import { TRPCError } from "@trpc/server";
import { type Prisma } from "@prisma/client";
import type { Listing } from "contracts/nft_marketplace/bindings/src/index";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildBuyXDR,
  buildCancelListingXDR,
  buildListForSaleXDR,
  buildMintXDR,
  getOnChainListing,
  getOnChainListings,
  getOnChainTokenBalance,
  getOnChainTokenMetadata,
  signNftXdr,
  verifyContractTransaction,
} from "~/lib/stellar/nft/marketplace";
import { humanPriceToRaw, NFT_MARKETPLACE_CONTRACT_ID, rawPriceToHuman } from "~/lib/common";
import { STELLAR_NETWORK_LABEL } from "~/lib/stellar/explorer";
import { SignUser } from "~/lib/stellar/utils";

const tokenIdInput = z.string().regex(/^\d+$/, "token id must be numeric");

// User ids are Stellar public keys (56-char strkeys) — never a valid match,
// used so the `likes` include can stay an unconditional array shape for
// logged-out requests instead of branching the query's return type.
const NO_SUCH_USER = "__anonymous__";

export const nftRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000),
        thumbnail: z.string().url(),
        contentUrl: z.string().url(),
        mediaType: z.string().min(1),
        copies: z.number().int().min(1).max(1_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Price isn't stored here — the real, on-chain-confirmed price is read
      // back from the contract's listing and written to `NftListing` in
      // `confirmMint`, once the mint transaction actually lands.
      return ctx.db.nft.create({
        data: {
          ...input,
          creatorId: ctx.session.user.id,
          status: "PENDING",
        },
      });
    }),

  // Cleans up the DB row `create` makes before minting is confirmed, for
  // when the wallet dialog is closed/cancelled or the transaction fails —
  // mirrors `bounty.Bounty.deleteUnfundedBounty`. Refuses to touch an
  // already-confirmed mint so a client can't delete a real, live NFT.
  deletePendingNft: protectedProcedure
    .input(z.object({ nftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (nft.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "Cannot delete a minted NFT" });
      }
      await ctx.db.nft.delete({ where: { id: input.nftId } });
      return { deleted: true };
    }),

  // Same two-step shape as the bounty escrow contract (see
  // `~/lib/stellar/bounty/escrow.ts`/`bounty.ts` router): build + sign here,
  // return the (possibly already fully-signed) XDR to the client, which
  // either submits it as-is (custodial) or signs it with the connected
  // wallet via `clientsign` — no wallet-specific signing code needed, and no
  // reliance on the SDK's own `signAndSend`/RPC result-decoding, which this
  // repo's pinned `@stellar/stellar-sdk` can't do reliably.
  getMintXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        price: z.number().positive(),
        royaltyBps: z.number().int().min(0).max(5000),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft || nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (nft.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "NFT already confirmed" });
      }

      const { xdr, tokenId } = await buildMintXDR({
        creatorPubKey: ctx.session.user.id,
        name: nft.name,
        description: nft.description,
        thumbnail: nft.thumbnail,
        contentUrl: nft.contentUrl,
        mediaType: nft.mediaType,
        copies: nft.copies,
        price: humanPriceToRaw(input.price),
        royaltyBps: input.royaltyBps,
      });
      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, tokenId: tokenId.toString(), fullySignedByServer };
    }),

  confirmMint: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        tokenId: tokenIdInput,
        txHash: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft || nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (nft.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "NFT already confirmed" });
      }

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const tokenId = BigInt(input.tokenId);
      const metadata = await getOnChainTokenMetadata(tokenId);
      if (!metadata || metadata.creator !== ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mint not found on-chain" });
      }
      const listing = await getOnChainListing(tokenId, ctx.session.user.id);
      if (!listing) throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not found on-chain" });

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.nft.update({
          where: { id: nft.id },
          data: {
            onChainTokenId: input.tokenId,
            txHash: input.txHash,
            status: "MINTED",
          },
        });
        await tx.nftOwnership.upsert({
          where: { nftId_ownerId: { nftId: nft.id, ownerId: ctx.session.user.id } },
          create: { nftId: nft.id, ownerId: ctx.session.user.id, quantity: nft.copies },
          update: { quantity: nft.copies },
        });
        await upsertNftListingFromChain(tx, nft.id, ctx.session.user.id, listing);
        await recomputeListingSummary(tx, nft.id);
        return updated;
      });
    }),

  // `copies` is deliberately NOT a client input — `list_for_sale` on the
  // contract fully overwrites the listing's available/total copies with
  // whatever number is passed, so this always re-reads the seller's live
  // on-chain balance rather than trusting a client-cached `heldQuantity`
  // that could be stale (e.g. right after buying more copies elsewhere).
  getListForSaleXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        price: z.number().positive(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const tokenId = BigInt(nft.onChainTokenId);
      const heldCopies = await getOnChainTokenBalance(tokenId, ctx.session.user.id);
      if (heldCopies <= 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't hold any copies of this NFT" });
      }

      const xdr = await buildListForSaleXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId,
        price: humanPriceToRaw(input.price),
        copies: heldCopies,
      });
      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, fullySignedByServer };
    }),

  confirmListing: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const tokenId = BigInt(nft.onChainTokenId);
      const listing = await getOnChainListing(tokenId, ctx.session.user.id);
      if (!listing) throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not found on-chain" });

      return ctx.db.$transaction(async (tx) => {
        await upsertNftListingFromChain(tx, nft.id, ctx.session.user.id, listing);
        await recomputeListingSummary(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  getCancelListingXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const xdr = await buildCancelListingXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: BigInt(nft.onChainTokenId),
      });
      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, fullySignedByServer };
    }),

  confirmCancelListing: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const tokenId = BigInt(nft.onChainTokenId);
      const listing = await getOnChainListing(tokenId, ctx.session.user.id);

      return ctx.db.$transaction(async (tx) => {
        await tx.nftListing.updateMany({
          where: { nftId: nft.id, sellerId: ctx.session.user.id },
          data: { isActive: listing?.is_active ?? false },
        });
        await recomputeListingSummary(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  getBuyXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        sellerId: z.string(),
        quantity: z.number().int().min(1),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sellerId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
      }
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const xdr = await buildBuyXDR({
        buyerPubKey: ctx.session.user.id,
        sellerPubKey: input.sellerId,
        tokenId: BigInt(nft.onChainTokenId),
        quantity: input.quantity,
      });
      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });
      return { xdr: signedXdr, fullySignedByServer };
    }),

  confirmBuy: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        sellerId: z.string(),
        txHash: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.onChainTokenId) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const tokenId = BigInt(nft.onChainTokenId);
      const listing = await getOnChainListing(tokenId, input.sellerId);
      if (!listing) throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not found on-chain" });
      // Bounds the client-claimed quantity against this specific listing's
      // edition size — the on-chain read is ground truth, this just catches
      // a caller lying about how many copies they claim to have bought.
      if (input.quantity > listing.total_copies) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quantity exceeds listing size" });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.nftListing.updateMany({
          where: { nftId: nft.id, sellerId: input.sellerId },
          data: {
            availableCopies: listing.available_copies,
            isActive: listing.is_active,
          },
        });
        await tx.nftOwnership.updateMany({
          where: { nftId: nft.id, ownerId: input.sellerId },
          data: { quantity: { decrement: input.quantity } },
        });
        await tx.nftOwnership.upsert({
          where: { nftId_ownerId: { nftId: nft.id, ownerId: ctx.session.user.id } },
          create: { nftId: nft.id, ownerId: ctx.session.user.id, quantity: input.quantity },
          update: { quantity: { increment: input.quantity } },
        });
        await recomputeListingSummary(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  // Each active listing is its own browsable card — a reseller's listing of
  // an already-minted NFT shows up as a distinct entry (marked "Resold by"),
  // not merged into the original mint's card, so resales are actually
  // discoverable as new inventory rather than hidden behind a seller picker.
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(24),
        search: z.string().trim().max(128).optional(),
        sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().positive().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const listings = await ctx.db.nftListing.findMany({
        where: {
          isActive: true,
          ...(input.search ? { nft: { name: { contains: input.search, mode: "insensitive" } } } : {}),
          ...(input.minPrice !== undefined || input.maxPrice !== undefined
            ? { price: { gte: input.minPrice, lte: input.maxPrice } }
            : {}),
        },
        orderBy:
          input.sort === "price_asc"
            ? { price: "asc" }
            : input.sort === "price_desc"
              ? { price: "desc" }
              : { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          seller: { select: { id: true, name: true, image: true } },
          nft: {
            include: {
              creator: { select: { id: true, name: true, image: true } },
              _count: { select: { likes: true } },
              likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (listings.length > input.limit) {
        const next = listings.pop();
        nextCursor = next?.id;
      }

      const items = listings.map((listing) => {
        const { likes, _count, ...nft } = listing.nft;
        return {
          id: nft.id,
          name: nft.name,
          thumbnail: nft.thumbnail,
          copies: nft.copies,
          status: nft.status,
          creator: nft.creator,
          lowestActivePrice: nft.lowestActivePrice,
          activeListingCount: nft.activeListingCount,
          likeCount: _count.likes,
          isLiked: likes.length > 0,
          listing: {
            sellerId: listing.sellerId,
            sellerName: listing.seller.name,
            sellerImage: listing.seller.image,
            price: listing.price,
            isResale: listing.sellerId !== nft.creatorId,
          },
        };
      });

      return { items, nextCursor };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.id },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          ownerships: {
            include: { owner: { select: { id: true, name: true, image: true } } },
          },
          listings: {
            where: { isActive: true },
            include: { seller: { select: { id: true, name: true, image: true } } },
            orderBy: { price: "asc" },
          },
          _count: { select: { likes: true } },
          likes: { where: { userId: userId ?? NO_SUCH_USER }, select: { id: true } },
        },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      return shapeLikes(nft);
    }),

  // Ground-truth read straight from the contract, independent of the cached
  // DB row — lets the manage page show real on-chain state (and flag it if
  // the cache has drifted) rather than just re-displaying what confirm*
  // already wrote.
  onChainInsights: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.id },
        select: {
          onChainTokenId: true,
          txHash: true,
          activeListingCount: true,
          lowestActivePrice: true,
        },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const base = {
        contractId: NFT_MARKETPLACE_CONTRACT_ID,
        network: STELLAR_NETWORK_LABEL,
        mintTxHash: nft.txHash,
      };

      if (!nft.onChainTokenId) {
        return { ...base, minted: false as const };
      }

      const tokenId = BigInt(nft.onChainTokenId);
      const [metadata, listings] = await Promise.all([
        getOnChainTokenMetadata(tokenId).catch(() => null),
        getOnChainListings(tokenId).catch(() => [] as Listing[]),
      ]);

      const onChainListings = listings.map((l) => ({
        seller: l.seller,
        price: rawPriceToHuman(l.price),
        availableCopies: l.available_copies,
        totalCopies: l.total_copies,
      }));
      const onChainLowestPrice =
        onChainListings.length > 0
          ? Math.min(...onChainListings.map((l) => l.price))
          : null;

      const verified =
        onChainListings.length === nft.activeListingCount &&
        onChainLowestPrice === nft.lowestActivePrice;

      return {
        ...base,
        minted: true as const,
        tokenId: nft.onChainTokenId,
        creator: metadata?.creator ?? null,
        royaltyBps: metadata?.royalty_bps ?? null,
        listings: onChainListings,
        lowestActivePrice: onChainLowestPrice,
        verified,
      };
    }),

  myCreated: protectedProcedure.query(({ ctx }) =>
    ctx.db.nft
      .findMany({
        where: { creatorId: ctx.session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          listings: { where: { sellerId: ctx.session.user.id } },
          ownerships: { where: { ownerId: ctx.session.user.id } },
          _count: { select: { likes: true } },
          likes: { where: { userId: ctx.session.user.id }, select: { id: true } },
        },
      })
      .then((items) =>
        items.map((nft) => {
          const { listings, ownerships, ...rest } = shapeLikes(nft);
          return {
            ...rest,
            myListing: listings[0] ?? null,
            heldQuantity: ownerships[0]?.quantity ?? 0,
          };
        }),
      ),
  ),

  myOwned: protectedProcedure.query(async ({ ctx }) => {
    const ownerships = await ctx.db.nftOwnership.findMany({
      where: { ownerId: ctx.session.user.id, quantity: { gt: 0 } },
      include: {
        nft: {
          include: {
            creator: { select: { id: true, name: true, image: true } },
            listings: { where: { sellerId: ctx.session.user.id } },
            _count: { select: { likes: true } },
            likes: { where: { userId: ctx.session.user.id }, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ownerships.map((o) => {
      const { listings, ...rest } = shapeLikes(o.nft);
      return { ...o, nft: { ...rest, myListing: listings[0] ?? null } };
    });
  }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const [listed, creators] = await Promise.all([
      ctx.db.nft.count({ where: { activeListingCount: { gt: 0 } } }),
      ctx.db.nft.findMany({
        where: { activeListingCount: { gt: 0 } },
        distinct: ["creatorId"],
        select: { creatorId: true },
      }),
    ]);
    return { listed, creators: creators.length };
  }),

  toggleLike: protectedProcedure
    .input(z.object({ nftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.nftLike.findUnique({
        where: { nftId_userId: { nftId: input.nftId, userId: ctx.session.user.id } },
      });
      if (existing) {
        await ctx.db.nftLike.delete({ where: { id: existing.id } });
        return { liked: false };
      }
      await ctx.db.nftLike.create({
        data: { nftId: input.nftId, userId: ctx.session.user.id },
      });
      return { liked: true };
    }),
});

function shapeLikes<T extends { _count: { likes: number }; likes: { id: string }[] }>(
  nft: T,
): Omit<T, "likes" | "_count"> & { likeCount: number; isLiked: boolean } {
  const { likes, _count, ...rest } = nft;
  return { ...rest, likeCount: _count.likes, isLiked: likes.length > 0 };
}

// Mirrors an on-chain `Listing` into the (nftId, sellerId) row — same shape
// needed after mint, list_for_sale, and re-listing, whether confirmed from a
// client-signed tx or a custodial one.
async function upsertNftListingFromChain(
  tx: Prisma.TransactionClient,
  nftId: string,
  sellerId: string,
  listing: Listing,
) {
  const data = {
    price: rawPriceToHuman(listing.price),
    availableCopies: listing.available_copies,
    totalCopies: listing.total_copies,
    isActive: listing.is_active,
  };
  await tx.nftListing.upsert({
    where: { nftId_sellerId: { nftId, sellerId } },
    create: { nftId, sellerId, ...data },
    update: data,
  });
}

// Denormalized onto `Nft` so browse/sort views don't need a live aggregate
// per card — recomputed after every listing write (mint/list/cancel/buy).
async function recomputeListingSummary(tx: Prisma.TransactionClient, nftId: string) {
  const agg = await tx.nftListing.aggregate({
    where: { nftId, isActive: true },
    _min: { price: true },
    _count: true,
  });
  await tx.nft.update({
    where: { id: nftId },
    data: {
      lowestActivePrice: agg._min.price,
      activeListingCount: agg._count,
    },
  });
}

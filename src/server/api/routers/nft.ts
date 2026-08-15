import { TRPCError } from "@trpc/server";
import { type Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildBuyXDR,
  buildCancelListingXDR,
  buildListXDR,
  buildMintAndListXDR,
  getOnChainArtMeta,
  getOnChainBalance,
  getOnChainListing,
  getOnChainOwner,
  getSaleBreakdown,
  getTokenIdByRef,
  pollUntilVisible,
  signArtXdr,
  verifyContractTransaction,
} from "~/lib/stellar/oz/nft";
import { ART_NFT_CONTRACT_ID } from "~/lib/common";
import {
  MAX_ROYALTY_BPS,
  humanPriceToRaw,
  rawPriceToHuman,
} from "~/lib/stellar/constant";
import { STELLAR_NETWORK_LABEL } from "~/lib/stellar/explorer";
import { SignUser } from "~/lib/stellar/utils";

// User ids are Stellar public keys (56-char strkeys) — never a valid match,
// used so the `likes` include can stay an unconditional array shape for
// logged-out requests instead of branching the query's return type.
const NO_SUCH_USER = "__anonymous__";

/**
 * `lowestActivePrice`/`activeListingCount` are read by the marketplace grid,
 * collection cards and stats. They're a cache of `listings`, so every mutation
 * that touches a listing has to recompute them or the UI silently reports
 * zeroes forever.
 */
async function refreshListingAggregates(
  tx: Prisma.TransactionClient,
  nftId: string,
) {
  const active = await tx.nftListing.findMany({
    where: { nftId, isActive: true },
    select: { price: true },
  });
  await tx.nft.update({
    where: { id: nftId },
    data: {
      activeListingCount: active.length,
      lowestActivePrice: active.length
        ? Math.min(...active.map((l) => l.price))
        : null,
    },
  });
}

/**
 * A listing's seller is a Stellar public key read straight from the
 * contract, which doubles as `User.id` in this app — so a small batch lookup
 * is enough to attach display name/avatar to on-chain listing data without
 * needing a cached `NftListing.seller` join for it.
 */
async function sellerInfoById(
  db: Prisma.TransactionClient,
  sellerIds: string[],
): Promise<Map<string, { name: string | null; image: string | null }>> {
  if (sellerIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(sellerIds)] } },
    select: { id: true, name: true, image: true },
  });
  return new Map(users.map((u) => [u.id, { name: u.name, image: u.image }]));
}

/**
 * Whether `account` currently owns `nft`, read live. Used only for bounded,
 * personal-scope views (`myCreated`, `myOwned`) — never for the public
 * marketplace grid, where doing this per row would mean one RPC call per
 * listing on every page load.
 */
async function liveHeldQuantity(
  nft: { contractAddress: string | null; onChainTokenId: string | null },
  account: string,
): Promise<number> {
  if (!nft.contractAddress || !nft.onChainTokenId) return 0;
  const owner = await getOnChainOwner(Number(nft.onChainTokenId));
  return owner === account ? 1 : 0;
}

/** Loads an NFT the caller owns a stake in, or throws. */
async function requireMinted(
  db: Prisma.TransactionClient,
  nftId: string,
) {
  const nft = await db.nft.findUnique({ where: { id: nftId } });
  if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
  if (nft.status !== "MINTED" || !nft.contractAddress) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This artwork hasn't finished minting on-chain yet",
    });
  }
  return nft;
}

export const nftRouter = createTRPCRouter({
  // The row is created before anything touches the chain so the mint has a
  // stable id to use as its on-chain `art_ref` — that reference is what lets
  // `confirmMint` find the minted token afterwards.
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(128),
        description: z.string().trim().max(2000),
        thumbnail: z.string().url(),
        contentUrl: z.string().url(),
        mediaType: z.string().min(1),
        royaltyBps: z.number().int().min(0).max(MAX_ROYALTY_BPS).default(0),
        collectionId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.nft.create({
        data: {
          name: input.name,
          description: input.description,
          thumbnail: input.thumbnail,
          contentUrl: input.contentUrl,
          mediaType: input.mediaType,
          royaltyBps: input.royaltyBps,
          collectionId: input.collectionId,
          creatorId: ctx.session.user.id,
          status: "PENDING",
        },
      });
    }),

  // Cleans up the row `create` makes before minting is confirmed, for when the
  // wallet dialog is closed/cancelled or the transaction fails. Refuses to
  // touch an already-confirmed mint so a client can't delete a live artwork.
  deletePendingNft: protectedProcedure
    .input(z.object({ nftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (nft.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "Cannot delete a minted artwork" });
      }
      await ctx.db.nft.delete({ where: { id: input.nftId } });
      return { deleted: true };
    }),

  // Build + sign here, return the (possibly already fully-signed) XDR to the
  // client, which either submits it as-is (custodial) or signs it with the
  // connected wallet via `clientsign`. Same shape as the bounty escrow flow.
  //
  // One signature creates AND lists — the contract does both atomically (see
  // `mint_and_list`). There used to be a separate `list` transaction after
  // minting, which needed to read the mint's effects back through the public
  // Soroban RPC pool before it could be built; that pool doesn't always agree
  // with itself in the first few seconds after a ledger closes, so that
  // second transaction could be built from stale state and fail in ways that
  // were confusing to debug and to hit. Folding listing into the mint removes
  // the second transaction, and the race, entirely.
  getMintXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        price: z.number().positive(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft || nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (nft.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "Already minted" });
      }

      const priceRaw = humanPriceToRaw(input.price);
      const xdr = await buildMintAndListXDR({
        creatorPubKey: ctx.session.user.id,
        artRef: nft.id,
        title: nft.name,
        description: nft.description,
        thumbnailUrl: nft.thumbnail,
        mediaUrl: nft.contentUrl,
        mediaType: nft.mediaType,
        royaltyBps: nft.royaltyBps,
        priceRaw,
      });
      const contractAddress = ART_NFT_CONTRACT_ID;

      await ctx.db.nft.update({
        where: { id: nft.id },
        data: { contractAddress },
      });

      const signed = await signArtXdr({ xdr, signWith: input.signWith });
      return { ...signed, contractAddress };
    }),

  // Confirms against the chain rather than trusting the client: the token id
  // and the listing it was created with are read back from the contract, so a
  // client that lies about its txHash can't fabricate a minted, listed
  // artwork. This is the only confirmation step for a new artwork — minting
  // and listing landed in the same transaction, so there's nothing left for
  // `confirmListing` to separately verify here (it's still used later, for
  // price changes and re-listing from the manage page).
  confirmMint: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const nftRow = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nftRow || nftRow.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (nftRow.status !== "PENDING") {
        throw new TRPCError({ code: "CONFLICT", message: "Already minted" });
      }
      // Reassigned to a non-nullable binding so the closure below doesn't
      // need to re-narrow `nftRow` across a nested async function boundary.
      const nft = nftRow;

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transaction did not succeed on-chain",
        });
      }

      // Quantity is deliberately not part of this result — the contract's
      // `Listing` is the only source of truth for how many units are for
      // sale, read live wherever it's displayed rather than cached here.
      async function resolveMintedListing(): Promise<{
        onChainTokenId: string | null;
        price: number;
        paymentToken: string;
      }> {
        const tokenId = await getTokenIdByRef(nft.id);
        if (tokenId === null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mint did not register on-chain",
          });
        }
        const listing = await pollUntilVisible(() => getOnChainListing(tokenId));
        if (!listing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Listing was not found on-chain",
          });
        }
        return {
          onChainTokenId: String(tokenId),
          price: rawPriceToHuman(listing.price),
          paymentToken: listing.payment_token,
        };
      }

      const { onChainTokenId, price, paymentToken } = await resolveMintedListing();

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.nft.update({
          where: { id: nft.id },
          data: { onChainTokenId, txHash: input.txHash, status: "MINTED" },
        });
        await tx.nftOwnership.upsert({
          where: { nftId_ownerId: { nftId: nft.id, ownerId: ctx.session.user.id } },
          create: { nftId: nft.id, ownerId: ctx.session.user.id },
          update: {},
        });
        await tx.nftListing.upsert({
          where: { nftId_sellerId: { nftId: nft.id, sellerId: ctx.session.user.id } },
          create: { nftId: nft.id, sellerId: ctx.session.user.id, price, paymentToken, isActive: true },
          update: { price, paymentToken, isActive: true },
        });
        await refreshListingAggregates(tx, nft.id);
        return updated;
      });
    }),

  getListXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        price: z.number().positive(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await requireMinted(ctx.db, input.nftId);
      const priceRaw = humanPriceToRaw(input.price);

      const xdr = await buildListXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: Number(nft.onChainTokenId),
        priceRaw,
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Mirrors the listing the contract actually recorded rather than echoing the
  // client's numbers back into the database.
  confirmListing: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const nft = await requireMinted(ctx.db, input.nftId);

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const onChain = await getOnChainListing(Number(nft.onChainTokenId));

      if (!onChain) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No listing found on-chain" });
      }

      const price = rawPriceToHuman(onChain.price);

      return ctx.db.$transaction(async (tx) => {
        await tx.nftListing.upsert({
          where: { nftId_sellerId: { nftId: nft.id, sellerId: ctx.session.user.id } },
          create: {
            nftId: nft.id,
            sellerId: ctx.session.user.id,
            price,
            paymentToken: onChain.payment_token,
            isActive: true,
          },
          update: { price, paymentToken: onChain.payment_token, isActive: true },
        });
        await refreshListingAggregates(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  getCancelListingXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const nft = await requireMinted(ctx.db, input.nftId);

      const xdr = await buildCancelListingXDR({
        sellerPubKey: ctx.session.user.id,
        tokenId: Number(nft.onChainTokenId),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  confirmCancelListing: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const nft = await requireMinted(ctx.db, input.nftId);

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.nftListing.updateMany({
          where: { nftId: nft.id, sellerId: ctx.session.user.id },
          data: { isActive: false },
        });
        await refreshListingAggregates(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  /** What the buyer will actually pay, read from the contract. */
  saleQuote: publicProcedure
    .input(
      z.object({
        nftId: z.string(),
        sellerId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.contractAddress) throw new TRPCError({ code: "NOT_FOUND" });

      const breakdown = await getSaleBreakdown(Number(nft.onChainTokenId));

      if (!breakdown) return null;
      return {
        total: rawPriceToHuman(breakdown.total),
        platformFee: rawPriceToHuman(breakdown.platform_fee),
        royalty: rawPriceToHuman(breakdown.royalty),
        sellerAmount: rawPriceToHuman(breakdown.seller_amount),
      };
    }),

  // A single contract call settles payment and delivery together, so there is
  // no window where the buyer has paid but not received (or vice versa), and
  // only the buyer signs.
  getBuyXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        sellerId: z.string(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sellerId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't buy your own listing" });
      }
      const nft = await requireMinted(ctx.db, input.nftId);

      const xdr = await buildBuyXDR({
        buyerPubKey: ctx.session.user.id,
        tokenId: Number(nft.onChainTokenId),
      });

      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  // Reconciles the cache against what the contract now reports, instead of
  // applying the client's claimed quantity blindly.
  confirmBuy: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        sellerId: z.string(),
        txHash: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await requireMinted(ctx.db, input.nftId);
      const buyerId = ctx.session.user.id;

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction did not succeed on-chain" });
      }

      const sellerListing = await getOnChainListing(Number(nft.onChainTokenId));
      const remaining = sellerListing ? 1 : 0;

      return ctx.db.$transaction(async (tx) => {
        await tx.nftOwnership.upsert({
          where: { nftId_ownerId: { nftId: nft.id, ownerId: buyerId } },
          create: { nftId: nft.id, ownerId: buyerId },
          update: {},
        });
        await tx.nftListing.updateMany({
          where: { nftId: nft.id, sellerId: input.sellerId },
          data: { isActive: remaining > 0 },
        });
        await refreshListingAggregates(tx, nft.id);
        return tx.nft.findUniqueOrThrow({ where: { id: nft.id } });
      });
    }),

  // Each active listing is its own browsable card — a reseller's listing of an
  // already-minted artwork shows up as a distinct entry (marked "Resold by"),
  // not merged into the original mint's card, so resales are discoverable as
  // new inventory rather than hidden behind a seller picker.
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
          ...(input.search
            ? {
                nft: {
                  name: { contains: input.search, mode: "insensitive" as const },
                },
              }
            : {}),
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
          mediaType: nft.mediaType,
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
          // Existence rows only now — how much each holder has is read live
          // from chain (see `onChainInsights`), not from this table.
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
  // DB row — lets the manage page show real on-chain state (and flag it if the
  // cache has drifted) rather than re-displaying what confirm* already wrote.
  onChainInsights: publicProcedure
    .input(z.object({ id: z.string(), account: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.id } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const account = input.account ?? ctx.session?.user?.id;
      const base = {
        contractId: nft.contractAddress,
        network: STELLAR_NETWORK_LABEL,
        mintTxHash: nft.txHash,
        account: account ?? null,
      };

      if (nft.status !== "MINTED" || !nft.contractAddress) {
        return { ...base, minted: false as const };
      }

      const tokenId = Number(nft.onChainTokenId);
      const [owner, meta, balance, listing] = await Promise.all([
        getOnChainOwner(tokenId),
        getOnChainArtMeta(tokenId),
        account ? getOnChainBalance(account) : Promise.resolve(0),
        getOnChainListing(tokenId),
      ]);
      const sellerInfo = listing ? (await sellerInfoById(ctx.db, [listing.seller])).get(listing.seller) : null;

      return {
        ...base,
        minted: true as const,
        tokenId: nft.onChainTokenId,
        owner,
        title: meta?.title ?? null,
        description: meta?.description ?? null,
        royaltyBps: nft.royaltyBps,
        thumbnailUrl: meta?.thumbnail_url ?? null,
        mediaUrl: meta?.media_url ?? null,
        creator: meta?.creator ?? null,
        userBalance: balance,
        listings: listing
          ? [
              {
                sellerId: listing.seller,
                sellerName: sellerInfo?.name ?? null,
                sellerImage: sellerInfo?.image ?? null,
                pricePerCopy: rawPriceToHuman(listing.price),
                available: 1,
              },
            ]
          : [],
        verified: meta !== null,
      };
    }),

  myCreated: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.nft.findMany({
      where: { creatorId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listings: { where: { sellerId: ctx.session.user.id } },
        _count: { select: { likes: true } },
        likes: { where: { userId: ctx.session.user.id }, select: { id: true } },
      },
    });
    return Promise.all(
      items.map(async (nft) => {
        const { listings, ...rest } = shapeLikes(nft);
        const heldQuantity =
          nft.status === "MINTED" ? await liveHeldQuantity(nft, ctx.session.user.id) : 0;
        return { ...rest, myListing: listings[0] ?? null, heldQuantity };
      }),
    );
  }),

  myOwned: protectedProcedure.query(async ({ ctx }) => {
    const ownerships = await ctx.db.nftOwnership.findMany({
      where: { ownerId: ctx.session.user.id },
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

    // `NftOwnership` is only an existence index (see the schema) — filtering
    // on "still holds more than zero" has to happen against a live balance,
    // not a cached column, since the whole point of removing that column was
    // to stop trusting a number that could be stale the moment someone buys,
    // sells, or transfers outside this app's own confirm* calls.
    const withQuantity = await Promise.all(
      ownerships.map(async (o) => ({
        ...o,
        quantity:
          o.nft.status === "MINTED" ? await liveHeldQuantity(o.nft, ctx.session.user.id) : 0,
      })),
    );

    return withQuantity
      .filter((o) => o.quantity > 0)
      .map((o) => {
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

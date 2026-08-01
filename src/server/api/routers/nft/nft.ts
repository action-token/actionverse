import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildMintNftXDR,
  buildBuyNftXDR,
  buildCancelListingXDR,
  buildTransferXDR,
  verifyContractTransaction,
  signNftXdr,
} from "~/lib/stellar/nft/marketplace";
import { SignUser } from "~/lib/stellar/utils";
import { TRPCError } from "@trpc/server";

export const NftRouter = createTRPCRouter({
  // ── Create NFT (in DB) ─────────────────────────────────────────────
  createNft: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000),
        thumbnail: z.string().url(),
        contentUrl: z.string().url(),
        mediaType: z.enum(["image", "video", "audio", "3d"]),
        copies: z.number().int().positive(),
        price: z.number().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.create({
        data: {
          name: input.name,
          description: input.description,
          thumbnail: input.thumbnail,
          contentUrl: input.contentUrl,
          mediaType: input.mediaType,
          copies: input.copies,
          price: input.price,
          creatorId: ctx.session.user.id,
        },
      });

      return nft;
    }),

  // ── Get Mint XDR ───────────────────────────────────────────────────
  getMintNftXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.nftId },
      });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const xdr = await buildMintNftXDR({
        creatorPubKey: ctx.session.user.id,
        name: nft.name,
        description: nft.description,
        thumbnail: nft.thumbnail,
        contentUrl: nft.contentUrl,
        mediaType: nft.mediaType,
        copies: nft.copies,
        price: nft.price,
      });

      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });

      return { xdr: signedXdr, fullySignedByServer };
    }),

  // ── Confirm NFT Minted ─────────────────────────────────────────────
  confirmNftMinted: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string(), onChainTokenId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction failed on-chain" });
      }

      return await ctx.db.nft.update({
        where: { id: input.nftId },
        data: {
          txHash: input.txHash,
          onChainTokenId: input.onChainTokenId,
          status: "LISTED",
        },
      });
    }),

  // ── Buy NFT ────────────────────────────────────────────────────────
  getBuyNftXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), quantity: z.number().int().positive(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (!nft.onChainTokenId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "NFT not minted on-chain yet" });
      }

      const xdr = await buildBuyNftXDR({
        buyerPubKey: ctx.session.user.id,
        tokenId: BigInt(nft.onChainTokenId),
        quantity: input.quantity,
      });

      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });

      return { xdr: signedXdr, fullySignedByServer, totalPrice: nft.price * input.quantity };
    }),

  confirmNftPurchased: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string(), quantity: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction failed on-chain" });
      }

      // Record ownership
      const ownership = await ctx.db.nftOwnership.upsert({
        where: {
          nftId_ownerId: {
            nftId: input.nftId,
            ownerId: ctx.session.user.id,
          },
        },
        update: {
          quantity: { increment: input.quantity },
        },
        create: {
          nftId: input.nftId,
          ownerId: ctx.session.user.id,
          quantity: input.quantity,
        },
      });

      // Update available copies
      await ctx.db.nft.update({
        where: { id: input.nftId },
        data: {
          availableCopies: { decrement: input.quantity },
        },
      });

      return ownership;
    }),

  // ── Cancel Listing ─────────────────────────────────────────────────
  getCancelListingXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!nft.onChainTokenId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "NFT not minted on-chain yet" });
      }

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

  confirmListingCancelled: protectedProcedure
    .input(z.object({ nftId: z.string(), txHash: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ok = await verifyContractTransaction(input.txHash);
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction failed on-chain" });
      }

      return await ctx.db.nft.update({
        where: { id: input.nftId },
        data: { status: "UNLISTED" },
      });
    }),

  // ── Transfer NFT ───────────────────────────────────────────────────
  getTransferXDR: protectedProcedure
    .input(z.object({ nftId: z.string(), toPubKey: z.string(), signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      const ownership = await ctx.db.nftOwnership.findUnique({
        where: {
          nftId_ownerId: {
            nftId: input.nftId,
            ownerId: ctx.session.user.id,
          },
        },
        include: { nft: true },
      });
      if (!ownership || ownership.quantity < 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't own this NFT" });
      }
      if (!ownership.nft.onChainTokenId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const xdr = await buildTransferXDR({
        fromPubKey: ctx.session.user.id,
        toPubKey: input.toPubKey,
        tokenId: BigInt(ownership.nft.onChainTokenId),
      });

      const { xdr: signedXdr, fullySignedByServer } = await signNftXdr({
        xdr,
        signWith: input.signWith,
      });

      return { xdr: signedXdr, fullySignedByServer };
    }),

  // ── Read Operations ────────────────────────────────────────────────
  getNfts: publicProcedure
    .input(
      z.object({
        status: z.enum(["LISTED", "UNLISTED", "SOLD"]).optional(),
        limit: z.number().default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const nfts = await ctx.db.nft.findMany({
        where: {
          ...(input.status && { status: input.status }),
          txHash: { not: null }, // Only show minted NFTs
        },
        include: {
          creator: { select: { id: true, name: true, image: true } },
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (nfts.length > input.limit) {
        const nextItem = nfts.pop();
        nextCursor = nextItem?.id;
      }

      return { nfts, nextCursor };
    }),

  getNftById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({
        where: { id: input.id },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          ownerships: {
            include: { owner: { select: { id: true, name: true, image: true } } },
          },
        },
      });
      return nft;
    }),

  getMyOwnedNfts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.nftOwnership.findMany({
      where: { ownerId: ctx.session.user.id, quantity: { gt: 0 } },
      include: {
        nft: {
          include: {
            creator: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getMyCreatedNfts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.nft.findMany({
      where: { creatorId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),
});

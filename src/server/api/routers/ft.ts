import { NftKind } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildTransferEditionXDR,
  getEditionBalance,
  getEditionListings,
  getEditionMeta,
  getEditionSupply,
} from "~/lib/stellar/oz/ft";
import { signArtXdr } from "~/lib/stellar/oz/nft";
import { rawPriceToHuman } from "~/lib/stellar/constant";
import { SignUser } from "~/lib/stellar/utils";

/**
 * Editions are fungible artwork tokens, one contract per piece. Creating one
 * is a mint, so it lives in `nft.getMintXDR`/`nft.confirmMint` alongside 1-of-1
 * minting; what's left here is edition-specific state that has no NFT analogue.
 */
export const ftRouter = createTRPCRouter({
  /**
   * Symbols are unique per platform. This checks the database rather than the
   * chain: each edition is its own contract, so there is no single contract to
   * ask, and the database is what actually enforces the constraint.
   */
  checkSymbolAvailability: publicProcedure
    .input(z.object({ symbol: z.string().trim().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      const symbol = input.symbol.toUpperCase().trim();

      if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
        return {
          available: false,
          symbol,
          message: "Use 1-12 letters or digits only",
        };
      }

      const taken = await ctx.db.nft.findFirst({
        where: { symbol },
        select: { id: true },
      });

      return taken
        ? {
            available: false,
            symbol,
            message: `"${symbol}" is already taken. Pick another symbol.`,
          }
        : { available: true, symbol, message: `"${symbol}" is available` };
    }),

  /** Live on-chain state for one edition: supply, holdings, open listings. */
  editionState: publicProcedure
    .input(z.object({ nftId: z.string(), account: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) throw new TRPCError({ code: "NOT_FOUND" });
      if (nft.kind !== NftKind.EDITION || !nft.contractAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This artwork is not an edition",
        });
      }

      const account = input.account ?? ctx.session?.user?.id;
      const [meta, supply, balance, listings] = await Promise.all([
        getEditionMeta(nft.contractAddress),
        getEditionSupply(nft.contractAddress),
        account
          ? getEditionBalance(nft.contractAddress, account)
          : Promise.resolve(0),
        getEditionListings(nft.contractAddress),
      ]);

      return {
        contractId: nft.contractAddress,
        symbol: nft.symbol,
        // No DB fallback: if the contract read hasn't caught up yet, the
        // honest answer is "not known yet," not a stale cached number.
        editionSize: meta ? Number(meta.edition_size) : 0,
        // Diverges from `editionSize` once holders burn copies.
        circulatingSupply: supply,
        royaltyBps: meta?.royalty_bps ?? nft.royaltyBps,
        creator: meta?.creator ?? null,
        myBalance: balance,
        account: account ?? null,
        listings: listings.map((l) => ({
          sellerId: l.seller,
          pricePerCopy: rawPriceToHuman(l.price),
          available: Number(l.available),
          paymentToken: l.payment_token,
        })),
      };
    }),

  /** How many copies the signed-in user holds of a given edition. */
  myBalance: protectedProcedure
    .input(z.object({ nftId: z.string() }))
    .query(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.contractAddress || nft.kind !== NftKind.EDITION) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        account: ctx.session.user.id,
        balance: await getEditionBalance(nft.contractAddress, ctx.session.user.id),
      };
    }),

  /** Gifts copies directly, outside the marketplace — no payment involved. */
  getTransferXDR: protectedProcedure
    .input(
      z.object({
        nftId: z.string(),
        to: z.string().regex(/^G[A-Z2-7]{55}$/, "not a Stellar account"),
        quantity: z.number().int().min(1),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nft = await ctx.db.nft.findUnique({ where: { id: input.nftId } });
      if (!nft?.contractAddress || nft.kind !== NftKind.EDITION) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (input.to === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That's your own address" });
      }

      const held = await getEditionBalance(nft.contractAddress, ctx.session.user.id);
      if (held < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You only hold ${held} cop${held === 1 ? "y" : "ies"}`,
        });
      }

      const xdr = await buildTransferEditionXDR({
        contractId: nft.contractAddress,
        fromPubKey: ctx.session.user.id,
        toPubKey: input.to,
        quantity: input.quantity,
      });
      return signArtXdr({ xdr, signWith: input.signWith });
    }),
});

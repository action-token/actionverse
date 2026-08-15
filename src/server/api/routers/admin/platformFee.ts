import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { PLATFORM_TREASURY_ADDRESS } from "~/lib/common";
import {
  DEFAULT_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
} from "~/lib/stellar/constant";
import {
  buildSetPlatformFeeXDR,
  getOnChainPlatformFeeBps,
  getOnChainTreasury,
  signArtXdr,
} from "~/lib/stellar/oz/nft";
import { SignUser } from "~/lib/stellar/utils";

/**
 * The 1-of-1 collection is one shared contract owned by the platform, so its
 * fee is changeable on-chain here and applies to every future sale.
 */
export const platformFeeRouter = createTRPCRouter({
  getPlatformFee: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.appConfig.findFirst();
    const [collectionFeeBps, collectionTreasury] = await Promise.all([
      getOnChainPlatformFeeBps(),
      getOnChainTreasury(),
    ]);

    const storedBps = config?.platformFeeBps ?? DEFAULT_PLATFORM_FEE_BPS;
    return {
      platformFeeBps: storedBps,
      platformFeePercent: storedBps / 100,
      platformFeeRecipient:
        config?.platformFeeRecipient ?? PLATFORM_TREASURY_ADDRESS,
      // What the shared 1-of-1 contract actually enforces right now. If this
      // disagrees with the stored value, the on-chain figure is the real one.
      collection:
        collectionFeeBps === null
          ? null
          : { feeBps: collectionFeeBps, treasury: collectionTreasury },
    };
  }),

  /** Changes the fee on the shared 1-of-1 collection contract. */
  getSetCollectionFeeXDR: adminProcedure
    .input(
      z.object({
        feeBps: z.number().int().min(0).max(MAX_PLATFORM_FEE_BPS),
        treasury: z.string().regex(/^G[A-Z2-7]{55}$/, "not a Stellar account"),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const xdr = await buildSetPlatformFeeXDR({
        adminPubKey: ctx.session.user.id,
        feeBps: input.feeBps,
        treasury: input.treasury,
      });
      return signArtXdr({ xdr, signWith: input.signWith });
    }),

  /**
   * The platform fee stored in `AppConfig`. Capped at the contract's own hard
   * limit so the UI can't offer a value the chain would reject.
   */
  setPlatformFee: adminProcedure
    .input(
      z.object({
        platformFeeBps: z.number().int().min(0).max(MAX_PLATFORM_FEE_BPS),
        platformFeeRecipient: z
          .string()
          .regex(/^G[A-Z2-7]{55}$/, "not a Stellar account")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.appConfig.findFirst();
      if (existing) {
        return ctx.db.appConfig.update({
          where: { id: existing.id },
          data: {
            platformFeeBps: input.platformFeeBps,
            ...(input.platformFeeRecipient
              ? { platformFeeRecipient: input.platformFeeRecipient }
              : {}),
          },
        });
      }
      return ctx.db.appConfig.create({
        data: {
          nearbyPinRadius: 10.0,
          platformFeeBps: input.platformFeeBps,
          platformFeeRecipient:
            input.platformFeeRecipient ?? PLATFORM_TREASURY_ADDRESS,
        },
      });
    }),
});

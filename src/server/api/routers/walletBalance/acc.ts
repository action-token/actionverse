import { sign } from "crypto";
import { add } from "date-fns";
import { z } from "zod";
import { SignUser } from "~/lib/stellar/utils";
import {
  AddAssetTrustLine,
  BalanceWithHomeDomain,
  AcceptClaimableBalance,
  NativeBalance,
  PendingAssetList,
  RecentTransactionHistory,
  SendAssets,
  DeclineClaimableBalance,
  CheckHasTrustLineOnPlatformAsset,
  PlatformAssetBalance,
  SendAssetFromStroage,
  PageAssetBalance,
} from "~/lib/stellar/walletBalance/acc";
import { User } from "firebase/auth";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { getAccSecretFromRubyApi } from "package/connect_wallet/src/lib/stellar/get-acc-secret";
import { Input } from "~/components/shadcn/ui/input";

export const WBalanceRouter = createTRPCRouter({
  getWalletsBalance: protectedProcedure.input(z.object({
    creatorStorageId: z.string().nullish(),
    isCreatorMode: z.boolean().nullish(),
  })).query(async ({ ctx, input }) => {
    const userId = (input.creatorStorageId && input.isCreatorMode) ? input.creatorStorageId : ctx.session.user.id;
    return await BalanceWithHomeDomain({ userPub: userId });
  }),
  getPageAssetBalance: protectedProcedure.input(z.object({
    creatorStorageId: z.string(),
    isCreatorMode: z.boolean().nullish(),
  })).query(async ({ ctx, input }) => {
    const creator = await ctx.db.creator.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      include: {
        pageAsset: true,
      }
    });
    if (!creator) {
      throw new Error("Creator not found");
    }
    if (creator.storagePub !== input.creatorStorageId) {
      throw new Error("Invalid creator storage ID");
    }
    let assetCode, assetIssuer;
    if (creator.pageAsset) {
      assetCode = creator.pageAsset.code;
      assetIssuer = creator.pageAsset.issuer;
    }
    else if (creator.customPageAssetCodeIssuer) {
      const [code, issuer] = creator.customPageAssetCodeIssuer.split("-");
      assetCode = code;
      assetIssuer = issuer;
    }
    return await PageAssetBalance({ userPub: input.creatorStorageId, code: assetCode ?? "", issuer: assetIssuer ?? "" });

  }),
  getNativeBalance: protectedProcedure.query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    return await NativeBalance({ userPub: userId });
  }),
  sendWalletAssets: protectedProcedure
    .input(
      z.object({
        creatorStorageId: z.string().nullish(),
        isCreatorMode: z.boolean().nullish(),
        recipientId: z.string().min(1, {
          message: "Recipient Id is required.",
        }),
        amount: z.number().positive({
          message: "Amount must be greater than zero.",
        }),
        asset_code: z.string().min(1, {
          message: "Asset code is required.",
        }),
        asset_type: z.string().min(1, {
          message: "Asset type is required.",
        }),
        asset_issuer: z.string().min(1, {
          message: "Asset Issuer is required.",
        }),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = (input.creatorStorageId && input.isCreatorMode) ? input.creatorStorageId : ctx.session.user.id;

      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }
      if (input.isCreatorMode && input.creatorStorageId) {
        const creator = await ctx.db.creator.findUnique({
          where: {
            id: ctx.session.user.id,
          },
        });
        if (!creator) {
          throw new Error("Creator not found");
        }
        if (creator.storagePub !== input.creatorStorageId) {
          throw new Error("Invalid creator storage ID");
        }
        console.log("creator.storageSecret", creator.storageSecret);
        secretKey = creator.storageSecret
      }
      if (input.creatorStorageId && input.isCreatorMode && secretKey) {
        return await SendAssetFromStroage({
          userPubKey: userPubKey,
          recipientId: input.recipientId,
          amount: input.amount,
          asset_code: input.asset_code,
          asset_type: input.asset_type,
          asset_issuer: input.asset_issuer,
          secretKey: secretKey,
        });
      }
      else {
        return await SendAssets({
          userPubKey: userPubKey,
          recipientId: input.recipientId,
          amount: input.amount,
          asset_code: input.asset_code,
          asset_type: input.asset_type,
          asset_issuer: input.asset_issuer,
          signWith: input.signWith,
          secretKey: secretKey,
        });
      }
    }),

  addTrustLine: protectedProcedure
    .input(
      z.object({
        // trustLimit: z.number().positive({
        //   message: "Trust Limit must be greater than zero.",
        // }),
        asset_code: z.string().min(1, {
          message: "Asset code is required.",
        }),

        asset_issuer: z.string().min(1, {
          message: "Asset Issuer is required.",
        }),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = ctx.session.user.id;
      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }
      return await AddAssetTrustLine({
        userPubKey: userPubKey,
        asset_code: input.asset_code,
        asset_issuer: input.asset_issuer,
        signWith: input.signWith,
        secretKey: secretKey,
      });
    }),

  getTransactionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish().default(10),
        cursor: z.string().nullish(),
        creatorStorageId: z.string().nullish(),
        isCreatorMode: z.boolean().nullish(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = (input.creatorStorageId && input.isCreatorMode) ? input.creatorStorageId : ctx.session.user.id;

      const result = await RecentTransactionHistory({ userPubKey: userId, input });
      return {
        items: result.items,
        nextCursor: result.nextCursor,
      };
    }),

  getPendingAssetList: protectedProcedure.query(async ({ ctx, input }) => {
    const userPubKey = ctx.session.user.id;
    return await PendingAssetList({ userPubKey: userPubKey });
  }),

  claimBalance: protectedProcedure
    .input(
      z.object({
        // trustLimit: z.number().positive({
        //   message: "Trust Limit must be greater than zero.",
        // }),
        balanceId: z.string().min(1, {
          message: "BalanceId is required.",
        }),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = ctx.session.user.id;
      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }
      return await AcceptClaimableBalance({
        userPubKey: userPubKey,
        balanceId: input.balanceId,
        signWith: input.signWith,
        secretKey: secretKey,
      });
    }),

  declineClaimBalance: protectedProcedure
    .input(
      z.object({
        // trustLimit: z.number().positive({
        //   message: "Trust Limit must be greater than zero.",
        // }),
        balanceId: z.string().min(1, {
          message: "BalanceId is required.",
        }),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = ctx.session.user.id;
      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }
      return await DeclineClaimableBalance({
        pubKey: userPubKey,
        balanceId: input.balanceId,
        signWith: input.signWith,
        secretKey: secretKey,
      });
    }),

  checkingPlatformTrustLine: protectedProcedure.query(
    async ({ ctx, input }) => {
      const userPubKey = ctx.session.user.id;
      return await CheckHasTrustLineOnPlatformAsset({ userPubKey: userPubKey });
    },
  ),
  getPlatformAssetBalance: protectedProcedure.query(async ({ ctx, input }) => {
    const userPubKey = ctx.session.user.id;
    return await PlatformAssetBalance({ userPubKey: userPubKey });
  }),


});

import { getAccSecret } from "package/connect_wallet";
import { z } from "zod";
import {
  createRedeemXDRAsset,
  createRedeemXDRNative,
} from "~/lib/stellar/fan/redeem";
import { AccountSchema } from "~/lib/stellar/fan/utils";
import {
  createOrRenewVanitySubscription,
  getVanitySubscriptionXDR,
} from "~/lib/stellar/fan/vanity-url";
import { getAssetBalance } from "~/lib/stellar/marketplace/test/acc";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import { SignUser } from "~/lib/stellar/utils";

import {
  createTRPCRouter,
  creatorProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { BADWORDS } from "~/utils/banned-word";
import { truncateString } from "~/utils/string";
export const CreatorAboutShema = z.object({
  description: z
    .string()
    .max(100, { message: "Bio must be lass than 101 character" })
    .nullable(),
  name: z
    .string()
    .min(3, { message: "Name must be between 3 to 98 characters" })
    .max(98, { message: "Name must be between 3 to 98 characters" }),
  profileUrl: z.string().nullable().optional(),
});

export const creatorRouter = createTRPCRouter({
  getCreator: protectedProcedure
    .input(z.object({ id: z.string() }).optional())
    .query(async ({ input, ctx }) => {
      let id = ctx.session.user.id;
      if (input) {
        id = input.id;
      }
      const creator = await ctx.db.creator.findFirst({
        where: { id: id },
        include: { pageAsset: true },
      });
      if (creator) {
        return creator;
      }
    }),

  getCreatorPageAsset: protectedProcedure.query(async ({ ctx }) => {
    const pageAsset = await ctx.db.creatorPageAsset.findFirst({
      where: { creatorId: ctx.session.user.id },
      select: {
        code: true,
        issuer: true,
        creatorId: true,
      },
    });

    if (!pageAsset) {
      const creator = await ctx.db.creator.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
      });
      const customAsset = creator.customPageAssetCodeIssuer;
      if (customAsset) {
        const [code, issuer] = customAsset.split("-");
        return {
          code,
          issuer,
          creatorId: creator.id,
        };
      }
    }
    return pageAsset;
  }),

  meCreator: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.creator.findFirst({
      where: { user: { id: ctx.session.user.id } },
    });
  }),
  vanitySubscription: protectedProcedure.query(async ({ ctx }) => {
    const creator = ctx.db.creator.findFirst({
      where: { user: { id: ctx.session.user.id } },
      include: {
        vanitySubscription: true,
      },
    });
    return creator;
  }),
  getCreatorSecret: protectedProcedure
    .input(
      z.object({
        uid: z.string().optional(),
        email: z.string().email().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { email, uid } = input;
      if (email && uid) {
        const secret = await getAccSecret(uid, email);
        return secret;
      }
    }),

  makeMeCreator: protectedProcedure
    .input(AccountSchema)
    .mutation(async ({ ctx, input: i }) => {
      const id = ctx.session.user.id;
      const data = await ctx.db.creator.create({
        data: {
          name: truncateString(id),
          bio: id,
          user: { connect: { id: id } },
          storagePub: i.publicKey,
          storageSecret: i.secretKey,
        },
      });
    }),

  updateCreatorProfile: protectedProcedure
    .input(CreatorAboutShema)
    .mutation(async ({ ctx, input }) => {
      const { name, description } = input;
      await ctx.db.creator.update({
        data: { name, bio: description },
        where: { id: ctx.session.user.id },
      });
    }),

  getAllCreator: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.string().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor } = input;
      const items = await ctx.db.creator.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // getLatest: protectedProcedure.query(({ ctx }) => {
  //   return ctx.db.post.findFirst({
  //     orderBy: { createdAt: "desc" },
  //     where: { createdBy: { id: ctx.session.user.id } },
  //   });
  // }),

  changeCreatorProfilePicture: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      await ctx.db.creator.update({
        data: { profileUrl: input },
        where: { id: ctx.session.user.id },
      });
    }),

  changeCreatorBackgroundSVG: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const url = input;
      await ctx.db.creator.update({
        data: { backgroundSVG: url },
        where: { id: ctx.session.user.id },
      });
    }),

  changeCreatorCoverPicture: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      await ctx.db.creator.update({
        data: { coverUrl: input },
        where: { id: ctx.session.user.id },
      });
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),

  search: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.string().nullish(),
        skip: z.number().optional(),
        searchInput: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor, searchInput } = input;

      const items = await ctx.db.creator.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          OR: [
            {
              name: {
                contains: searchInput,
                mode: "insensitive",
              },
            },
            {
              bio: {
                contains: searchInput,
                mode: "insensitive",
              },
            },
          ],
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  getCreatorPageAssetBalance: protectedProcedure.query(
    async ({ ctx, input }) => {
      const creatorId = ctx.session.user.id;

      const creator = await ctx.db.creator.findUniqueOrThrow({
        where: { id: creatorId },
        include: { pageAsset: true },
      });

      const creatorStoragePub = creator.storagePub;
      const creatorPageAsset = creator.pageAsset;

      const storageAcc = await StellarAccount.create(creatorStoragePub);

      if (creatorPageAsset) {
        const bal = storageAcc.getTokenBalance(
          creatorPageAsset.code,
          creatorPageAsset.issuer,
        );
        if (bal) {
          return { balance: bal, asset: creatorPageAsset.code };
        } else {
          return { balance: 0, asset: creatorPageAsset.code };
        }
      } else {
        if (creator.customPageAssetCodeIssuer) {
          const [code, issuer] = creator.customPageAssetCodeIssuer.split("-");

          const assetCode = z.string().max(12).min(1).parse(code);
          const assetIssuer = z.string().length(56).safeParse(issuer);

          if (assetIssuer.success === false) throw new Error("invalid issuer");

          console.log("storage Acc", storageAcc);

          const bal = storageAcc.getTokenBalance(assetCode, assetIssuer.data);



          if (bal >= 0) {
            return { balance: bal, asset: assetCode };
          } else {
            throw new Error("Invalid asset code or issuer");
          }
        } else throw new Error("creator has no page asset");
      }
    },
  ),
  getFansList: protectedProcedure.query(async ({ ctx }) => {
    const creatorId = ctx.session.user.id;
    return ctx.db.follow.findMany({
      where: { creatorId: creatorId },
      include: { user: true },
    });
  }),
  getCreatorAllAssets: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { creatorId } = input;
      const creator = await ctx.db.creator.findUnique({
        where: { id: creatorId },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }
      const storagePubKey = creator.storagePub;

      const Asset = await ctx.db.asset.findMany({
        where: { creatorId },
        select: {
          id: true,
          code: true,
          issuer: true,
          name: true,
          limit: true,
          Redeem: {
            select: {
              totalRedeemable: true,
              code: true,
              redeemConsumers: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      const acc = await StellarAccount.create(storagePubKey);

      const assetsWithRemaining = Asset.map((asset) => ({
        ...asset,
        limit: acc.getTokenBalance(asset.code, asset.issuer),
        Redeem: asset.Redeem.map((redeem) => ({
          ...redeem,
          remaining: redeem.totalRedeemable - redeem.redeemConsumers.length, // Calculate remaining redemptions
        })),
      }));
      return assetsWithRemaining;
    }),
  generateRedeemCode: protectedProcedure
    .input(
      z.object({
        redeemCode: z.string(),
        assetId: z.number(),
        maxRedeems: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { redeemCode, assetId, maxRedeems } = input;
      const creatorId = ctx.session.user.id;
      const creator = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        include: { pageAsset: true },
      });
      if (!creator) {
        throw new Error("Creator not found");
      }
      const asset = await ctx.db.asset.findUnique({
        where: { id: assetId },
      });
      if (!asset) {
        throw new Error("Asset not found");
      }
      const findRedeem = await ctx.db.redeem.findUnique({
        where: { code: redeemCode },
      });
      if (findRedeem) {
        throw new Error("Redeem code already exists");
      }
      const code = await ctx.db.redeem.create({
        data: {
          totalRedeemable: maxRedeems,
          code: redeemCode.toLocaleUpperCase(),
          assetRedeemId: assetId,
        },
      });
      return { code: redeemCode };
    }),

  getXDRForCreatorRedeem: creatorProcedure
    .input(
      z.object({
        assetId: z.number(),
        maxRedeems: z.number(),
        redeemCode: z.string(),
        signWith: SignUser,
        paymentMethod: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { assetId, maxRedeems, signWith, redeemCode, paymentMethod } =
        input;

      const creatorId = ctx.session.user.id;

      const creator = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        include: { pageAsset: true },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }

      const asset = await ctx.db.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error("Asset not found");
      }

      const findRedeem = await ctx.db.redeem.findUnique({
        where: { code: redeemCode },
      });

      if (findRedeem) {
        throw new Error("Redeem code founded!");
      }

      if (paymentMethod === "xlm") {
        return await createRedeemXDRNative({
          creatorId: creatorId,
          maxRedeems,
          signWith,
        });
      } else if (paymentMethod === "asset") {
        return await createRedeemXDRAsset({
          creatorId: creatorId,
          maxRedeems,
          signWith,
        });
      }
    }),

  // Vanity URL Section

  updateVanityURL: protectedProcedure
    .input(
      z.object({
        vanityURL: z.string().min(2).max(30).optional().nullable(),
        isChanging: z.boolean(),
        signWith: SignUser,
        cost: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const creator = await ctx.db.creator.findUnique({
        where: { id: userId },
        include: { vanitySubscription: true },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }
      return getVanitySubscriptionXDR({
        amount: input.cost,
        signWith: input.signWith,
        userPubKey: userId,
      });
    }),

  createOrUpdateVanityURL: protectedProcedure
    .input(
      z.object({
        vanityURL: z.string().min(2).max(30).optional().nullable(),
        isChanging: z.boolean(),
        amount: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const creator = await ctx.db.creator.findUnique({
        where: { id: userId },
        include: { vanitySubscription: true },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }

      return createOrRenewVanitySubscription({
        creatorId: userId,
        isChanging: input.isChanging,
        amount: input.amount,
        vanityURL: input.vanityURL,
      });
    }),

  checkVanityURLAvailability: protectedProcedure
    .input(z.object({ vanityURL: z.string().min(2).max(30) }))
    .query(async ({ ctx, input }) => {
      const existingCreator = await ctx.db.creator.findUnique({
        where: { vanityURL: input.vanityURL },
      });

      const exixt = BADWORDS.includes(input.vanityURL) || existingCreator;

      return { isAvailable: !exixt };
    }),
});

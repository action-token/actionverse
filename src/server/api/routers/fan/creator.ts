import { getAccSecret } from "package/connect_wallet";
import { z } from "zod";
import { CreatorAboutShema } from "~/components/fan/creator/about";
import { brandCreateRequestSchema } from "~/components/fan/creator/onboarding/create-form";
import { MAX_ASSET_LIMIT } from "~/components/fan/creator/page_asset/new";
import { PaymentMethodEnum } from "~/components/payment/payment-process";
import {
  getCreatorShopAssetBalance,
  sendAssetXDRForAsset,
  sendAssetXDRForNative,
} from "~/lib/stellar/fan/creator_pageasset_buy";
import {
  getAssetPriceByCoddenIssuer,
  getPlatformAssetPrice,
  getXLMPrice,
  getXlmUsdPrice,
} from "~/lib/stellar/fan/get_token_price";
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
import { BLANK_KEYWORD } from "~/lib/utils";

import {
  createTRPCRouter,
  creatorProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { BADWORDS } from "~/utils/banned-word";
import { truncateString } from "~/utils/string";

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
        include: {
          pageAsset: {
            select: {
              code: true,
              issuer: true,
              price: true,
              priceUSD: true,
              thumbnail: true,
            },
          },
        },
      });
      if (creator) {
        return creator;
      }
    }),

  getMeCreator: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.creator.findFirst({
      where: { user: { id: ctx.session.user.id } },
      include: {
        pageAsset: {
          select: {
            code: true,
            thumbnail: true,
          },
        },
      },
    });
  }),

  getCreatorPageAsset: protectedProcedure.query(async ({ ctx }) => {
    const pageAsset = await ctx.db.creatorPageAsset.findFirst({
      where: { creatorId: ctx.session.user.id },
      select: {
        code: true,
        issuer: true,
        creatorId: true,
        price: true,
        priceUSD: true,
        thumbnail: true,
      },
    });

    if (!pageAsset) {
      const creator = await ctx.db.creator.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
      });
      const customAsset = creator.customPageAssetCodeIssuer;
      console.log("custom asset", customAsset);
      if (customAsset) {
        const [code, issuer, asset, usd] = customAsset.split("-");

        return {
          code,
          issuer,
          creatorId: creator.id,
          price: Number(asset),
          priceUSD: Number(usd),
          thumbnail: "https://app.wadzzo.com/images/loading.png",
        };
      }
    }
    return pageAsset;
  }),

  meCreator: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.creator.findFirst({
      where: {
        AND: {
          id: ctx.session.user.id,
          approved: {
            equals: true,
          },
        },
      },
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
          aprovalSend: true,
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
        where: { approved: { equals: true } },
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
  getCreators: protectedProcedure.query(async ({ input, ctx }) => {
    const items = await ctx.db.creator.findMany({
      where: { approved: { equals: true } },
    });
    return items;
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
          return {
            balance: bal,
            assetCode: creatorPageAsset.code,
            assetIssuer: creatorPageAsset.issuer,
          };
        } else {
          return {
            balance: 0,
            assetCode: creatorPageAsset.code,
            assetIssuer: creatorPageAsset.issuer,
          };
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
            return {
              balance: bal,
              assetCode: assetCode,
              assetIssuer: assetIssuer.data,
            };
          } else {
            throw new Error("Invalid asset code or issuer");
          }
        } else throw new Error("creator has no page asset");
      }
    },
  ),
  getCreatorShopAssetBalance: creatorProcedure.query(async ({ ctx }) => {
    const creator = await ctx.db.creator.findUnique({
      where: { id: ctx.session.user.id },
    });

    if (!creator) {
      throw new Error("Creator not found");
    }

    const creatorStoragePub = creator.storagePub;

    return await getCreatorShopAssetBalance({
      creatorStoragePub,
    });
  }),
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
        vanityURL: z.string().min(2).max(30),
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

  getAssetPriceByCodeIssuser: protectedProcedure
    .input(
      z.object({
        code: z.string().optional(),
        issuer: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { code, issuer } = input;
      if (!code || !issuer) {
        throw new Error("Code and issuer are required");
      }

      const priceUSDAsset = await getAssetPriceByCoddenIssuer({
        code,
        issuer,
      });

      const priceXLMUSD = await getXLMPrice();
      const platformAssetUSD = await getPlatformAssetPrice();
      return {
        xlmInUSD: priceXLMUSD,
        AssetInUSD: priceUSDAsset,
        platformAssetInUSD: platformAssetUSD,
      };
    }),
  updatePageAssetPrice: protectedProcedure
    .input(
      z.object({
        price: z.number().nonnegative(),
        priceUSD: z.number().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creatorId = ctx.session.user.id;
      const creator = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        select: {
          customPageAssetCodeIssuer: true,
          pageAsset: true,
        },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }

      const { price, priceUSD } = input;

      if (creator.pageAsset) {
        await ctx.db.creatorPageAsset.update({
          data: {
            price,
            priceUSD,
          },
          where: { creatorId: creatorId },
        });
      } else if (creator.customPageAssetCodeIssuer) {
        const [code, issuer] = creator.customPageAssetCodeIssuer.split("-");
        await ctx.db.creator.update({
          data: {
            customPageAssetCodeIssuer: `${code}-${issuer}-${price}-${priceUSD}`,
          },
          where: { id: creatorId },
        });
      }
      return { success: true };
    }),
  getSendAssetXDR: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        issuer: z.string(),
        price: z.number(),
        signWith: SignUser,
        creatorId: z.string(),
        method: PaymentMethodEnum,
        priceInXLM: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { code, issuer, price, signWith, creatorId, method, priceInXLM } =
        input;

      const currentUser = ctx.session.user.id;
      const creator = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        select: {
          storagePub: true,
          customPageAssetCodeIssuer: true,
          pageAsset: true,
          storageSecret: true,
        },
      });

      if (!creator) {
        throw new Error("Creator not found");
      }

      const acc = await StellarAccount.create(creator.storagePub);

      const getTotalToken = acc.getTokenBalance(code, issuer);

      if (method === "xlm") {
        return await sendAssetXDRForNative({
          creatorId: creatorId,
          priceInXLMWithCost: priceInXLM,
          code: code,
          issuer: issuer,
          totoalTokenToSend: getTotalToken,
          storageSecret: creator.storageSecret,
          signWith,
          userPublicKey: currentUser,
        });
      } else if (method === "asset") {
        return await sendAssetXDRForAsset({
          creatorId: creatorId,
          priceWithCost: price,
          code: code,
          issuer: issuer,
          totoalTokenToSend: getTotalToken,
          storageSecret: creator.storageSecret,
          signWith,
          userPublicKey: currentUser,
        });
      }
    }),

  requestBrandCreate: protectedProcedure
    .input(
      z.object({
        data: brandCreateRequestSchema,
        action: z.enum(["create", "update", "page_asset"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(input);
      const { data, action } = input;
      console.log(data);
      if (action === "page_asset") {
        await ctx.db.creator.update({
          data: {
            profileUrl: data.profileUrl,
            coverUrl: data.coverUrl,
            bio: data.bio,
            name: data.displayName,
            aprovalSend: true,
            vanityURL: data.vanityUrl.toLocaleLowerCase(),
          },
          where: { id: ctx.session.user.id },
        });

        await ctx.db.creatorPageAsset.create({
          data: {
            code: data.pageAssetName,
            thumbnail: data.assetThumbnail,
            creatorId: ctx.session.user.id,
            issuer: BLANK_KEYWORD,
            limit: 0,
          },
          // where: { creatorId: ctx.session.user.id },
        });
      } else if (action === "create") {
        await ctx.db.creator.create({
          data: {
            id: ctx.session.user.id,
            profileUrl: data.profileUrl,
            coverUrl: data.coverUrl,
            bio: data.bio,
            storagePub: BLANK_KEYWORD,
            storageSecret: BLANK_KEYWORD,
            name: data.displayName,
            aprovalSend: true,
            pageAsset: {
              create: {
                code: data.pageAssetName,
                issuer: BLANK_KEYWORD,
                thumbnail: data.assetThumbnail,
                limit: 0,
              },
            },
          },
        });
        await createOrRenewVanitySubscription({
          creatorId: ctx.session.user.id,
          isChanging: false,
          amount: 0,
          vanityURL: data.vanityUrl.toLocaleLowerCase(),
        });
      } else if (action === "update") {
        await ctx.db.creator.update({
          data: {
            profileUrl: data.profileUrl,
            coverUrl: data.coverUrl,
            vanityURL: data.vanityUrl.toLocaleLowerCase(),
            bio: data.bio,
            name: data.displayName,
            aprovalSend: true,
            pageAsset: {
              update: {
                where: { creatorId: ctx.session.user.id },
                data: {
                  code: data.pageAssetName,
                  thumbnail: data.assetThumbnail,
                },
              },
            },
          },
          where: { id: ctx.session.user.id },
        });
      }
    }),

  getTrandingCreators: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(5),
        cursor: z.string().nullish(), // cursor for pagination
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      // Parse the cursor (which is the last creator's ID)
      const cursorObj = cursor ? { id: cursor } : undefined;

      // Fetch creators with cursor-based pagination
      const creators = await ctx.db.creator.findMany({
        where: {
          approved: true,
          followers: {
            none: {
              userId: ctx.session.user.id,
            },
          },
        },
        orderBy: {
          followers: {
            _count: "desc",
          },
        },
        take: limit + 1, // take one extra to determine if there are more
        ...(cursorObj && {
          cursor: {
            id: cursorObj.id,
          },
          skip: 1, // Skip the cursor
        }),
        select: {
          id: true,
          name: true,
          profileUrl: true,
          _count: {
            select: {
              followers: true,
            },
          },
        },
      });

      // Check if we have more items
      let nextCursor: typeof cursor = undefined;
      if (creators.length > limit) {
        const nextItem = creators.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      // Check if current user follows the creators
      const followedCreators = await ctx.db.follow.findMany({
        where: {
          creatorId: {
            in: creators.map((creator) => creator.id),
          },
          userId: ctx.session.user.id,
        },
      });

      const creatorsWithFollow = creators.map((creator) => {
        const isFollowed = followedCreators.some(
          (follow) => follow.creatorId === creator.id,
        );
        return {
          ...creator,
          isFollowed,
          isCurrentUser: creator.id === ctx.session.user.id,
        };
      });

      return {
        creators: creatorsWithFollow,
        nextCursor,
      };
    }),

  getFollowedCreators: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(3),
        cursor: z.string().nullish(), // cursor for pagination
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      // Parse the cursor (which is the last creator's ID)
      const cursorObj = cursor ? { id: cursor } : undefined;

      // Fetch creators with cursor-based pagination
      const creators = await ctx.db.creator.findMany({
        where: {
          approved: true,
          followers: {
            some: {
              userId: ctx.session.user.id,
            },
          },
        },
        orderBy: {
          followers: {
            _count: "desc",
          },
        },
        take: limit + 1, // take one extra to determine if there are more
        ...(cursorObj && {
          cursor: {
            id: cursorObj.id,
          },
          skip: 1, // Skip the cursor
        }),
        select: {
          id: true,
          name: true,
          profileUrl: true,
          _count: {
            select: {
              followers: true,
            },
          },
          subscriptions: {
            select: {
              name: true,
            },
          },
        },
      });

      // Check if we have more items
      let nextCursor: typeof cursor = undefined;
      if (creators.length > limit) {
        const nextItem = creators.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      // Check if current user follows the creators

      return {
        creators: creators,
        nextCursor,
      };
    }),
});

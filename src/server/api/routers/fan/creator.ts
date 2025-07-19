import axios from "axios";
import { getAccSecret } from "package/connect_wallet";
import { env } from "process";
import { z } from "zod";
import { getCreatorShopAssetBalance } from "~/lib/stellar/fan/creator_pageasset_buy";
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
import { RequestBrandCreateFormSchema } from "~/pages/organization/create";

import {
  createTRPCRouter,
  creatorProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { BADWORDS } from "~/utils/banned-word";
import { truncateString } from "~/utils/string";
export const CreatorAboutShema = z.object({
  bio: z
    .string()
    .max(200, { message: "Bio must be lass than 101 character" })
    .nullable(),
  name: z
    .string()
    .min(3, { message: "Name must be between 3 to 98 characters" })
    .max(99, { message: "Name must be between 3 to 98 characters" }),
  website: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
});

export const creatorRouter = createTRPCRouter({

  requestForBrandCreation: protectedProcedure
    .input(RequestBrandCreateFormSchema).mutation(async ({ ctx, input }) => {
      const creator = await ctx.db.creator.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (creator) {
        throw new Error("Creator already exists");
      }

      if (input.assetType === 'custom') {


        await ctx.db.creator.create({
          data: {
            id: ctx.session.user.id,
            profileUrl: input.profileUrl,
            coverUrl: input.coverUrl,
            bio: input.bio,
            storagePub: BLANK_KEYWORD,
            storageSecret: BLANK_KEYWORD,
            name: input.displayName,
            aprovalSend: true,
            customPageAssetCodeIssuer: `${input.assetCode}-${input.issuer}`,

          },
        });
      }
      if (input.assetType === 'new') {

        await ctx.db.creator.create({
          data: {
            id: ctx.session.user.id,
            profileUrl: input.profileUrl,
            coverUrl: input.coverUrl,
            bio: input.bio,
            storagePub: BLANK_KEYWORD,
            storageSecret: BLANK_KEYWORD,
            name: input.displayName,
            aprovalSend: true,
            pageAsset: {
              create: {
                code: input.assetName,
                issuer: BLANK_KEYWORD,
                thumbnail: input.assetImage,
                limit: 0,
              }
            }
          },
        });
      }

      // await createOrRenewVanitySubscription({
      //   creatorId: ctx.session.user.id,
      //   isChanging: false,
      //   amount: 0,
      //   vanityURL: input.vanityUrl.toLocaleLowerCase(),
      // });

    }),

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
          pageAsset: true,
          _count: {
            select: {
              followers: true,
              assets: true,
              posts: true,
            }
          }
        },
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
      include: {
        _count: {
          select: {
            followers: true,
            assets: true,
            posts: true,
          }
        },
        pageAsset: true,

      }
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
          aprovalSend: true,
        },
      });
    }),

  updateCreatorProfileInfo: protectedProcedure
    .input(CreatorAboutShema)
    .mutation(async ({ ctx, input }) => {
      const { name, bio, instagram, twitter, website } = input;
      await ctx.db.creator.update({
        data: {
          name, bio:
            bio,
          instagram: instagram,
          twitter: twitter,
          website: website,

        },
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
  getCreators: protectedProcedure

    .query(async ({ input, ctx }) => {

      const items = await ctx.db.creator.findMany({

        where: { approved: { equals: true } },
      });
      return items;
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
            balance: bal, assetCode: creatorPageAsset.code,
            assetIssuer: creatorPageAsset.issuer
          };
        } else {
          return {
            balance: 0, assetCode: creatorPageAsset.code,
            assetIssuer: creatorPageAsset.issuer
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
            return { balance: bal, assetCode: assetCode, assetIssuer: assetIssuer.data };
          } else {
            throw new Error("Invalid asset code or issuer");
          }
        } else throw new Error("creator has no page asset");
      }
    },
  ),
  getCreatorShopAssetBalance: creatorProcedure.query(
    async ({ ctx }) => {
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
    .mutation(async ({ ctx, input }) => {
      const existingCreator = await ctx.db.creator.findUnique({
        where: { vanityURL: input.vanityURL },
      });

      const exixt = BADWORDS.includes(input.vanityURL) || existingCreator;

      return { isAvailable: !exixt };
    }),

  getTrandingCreators: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(5),
        cursor: z.string().nullish(), // cursor for pagination
      })
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
              userId: ctx.session.user.id
            }
          }
        },
        orderBy: {
          followers: {
            _count: 'desc',
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
        const isFollowed = followedCreators.some((follow) => follow.creatorId === creator.id);
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
    }
    ),

  getFollowedCreators: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(3),
        cursor: z.string().nullish(), // cursor for pagination
      })
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
              userId: ctx.session.user.id
            }
          }
        },
        orderBy: {
          followers: {
            _count: 'desc',
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
            }
          }
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
    }
    ),
  checkCustomAssetValidity: protectedProcedure
    .input(z.object({ assetCode: z.string(), issuer: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log("input", input);
      console.log("process.env.NEXT_PUBLIC_STELLAR_PUBNET", process.env.NEXT_PUBLIC_STELLAR_PUBNET);

      const isPubnet = process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"; // Explicit comparison

      const url = `https://api.stellar.expert/explorer/${isPubnet ? "public" : "testnet"}/asset/${input.assetCode}-${input.issuer}`;

      console.log("Generated URL:", url);

      console.log("url", url);
      const response = await axios.get(
        url
      );
      console.log("response", response.data);
      return response.status === 200;
    }),

  addCreatorSubscription: protectedProcedure.input(z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    features: z.array(z.string()),
    color: z.string(),
    popular: z.boolean(),
    isActive: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    console.log("input", input);
    const creator = await ctx.db.creator.findUnique({
      where: { id: ctx.session.user.id },
    });
    if (!creator) {
      throw new Error("Creator not found");
    }
    const feature = await ctx.db.subscription.create({
      data: {
        name: input.name,
        creatorId: creator.id,
        price: input.price,
        description: input.description,
        features: input.features,
        color: input.color,
        popular: input.popular,
        isActive: input.isActive,
      },
    });
    return feature;
  }
  ),
  updateCreatorSubscription: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    description: z.string(),
    features: z.array(z.string()),
    color: z.string(),
    popular: z.boolean(),
    isActive: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const creator = await ctx.db.creator.findUnique({
      where: { id: ctx.session.user.id },
    });
    if (!creator) {
      throw new Error("Creator not found");
    }
    const feature = await ctx.db.subscription.update({
      where: { id: input.id },
      data: {
        name: input.name,
        price: input.price,
        description: input.description,
        features: input.features,
        color: input.color,
        popular: input.popular,
        isActive: input.isActive,
      },
    });
    return feature;
  }
  ),
  deleteCreatorSubscription: protectedProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const creator = await ctx.db.creator.findUnique({
      where: { id: ctx.session.user.id },
    });
    if (!creator) {
      throw new Error("Creator not found");
    }
    const feature = await ctx.db.subscription.delete({
      where: { id: input.id },
    });
    return feature;
  }
  ),

  getCreatorPackages: protectedProcedure.input(z.object({ id: z.string() }).optional()).query(async ({ ctx, input }) => {
    let id = ctx.session.user.id;
    if (input) {
      id = input.id;
    }
    const creator = await ctx.db.creator.findUnique({
      where: { id: id },
    });
    if (!creator) {
      throw new Error("Creator not found");
    }
    const packages = await ctx.db.subscription.findMany({
      where: { creatorId: creator.id },
    });
    return packages;
  }),
  getPaginatedCreator: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(7),
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input

      const items = await ctx.db.creator.findMany({
        take: limit + 1, // take an extra item to determine if there are more items
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          _count: {
            select: {
              Bounty: true,
              followers: true,
            }
          },
          id: true,
          name: true,
          bio: true,
          profileUrl: true,
          coverUrl: true,
          website: true,
          twitter: true,
          instagram: true,

        },
        where: {
          approved: true,
        },
      })


      let nextCursor: typeof cursor = undefined
      if (items.length > limit) {
        const nextItem = items.pop()
        nextCursor = nextItem?.id
      }

      return {
        items,
        nextCursor,
      }
    }),
});

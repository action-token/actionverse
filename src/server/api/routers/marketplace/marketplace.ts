import { Keypair } from "@stellar/stellar-sdk";
import { z } from "zod";
import { env } from "~/env";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import {
  sendNft2StorageXDR,
  sendNftback,
} from "~/lib/stellar/marketplace/trx/nft_2_storage";
import { SignUser } from "~/lib/stellar/utils";

import { ItemPrivacy, MarketAsset } from "@prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { MarketAssetType } from "~/types/market/market-asset-type";
export const BackMarketFormSchema = z.object({
  placingCopies: z
    .number({
      required_error: "Placing Copies  must be a number",
      invalid_type_error: "Placing Copies must be a number",
    })
    .nonnegative()
    .int(),
  code: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" }),
  issuer: z.string(),
});
export const PlaceMarketFormSchema = z.object({
  placingCopies: z
    .number({
      required_error: "Placing Copies  must be a number",
      invalid_type_error: "Placing Copies must be a number",
    })
    .nonnegative()
    .int(),
  code: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" }),
  issuer: z.string(),
});
export const AssetSelectAllProperty = {
  code: true,
  name: true,
  issuer: true,
  creatorId: true,
  thumbnail: true,
  privacy: true,
  description: true,
  id: true,
  mediaType: true,
  mediaUrl: true,
  limit: true,
  tierId: true,
  tier: true,
  createdAt: true,
  isQRItem: true,
};

export const marketRouter = createTRPCRouter({
  placeNft2StorageXdr: protectedProcedure
    .input(PlaceMarketFormSchema.extend({ signWith: SignUser }))
    .mutation(async ({ input, ctx }) => {
      // validate and transfer input
      const { code, issuer, placingCopies, signWith } = input;

      const creatorId = ctx.session.user.id;
      const storage = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        select: { storagePub: true, storageSecret: true },
      });
      if (!storage?.storagePub) {
        throw new Error("storage does not exist");
      }

      const assetAmount = placingCopies.toString();

      // stellar sdk for xdr
      return await sendNft2StorageXDR({
        assetAmount,
        assetCode: code,
        signWith,
        issuerPub: issuer,
        storageSec: storage.storageSecret,
        userPub: creatorId,
      });
    }),
  createAssetBuyerInfo: protectedProcedure.input(z.object({
    assetId: z.number(),

  })).mutation(async ({ ctx, input }) => {
    const { assetId } = input;
    const buyerId = ctx.session.user.id;
    // Check if the asset exists
    const asset = await ctx.db.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new Error("Asset not found");

    // Create a buyer record in the User_Asset table
    const buyerRecord = await ctx.db.user_Asset.create({
      data: {
        assetId: assetId,
        userId: buyerId,
        buyAt: new Date(),

      },
    });

    return buyerRecord;

  }),
  placeBackNftXdr: protectedProcedure
    .input(BackMarketFormSchema.extend({ signWith: SignUser }))
    .mutation(async ({ ctx, input }) => {
      // validate and transfor input
      const { code, issuer, placingCopies, signWith } = input;

      const creatorId = ctx.session.user.id;
      const storage = await ctx.db.creator.findUnique({
        where: { id: creatorId },
        select: { storageSecret: true },
      });
      if (!storage?.storageSecret) {
        throw new Error("storage does not exist");
      }

      const assetAmount = placingCopies.toString();

      // console.log(assetAmount);
      // stellear sdk for xdr
      return await sendNftback({
        assetAmount,
        assetCode: code,
        signWith,
        issuerPub: issuer,
        storageSecret: storage.storageSecret,
        userPub: creatorId,
      });
    }),

  placeToMarketDB: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        issuer: z.string(),
        price: z.number(),
        priceUSD: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { code, issuer, price, priceUSD } = input;

      const userId = ctx.session.user.id;

      const asset = await ctx.db.asset.findUnique({
        where: { code_issuer: { code, issuer } },
      });

      if (!asset) throw new Error("asset not found");

      const placerId = userId;

      await ctx.db.marketAsset.create({
        data: {
          placerId,
          price,
          assetId: asset.id,
          priceUSD,
          privacy: asset.privacy,
        },
      });
    }),

  disableToMarketDB: protectedProcedure
    .input(z.object({ code: z.string(), issuer: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { code, issuer } = input;

      const userId = ctx.session.user.id;

      const asset = await ctx.db.asset.findUnique({
        where: { code_issuer: { code, issuer } },
        select: { id: true, creatorId: true },
      });

      if (!asset) throw new Error("asset not found");


      console.log("asset", asset, code, issuer);

      await ctx.db.marketAsset.deleteMany({
        where: {
          AND: [{ assetId: asset.id }, { placerId: userId }],
        },
      });
    }),

  getFanMarketNfts: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, skip } = input
      if (ctx.session?.user.id) {
        const currentUserId = ctx.session.user.id

        const fetchAndFilterItems = async (
          currentLimit: number,
          currentCursor: number | null | undefined,
          currentSkip: number | undefined,

          accumulatedItems: MarketAssetType[] = [],

        ): Promise<{ nfts: MarketAssetType[]; nextCursor: number | null }> => {
          const items = await ctx.db.marketAsset.findMany({
            take: currentLimit,
            skip: currentSkip,
            cursor: currentCursor ? { id: currentCursor } : undefined,
            include: {
              asset: {
                select: {
                  ...AssetSelectAllProperty,
                  tier: {
                    select: {
                      price: true,
                    },
                  },
                  creator: {
                    select: {
                      pageAsset: {
                        select: {
                          code: true,
                          issuer: true,
                        },
                      },
                      customPageAssetCodeIssuer: true,
                    },
                  },
                  isQRItem: true,
                },
              },
            },
            where: { placerId: { not: null }, type: { equals: "FAN" }, isQRItem: false },
          })

          const stellarAcc = await StellarAccount.create(currentUserId)

          const filteredItems = items.filter((item) => {
            const creatorPageAsset = item.asset.creator?.pageAsset
            const creatorCustomPageAsset = item.asset.creator?.customPageAssetCodeIssuer
            let code: string | undefined
            let issuer: string | undefined

            if (creatorCustomPageAsset) {
              [code, issuer] = creatorCustomPageAsset.split("-")
            } else if (creatorPageAsset) {
              code = creatorPageAsset.code
              issuer = creatorPageAsset.issuer
            }

            if (!code || !issuer) return false

            if (item.asset.privacy === ItemPrivacy.PUBLIC) {
              return true
            }

            if (item.asset.creatorId !== item.placerId) {
              return true
            }

            if (item.asset.privacy === ItemPrivacy.PRIVATE) {
              return stellarAcc.hasTrustline(code, issuer)
            }

            if (item.asset.privacy === ItemPrivacy.TIER) {
              return item.asset.tier && item.asset.tier.price <= stellarAcc.getTokenBalance(code, issuer)
            }

            return false
          })

          const newAccumulatedItems = [...accumulatedItems, ...filteredItems]

          if (newAccumulatedItems.length >= limit || items.length < currentLimit) {
            // We have enough items or there are no more items to fetch
            // @ts-expect-error: This error occurs because of an intentional type mismatch due to X.
            const nextCursor = newAccumulatedItems.length > limit ? newAccumulatedItems[limit - 1].id : null
            return {
              nfts: newAccumulatedItems.slice(0, limit),
              nextCursor,
            }
          } else {
            // We need to fetch more items
            const lastItem = items[items.length - 1]
            if (lastItem) {
              return fetchAndFilterItems(currentLimit, lastItem.id, 0, newAccumulatedItems)
            } else {
              // If there are no items left, return what we have
              return {
                nfts: newAccumulatedItems,
                nextCursor: null,
              }
            }
          }
        }

        return fetchAndFilterItems(limit, cursor, skip)
      }
      else {


        const items = await ctx.db.marketAsset.findMany({
          take: limit,
          skip: skip,
          cursor: cursor ? { id: cursor } : undefined,
          include: {
            asset: {
              select: {
                ...AssetSelectAllProperty,
                tier: {
                  select: {
                    price: true,
                  },
                },
                creator: {
                  select: {
                    pageAsset: {
                      select: {
                        code: true,
                        issuer: true,
                      },
                    },
                    customPageAssetCodeIssuer: true,
                  },
                },
              },
            },
          },
          where: { placerId: { not: null }, type: { equals: "FAN" } },
        })

        let nextCursor: typeof cursor | undefined = undefined
        if (items.length > limit) {
          const nextItem = items.pop() // return the last item from the array
          nextCursor = nextItem?.id
        }
        return {
          nfts: items,
          nextCursor,
        }

      }
    }),

  getLatestMarketNFT: publicProcedure

    .query(async ({ ctx, input }) => {
      if (ctx.session?.user.id) {
        const currentUserId = ctx.session.user.id;

        const items = await ctx.db.marketAsset.findMany({

          include: {
            asset: {
              select: {
                ...AssetSelectAllProperty,
                tier: {
                  select: {
                    price: true,
                  },
                },
                creator: {
                  select: {
                    pageAsset: {
                      select: {
                        code: true,
                        issuer: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          where: { placerId: { not: null } },
        });

        const stellarAcc = await StellarAccount.create(currentUserId);

        // Filter items based on privacy and conditions
        const array = items.filter((item) => {
          const creatorPageAsset = item.asset.creator?.pageAsset;

          if (item.asset.privacy === ItemPrivacy.PUBLIC) {
            return true;
          }

          if (item.asset.creatorId !== item.placerId) {
            return true;
          }

          if (item.asset.privacy === ItemPrivacy.PRIVATE) {
            return (
              creatorPageAsset &&
              stellarAcc.hasTrustline(
                creatorPageAsset.code,
                creatorPageAsset.issuer,
              )
            );
          }

          if (item.asset.privacy === ItemPrivacy.TIER) {
            return (
              creatorPageAsset &&
              item.asset.tier &&
              item.asset.tier.price <=
              stellarAcc.getTokenBalance(
                creatorPageAsset.code,
                creatorPageAsset.issuer,
              )
            );
          }

          return false;
        });

        return array.slice(0, 5);
      }
      else {


        const items = await ctx.db.marketAsset.findMany({

          include: {
            asset: {
              select: {
                ...AssetSelectAllProperty,
                tier: {
                  select: {
                    price: true,
                  },
                },
                creator: {
                  select: {
                    pageAsset: {
                      select: {
                        code: true,
                        issuer: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          where: { placerId: { not: null } },
        });

        return items.slice(0, 5);
      }

    }),
  getPageAssets: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.string().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, skip } = input;

      const items = await ctx.db.creator.findMany({
        where: {
          profileUrl: { not: null },

          OR: [
            { pageAsset: { isNot: null } },
            { customPageAssetCodeIssuer: { contains: "-" } }

          ]

        },
        select: {
          id: true,
          name: true,
          profileUrl: true,
          pageAsset: true,
          customPageAssetCodeIssuer: true
        },
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          pageAsset: {
            creatorId: "asc"
          }
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }
      return {
        nfts: items,
        nextCursor,
      };
    }),


  getMarketAdminNfts: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, skip } = input;
      if (ctx.session?.user.id) {
        const currentUserId = ctx.session.user.id;

        const items = await ctx.db.marketAsset.findMany({
          take: limit + 1,
          skip: skip,
          cursor: cursor ? { id: cursor } : undefined,
          include: {
            asset: {
              select: {
                ...AssetSelectAllProperty,
                tier: {
                  select: {
                    price: true,
                  },
                },
                creator: {
                  select: {
                    pageAsset: {
                      select: {
                        code: true,
                        issuer: true,
                      },
                    },
                  },
                },
              },
            },
          },
          where: { type: "ADMIN" },
        });

        const stellarAcc = await StellarAccount.create(currentUserId);
        const array = items.filter((item) => {
          if (item.asset.privacy === ItemPrivacy.PUBLIC) {
            return true;
          }

          if (item.asset.creatorId !== item.placerId) {
            return true;
          }

          if (item.asset.privacy === ItemPrivacy.PRIVATE) {
            const creatorPageAsset = item.asset.creator?.pageAsset;
            if (
              creatorPageAsset &&
              stellarAcc.hasTrustline(
                creatorPageAsset.code,
                creatorPageAsset.issuer,
              )
            ) {
              return true;
            }
          } else if (item.asset.privacy === ItemPrivacy.TIER) {
            const creatorPageAsset = item.asset.creator?.pageAsset;
            if (
              creatorPageAsset &&
              item.asset.tier &&
              item.asset.tier.price <=
              stellarAcc.getTokenBalance(
                creatorPageAsset.code,
                creatorPageAsset.issuer,
              )
            ) {
              return true;
            }
          }
          return false;
        });

        let nextCursor: typeof cursor | undefined = undefined;
        if (array.length > limit) {
          const nextItem = array.pop();
          nextCursor = nextItem?.id;
        }

        return {
          nfts: array,
          nextCursor,
        };
      }
      else {

        const items = await ctx.db.marketAsset.findMany({
          take: limit + 1,
          skip: skip,
          cursor: cursor ? { id: cursor } : undefined,
          include: {
            asset: {
              select: {
                ...AssetSelectAllProperty,
                tier: {
                  select: {
                    price: true,
                  },
                },
                creator: {
                  select: {
                    pageAsset: {
                      select: {
                        code: true,
                        issuer: true,
                      },
                    },
                  },
                },
              },
            },
          },
          where: { type: "ADMIN" },
        });



        let nextCursor: typeof cursor | undefined = undefined;
        if (items.length > limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.id;
        }

        return {
          nfts: items,
          nextCursor,
        };
      }
    }),

  getCreatorNftsByCreatorID: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.number().nullish(),
        skip: z.number().optional(),
        creatorId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, skip, creatorId } = input;

      const items = await ctx.db.marketAsset.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          asset: {
            select: AssetSelectAllProperty,
          },
        },
        where: { asset: { creatorId: creatorId, isQRItem: false } },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        nfts: items,
        nextCursor,
      };
    }),

  getACreatorNfts: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, skip } = input;
      const creatorId = ctx.session.user.id;
      const items = await ctx.db.marketAsset.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          asset: {
            select: AssetSelectAllProperty,
          },
        },
        where: { asset: { creatorId: creatorId, isQRItem: false, } },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }
      console.log("items......", items);
      return {
        nfts: items,
        nextCursor,
      };
    }),

  getSongAssetAvailableCopy: protectedProcedure
    .input(z.object({ code: z.string(), issuer: z.string() }))
    .query(async ({ ctx, input }) => {
      const { code, issuer } = input;

      const adminStoragePub = Keypair.fromSecret(
        env.STORAGE_SECRET,
      ).publicKey();

      const bal = await StellarAccount.create(adminStoragePub);
      const copy = bal.getTokenBalance(code, issuer);
      return copy;
    }),

  getMarketAssetAvailableCopy: protectedProcedure
    .input(z.object({ id: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { id } = input;

      if (!id) {
        //  throw new Error("id is required");

        return 0;
      }
      console.log("id............", id);
      const marketItem = await ctx.db.marketAsset.findUnique({
        where: { id },
        include: { asset: { select: { code: true, issuer: true } } },
      });

      if (!marketItem) throw new Error("market item not found");

      const placerId = marketItem.placerId;

      if (placerId) {
        // placer have to be creator, have an storage account,
        const placer = await ctx.db.creator.findUnique({
          where: { id: placerId },
        });

        if (!placer) throw new Error("seller not found");

        const placerStorage = placer.storagePub;

        const bal = await StellarAccount.create(placerStorage);
        const copy = bal.getTokenBalance(
          marketItem.asset.code,
          marketItem.asset.issuer,
        );

        return copy;
      } else {
        // admin or original item
        const adminStorage = Keypair.fromSecret(env.STORAGE_SECRET).publicKey();

        const bal = await StellarAccount.create(adminStorage);
        const copy = bal.getTokenBalance(
          marketItem.asset.code,
          marketItem.asset.issuer,
        );

        return copy;
      }
      // return copies.length;
    }),

  getSongAvailableCopy: protectedProcedure
    .input(z.object({ songId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const { songId } = input;

      if (!songId) {
        //  throw new Error("id is required");

        return 0;
      }

      const song = await ctx.db.song.findUniqueOrThrow({
        where: { id: songId },
        select: {
          creator: true,
          asset: {
            select: { code: true, issuer: true },
          },
        },
      });

      if (song.creator) {
        const storage = song.creator.storagePub;

        if (!storage) throw new Error("Song item not found");

        const acc = await StellarAccount.create(storage);
        const copy = acc.getTokenBalance(song.asset.code, song.asset.issuer);
        return copy;
      } else {
        const adminStorage = Keypair.fromSecret(env.STORAGE_SECRET).publicKey();

        const bal = await StellarAccount.create(adminStorage);
        const copy = bal.getTokenBalance(song.asset.code, song.asset.issuer);

        return copy;
      }
      // return copies.length;
    }),
  deleteMarketAsset: adminProcedure
    .input(
      z.object({
        assetId: z.number().optional(),
        marketId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { assetId, marketId } = input;

      if (assetId) {
        const asset = await ctx.db.asset.findUnique({
          where: { id: assetId },
        });
        console.log("asset", asset);
        await ctx.db.asset.delete({
          where: {
            id: assetId,
          },
        });
      } else if (marketId) {
        const marketAsset = await ctx.db.marketAsset.findUniqueOrThrow({
          where: {
            id: marketId,
          },
        });

        await ctx.db.asset.delete({
          where: {
            id: marketAsset.assetId,
          },
        });
      }
    }),

  userCanBuyThisMarketAsset: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const pubkey = ctx.session.user.id;

      const stellarAcc = await StellarAccount.create(pubkey);

      // check
      const marketAsset = await ctx.db.marketAsset.findUnique({
        where: { id: input },
        include: {
          asset: {
            include: {
              tier: { include: { creator: { include: { pageAsset: true } } } },
            },
          },
        },
      });
      console.log("marketAsset", marketAsset);
      if (!marketAsset) return false;

      if (marketAsset.privacy === ItemPrivacy.PUBLIC) {
        return true;
      }

      // secondary market if placerId is not the creatorId
      if (marketAsset.placerId !== marketAsset.asset.creatorId) {
        return true;
      }
      if (marketAsset.privacy === ItemPrivacy.PRIVATE && marketAsset.placerId) {
        const creatorPageAsset = await ctx.db.creator.findUniqueOrThrow({
          where: { id: marketAsset.placerId },
          select: {
            pageAsset: true,
          },
        });
        if (!creatorPageAsset.pageAsset) return false;
        const hasTrust = stellarAcc.hasTrustline(
          creatorPageAsset.pageAsset?.code,
          creatorPageAsset.pageAsset?.issuer,
        );
        if (hasTrust) {
          return true;
        }
      }
      const tier = marketAsset.asset.tier;
      if (tier) {
        const pageAsset = tier.creator.pageAsset;
        if (pageAsset) {
          if (marketAsset.privacy === ItemPrivacy.TIER) {
            const { code, issuer } = pageAsset;
            const bal = stellarAcc.getTokenBalance(code, issuer);
            if (bal >= tier.price) {
              return true;
            }
          }
        }
      }
    }),

  userCanBuySongMarketAsset: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const pubkey = ctx.session.user.id;

      const stellarAcc = await StellarAccount.create(pubkey);

      // check
      const marketAsset = await ctx.db.marketAsset.findFirst({
        where: {
          asset: {
            song: {
              id: input,
            },
          },
        },
        include: {
          asset: {
            include: {
              tier: { include: { creator: { include: { pageAsset: true } } } },
            },
          },
        },
      });

      if (!marketAsset) return { canBuy: false, marketAssetId: -1 };

      if (marketAsset.privacy === ItemPrivacy.PUBLIC) {
        return { canBuy: true, marketAssetId: marketAsset.id };
      }

      // secondary market if placerId is not the creatorId
      if (marketAsset.placerId !== marketAsset.asset.creatorId) {
        return { canBuy: true, marketAssetId: marketAsset.id };
      }
      if (marketAsset.privacy === ItemPrivacy.PRIVATE && marketAsset.placerId) {
        const creatorPageAsset = await ctx.db.creator.findUniqueOrThrow({
          where: { id: marketAsset.placerId },
          select: {
            pageAsset: true,
          },
        });
        if (!creatorPageAsset.pageAsset)
          return { canBuy: false, marketAssetId: -1 };
        const hasTrust = stellarAcc.hasTrustline(
          creatorPageAsset.pageAsset?.code,
          creatorPageAsset.pageAsset?.issuer,
        );
        if (hasTrust) {
          return { canBuy: true, marketAssetId: marketAsset.id };
        }
      }
      const tier = marketAsset.asset.tier;
      if (tier) {
        const pageAsset = tier.creator.pageAsset;
        if (pageAsset) {
          if (marketAsset.privacy === ItemPrivacy.TIER) {
            const { code, issuer } = pageAsset;
            const bal = stellarAcc.getTokenBalance(code, issuer);
            if (bal >= tier.price) {
              return { canBuy: true, marketAssetId: marketAsset.id };
            }
          }
        }
      }
    }),
});

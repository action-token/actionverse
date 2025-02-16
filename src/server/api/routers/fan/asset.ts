import { ItemPrivacy, MediaType } from "@prisma/client";
import { z } from "zod";
import { AccountSchema } from "~/lib/stellar/fan/utils";

import {
  createTRPCRouter,
  creatorProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { BADWORDS } from "~/utils/banned-word";
export const updateAssetFormShema = z.object({
  assetId: z.number(),
  price: z.number().nonnegative(),

  priceUSD: z.number().nonnegative(),
});
export const ExtraSongInfo = z.object({
  artist: z.string(),
  albumId: z.number(),
});
export const NftFormSchema = z.object({
  name: z.string().refine(
    (value) => {
      return !BADWORDS.some((word) => value.includes(word));
    },
    {
      message: "Input contains banned words.",
    },
  ),
  description: z.string(),
  mediaUrl: z.string(),
  coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
  mediaType: z.nativeEnum(MediaType),
  price: z
    .number({
      required_error: "Price must be entered as a number",
      invalid_type_error: "Price must be entered as a number",
    })
    .nonnegative()
    .default(2),
  priceUSD: z
    .number({
      required_error: "Limit must be entered as a number",
      invalid_type_error: "Limit must be entered as a number",
    })
    .nonnegative()
    .default(1),
  limit: z
    .number({
      required_error: "Limit must be entered as a number",
      invalid_type_error: "Limit must be entered as a number",
    })
    .nonnegative(),
  code: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" }),
  issuer: AccountSchema.optional(),
  songInfo: ExtraSongInfo.optional(),
  isAdmin: z.boolean().optional(),
  tier: z.string().optional(),
});

export const shopRouter = createTRPCRouter({
  createAsset: protectedProcedure
    .input(NftFormSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        code,
        coverImgUrl,
        description,

        mediaType,
        mediaUrl,
        name,
        price,
        issuer,
        limit,
        tier,
        priceUSD,
        isAdmin,
      } = input;

      if (issuer) {
        const userId = ctx.session.user.id;
        const creatorId = isAdmin ? undefined : userId; // for admin creator and placer id is undefined
        const nftType = isAdmin ? "ADMIN" : "FAN";

        let tierId: number | undefined;
        let privacy: ItemPrivacy = ItemPrivacy.PUBLIC;

        if (!tier) {
          privacy = ItemPrivacy.PUBLIC;
        } else if (tier == "public") {
          privacy = ItemPrivacy.PUBLIC;
        } else if (tier == "private") {
          privacy = ItemPrivacy.PRIVATE;
        } else {
          tierId = Number(tier);
          privacy = ItemPrivacy.TIER;
        }

        // console.log("mediaType", mediaType, mediaUrl);

        return await ctx.db.asset.create({
          data: {
            code,
            issuer: issuer.publicKey,
            issuerPrivate: issuer.secretKey,
            name,
            mediaType,
            mediaUrl,
            marketItems: {
              create: {
                price,
                priceUSD,
                placerId: creatorId,
                type: nftType,
                privacy: privacy,
              },
            },
            description,
            thumbnail: coverImgUrl,
            creatorId,
            limit,
            tierId,
            privacy: privacy,
          },
        });
      }
    }),

  updateAsset: protectedProcedure
    .input(updateAssetFormShema)
    .mutation(async ({ ctx, input }) => {
      const { assetId, price, priceUSD } = input;
      return await ctx.db.marketAsset.update({
        where: { id: assetId },
        data: { price, priceUSD },
      });
    }),

  deleteAsset: protectedProcedure // fix the logic
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.asset.delete({
        where: { id: input },
      });
    }),

  // search: publicProcedure
  //   .input(
  //     z.object({
  //       limit: z.number(),
  //       // cursor is a reference to the last item in the previous batch
  //       // it's used to fetch the next batch
  //       cursor: z.number().nullish(),
  //       skip: z.number().optional(),
  //       searchInput: z.string(),
  //     }),
  //   )
  //   .query(async ({ input, ctx }) => {
  //     const { limit, skip, cursor, searchInput } = input;
  //     const items = await ctx.db.shopAsset.findMany({
  //       take: limit + 1,
  //       skip: skip,
  //       cursor: cursor ? { id: cursor } : undefined,
  //       where: {
  //         OR: [
  //           {
  //             name: {
  //               contains: searchInput,
  //               mode: "insensitive",
  //             },
  //           },
  //           {
  //             description: {
  //               contains: searchInput,
  //               mode: "insensitive",
  //             },
  //           },
  //           {
  //             asset: {
  //               code: {
  //                 contains: searchInput,
  //                 mode: "insensitive",
  //               },
  //               issuer: {
  //                 contains: searchInput,
  //                 mode: "insensitive",
  //               },
  //             },
  //           },
  //         ],
  //       },
  //       include: { asset: { select: { code: true, issuer: true } } },
  //     });

  //     let nextCursor: typeof cursor | undefined = undefined;
  //     if (items.length > limit) {
  //       const nextItem = items.pop(); // return the last item from the array
  //       nextCursor = nextItem?.id;
  //     }

  //     return {
  //       items,
  //       nextCursor,
  //     };
  //   }),

  buyAsset: protectedProcedure
    .input(z.object({ shopAssetId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { shopAssetId } = input;
      // return await ctx.db..create({
      //   data: {
      //     userId: ctx.session.user.id,
      //     shopAssetId: shopAssetId,
      //   },
      // });
    }),

  // getAllPopularAsset: publicProcedure
  //   .input(
  //     z.object({
  //       limit: z.number(),
  //       // cursor is a reference to the last item in the previous batch
  //       // it's used to fetch the next batch
  //       cursor: z.number().nullish(),
  //       skip: z.number().optional(),
  //     }),
  //   )
  //   .query(async ({ input, ctx }) => {
  //     const { limit, skip, cursor } = input;
  //     const items = await ctx.db.shopAsset.findMany({
  //       take: limit + 1,
  //       skip: skip,
  //       cursor: cursor ? { id: cursor } : undefined,
  //       orderBy: { UserShopAsset: { _count: "desc" } },
  //       include: { asset: { select: { code: true, issuer: true } } },
  //     });

  //     let nextCursor: typeof cursor | undefined = undefined;
  //     if (items.length > limit) {
  //       const nextItem = items.pop(); // return the last item from the array
  //       nextCursor = nextItem?.id;
  //     }

  //     return {
  //       items,
  //       nextCursor,
  //     };
  //   }),

  // getUserShopAsset: protectedProcedure.query(async ({ ctx }) => {
  //   return await ctx.db.userShopAsset.findMany({
  //     where: { userId: ctx.session.user.id },
  //     include: {
  //       shopAsset: {
  //         include: { asset: { select: { code: true, issuer: true } } },
  //       },
  //     },
  //   });
  // }),

  myAssets: creatorProcedure.query(async ({ ctx }) => {
    const shopAsset = await ctx.db.asset.findMany({
      where: { creatorId: ctx.session.user.id },
      select: { code: true, issuer: true, thumbnail: true, id: true },
    });

    const pageAsset = await ctx.db.creatorPageAsset.findUnique({
      where: { creatorId: ctx.session.user.id },
      select: { code: true, issuer: true, creatorId: true, thumbnail: true },
    });

    let customPageAsset = {
      code: "",
      issuer: "",
      creatorId: ctx.session.user.id,
      thumbnail: "",
    };


    if (!pageAsset) {
      const customPageAssetCodeIssuer = await ctx.db.creator.findUnique({
        where: { id: ctx.session.user.id },
        select: { customPageAssetCodeIssuer: true },
      });
      if (customPageAssetCodeIssuer) {
        if (customPageAssetCodeIssuer.customPageAssetCodeIssuer) {
          const [code, issuer] = customPageAssetCodeIssuer.customPageAssetCodeIssuer.split("-");
          if (code && issuer) {
            customPageAsset = {
              code,
              issuer,
              creatorId: ctx.session.user.id,
              thumbnail: "",
            };
          }
        }
      }

    }

    return { shopAsset, pageAsset: pageAsset ?? customPageAsset };

  }),

  getCreatorAsset: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { creatorId } = input;
      return await ctx.db.creatorPageAsset.findUnique({
        where: { creatorId: creatorId },
        select: { code: true, issuer: true },
      });
    }),
});

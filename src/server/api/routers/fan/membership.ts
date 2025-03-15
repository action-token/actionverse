import { NotificationType } from "@prisma/client";
import { z } from "zod";
import { CreatorPageAssetSchema } from "~/components/fan/creator/page_asset/new";
import { AccountSchema } from "~/lib/stellar/fan/utils";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { BADWORDS } from "~/utils/banned-word";

export const EditTierSchema = z.object({
  name: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" })
    .refine(
      (value) => {
        // Check if the input is a single word
        return /^\w+$/.test(value);
      },
      {
        message: "Input must be a single word",
      },
    ),

  price: z
    .number({
      required_error: "Price must be entered as a number",
      invalid_type_error: "Price must be entered as a number",
    })
    .min(1, {
      message: "Price must be greater than 0",
    }),
  featureDescription: z
    .string()
    .min(20, { message: "Description must be longer than 20 characters" }),
  id: z.number(),
});
export const TierSchema = z.object({
  name: z
    .string()
    .min(4, { message: "Must be a minimum of 4 characters" })
    .max(12, { message: "Must be a maximum of 12 characters" })
    .refine(
      (value) => {
        // Check if the input is a single word
        return /^\w+$/.test(value);
      },
      {
        message: "Input must be a single word",
      },
    )
    .refine(
      (value) => {
        return !BADWORDS.some((word) => value.includes(word));
      },
      {
        message: "Input contains banned words.",
      },
    ),
  price: z
    .number({
      required_error: "Price must be entered as a number",
      invalid_type_error: "Price must be entered as a number",
    })
    .min(1, {
      message: "Price must be greater than 0",
    }),
  featureDescription: z
    .string()
    .min(10, { message: "Make description longer" }),
});
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

export const MAX_ASSET_LIMIT = Number("922337203685");

const selectedColumn = {
  name: true,
  price: true,
  features: true,
  id: true,
  creatorId: true,
  creator: {
    select: {
      pageAsset: {
        select: {
          code: true,
        },
      },
    },
  },
};

export const membershipRouter = createTRPCRouter({
  createMembership: protectedProcedure
    .input(TierSchema)
    .mutation(async ({ ctx, input }) => {
      const { featureDescription, name, price } = input;
      await ctx.db.subscription.create({
        data: {
          creatorId: ctx.session.user.id,
          name,
          features: featureDescription,
          price,
        },
      });
    }),

  createCreatePageAsset: protectedProcedure
    .input(CreatorPageAssetSchema.extend({ issuer: AccountSchema }))
    .mutation(async ({ ctx, input }) => {
      const creatorId = ctx.session.user.id;

      const { code: code, issuer, limit, thumbnail } = input;

      if (thumbnail) {
        await ctx.db.creatorPageAsset.create({
          data: {
            creatorId,
            limit: limit,
            code,
            thumbnail: thumbnail,
            issuer: issuer.publicKey,
            issuerPrivate: issuer.secretKey,
          },
        });
      } else {
        await ctx.db.creatorPageAsset.create({
          data: {
            creatorId,
            limit: limit,
            code,
            issuer: issuer.publicKey,
            issuerPrivate: issuer.secretKey,
          },
        });
      }
    }),

  createCustomPageAsset: protectedProcedure
    .input(z.object({ code: z.string(), issuer: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const creatorId = ctx.session.user.id;
      const { code, issuer } = input;
      const assetIssuer = `${code}-${issuer}`;

      const creator = await ctx.db.creator.update({
        data: { customPageAssetCodeIssuer: assetIssuer },
        where: { id: creatorId },
      });

      return creator;
    }),

  editTierModal: protectedProcedure
    .input(EditTierSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.subscription.update({
        data: {
          features: input.featureDescription,
          name: input.name,
          price: input.price,
        },
        where: {
          id: input.id,
        },
      });
    }),

  deleteTier: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const creatorId = ctx.session.user.id;
      return await ctx.db.subscription.delete({
        where: {
          id: input.id,
          creatorId: creatorId,
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

  getCreatorMembership: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return await ctx.db.subscription.findMany({
        where: { creatorId: input },
        select: selectedColumn,
      });
    }),

  getAllMembership: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.subscription.findMany({
      where: { creatorId: ctx.session.user.id },
      select: selectedColumn,
    });
  }),

  isFollower: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const isFollower = await ctx.db.follow.findUnique({
        where: {
          userId_creatorId: {
            creatorId: input.creatorId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (isFollower) return true;
      else false;
    }),

  followCreator: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (userId === input.creatorId) {
        throw new Error("You can't follow yourself");
      }
      const fol = await ctx.db.follow.create({
        data: { creatorId: input.creatorId, userId },
      });

      await ctx.db.notificationObject.create({
        data: {
          actorId: ctx.session.user.id,
          entityType: NotificationType.FOLLOW,
          entityId: fol.id,
          isUser: false,
          Notification: {
            create: [
              {
                notifierId: input.creatorId,
                isCreator: true, // Notification for the creator
              },
            ],
          },
        },
      });
    }),

  unFollowCreator: protectedProcedure
    .input(z.object({ creatorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (userId === input.creatorId) {
        throw new Error("You can't unfollow yourself");
      }
      const fol = await ctx.db.follow.findFirst({
        where: { creatorId: input.creatorId, userId },
      });

      if (!fol) {
        throw new Error("You are not following this creator");
      }

      // delete his follow
      await ctx.db.follow.delete({
        where: { id: fol.id },
      });
    }),
});

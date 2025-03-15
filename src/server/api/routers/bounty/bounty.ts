import {
  NotificationType,
  Prisma,
  SubmissionViewType,
  UserRole,
} from "@prisma/client"; // Assuming you are using Prisma
import { getAccSecretFromRubyApi } from "package/connect_wallet/src/lib/stellar/get-acc-secret";
import { z } from "zod";
import { MediaType } from "@prisma/client";

import {
  checkXDRSubmitted,
  getHasMotherTrustOnUSDC,
  getHasUserHasTrustOnUSDC,
  SendBountyBalanceToMotherAccount,
  SendBountyBalanceToMotherAccountViaXLM,
  SendBountyBalanceToUserAccount,
  SendBountyBalanceToUserAccountViaXLM,
  SendBountyBalanceToWinner,
  SendBountyBalanceToWinnerViaXLM,
  SwapUserAssetToMotherUSDC,
} from "~/lib/stellar/bounty/bounty";
import {
  getAssetPrice,
  getAssetToUSDCRate,
  getplatformAssetNumberForXLM,
  getPlatformAssetPrice,
  getXLMPriceByPlatformAsset,
} from "~/lib/stellar/fan/get_token_price";
import { SignUser } from "~/lib/stellar/utils";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { BountySchema } from "~/components/modal/edit-bounty-modal";

export const PaymentMethodEnum = z.enum(["asset", "xlm", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const BountyCommentSchema = z.object({
  bountyId: z.number(),
  parentId: z.number().optional(),
  content: z
    .string()
    .min(1, { message: "Minimum 5 character is required!" })
    .trim(),
});
export const SubmissionMediaInfo = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});
type SubmissionMediaInfoType = z.TypeOf<typeof SubmissionMediaInfo>;

export const MediaInfo = z.object({
  url: z.string(),
  type: z.nativeEnum(MediaType),
});

export enum sortOptionEnum {
  DATE_ASC = "DATE_ASC",
  DATE_DESC = "DATE_DESC",
  PRICE_ASC = "PRICE_ASC",
  PRICE_DESC = "PRICE_DESC",
}
const getAllBountyByUserIdInput = z.object({
  limit: z.number().min(1).max(100).default(10),
  cursor: z.string().uuid().nullish(),
  search: z.string().optional(),
  sortBy: z
    .enum(["DATE_ASC", "DATE_DESC", "PRICE_ASC", "PRICE_DESC"])
    .optional(),
  status: z.enum(["ALL", "ACTIVE", "FINISHED"]).optional(),
});

// Define the orderBy type for the specific query

export const BountyRoute = createTRPCRouter({
  sendBountyBalanceToMotherAcc: protectedProcedure
    .input(
      z.object({
        signWith: SignUser,
        prize: z.number().min(0.00001, { message: "Prize can't less than 0" }),
        method: PaymentMethodEnum,
        costInXLM: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = ctx.session.user.id;

      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }

      if (input.method === PaymentMethodEnum.enum.xlm) {
        const priceInXLM = await getXLMPriceByPlatformAsset(input.prize);

        return await SendBountyBalanceToMotherAccountViaXLM({
          userPubKey: userPubKey,
          prizeInXLM: priceInXLM + input.costInXLM,
          signWith: input.signWith,
          secretKey: secretKey,
        });
      } else {
        return await SendBountyBalanceToMotherAccount({
          userPubKey: userPubKey,
          prize: input.prize,
          signWith: input.signWith,
          secretKey: secretKey,
        });
      }
    }),

  createBounty: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, { message: "Title can't be empty" }),
        totalWinner: z
          .number()
          .min(1, { message: "Please select at least 1 winner" }),
        prizeInUSD: z
          .number()
          .min(0.00001, { message: "Prize can't less than 0" }),
        prize: z.number().min(0.00001, { message: "Prize can't less than 0" }),
        requiredBalance: z
          .number()
          .min(0, { message: "Required Balance can't be less than 0" }),
        content: z.string().min(2, { message: "Description can't be empty" }),

        priceInXLM: z.number().optional(),

        medias: z.array(MediaInfo).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.create({
        data: {
          title: input.title,
          description: input.content,
          priceInUSD: input.prizeInUSD,
          priceInBand: input.prize,
          creatorId: ctx.session.user.id,
          priceInXLM: input.priceInXLM,
          totalWinner: input.totalWinner,
          requiredBalance: input.requiredBalance,
          imageUrls: input.medias ? input.medias.map((media) => media.url) : [],
        },
      });
      const followers = await ctx.db.follow.findMany({
        where: { creatorId: ctx.session.user.id },
        select: { userId: true },
      });

      const followerIds = followers.map((follower) => follower.userId);

      const createNotification = async (notifierId: string) => {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.BOUNTY,
            entityId: bounty.id,
            isUser: true,
            Notification: {
              create: [
                {
                  notifierId,
                  isCreator: false,
                },
              ],
            },
          },
        });
      };

      for (const followerId of followerIds) {
        await createNotification(followerId);
      }
    }),

  getAllBounties: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
        search: z.string().optional(),
        sortBy: z
          .enum(["DATE_ASC", "DATE_DESC", "PRICE_ASC", "PRICE_DESC"])
          .optional(),
        filter: z.enum(["ALL", "NOT_JOINED", "JOINED"]).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor, skip, search, sortBy, filter } = input;

      const orderBy: Prisma.BountyOrderByWithRelationInput = {};
      if (sortBy === sortOptionEnum.DATE_ASC) {
        orderBy.createdAt = "asc";
      } else if (sortBy === sortOptionEnum.DATE_DESC) {
        orderBy.createdAt = "desc";
      } else if (sortBy === sortOptionEnum.PRICE_ASC) {
        orderBy.priceInUSD = "asc";
      } else if (sortBy === sortOptionEnum.PRICE_DESC) {
        orderBy.priceInUSD = "desc";
      }

      const where: Prisma.BountyWhereInput = {
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(filter === "NOT_JOINED" && {
          NOT: {
            participants: {
              some: {
                userId: ctx.session?.user.id,
              },
            },
          },
        }),
        ...(filter === "JOINED" && {
          participants: {
            some: {
              userId: ctx.session?.user.id,
            },
          },
        }),
      };

      const bounties = await ctx.db.bounty.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: where,
        orderBy: orderBy,
        include: {
          _count: {
            select: {
              participants: true,
              BountyWinner: true,
            },
          },
          creator: {
            select: {
              name: true,
              profileUrl: true,
            },
          },

          BountyWinner: {
            select: {
              user: {
                select: {
                  id: true,
                },
              },
              isSwaped: true,
            },
          },
          participants: {
            where: { userId: ctx.session?.user.id },
            select: { userId: true },
          },
        },
      });
      const bountyWithIsOwnerNisJoined = bounties.map((bounty) => {
        return {
          ...bounty,
          isOwner: bounty.creatorId === ctx.session?.user.id,
          isJoined: bounty.participants.some(
            (participant) => participant.userId === ctx.session?.user.id,
          ),
        };
      });
      let nextCursor: typeof cursor | undefined = undefined;
      if (bountyWithIsOwnerNisJoined.length > limit) {
        const nextItem = bountyWithIsOwnerNisJoined.pop();
        nextCursor = nextItem?.id;
      }
      return {
        bounties: bountyWithIsOwnerNisJoined,
        nextCursor: nextCursor,
      };
    }),

  isAlreadyJoined: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
        include: {
          participants: {
            where: {
              userId: ctx.session.user.id,
            },
          },
        },
      });
      return {
        isJoined: !!bounty?.participants.length,
      };
    }),

  joinBounty: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
        include: {
          participants: {
            where: {
              userId: ctx.session.user.id,
            },
          },
        },
      });
      if (bounty?.participants.length) {
        throw new Error("You already joined this bounty");
      }
      if (bounty?.creatorId === ctx.session.user.id) {
        throw new Error("You can't join your own bounty");
      }
      await ctx.db.bountyParticipant.create({
        data: {
          bountyId: input.BountyId,
          userId: ctx.session.user.id,
        },
      });
      // Notify the bounty creator about the new participant
      if (bounty?.creatorId) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.BOUNTY_PARTICIPANT,
            entityId: input.BountyId,
            isUser: true,
            Notification: {
              create: [
                {
                  notifierId: bounty.creatorId,
                  isCreator: true,
                },
              ],
            },
          },
        });
      }
    }),

  getAllBountyByUserId: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
        search: z.string().optional(),
        sortBy: z.nativeEnum(sortOptionEnum).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor, skip, search, sortBy } = input;

      const orderBy: Prisma.BountyOrderByWithRelationInput = {};
      if (sortBy === sortOptionEnum.DATE_ASC) {
        orderBy.createdAt = "asc";
      } else if (sortBy === sortOptionEnum.DATE_DESC) {
        orderBy.createdAt = "desc";
      } else if (sortBy === sortOptionEnum.PRICE_ASC) {
        orderBy.priceInUSD = "asc";
      } else if (sortBy === sortOptionEnum.PRICE_DESC) {
        orderBy.priceInUSD = "desc";
      }

      const where: Prisma.BountyWhereInput = {
        creatorId: ctx.session.user.id,
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const bounties = await ctx.db.bounty.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: where,
        include: {
          _count: {
            select: {
              participants: true,
              BountyWinner: true,
            },
          },
          BountyWinner: {
            select: {
              user: {
                select: {
                  id: true,
                },
              },
              isSwaped: true,
            },
          },
          creator: {
            select: {
              name: true,
            },
          },
          participants: {
            where: { userId: ctx.session?.user.id },
            select: { userId: true },
          },
        },
        orderBy: orderBy,
      });
      const bountyWithIsOwnerNisJoined = bounties.map((bounty) => {
        return {
          ...bounty,
          isOwner: bounty.creatorId === ctx.session?.user.id,
          isJoined: bounty.participants.some(
            (participant) => participant.userId === ctx.session?.user.id,
          ),
        };
      });
      let nextCursor: typeof cursor | undefined = undefined;
      if (bountyWithIsOwnerNisJoined.length > limit) {
        const nextItem = bountyWithIsOwnerNisJoined.pop();
        nextCursor = nextItem?.id;
      }

      return {
        bounties: bountyWithIsOwnerNisJoined,
        nextCursor: nextCursor,
      };
    }),

  getBountyByID: publicProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
        include: {
          participants: {
            select: {
              user: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              profileUrl: true,
            },
          },
          BountyWinner: {
            select: {
              user: {
                select: {
                  id: true,
                },
              },
              isSwaped: true,
            },
          },

          submissions: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              medias: true,
            },
          },
          comments: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              content: true,
            },
          },
          _count: {
            select: {
              participants: true,
              submissions: true,
              comments: true,
              BountyWinner: true,
            },
          },
        },
      });
      return bounty;
    }),
  createBountyAttachment: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
        content: z.string().min(2, { message: "Description can't be empty" }),
        medias: z.array(SubmissionMediaInfo).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      await ctx.db.bountySubmission.create({
        data: {
          userId: ctx.session.user.id,
          content: input.content,
          bountyId: input.BountyId,
          medias: input.medias
            ? {
                createMany: {
                  data: input.medias,
                },
              }
            : undefined,
        },
      });

      await ctx.db.notificationObject.create({
        data: {
          actorId: ctx.session.user.id,
          entityType: NotificationType.BOUNTY_SUBMISSION,
          entityId: input.BountyId,
          isUser: true,
          Notification: {
            create: [
              {
                notifierId: bounty.creatorId,
                isCreator: true,
              },
            ],
          },
        },
      });
    }),

  updateBountyAttachment: protectedProcedure
    .input(
      z.object({
        submissionId: z.number(),
        content: z.string().min(2, { message: "Description can't be empty" }),
        medias: z.array(SubmissionMediaInfo).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bountySubmission.findUnique({
        where: {
          id: input.submissionId,
        },
      });

      if (!bounty) {
        throw new Error("Bounty not found");
      }
      if (bounty.userId !== ctx.session.user.id) {
        throw new Error("You are not the owner of this bounty");
      }
      await ctx.db.bountySubmission.update({
        where: {
          id: input.submissionId,
        },
        data: {
          content: input.content,
          medias: {
            deleteMany: {}, // Remove existing media
            createMany: {
              data: input.medias
                ? input.medias.map((media) => ({
                    url: media.url,
                    name: media.name,
                    size: media.size,
                    type: media.type,
                  }))
                : [],
            },
          },
        },
      });
    }),

  getSubmittedAttachmentById: protectedProcedure
    .input(
      z.object({
        submissionId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db.bountySubmission.findUnique({
        where: { id: input.submissionId },
        include: {
          medias: true,
        },
      });
    }),
  getBountyAttachmentByUserId: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const bounty = await ctx.db.bountySubmission.findMany({
        where: {
          bountyId: input.BountyId,
          userId: ctx.session.user.id,
        },
        include: {
          medias: true,
        },
      });

      if (!bounty) {
        throw new Error("Bounty not found");
      }
      return bounty;
    }),
  isOwnerOfBounty: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      return {
        isOwner: bounty.creatorId === ctx.session.user.id,
      };
    }),

  deleteBounty: protectedProcedure
    .input(
      z.object({
        BountyId: z
          .number()
          .min(1, { message: "Bounty ID can't be less than 0" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      if (bounty.creatorId !== ctx.session.user.id) {
        throw new Error("You are not the owner of this bounty");
      }
      await ctx.db.bounty.delete({
        where: {
          id: input.BountyId,
        },
      });
    }),
  getCurrentUSDFromAsset: protectedProcedure.query(async ({ ctx }) => {
    return await getPlatformAssetPrice();
  }),
  getPlatformAsset: protectedProcedure.query(async ({ ctx }) => {
    return await getAssetPrice();
  }),

  getAssetToUSDCRate: protectedProcedure.query(async ({ ctx }) => {
    return await getAssetToUSDCRate();
  }),
  getTrustCost: protectedProcedure.query(async ({ ctx }) => {
    return await getplatformAssetNumberForXLM(0.5);
  }),

  getSendBalanceToWinnerXdr: protectedProcedure
    .input(
      z.object({
        prize: z
          .number()
          .min(0.00001, { message: "Prize can't less than 00001" }),
        userId: z
          .string()
          .min(1, { message: "Bounty ID can't be less than 0" }),
        BountyId: z
          .number()
          .min(1, { message: "Bounty ID can't be less than 0" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = input.userId;
      const winners = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
        select: {
          _count: {
            select: {
              BountyWinner: true,
            },
          },
          totalWinner: true,
          priceInXLM: true,
          currentWinnerCount: true,
        },
      });
      if (!winners) {
        throw new Error("Bounty not found");
      }

      if (winners.currentWinnerCount === winners.totalWinner) {
        throw new Error(
          "Bounty has finished, you can't send balance to winner",
        );
      }

      if (winners.priceInXLM) {
        return await SendBountyBalanceToWinnerViaXLM({
          recipientID: userPubKey,
          prizeInXLM: winners.priceInXLM,
        });
      } else {
        return await SendBountyBalanceToWinner({
          recipientID: userPubKey,
          prize: input.prize / winners.totalWinner,
        });
      }
    }),
  makeBountyWinner: protectedProcedure
    .input(
      z.object({
        BountyId: z
          .number()
          .min(1, { message: "Bounty ID can't be less than 0" }),
        userId: z.string().min(1, { message: "User ID can't be less than 0" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
        select: {
          _count: {
            select: {
              BountyWinner: true,
            },
          },
          totalWinner: true,
          creatorId: true,
          currentWinnerCount: true,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      if (bounty.currentWinnerCount === bounty.totalWinner) {
        throw new Error("Bounty has reached the maximum number of winners");
      }
      if (bounty.creatorId !== ctx.session.user.id) {
        throw new Error("You are not the owner of this bounty");
      }
      await ctx.db.bounty.update({
        where: {
          id: input.BountyId,
        },
        data: {
          BountyWinner: {
            create: {
              userId: input.userId,
            },
          },
          currentWinnerCount: {
            increment: 1,
          },
        },
      });

      await ctx.db.notificationObject.create({
        data: {
          actorId: ctx.session.user.id,
          entityType: NotificationType.BOUNTY_WINNER,
          entityId: input.BountyId,
          isUser: true,
          Notification: {
            create: [
              {
                notifierId: input.userId,
                isCreator: false,
              },
            ],
          },
        },
      });
    }),

  updateBountySubmissionStatus: protectedProcedure
    .input(
      z.object({
        creatorId: z
          .string()
          .min(1, { message: "User ID can't be less than 0" }),
        submissionId: z.number(),
        status: z.nativeEnum(SubmissionViewType),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const Submission = await ctx.db.bountySubmission.findUnique({
        where: {
          id: input.submissionId,
        },
      });

      if (!Submission) {
        throw new Error("Bounty not found");
      }
      const submission = await ctx.db.bountySubmission.findUnique({
        where: {
          id: input.submissionId,
        },
      });
      if (!submission) {
        throw new Error("Submission not found");
      }

      const isUserIsAdmin = await ctx.db.admin.findUnique({
        where: {
          id: ctx.session.user.id,
        },
      });
      const isOwner = input.creatorId === ctx.session.user.id;

      if (!isOwner && !isUserIsAdmin) {
        throw new Error(
          "You do not have permission to update this submission status",
        );
      }
      await ctx.db.bountySubmission.update({
        where: {
          id: input.submissionId,
        },
        data: {
          status: input.status,
        },
      });
    }),

  getDeleteXdr: protectedProcedure
    .input(
      z.object({
        prize: z.number().min(0.00001, { message: "Prize can't less than 0" }),
        creatorId: z
          .string()
          .min(1, { message: "User ID can't be less than 0" })
          .optional(),
        bountyId: z
          .number()
          .min(1, { message: "Bounty ID can't be less than 0" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userPubKey = ctx.session.user.id;
      const hasBountyWinner = await ctx.db.bountyWinner.findFirst({
        where: {
          bountyId: input.bountyId,
        },
      });
      if (hasBountyWinner) {
        throw new Error("Bounty has a winner, you can't delete this bounty");
      }

      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.bountyId,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      if (bounty.priceInXLM) {
        return await SendBountyBalanceToUserAccountViaXLM({
          userPubKey: input.creatorId ? input.creatorId : userPubKey,
          prizeInXLM: bounty.priceInXLM,
        });
      } else
        return await SendBountyBalanceToUserAccount({
          userPubKey: input.creatorId ? input.creatorId : userPubKey,
          prize: input.prize,
        });
    }),

  updateBounty: protectedProcedure
    .input(
      BountySchema.merge(
        z.object({
          BountyId: z.number(),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: {
          id: input.BountyId,
        },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      if (bounty.creatorId !== ctx.session.user.id) {
        throw new Error("You are not the owner of this bounty");
      }
      await ctx.db.bounty.update({
        where: {
          id: input.BountyId,
        },
        data: {
          title: input.title,
          description: input.content,
          requiredBalance: input.requiredBalance,
          status: input.status,
          imageUrls: input.medias ? input.medias.map((media) => media.url) : [],
        },
      });
    }),
  deleteBountySubmission: protectedProcedure
    .input(
      z.object({
        submissionId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return await ctx.db.bountySubmission.delete({
        where: { id: input.submissionId, userId },
      });
    }),

  createBountyComment: protectedProcedure
    .input(BountyCommentSchema)
    .mutation(async ({ ctx, input }) => {
      let comment;

      if (input.parentId) {
        comment = await ctx.db.bountyComment.create({
          data: {
            content: input.content,
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
            bountyParentCommentID: input.parentId,
          },
        });
      } else {
        comment = await ctx.db.bountyComment.create({
          data: {
            content: input.content,
            bountyId: input.bountyId,
            userId: ctx.session.user.id,
          },
        });
      }

      const bountys = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { creatorId: true },
      });

      const previousCommenters = await ctx.db.bountyComment.findMany({
        where: {
          bountyId: input.bountyId,
          userId: { not: ctx.session.user.id },
        },
        distinct: ["userId"],
        select: { userId: true },
      });

      const previousCommenterIds = previousCommenters.map(
        (comment) => comment.userId,
      );

      const usersToNotify = new Set([
        bountys?.creatorId,
        ...previousCommenterIds,
      ]);

      usersToNotify.delete(ctx.session.user.id);

      if (usersToNotify.size > 0) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: input.parentId
              ? NotificationType.BOUNTY_REPLY
              : NotificationType.BOUNTY_COMMENT,
            entityId: input.bountyId,
            isUser: false,
            Notification: {
              create: Array.from(usersToNotify)
                .filter(
                  (notifierId): notifierId is string =>
                    notifierId !== undefined,
                )
                .map((notifierId) => ({
                  notifierId,
                  isCreator: notifierId === bountys?.creatorId,
                })),
            },
          },
        });
      }
      return comment;
    }),

  getBountyComments: publicProcedure
    .input(z.object({ bountyId: z.number(), limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      if (input.limit) {
        const comments = await ctx.db.bountyComment.findMany({
          where: {
            bountyId: input.bountyId,
            bountyParentBComment: null,
          },
          include: {
            user: { select: { name: true, image: true } },
            bountyChildComments: {
              include: {
                user: { select: { name: true, image: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        });
        const detailedComments = await Promise.all(
          comments.map(async (comment) => {
            const userWins = await ctx.db.bountyWinner.count({
              where: {
                userId: comment.userId,
              },
            });

            return {
              ...comment,
              userWinCount: userWins,
            };
          }),
        );
        return detailedComments;
      } else {
        const comments = await ctx.db.bountyComment.findMany({
          where: {
            bountyId: input.bountyId,
            bountyParentBComment: null,
          },

          include: {
            user: { select: { name: true, image: true } },
            bountyChildComments: {
              include: {
                user: { select: { name: true, image: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },

          orderBy: { createdAt: "desc" },
        });
        const detailedComments = await Promise.all(
          comments.map(async (comment) => {
            const userWins = await ctx.db.bountyWinner.count({
              where: {
                userId: comment.userId,
              },
            });

            return {
              ...comment,
              userWinCount: userWins,
            };
          }),
        );
        return detailedComments;
      }
    }),
  deleteBountyComment: protectedProcedure
    .input(z.number())
    .mutation(async ({ input: bountyCommentId, ctx }) => {
      const userId = ctx.session.user.id;
      return await ctx.db.bountyComment.delete({
        where: { id: bountyCommentId, userId },
      });
    }),

  getCommentCount: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db.bountyComment.count({
        where: {
          bountyId: input.bountyId,
        },
      });
    }),
  getBountyAllSubmission: protectedProcedure
    .input(
      z.object({
        BountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const submissions = await ctx.db.bountySubmission.findMany({
        where: {
          bountyId: input.BountyId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          medias: true,
        },
      });

      const detailedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const userWins = await ctx.db.bountyWinner.count({
            where: {
              userId: submission.userId,
            },
          });

          return {
            ...submission,
            userWinCount: userWins,
          };
        }),
      );

      return detailedSubmissions;
    }),
  swapAssetToUSDC: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        priceInBand: z.number(),
        priceInUSD: z.number(),
        signWith: SignUser,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      let secretKey;
      if (ctx.session.user.email && ctx.session.user.email.length > 0) {
        secretKey = await getAccSecretFromRubyApi(ctx.session.user.email);
      }
      const findXDR = await ctx.db.bountyWinner.findFirst({
        where: {
          bountyId: input.bountyId,
          userId: ctx.session.user.id,
        },
        select: {
          xdr: true,
        },
      });

      if (findXDR?.xdr) {
        const prevXDR = findXDR.xdr;
        const isSubmitted = await checkXDRSubmitted(prevXDR);
        if (isSubmitted) {
          throw new Error("You already submitted the XDR");
        }
      }

      const res = await SwapUserAssetToMotherUSDC({
        priceInBand: input.priceInBand,
        priceInUSD: input.priceInUSD,
        userPubKey: ctx.session.user.id,
        secretKey: secretKey,
        signWith: input.signWith,
      });

      if (res.xdr) {
        await ctx.db.bounty.update({
          where: {
            id: input.bountyId,
          },
          data: {
            BountyWinner: {
              create: {
                userId: ctx.session.user.id,
                xdr: res.xdr,
              },
            },
          },
        });
      }
      return res;
    }),

  makeSwapUpdate: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.update({
        where: {
          id: input.bountyId,
        },
        data: {
          BountyWinner: {
            create: {
              userId: ctx.session.user.id,
              isSwaped: true,
            },
          },
        },
      });
    }),
  hasMotherTrustOnUSDC: protectedProcedure.query(async ({ ctx }) => {
    return getHasMotherTrustOnUSDC();
  }),

  hasUserTrustOnUSDC: protectedProcedure.query(async ({ ctx }) => {
    return await getHasUserHasTrustOnUSDC(ctx.session.user.id);
  }),

  createUpdateBountyDoubtForCreatorAndUser: protectedProcedure
    .input(
      z.object({
        chatUserId: z.string(),
        bountyId: z.number(),
        content: z.string().min(2, { message: "Message can't be empty" }), // The doubt message
        role: z.nativeEnum(UserRole).optional(),
        media: z.array(SubmissionMediaInfo).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { bountyId, content, role, chatUserId } = input;
      const creatorId = ctx.session.user.id;
      const newContent = input.media
        ? `${content} ${input.media.map((media) => media.url).join(" ")}`
        : content;

      const existingBountyDoubt = await ctx.db.bountyDoubt.findFirst({
        where: {
          bountyId: bountyId,
          userId: chatUserId, // The user involved in the doubt
          bounty: {
            creatorId: creatorId, // Ensure it's the same creator
          },
        },
      });
      if (!existingBountyDoubt) {
        await ctx.db.bountyDoubt.create({
          data: {
            bountyId: bountyId,
            userId: chatUserId,
            messages: {
              create: {
                senderId: creatorId,
                role: role ?? UserRole.CREATOR,
                content: content,
              },
            },
            updatedAt: new Date(),
          },
        });
        await ctx.db.notificationObject.create({
          data: {
            actorId: creatorId,
            entityType: NotificationType.BOUNTY_DOUBT_CREATE,
            entityId: bountyId,
            isUser: false,
            Notification: {
              create: [
                {
                  notifierId: chatUserId,
                  isCreator: false,
                },
              ],
            },
          },
        });
      } else {
        await ctx.db.bountyDoubtMessage.create({
          data: {
            doubtId: existingBountyDoubt.id,
            senderId: creatorId,
            role: role ?? UserRole.CREATOR,
            content: newContent,
            createdAt: new Date(),
          },
        });
        await ctx.db.bountyDoubt.update({
          where: { id: existingBountyDoubt.id },
          data: {
            updatedAt: new Date(),
          },
        });
        await ctx.db.notificationObject.create({
          data: {
            actorId: creatorId,
            entityType: NotificationType.BOUNTY_DOUBT_REPLY,
            entityId: bountyId,
            isUser: false,
            Notification: {
              create: [
                {
                  notifierId: chatUserId,
                  isCreator: false,
                },
              ],
            },
          },
        });
      }
    }),

  createUpdateBountyDoubtForUserCreator: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        content: z.string().min(2, { message: "Message can't be empty" }), // The doubt message
        role: z.nativeEnum(UserRole).optional(),
        media: z.array(SubmissionMediaInfo).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { bountyId, content, role } = input;
      const userId = ctx.session.user.id;
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: bountyId },
        select: { creatorId: true },
      });
      if (!bounty) {
        throw new Error("Bounty not found");
      }
      const newContent = input.media
        ? `${content} ${input.media.map((media) => media.url).join(" ")}`
        : content;
      const creatorId = bounty.creatorId;
      const existingBountyDoubt = await ctx.db.bountyDoubt.findFirst({
        where: {
          bountyId: bountyId,
          userId: userId,
          bounty: {
            creatorId: creatorId,
          },
        },
      });
      if (!existingBountyDoubt) {
        await ctx.db.bountyDoubt.create({
          data: {
            bountyId: bountyId,
            userId: userId,
            messages: {
              create: {
                senderId: creatorId,
                role: role ?? UserRole.CREATOR,
                content: content,
              },
            },
            updatedAt: new Date(),
          },
        });

        await ctx.db.notificationObject.create({
          data: {
            actorId: userId,
            entityType: NotificationType.BOUNTY_DOUBT_CREATE,
            entityId: bountyId,
            isUser: false,
            Notification: {
              create: [
                {
                  notifierId: creatorId,
                  isCreator: true,
                },
              ],
            },
          },
        });
      } else {
        await ctx.db.bountyDoubtMessage.create({
          data: {
            doubtId: existingBountyDoubt.id,
            senderId: creatorId,
            role: role ?? UserRole.CREATOR,
            content: newContent,
            createdAt: new Date(),
          },
        });
        await ctx.db.bountyDoubt.update({
          where: { id: existingBountyDoubt.id },
          data: {
            updatedAt: new Date(),
          },
        });

        await ctx.db.notificationObject.create({
          data: {
            actorId: userId,
            entityType: NotificationType.BOUNTY_DOUBT_REPLY,
            entityId: bountyId,
            isUser: false,
            Notification: {
              create: [
                {
                  notifierId: creatorId,
                  isCreator: true,
                },
              ],
            },
          },
        });
      }
    }),

  listBountyDoubts: protectedProcedure
    .input(z.object({ bountyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const creator = await ctx.db.bounty.findUnique({
        where: {
          id: input.bountyId,
        },
        select: {
          creatorId: true,
        },
      });
      const doubts = await ctx.db.bountyDoubt.findMany({
        where: {
          bountyId: input.bountyId,
          userId: { not: creator?.creatorId },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        distinct: ["userId"],
      });

      const users = doubts.map((doubt) => doubt.user.id);

      const winnerCounts = await ctx.db.bountyWinner.groupBy({
        by: ["userId"],
        _count: {
          userId: true,
        },
        where: {
          userId: {
            in: users,
          },
        },
      });
      const result = doubts.map((doubt) => {
        const winnerData = winnerCounts.find((w) => w.userId === doubt.user.id);
        return {
          ...doubt,
          winnerCount: winnerData ? winnerData._count.userId : 0,
        };
      });
      return result;
    }),

  getBountyForUserCreator: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
        userId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { creatorId: true },
      });

      if (!bounty) {
        throw new Error("Bounty not found");
      }

      // Fetch the doubts between the user and creator
      const bountyDoubts = await ctx.db.bountyDoubt.findMany({
        where: {
          bountyId: input.bountyId,
          userId: input.userId, // Fetch doubts initiated by the specific user
        },
        include: {
          messages: {
            where: {
              senderId: {
                in: [input.userId, bounty.creatorId], // Ensure both user and creator messages are fetched
              },
            },
            orderBy: { createdAt: "asc" }, // Order messages by creation time
          },
        },
      });

      // Debugging purposes: check the retrieved bounty doubts

      // Map messages to extract content and role
      const messages = bountyDoubts.flatMap((doubt) =>
        doubt.messages.map((message) => ({
          message: message.content,
          role: message.role,
        })),
      );

      return messages.length > 0 ? messages : [];
    }),

  getBountyForCreatorUser: protectedProcedure
    .input(
      z.object({
        bountyId: z.number(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const bounty = await ctx.db.bounty.findUnique({
        where: { id: input.bountyId },
        select: { creatorId: true },
      });

      if (!bounty) {
        throw new Error("Bounty not found");
      }

      // Fetch the doubts between the user and creator
      const bountyDoubts = await ctx.db.bountyDoubt.findMany({
        where: {
          bountyId: input.bountyId,
          userId: userId, // Fetch doubts initiated by the specific user
        },
        include: {
          messages: {
            where: {
              senderId: {
                in: [userId, bounty.creatorId], // Ensure both user and creator messages are fetched
              },
            },
            orderBy: { createdAt: "asc" }, // Order messages by creation time
          },
        },
      });

      // Debugging purposes: check the retrieved bounty doubts

      // Map messages to extract content and role
      const messages = bountyDoubts.flatMap((doubt) =>
        doubt.messages.map((message) => ({
          message: message.content,
          role: message.role,
        })),
      );

      return messages.length > 0 ? messages : [];
    }),

  getplatformAssetNumberForXLM: protectedProcedure
    .input(
      z.object({
        xlm: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await getplatformAssetNumberForXLM(input.xlm);
    }),
});

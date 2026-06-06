import {
  CommunityMemberListVisibility,
  NotificationType,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const communityMemberRouter = createTRPCRouter({
  join: protectedProcedure
    .input(z.object({
      communityId: z.number(),
      walletBalances: z.array(z.object({
        assetCode: z.string(),
        assetIssuer: z.string(),
        balance: z.number(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const userExists = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found. Please reconnect your wallet." });

      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
        include: {
          tokenRequirements: true,
        },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });

      if (community.isTokenGated && community.tokenRequirements.length > 0 && input.walletBalances) {
        const logic = community.tokenGateLogic;
        const results = community.tokenRequirements.map((req) => {
          const walletEntry = input.walletBalances?.find(
            (b) => b.assetCode === req.assetCode && b.assetIssuer === req.assetIssuer
          );
          if (req.requiredBalance === 0) {
            return walletEntry !== undefined;
          }
          return (walletEntry?.balance ?? 0) >= req.requiredBalance;
        });

        const passes = logic === "AND"
          ? results.every(Boolean)
          : results.some(Boolean);

        if (!passes) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: logic === "AND"
              ? "You need all required tokens to join this community"
              : "You need at least one of the required tokens to join this community",
          });
        }
      }

      const existing = await ctx.db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId,
          },
        },
      });

      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });

      const member = await ctx.db.communityMember.create({
        data: {
          communityId: input.communityId,
          userId,
          role: "MEMBER",
        },
      });

      await ctx.db.communityActivity.create({
        data: {
          communityId: input.communityId,
          actorId: ctx.session.user.id,
          type: "JOIN",
        },
      });

      await ctx.db.communityNotificationPreference.create({
        data: {
          communityId: input.communityId,
          userId: ctx.session.user.id,
        },
      });

      // Notify community owner
      await ctx.db.notificationObject.create({
        data: {
          actorId: ctx.session.user.id,
          entityType: NotificationType.COMMUNITY_MEMBER_JOIN,
          entityId: input.communityId,
          isUser: true,
          Notification: {
            create: [
              {
                notifierId: community.ownerId,
                isCreator: false,
              },
            ],
          },
        },
      });

      return member;
    }),

  leave: protectedProcedure
    .input(z.object({ communityId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });

      if (community.ownerId === ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner cannot leave the community" });

      await ctx.db.communityMember.delete({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.session.user.id,
          },
        },
      });

      await ctx.db.communityNotificationPreference.deleteMany({
        where: {
          communityId: input.communityId,
          userId: ctx.session.user.id,
        },
      });

      await ctx.db.communityActivity.create({
        data: {
          communityId: input.communityId,
          actorId: ctx.session.user.id,
          type: "LEAVE",
        },
      });

      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({ communityId: z.number(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      if (community.ownerId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can remove members" });
      if (input.userId === community.ownerId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove the owner" });

      await ctx.db.communityMember.delete({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: input.userId,
          },
        },
      });

      await ctx.db.communityNotificationPreference.deleteMany({
        where: {
          communityId: input.communityId,
          userId: input.userId,
        },
      });

      return { success: true };
    }),

  getMembers: publicProcedure
    .input(
      z.object({
        communityId: z.number(),
        limit: z.number().default(20),
        cursor: z.number().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { communityId, limit, cursor } = input;

      const community = await ctx.db.community.findUnique({
        where: { id: communityId },
        select: { memberListVisibility: true, ownerId: true },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });

      if (community.memberListVisibility === CommunityMemberListVisibility.MEMBERS_ONLY) {
        if (!ctx.session?.user) {
          return { members: [], nextCursor: undefined, locked: true };
        }
        const isMember = await ctx.db.communityMember.findUnique({
          where: {
            communityId_userId: {
              communityId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!isMember) {
          return { members: [], nextCursor: undefined, locked: true };
        }
      }

      const members = await ctx.db.communityMember.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: { communityId },
        orderBy: { joinedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (members.length > limit) {
        const nextItem = members.pop();
        nextCursor = nextItem?.id;
      }

      return { members, nextCursor, locked: false };
    }),

  invite: protectedProcedure
    .input(
      z.object({
        communityId: z.number(),
        userIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership)
        throw new TRPCError({ code: "FORBIDDEN", message: "Only members can invite" });

      for (const userId of input.userIds) {
        const alreadyMember = await ctx.db.communityMember.findUnique({
          where: {
            communityId_userId: {
              communityId: input.communityId,
              userId,
            },
          },
        });

        if (alreadyMember) continue;

        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.COMMUNITY_INVITE,
            entityId: input.communityId,
            isUser: true,
            Notification: {
              create: [
                {
                  notifierId: userId,
                  isCreator: false,
                },
              ],
            },
          },
        });

        await ctx.db.communityActivity.create({
          data: {
            communityId: input.communityId,
            actorId: ctx.session.user.id,
            type: "MEMBER_INVITED",
            entityId: undefined,
          },
        });
      }

      return { success: true };
    }),

  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        communityId: z.number(),
        newPosts: z.boolean().optional(),
        newComments: z.boolean().optional(),
        newMembers: z.boolean().optional(),
        reactions: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { communityId, ...prefs } = input;

      return await ctx.db.communityNotificationPreference.upsert({
        where: {
          communityId_userId: {
            communityId,
            userId: ctx.session.user.id,
          },
        },
        update: prefs,
        create: {
          communityId,
          userId: ctx.session.user.id,
          ...prefs,
        },
      });
    }),

  searchUsers: protectedProcedure
    .input(z.object({ search: z.string().optional(), communityId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const excludeIds: string[] = [ctx.session.user.id];

      // Exclude existing members if communityId provided
      if (input.communityId) {
        const existingMembers = await ctx.db.communityMember.findMany({
          where: { communityId: input.communityId },
          select: { userId: true },
        });
        excludeIds.push(...existingMembers.map((m) => m.userId));
      }

      return await ctx.db.user.findMany({
        where: {
          ...(input.search && input.search.length >= 2
            ? {
                OR: [
                  { name: { contains: input.search, mode: "insensitive" } },
                  { email: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
          NOT: { id: { in: excludeIds } },
        },
        select: {
          id: true,
          name: true,
          image: true,
        },
        take: 20,
        orderBy: { joinedAt: "desc" },
      });
    }),

  getNotificationPreferences: protectedProcedure
    .input(z.object({ communityId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.communityNotificationPreference.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.session.user.id,
          },
        },
      });
    }),
});

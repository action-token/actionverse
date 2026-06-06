import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const communityActivityRouter = createTRPCRouter({
  getCommunityActivity: publicProcedure
    .input(
      z.object({
        communityId: z.number(),
        limit: z.number().default(20),
        cursor: z.number().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { communityId, limit, cursor } = input;

      const activities = await ctx.db.communityActivity.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: { communityId },
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, image: true },
          },
          community: {
            select: { id: true, title: true },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (activities.length > limit) {
        const nextItem = activities.pop();
        nextCursor = nextItem?.id;
      }

      return { activities, nextCursor };
    }),

  getMyActivity: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(3),
        cursor: z.number().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, cursor } = input;

      const memberships = await ctx.db.communityMember.findMany({
        where: { userId: ctx.session.user.id },
        select: { communityId: true },
      });

      const communityIds = memberships.map((m) => m.communityId);

      if (communityIds.length === 0) {
        return { activities: [], nextCursor: undefined };
      }

      const activities = await ctx.db.communityActivity.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          communityId: { in: communityIds },
          NOT: { actorId: ctx.session.user.id },
        },
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, image: true },
          },
          community: {
            select: { id: true, title: true },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (activities.length > limit) {
        const nextItem = activities.pop();
        nextCursor = nextItem?.id;
      }

      return { activities, nextCursor };
    }),
});

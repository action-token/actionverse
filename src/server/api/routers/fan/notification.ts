import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const notificationInclude = {
  notificationObject: {
    select: {
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  },
} as const;

export const notificationRouter = createTRPCRouter({
  getCreatorNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor } = input;

      const items = await ctx.db.notification.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          notifierId: ctx.session.user.id,
          isCreator: true,
        },
        select: {
          id: true,
          seen: true,
          createdAt: true,
          isCreator: true,
          ...notificationInclude,
        },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  getUserNotification: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor } = input;

      const notifications = await ctx.db.notification.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          notifierId: ctx.session.user.id,
          isCreator: false,
        },
        select: {
          id: true,
          seen: true,
          createdAt: true,
          isCreator: true,
          ...notificationInclude,
        },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (notifications.length > limit) {
        const nextItem = notifications.pop();
        nextCursor = nextItem?.id;
      }

      return { notifications, nextCursor };
    }),

  getUnseenNotificationCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: {
        notifierId: ctx.session.user.id,
        seen: null,
      },
    });

    return count ?? 0;
  }),

  markAllAsSeen: protectedProcedure
    .input(
      z.object({
        isCreator: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.notification.updateMany({
        where: {
          notifierId: ctx.session.user.id,
          isCreator: input.isCreator,
          seen: null,
        },
        data: { seen: new Date() },
      });
    }),

  markAsSeen: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.notification.updateMany({
        where: {
          id: input.notificationId,
          notifierId: ctx.session.user.id,
          seen: null,
        },
        data: { seen: new Date() },
      });
    }),
});

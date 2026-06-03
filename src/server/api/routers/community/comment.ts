import { NotificationType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const communityCommentRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1, { message: "Comment can't be empty" }),
        parentCommentId: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.db.communityPost.findUnique({
        where: { id: input.postId },
        select: {
          communityId: true,
          authorId: true,
          commentsEnabled: true,
        },
      });

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      if (!post.commentsEnabled)
        throw new TRPCError({ code: "FORBIDDEN", message: "Comments are disabled on this post" });

      const membership = await ctx.db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: post.communityId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership)
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a member to comment" });

      if (input.parentCommentId) {
        const parentComment = await ctx.db.communityComment.findUnique({
          where: { id: input.parentCommentId },
        });
        if (!parentComment || parentComment.postId !== input.postId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid parent comment" });
      }

      const comment = await ctx.db.communityComment.create({
        data: {
          content: input.content,
          postId: input.postId,
          userId: ctx.session.user.id,
          parentCommentId: input.parentCommentId,
        },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      await ctx.db.communityActivity.create({
        data: {
          communityId: post.communityId,
          actorId: ctx.session.user.id,
          type: "COMMENT_CREATED",
          entityId: comment.id,
        },
      });

      const entityType = input.parentCommentId
        ? NotificationType.COMMUNITY_REPLY
        : NotificationType.COMMUNITY_COMMENT;

      // Collect user IDs to notify (avoid duplicates)
      const notifyUserIds = new Set<string>();

      // Notify post author
      if (post.authorId !== ctx.session.user.id) {
        notifyUserIds.add(post.authorId);
      }

      // Notify parent comment author on reply
      if (input.parentCommentId) {
        const parentComment = await ctx.db.communityComment.findUnique({
          where: { id: input.parentCommentId },
          select: { userId: true },
        });
        if (parentComment && parentComment.userId !== ctx.session.user.id) {
          notifyUserIds.add(parentComment.userId);
        }
      }

      // Notify community members with newComments preference
      const prefs = await ctx.db.communityNotificationPreference.findMany({
        where: {
          communityId: post.communityId,
          newComments: true,
          NOT: { userId: ctx.session.user.id },
        },
        select: { userId: true },
      });
      for (const pref of prefs) {
        notifyUserIds.add(pref.userId);
      }

      if (notifyUserIds.size > 0) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType,
            entityId: post.communityId,
            isUser: true,
            Notification: {
              create: Array.from(notifyUserIds).map((userId) => ({
                notifierId: userId,
                isCreator: false,
              })),
            },
          },
        });
      }

      return comment;
    }),

  delete: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const comment = await ctx.db.communityComment.findUnique({
        where: { id: input.commentId },
        include: {
          post: {
            select: {
              community: { select: { ownerId: true } },
            },
          },
        },
      });

      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });

      if (
        comment.userId !== ctx.session.user.id &&
        comment.post.community.ownerId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized to delete this comment" });

      await ctx.db.communityComment.delete({ where: { id: input.commentId } });

      return { success: true };
    }),

  getAll: publicProcedure
    .input(
      z.object({
        postId: z.number(),
        limit: z.number().default(20),
        cursor: z.number().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { postId, limit, cursor } = input;

      const comments = await ctx.db.communityComment.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          postId,
          parentCommentId: null,
        },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
          childComments: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (comments.length > limit) {
        const nextItem = comments.pop();
        nextCursor = nextItem?.id;
      }

      return { comments, nextCursor };
    }),
});

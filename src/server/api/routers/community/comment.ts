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

      // Notify post author
      if (post.authorId !== ctx.session.user.id) {
        const entityType = input.parentCommentId
          ? NotificationType.COMMUNITY_REPLY
          : NotificationType.COMMUNITY_COMMENT;

        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType,
            entityId: input.postId,
            isUser: true,
            Notification: {
              create: [
                {
                  notifierId: post.authorId,
                  isCreator: false,
                },
              ],
            },
          },
        });
      }

      // Notify parent comment author on reply
      if (input.parentCommentId) {
        const parentComment = await ctx.db.communityComment.findUnique({
          where: { id: input.parentCommentId },
          select: { userId: true },
        });

        if (
          parentComment &&
          parentComment.userId !== ctx.session.user.id &&
          parentComment.userId !== post.authorId
        ) {
          await ctx.db.notificationObject.create({
            data: {
              actorId: ctx.session.user.id,
              entityType: NotificationType.COMMUNITY_REPLY,
              entityId: input.postId,
              isUser: true,
              Notification: {
                create: [
                  {
                    notifierId: parentComment.userId,
                    isCreator: false,
                  },
                ],
              },
            },
          });
        }
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

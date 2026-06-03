import { MediaType, NotificationType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

const CommunityPostMediaSchema = z.object({
  url: z.string().url(),
  type: z.nativeEnum(MediaType),
});

export const communityPostRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        communityId: z.number(),
        content: z.string().min(1, { message: "Content can't be empty" }),
        medias: z.array(CommunityPostMediaSchema).optional(),
        commentsEnabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const community = await ctx.db.community.findUnique({
        where: { id: input.communityId },
        select: { postPermission: true, ownerId: true },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });

      const membership = await ctx.db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership)
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a member to post" });

      if (
        community.postPermission === "OWNER_ONLY" &&
        community.ownerId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can post in this community" });

      const post = await ctx.db.communityPost.create({
        data: {
          content: input.content,
          communityId: input.communityId,
          authorId: ctx.session.user.id,
          commentsEnabled: input.commentsEnabled,
          medias: input.medias
            ? { createMany: { data: input.medias } }
            : undefined,
        },
        include: {
          medias: true,
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      await ctx.db.communityActivity.create({
        data: {
          communityId: input.communityId,
          actorId: ctx.session.user.id,
          type: "POST_CREATED",
          entityId: post.id,
        },
      });

      // Notify members who have newPosts enabled
      const prefs = await ctx.db.communityNotificationPreference.findMany({
        where: {
          communityId: input.communityId,
          newPosts: true,
          NOT: { userId: ctx.session.user.id },
        },
        select: { userId: true },
      });

      for (const pref of prefs) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.COMMUNITY_POST,
            entityId: post.id,
            isUser: true,
            Notification: {
              create: [
                {
                  notifierId: pref.userId,
                  isCreator: false,
                },
              ],
            },
          },
        });
      }

      return post;
    }),

  update: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1).optional(),
        commentsEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.db.communityPost.findUnique({
        where: { id: input.postId },
      });

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      if (post.authorId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the author can edit this post" });

      const { postId, ...updateData } = input;

      return await ctx.db.communityPost.update({
        where: { id: postId },
        data: updateData,
        include: {
          medias: true,
          author: {
            select: { id: true, name: true, image: true },
          },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.db.communityPost.findUnique({
        where: { id: input.postId },
        include: { community: { select: { ownerId: true } } },
      });

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      if (
        post.authorId !== ctx.session.user.id &&
        post.community.ownerId !== ctx.session.user.id
      )
        throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized to delete this post" });

      await ctx.db.communityPost.delete({ where: { id: input.postId } });

      return { success: true };
    }),

  getAll: publicProcedure
    .input(
      z.object({
        communityId: z.number(),
        limit: z.number().default(10),
        cursor: z.number().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { communityId, limit, cursor } = input;

      const community = await ctx.db.community.findUnique({
        where: { id: communityId },
        select: { isTokenGated: true },
      });

      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });

      if (community.isTokenGated && ctx.session?.user) {
        const isMember = await ctx.db.communityMember.findUnique({
          where: {
            communityId_userId: {
              communityId,
              userId: ctx.session.user.id,
            },
          },
        });
        if (!isMember) {
          return { posts: [], nextCursor: undefined, locked: true };
        }
      } else if (community.isTokenGated && !ctx.session?.user) {
        return { posts: [], nextCursor: undefined, locked: true };
      }

      const posts = await ctx.db.communityPost.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: { communityId },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
          medias: true,
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
          likes: ctx.session?.user
            ? {
                where: { userId: ctx.session.user.id },
                select: { id: true },
              }
            : false,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem?.id;
      }

      const postsWithLikeStatus = posts.map((post) => ({
        ...post,
        isLiked: Array.isArray(post.likes) && post.likes.length > 0,
        likes: undefined,
      }));

      return { posts: postsWithLikeStatus, nextCursor, locked: false };
    }),

  like: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.db.communityPost.findUnique({
        where: { id: input.postId },
        select: { communityId: true, authorId: true },
      });

      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      const membership = await ctx.db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: post.communityId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership)
        throw new TRPCError({ code: "FORBIDDEN", message: "Must be a member to like" });

      const existingLike = await ctx.db.communityPostLike.findUnique({
        where: {
          postId_userId: {
            postId: input.postId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (existingLike) {
        await ctx.db.communityPostLike.delete({
          where: { id: existingLike.id },
        });
        return { liked: false };
      }

      await ctx.db.communityPostLike.create({
        data: {
          postId: input.postId,
          userId: ctx.session.user.id,
        },
      });

      await ctx.db.communityActivity.create({
        data: {
          communityId: post.communityId,
          actorId: ctx.session.user.id,
          type: "POST_LIKED",
          entityId: input.postId,
        },
      });

      if (post.authorId !== ctx.session.user.id) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.COMMUNITY_REACTION,
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

      return { liked: true };
    }),
});

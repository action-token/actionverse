import { NotificationType } from "@prisma/client";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { PostSchema } from "~/components/modal/create-post-modal";
import { CommentSchema } from "~/components/post/comment/add-post-comment";
import { TRPCError } from "@trpc/server";

export const postRouter = createTRPCRouter({
  create: protectedProcedure
    .input(PostSchema)
    .mutation(async ({ ctx, input }) => {
      const limit = 100;
      const post = await ctx.db.postGroup.create({
        data: {
          heading: input.heading,
          content: input.content ?? "",
          creatorId: ctx.session.user.id,
          subscriptionId: input.subscription
            ? Number(input.subscription)
            : null,
          medias: input.medias
            ? {
              createMany: {
                data: input.medias,
              },
            }
            : undefined,
          posts: {
            createMany: {
              //create limit number of post
              data: Array.from({ length: limit }, (_, i) => ({
                isCollected: false,
              })),
            },
          }
        },
      });

      const followers = await ctx.db.temporalFollow.findMany({
        where: { creatorId: ctx.session.user.id },
        select: { userId: true },
      });

      const followerIds = followers.map((follower) => follower.userId);

      const createNotification = async (notifierId: string) => {
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.POST,
            entityId: post.id,
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

      return post;
    }),

  getPosts: protectedProcedure
    .input(
      z.object({
        pubkey: z.string().min(56, { message: "pubkey is more than 56" }),
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor } = input;
      const items = await ctx.db.postGroup.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          creatorId: input.pubkey,
        },
        include: {
          _count: {
            select: {
              likes: {
                where: { status: true },
              },
              comments: true,
            },
          },
          // return one uncollected post slot
          posts: {
            where: { isCollected: false },
            take: 1,
            select: { id: true, isCollected: true },
          },
          medias: true,
          subscription: true,
          creator: {
            select: { name: true, id: true, profileUrl: true, pageAsset: true, customPageAssetCodeIssuer: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        posts: items,
        nextCursor,
      };
    }),

  getAllRecentPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.number().nullish(),
        skip: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor } = input;

      const items = await ctx.db.postGroup.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,

        orderBy: { createdAt: "desc" },
        include: {
          subscription: {
            select: {
              id: true,
              name: true,
              price: true,
              description: true,
              creatorId: true,

            }
          },
          _count: {
            select: { likes: true, comments: true },
          },
          posts: {
            where: { isCollected: false },
            take: 1,
            select: { id: true, isCollected: true },
          },
          creator: {
            select: {
              name: true,
              id: true,
              pageAsset: { select: { code: true, issuer: true } },
              profileUrl: true,
              customPageAssetCodeIssuer: true,
              followers: {
                where: {
                  userId: ctx.session.user.id,
                },
              },
            },
          },
          medias: true,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        posts: items,
        nextCursor,
      };
    }),



  getAConsumedPost: protectedProcedure
    .input(z.number())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      // First find the post slot to get its postGroupId
      const post = await ctx.db.post.findUnique({
        where: { id: input },
        select: { postGroupId: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }
      const postGroup = await ctx.db.postGroup.findUnique({
        where: { id: post.postGroupId, collections: { some: { userId: userId } } },
        include: {
          subscription: {
            select: {
              id: true,
              name: true,
              price: true,
              description: true,
              creatorId: true,

            }
          },
          _count: {
            select: { likes: true, comments: true },
          },

          creator: {
            select: {
              name: true,
              id: true,
              pageAsset: { select: { code: true, issuer: true } },
              profileUrl: true,
              customPageAssetCodeIssuer: true,
            },
          },
          medias: true,
        },
      });
      if (!postGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found or you don't have access to it",
        })
      }
      return postGroup;

    }),

  getAPost: protectedProcedure
    .input(z.number())
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const post = await ctx.db.postGroup.findUnique({
        where: { id: input },
        include: {
          subscription: {
            select: {
              id: true,
              name: true,
              price: true,
              description: true,
              creatorId: true,

            }
          },
          _count: {
            select: { likes: true, comments: true },
          },

          creator: {
            select: {
              name: true,
              id: true,
              pageAsset: { select: { code: true, issuer: true } },
              profileUrl: true,
              customPageAssetCodeIssuer: true,
            },
          },
          medias: true,
        },
      });

      return post;

    }),

  deletePost: protectedProcedure
    .input(z.number())
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const post = await ctx.db.postGroup.findUnique({
        where: { id: input },
        select: { creatorId: true },
      });
      if (post?.creatorId === userId) {
        await ctx.db.postGroup.delete({ where: { id: input } });
      }
    }),

  getSecretMessage: protectedProcedure.query(async ({ ctx }) => {
    return "secret message";
  }),

  likeApost: protectedProcedure
    .input(z.number())
    .mutation(async ({ input: postGroupId, ctx }) => {
      const userId = ctx.session.user.id;

      const oldLike = await ctx.db.like.findUnique({
        where: { postGroupId_userId: { postGroupId, userId } },
        include: {
          postGroup: {
            select: {
              creatorId: true,
            },
          },
        },
      });

      if (oldLike) {
        await ctx.db.like.update({
          data: { status: true },
          where: {
            postGroupId_userId: { postGroupId: postGroupId, userId },
          },
        });
        return oldLike;
      } else {
        // first time.
        const like = await ctx.db.like.create({
          data: { userId, postGroupId },
          include: {
            postGroup: {
              select: {
                creatorId: true,
              },
            },
          },
        });
        if (like.postGroup?.creatorId === userId) return like;
        await ctx.db.notificationObject.create({
          data: {
            actorId: ctx.session.user.id,
            entityType: NotificationType.LIKE,
            entityId: postGroupId,
            isUser: false,
            Notification: {
              create: [
                {
                  notifierId: like.postGroup?.creatorId ?? "",
                  isCreator: true,
                },
              ],
            },
          },
        });
        // create notification
        // void ctx.db.post
        //   .findUnique({ where: { id: postId }, select: { creatorId: true } })
        //   .then(async (creator) => {
        //     if (creator) {
        //       await ctx.db.notificationObject.create({
        //         data: {
        //           actorId: userId,
        //           entityId: postId,
        //           entityType: NotificationType.LIKE,
        //           Notification: {
        //             create: [{ notifierId: creator.creatorId }],
        //           },
        //         },
        //       });
        //     }
        //   })
        //   .catch(console.error);

        return like;
      }
    }),

  unLike: protectedProcedure
    .input(z.number())
    .mutation(async ({ input: postGroupId, ctx }) => {
      await ctx.db.like.update({
        data: { status: false },
        where: {
          postGroupId_userId: { postGroupId: postGroupId, userId: ctx.session.user.id },
        },
      });
    }),

  getLikes: publicProcedure
    .input(z.number())
    .query(async ({ input: postGroupId, ctx }) => {
      return await ctx.db.like.count({
        where: { postGroupId },
      });
    }),

  isLiked: protectedProcedure
    .input(z.number())
    .query(async ({ input: postGroupId, ctx }) => {
      return await ctx.db.like.findFirst({
        where: { userId: ctx.session.user.id, postGroupId, status: true },
      });
    }),

  getComments: publicProcedure
    .input(z.object({ postGroupId: z.number(), limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      if (input.limit) {
        return await ctx.db.comment.findMany({
          where: {
            postGroupId: input.postGroupId,
            parentCommentID: null, // Fetch only top-level comments (not replies)
          },

          include: {
            user: { select: { name: true, image: true } }, // Include user details
            childComments: {
              include: {
                user: { select: { name: true, image: true } }, // Include user details for child comments
              },
              orderBy: { createdAt: "asc" }, // Order child comments by createdAt in ascending order
            },
          },
          take: input.limit, // Limit the number of comments
          orderBy: { createdAt: "desc" }, // Order top-level comments by createdAt in descending order
        });
      } else {
        return await ctx.db.comment.findMany({
          where: {
            postGroupId: input.postGroupId,
            parentCommentID: null, // Fetch only top-level comments (not replies)
          },

          include: {
            user: { select: { name: true, image: true } }, // Include user details
            childComments: {
              include: {
                user: { select: { name: true, image: true } }, // Include user details for child comments
              },
              orderBy: { createdAt: "asc" }, // Order child comments by createdAt in ascending order
            },
          },

          orderBy: { createdAt: "desc" }, // Order top-level comments by createdAt in descending order
        });
      }
    }),

  createComment: protectedProcedure
    .input(CommentSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let comment;

      if (input.parentId) {
        comment = await ctx.db.comment.create({
          data: {
            content: input.content,
            postGroupId: input.postGroupId,
            userId,
            parentCommentID: input.parentId,
          },
        });
      } else {
        comment = await ctx.db.comment.create({
          data: {
            content: input.content,
            postGroupId: input.postGroupId,
            userId,
          },
        });
      }

      const post = await ctx.db.postGroup.findUnique({
        where: { id: input.postGroupId },
        select: { creatorId: true },
      });

      const previousCommenters = await ctx.db.comment.findMany({
        where: {
          postGroupId: input.postGroupId,
          userId: { not: userId },
        },
        distinct: ["userId"],
        select: { userId: true },
      });

      const previousCommenterIds = previousCommenters.map(
        (comment) => comment.userId,
      );

      const usersToNotify = new Set([post?.creatorId, ...previousCommenterIds]);

      usersToNotify.delete(userId);

      if (usersToNotify.size > 0) {
        await ctx.db.notificationObject.create({
          data: {
            actorId: userId,
            entityType: input.parentId
              ? NotificationType.REPLY
              : NotificationType.COMMENT,
            entityId: input.postGroupId,
            isUser: false,
            Notification: {
              create: Array.from(usersToNotify)
                .filter(
                  (notifierId): notifierId is string =>
                    notifierId !== undefined,
                )
                .map((notifierId) => ({
                  notifierId,
                  isCreator: notifierId === post?.creatorId, // Mark if the notifier is the post creator
                })),
            },
          },
        });
      }

      return comment;
    }),
  deleteComment: protectedProcedure
    .input(z.number())
    .mutation(async ({ input: commentId, ctx }) => {
      const userId = ctx.session.user.id;
      return await ctx.db.comment.delete({ where: { id: commentId, userId } });
    }),

  search: publicProcedure
    .input(
      z.object({
        limit: z.number(),
        // cursor is a reference to the last item in the previous batch
        // it's used to fetch the next batch
        cursor: z.number().nullish(),
        skip: z.number().optional(),
        searchInput: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, skip, cursor, searchInput } = input;
      const items = await ctx.db.postGroup.findMany({
        take: limit + 1,
        skip: skip,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          OR: [
            // {
            //   content: {
            //     contains: searchInput,
            //     // how can i make this case insensitive?
            //     mode: "insensitive",
            //   },
            // },
            {
              heading: {
                contains: searchInput,
                mode: "insensitive",
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // return the last item from the array
        nextCursor = nextItem?.id;
      }

      return {
        posts: items,
        nextCursor,
      };
    }),
});

import { z } from "zod";
import { decode } from "next-auth/jwt";
import { ItemPrivacy } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { env } from "~/env";
import { db } from "~/server/db";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import { PlatformAssetBalance } from "~/lib/stellar/walletBalance/acc";
import { avaterIconUrl } from "~/pages/api/game/brands";
import { WadzzoIconURL } from "~/pages/api/game/locations/index";
import type { ConsumedLocation } from "~/types/game/location";
import { initAdmin } from "package/connect_wallet/src/lib/firebase/admin/config";
import { generateRedeemCode } from "~/lib/utils";
import { TRPCError } from "@trpc/server";

export const gameRouter = createTRPCRouter({
  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),

  decodeSessionToken: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const sessionToken = input;
      const decoded = await decode({
        token: sessionToken,
        secret: env.NEXTAUTH_SECRET ?? "",
      });
      return decoded;
    }),

  // Returns the current session user's profile fields
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  }),

  // Returns the user's platform asset balance
  getPlatformBalance: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const balance = await PlatformAssetBalance({ userPubKey: userId });
    return balance;
  }),

  // Returns all visible map pins for the user, optionally filtered to followed creators
  getPins: protectedProcedure
    .input(z.object({ filterId: z.string().default("0") }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userAcc = await StellarAccount.create(userId);

      const userFollowerRelationships = await db.creator.findMany({
        where: {
          OR: [
            { followers: { some: { userId } } },
            { temporalFollows: { some: { userId } } },
          ],
        },
        select: {
          id: true,
          followers: { where: { userId }, select: { userId: true } },
          temporalFollows: { where: { userId }, select: { userId: true } },
          pageAsset: { select: { code: true, issuer: true } },
        },
      });

      const memberCreatorIds: string[] = [];
      const temporalFollowerCreatorIds: string[] = [];
      for (const creator of userFollowerRelationships) {
        if (creator.followers.length > 0) {
          memberCreatorIds.push(creator.id);
        } else if (creator.temporalFollows.length > 0) {
          temporalFollowerCreatorIds.push(creator.id);
        }
      }

      const privacyConditions =
        input.filterId === "1"
          ? {
            OR: [
              { creatorId: { in: temporalFollowerCreatorIds }, privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.FOLLOWER] } },
              { creatorId: { in: memberCreatorIds }, privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.PRIVATE, ItemPrivacy.FOLLOWER, ItemPrivacy.TIER] } },
            ],
          }
          : {
            OR: [
              { privacy: ItemPrivacy.PUBLIC },
              { creatorId: { in: temporalFollowerCreatorIds }, privacy: ItemPrivacy.FOLLOWER },
              { creatorId: { in: memberCreatorIds }, privacy: { in: [ItemPrivacy.PRIVATE, ItemPrivacy.FOLLOWER, ItemPrivacy.TIER] } },
            ],
          };

      const locationGroups = await db.locationGroup.findMany({
        where: {
          AND: [
            { approved: true, startDate: { lte: new Date() }, endDate: { gte: new Date() }, subscriptionId: null, remaining: { gt: 0 }, hidden: false },
            privacyConditions,
          ],
        },
        include: {
          locations: { include: { consumers: { select: { userId: true, viewedAt: true } } } },
          Subscription: true,
          creator: { include: { pageAsset: { select: { code: true, issuer: true } } } },
        },
      });

      const pins = locationGroups.flatMap((group) => {
        const hasConsumedOne = group.locations.some((loc) =>
          loc.consumers.some((c) => c.userId === userId),
        );

        if (group.privacy === ItemPrivacy.TIER) {
          const creatorPageAsset = group.creator.pageAsset;
          const subscription = group.Subscription;
          if (creatorPageAsset && subscription) {
            const bal = userAcc.getTokenBalance(creatorPageAsset.code, creatorPageAsset.issuer);
            if (bal < subscription.price) return [];
          } else {
            return [];
          }
        }

        return group.locations.map((location) => ({
          id: location.id,
          lat: location.latitude,
          lng: location.longitude,
          title: group.title,
          description: group.description ?? "No description provided",
          brand_name: group.creator.name,
          viewed: location.consumers.some((el) => el.viewedAt != null),
          url: group.link ?? "https://app.action-tokens.com/",
          image_url: group.optimizedImage || group.image || group.creator.profileUrl || WadzzoIconURL,
          collected: group.multiPin
            ? location.consumers.some((c) => c.userId === userId)
            : hasConsumedOne,
          collection_limit_remaining: group.remaining,
          auto_collect: location.autoCollect,
          brand_image_url: group.creator.profileUrl ?? avaterIconUrl,
          brand_id: group.creatorId,
          public: true,
        })) satisfies ConsumedLocation[];
      });

      return { locations: pins };
    }),

  // Returns all pins the current user has collected
  getConsumedPins: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const dbLocations = await db.location.findMany({
      include: {
        locationGroup: {
          include: {
            creator: true,
            locations: {
              include: {
                _count: { select: { consumers: { where: { userId } } } },
              },
            },
          },
        },
        consumers: { select: { userId: true, viewedAt: true } },
      },
      where: {
        consumers: {
          some: { userId, hidden: false },
          none: { userId, hidden: true },
        },
      },
    });

    const locations = dbLocations
      .map((location): ConsumedLocation | undefined => {
        if (!location.locationGroup) return undefined;
        const totalGroupConsumers = location.locationGroup.locations.reduce(
          (sum, loc) => sum + loc._count.consumers,
          0,
        );
        const remaining = location.locationGroup.limit - totalGroupConsumers;
        return {
          id: location.id,
          lat: location.latitude,
          lng: location.longitude,
          title: location.locationGroup.title,
          description: location.locationGroup.description ?? "No description provided",
          viewed: location.consumers.some((el) => el.viewedAt != null),
          auto_collect: location.autoCollect,
          brand_image_url: location.locationGroup.creator.profileUrl ?? avaterIconUrl,
          brand_id: location.locationGroup.creator.id,
          modal_url: "https://vong.cong/",
          collected: true,
          collection_limit_remaining: remaining,
          brand_name: location.locationGroup.creator.name,
          image_url: location.locationGroup.optimizedImage ?? location.locationGroup.image ?? location.locationGroup.creator.profileUrl ?? WadzzoIconURL,
          url: location.locationGroup.link ?? "https://app.action-tokens.com/images/action/logo.png",
        };
      })
      .filter((loc): loc is ConsumedLocation => loc !== undefined);

    return { locations };
  }),

  // Marks a location as consumed by the current user
  consumePin: publicProcedure

    .input(z.object({
      pinId: z.string().optional(),
      postId: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {

      // ── Helper: unique 6-char redeem code with collision retry ──────────────
      const getUniqueRedeemCode = async (): Promise<string> => {
        for (let i = 0; i < 10; i++) {
          const code = generateRedeemCode();
          const exists = await ctx.db.locationConsumer.findUnique({
            where: { redeemCode: code },
          });
          if (!exists) return code;
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate a unique redeem code" });
      };
      const redeemCode = await getUniqueRedeemCode();

      if (input.pinId) {
        const { pinId } = input;
        if (ctx.session?.user.id) {
          const userId = ctx.session.user.id;
          const location = await ctx.db.location.findUnique({
            include: {
              _count: {
                select: {
                  consumers: {
                    where: { userId: userId },
                  },
                },
              },
              locationGroup: true,
            },
            where: { id: pinId },
          });
          if (!location?.locationGroup) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Could not find the location" });
          }

          if (location.locationGroup.multiPin) {
            // user have not consumed this location
            if (
              location._count.consumers <= 0 &&
              location.locationGroup.remaining > 0
            ) {
              // also check limit of the group

              await ctx.db.locationConsumer.create({
                data: { locationId: location.id, userId: userId, redeemCode, claimedAt: new Date() },
              });
              await ctx.db.locationGroup.update({
                where: { id: location.locationGroup.id },
                data: { remaining: { decrement: 1 } },
              });

              return { success: true, data: "Location consumed" };
            } else {
              return { success: false, data: "You have already consumed this location or no remaining pins" };
            }
          } else {
            const checkMeAsAConsumer = await ctx.db.locationGroup.findFirst({
              where: {
                locations: {
                  some: {
                    consumers: {
                      some: {
                        userId: userId,
                      },
                    },
                  },
                },
                id: location.locationGroup.id,
              },
            });


            if (!checkMeAsAConsumer) {
              await ctx.db.locationConsumer.create({
                data: { locationId: location.id, userId: userId, redeemCode, claimedAt: new Date() },
              });

              await ctx.db.locationGroup.update({
                where: { id: location.locationGroup.id },
                data: { remaining: { decrement: 1 } },
              });

              return { success: true, data: "Location consumed" };

            }
            else {
              return { success: false, data: "You have already consumed this location" };
            }
          }
        }
        else {
          return {
            success: true,
            data: "You can view this location but need to login to consume it"
          }
        }
      }
      else {
        if (ctx.session?.user.id) {
          const userId = ctx.session.user.id;
          if (!input.postId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Post ID is required to consume a post" });
          }
          return await ctx.db.$transaction(async (tx) => {

            // 1. Get the post and check if already collected
            const post = await tx.post.findUnique({
              where: { id: Number(input.postId) },
            });
            if (!post) throw new TRPCError({
              code: "NOT_FOUND",
              message: "Post not found",
            });
            if (post.isCollected) throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Post already collected",
            });

            const alreadyCollected = await tx.postCollection.findUnique({
              where: {
                postGroupId_userId: {
                  postGroupId: post.postGroupId,
                  userId,
                },
              },
            });
            if (alreadyCollected) throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You already collected a post from this group",
            });

            // 2. Mark post as collected + create collection record in parallel
            await Promise.all([
              tx.post.update({
                where: { id: Number(input.postId) },
                data: { isCollected: true },
              }),
              tx.postCollection.create({
                data: {
                  postId: Number(input.postId),
                  userId,
                  postGroupId: post.postGroupId,
                },
                include: {
                  post: true,
                  postGroup: {
                    include: {
                      medias: true,
                      creator: {
                        select: {
                          name: true,
                          id: true,
                          profileUrl: true,
                        },
                      },
                    },
                  },
                },
              }),
            ]);

            return ({ success: true, data: "Post collected successfully!" });
          });

        } else {
          return {
            success: true,
            data: "You can view this post but need to login to collect it"
          }
        }
      }
    }),

  getConsumedLocationById: protectedProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const location = await db.location.findFirst({
        where: {
          id: input.locationId,
          consumers: {
            some: { userId, hidden: false },
            none: { userId, hidden: true },
          },
        },
        include: {
          locationGroup: {
            include: {
              creator: true,
              locations: {
                include: {
                  _count: { select: { consumers: { where: { userId } } } },
                },
              },
            },
          },
          consumers: {
            where: { userId },
            select: { userId: true, viewedAt: true, redeemCode: true },
          },
        },
      });

      if (!location?.locationGroup) {
        throw new Error("Collection not found");
      }

      const group = location.locationGroup;
      const totalGroupConsumers = group.locations.reduce(
        (sum, loc) => sum + loc._count.consumers,
        0,
      );
      const remaining = group.limit - totalGroupConsumers;

      const loc: ConsumedLocation & { redeemCode?: string | null } = {
        id: location.id,
        lat: location.latitude,
        lng: location.longitude,
        title: group.title,
        description: group.description ?? "No description provided",
        viewed: location.consumers.some((el) => el.viewedAt != null),
        auto_collect: location.autoCollect,
        brand_image_url: group.creator.profileUrl ?? avaterIconUrl,
        brand_id: group.creator.id,
        collected: true,
        collection_limit_remaining: remaining,
        brand_name: group.creator.name,
        image_url: group.optimizedImage ?? group.image ?? group.creator.profileUrl ?? WadzzoIconURL,
        url: group.link ?? "https://app.action-tokens.com/images/action/logo.png",
        redeemCode: location.consumers[0]?.redeemCode,
      };

      return loc;
    }),

  // Deletes the current user's account from the database and Firebase
  deleteUser: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const email = ctx.session.user.email;

    if (email) {
      const admin = initAdmin();
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    await db.user.delete({
      where: { id: userId },
      include: {
        sessions: true,
        accounts: true,
        actorNotificationObjects: true,
        Admin: true,
        assets: true,
        comments: true,
        likes: true,
        followings: true,
        LocationConsumer: true,
        RedeemConsumer: true,
        songs: true,
        creator: true,
      },
    });

    return { success: true };
  }),
});

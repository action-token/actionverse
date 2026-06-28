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
  consumePin: protectedProcedure
    .input(z.object({ location_id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const location = await db.location.findUnique({
        include: {
          _count: { select: { consumers: { where: { userId } } } },
          locationGroup: true,
        },
        where: { id: input.location_id },
      });

      if (!location?.locationGroup) {
        throw new Error("Could not find the location");
      }
      // ── Helper: generate a unique redeem code with collision retry ──────────────
      const getUniqueRedeemCode = async (): Promise<string> => {
        for (let i = 0; i < 10; i++) {
          const code = generateRedeemCode();
          const exists = await db.locationConsumer.findUnique({ where: { redeemCode: code } });
          if (!exists) return code;
        }
        // Extremely unlikely — 32^6 = ~1 billion combinations
        throw new Error("Could not generate a unique redeem code");
      };
      if (location.locationGroup.multiPin) {
        if (location._count.consumers <= 0 && location.locationGroup.remaining > 0) {
          const redeemCode = await getUniqueRedeemCode();

          await db.locationConsumer.create({ data: { locationId: location.id, userId, redeemCode } });
          await db.locationGroup.update({
            where: { id: location.locationGroup.id },
            data: { remaining: { decrement: 1 } },
          });
          return { success: true };
        }
        throw new Error("Location limit reached");
      } else {
        const alreadyConsumed = await db.locationGroup.findFirst({
          where: {
            id: location.locationGroup.id,
            locations: { some: { consumers: { some: { userId } } } },
          },
        });

        if (!alreadyConsumed) {
          const redeemCode = await getUniqueRedeemCode();
          await db.locationConsumer.create({ data: { locationId: location.id, userId, redeemCode } });
          await db.locationGroup.update({
            where: { id: location.locationGroup.id },
            data: { remaining: { decrement: 1 } },
          });
          return { success: true };
        }
        throw new Error("Location limit reached");
      }
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

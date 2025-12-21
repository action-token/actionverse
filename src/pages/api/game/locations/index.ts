import type { NextApiRequest, NextApiResponse } from "next";

import { ItemPrivacy } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { EnableCors } from "~/server/api-cors";
import { db } from "~/server/db";
import { Location } from "~/types/game/location";
import { avaterIconUrl as abaterIconUrl } from "../brands";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await EnableCors(req, res);
  const token = await getToken({ req });

  if (!token) {
    res.status(401).json({
      error: "User is not authenticated",
    });
    return;
  }
  const data = z.object({ filterId: z.string() }).safeParse(req.query);

  if (!data.success) {
    console.log("data.error", data.error);
    return res.status(400).json({
      error: data.error,
    });
  }

  const userId = token.sub;

  if (!userId) {
    return res.status(401).json({
      error: "User is not authenticated",
    });
  }

  const userAcc = await StellarAccount.create(userId);

  // Step 1: Get all scavenger bounties user is participating in
  const getUserActionBounties = await db.bounty.findMany({
    where: {
      bountyType: "SCAVENGER_HUNT",
    },
    select: {
      ActionLocation: true,
      participants: {
        select: {
          userId: true,
          currentStep: true,
        },
      }
    }
  })

  // Collect all scavenger group IDs and currentStep+1 group IDs
  const allScavengerGroupIdsSet = new Set<string>();
  const currentStepGroupIdsSet = new Set<string>();
  for (const bounty of getUserActionBounties) {
    const currentStep = bounty.participants.find((p) => p.userId === userId)?.currentStep ?? -1;
    for (const action of bounty.ActionLocation) {
      allScavengerGroupIdsSet.add(action.locationGroupId);
      if (action.serial === currentStep + 1) {
        currentStepGroupIdsSet.add(action.locationGroupId);
      }
    }
  }

  // Get user's follower relationships
  const userFollowerRelationships = await db.creator.findMany({
    where: {
      OR: [
        {
          followers: {
            some: {
              userId: userId,
            },
          },
        },
        {
          temporalFollows: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      followers: {
        where: { userId: userId },
        select: { userId: true }
      },
      temporalFollows: {
        where: { userId: userId },
        select: { userId: true }
      },
      pageAsset: {
        select: {
          code: true,
          issuer: true,
        },
      },
    },
  });

  // Categorize creators by follower type
  const memberCreatorIds: string[] = [];
  const temporalFollowerCreatorIds: string[] = [];

  for (const creator of userFollowerRelationships) {
    if (creator.followers.length > 0) {
      memberCreatorIds.push(creator.id);
    } else if (creator.temporalFollows.length > 0) {
      temporalFollowerCreatorIds.push(creator.id);
    }
  }

  console.log("memberCreatorIds", memberCreatorIds);
  console.log("temporalFollowerCreatorIds", temporalFollowerCreatorIds);

  async function pinsForUser(filterId: string) {
    let privacyConditions;

    if (filterId === "1") {
      // Filter mode 1: Only followed creators
      privacyConditions = {
        OR: [
          // Temporal followers: PUBLIC + FOLLOWER
          {
            creatorId: { in: temporalFollowerCreatorIds },
            privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.FOLLOWER] },
          },
          // Members: PUBLIC + PRIVATE + FOLLOWER + TIER
          {
            creatorId: { in: memberCreatorIds },
            privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.PRIVATE, ItemPrivacy.FOLLOWER, ItemPrivacy.TIER] },
          },
        ],
      };
    } else {
      // Filter mode 0: All public + followed creators
      privacyConditions = {
        OR: [
          // All public pins
          {
            privacy: ItemPrivacy.PUBLIC,
          },
          // Temporal followers: FOLLOWER (PUBLIC already included above)
          {
            creatorId: { in: temporalFollowerCreatorIds },
            privacy: ItemPrivacy.FOLLOWER,
          },
          // Members: PRIVATE + FOLLOWER + TIER
          {
            creatorId: { in: memberCreatorIds },
            privacy: { in: [ItemPrivacy.PRIVATE, ItemPrivacy.FOLLOWER, ItemPrivacy.TIER] },
          },
        ],
      };
    }

    const locationGroup = await db.locationGroup.findMany({
      where: {
        AND: [
          {
            approved: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            subscriptionId: null,
            remaining: { gt: 0 },
            hidden: false,
          },
          {
            // Include only:
            // - groups NOT in any scavenger (to avoid duplicates)
            // OR
            // - current step+1 scavenger pins
            OR: [
              {
                NOT: {
                  id: {
                    in: Array.from(allScavengerGroupIdsSet),
                  },
                },
              },
              {
                id: {
                  in: Array.from(currentStepGroupIdsSet),
                },
              },
            ],
          },
          privacyConditions,
        ],
      },
      include: {
        locations: {
          include: {
            consumers: {
              select: {
                userId: true,
              },
            },
          },
        },
        Subscription: true,
        creator: {
          include: {
            pageAsset: {
              select: {
                code: true,
                issuer: true,
              },
            },
          },
        },
      },
    });

    const pins = locationGroup
      .flatMap((group) => {
        const multiPin = group.multiPin;
        const hasConsumedOne = group.locations.some((location) =>
          location.consumers.some((consumer) => consumer.userId === userId),
        );

        // Check Tier eligibility
        if (group.privacy === ItemPrivacy.TIER) {
          const creatorPageAsset = group.creator.pageAsset;
          const subscription = group.Subscription;

          if (creatorPageAsset && subscription) {
            const bal = userAcc.getTokenBalance(
              creatorPageAsset.code,
              creatorPageAsset.issuer,
            );

            // Not eligible for tier - skip this group
            if (bal < subscription.price) {
              return [];
            }
          } else {
            // Missing pageAsset or subscription data - skip
            return [];
          }
        }

        // Map locations with collected status
        if (multiPin) {
          return group.locations.map((location) => ({
            ...location,
            ...group,
            id: location.id,
            collected: location.consumers.some((c) => c.userId === userId),
          }));
        } else {
          return group.locations.map((location) => ({
            ...location,
            ...group,
            id: location.id,
            collected: hasConsumedOne,
          }));
        }
      })
      .filter((location) => location !== undefined);

    const locations: Location[] = pins.map((location) => {
      return {
        id: location.id,
        lat: location.latitude,
        lng: location.longitude,
        title: location.title,
        description: location.description ?? "No description provided",
        brand_name: location.creator.name,
        url: location.link ?? "https://app.action-tokens.com/",
        image_url:
          location.image ?? location.creator.profileUrl ?? WadzzoIconURL,
        collected: location.collected,
        collection_limit_remaining: location.remaining,
        auto_collect: location.autoCollect,
        brand_image_url: location.creator.profileUrl ?? abaterIconUrl,
        brand_id: location.creatorId,
        public: true,
      };
    });

    return locations;
  }

  const locations = await pinsForUser(data.data.filterId);
  console.log("locations.length", locations.length);
  res.status(200).json({ locations });
}

export const WadzzoIconURL = "https://app.action-tokens.com/images/action/logo.png";
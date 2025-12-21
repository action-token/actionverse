import type { NextApiRequest, NextApiResponse } from "next";

import { ItemPrivacy } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { EnableCors } from "~/server/api-cors";
import { db } from "~/server/db";
import { Location } from "~/types/game/location";
import { avaterIconUrl as abaterIconUrl } from "../brands";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import { m } from "framer-motion";

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
  const data = z.object({ filterId: z.string() }).safeParse(req.query); // Use req.query instead of req.body

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

  let creatorsId: string[] | undefined = undefined;
  if (data.data.filterId === "1") {

    const getAllFollowedBrand = await db.creator.findMany({
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
      include: {
        pageAsset: true,
        subscriptions: true,
      },
    });

    // type Creator = {
    //   id: string;
    //   pageAsset: {
    //     code: string;
    //     issuer: string;
    //   };
    // };

    // const creators: Creator[] = getAllFollowedBrand
    //   .map((brand) => {
    //     if (brand.pageAsset) {
    //       const { code, issuer } = brand.pageAsset;

    //       return {
    //         id: brand.id,
    //         pageAsset: {
    //           code,
    //           issuer,
    //         },
    //       };
    //     }
    //     return null;
    //   })
    //   .filter((creator): creator is Creator => creator !== null);

    creatorsId = getAllFollowedBrand.map((brand) => brand.id);
    console.log("creatorsId", creatorsId);
  }

  // now i am extracting this brands pins

  async function pinsForCreators(creatorsId?: string[]) {

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
        ],
        // Filter by creator if given (filterId = 1)
        ...(creatorsId && {
          creatorId: { in: creatorsId },
          privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.PRIVATE, ItemPrivacy.TIER, ItemPrivacy.FOLLOWER] },
        }),
        // Else only show public pins
        ...(!creatorsId && {
          privacy: { in: [ItemPrivacy.PUBLIC] },
        }),
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
        if (group.privacy === ItemPrivacy.TIER) {
          const creatorPageAsset = group.creator.pageAsset;
          const subscription = group.Subscription;

          if (creatorPageAsset && subscription) {
            const bal = userAcc.getTokenBalance(
              creatorPageAsset.code,
              creatorPageAsset.issuer,
            );
            if (bal >= subscription.price) {
              if (multiPin) {
                return group.locations.map((location) => ({
                  ...location,
                  ...group,
                  id: location.id,
                  collected: location.consumers.some(
                    (c) => c.userId === userId,
                  ),
                }));
              } else {
                return group.locations.map((location) => ({
                  ...location,
                  ...group,
                  id: location.id,
                  collected: hasConsumedOne,
                }));
              }
            }
          }
        } else {
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

  const locations = await pinsForCreators(creatorsId);
  console.log("locations.length", locations.length);
  res.status(200).json({ locations });
}

export const WadzzoIconURL = "https://app.action-tokens.com/images/action/logo.png";

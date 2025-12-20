import type { NextApiRequest, NextApiResponse } from "next";
import { ItemPrivacy } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { EnableCors } from "~/server/api-cors";
import { db } from "~/server/db";
import { Location } from "~/types/game/location";
import { avaterIconUrl } from "../brands";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";

export const WadzzoIconURL = "https://app.action-tokens.com/images/action/logo.png";

// Type definitions
interface ScavengerData {
  allGroupIds: Set<string>;
  currentStepGroupIds: Set<string>;
}

interface FollowData {
  followerOnlyIds: string[];
  memberIds: string[];
}

interface LocationGroupQuery {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  image: string | null;
  remaining: number;
  multiPin: boolean;
  privacy: ItemPrivacy;
  creatorId: string;
  locations: Array<{
    id: string;
    latitude: number;
    longitude: number;
    autoCollect: boolean;
    consumers: Array<{
      userId: string;
    }>;
  }>;
  Subscription: {
    price: number;
  } | null;
  creator: {
    name: string;
    profileUrl: string | null;
    pageAsset: {
      code: string;
      issuer: string;
    } | null;
  };
}

interface GetLocationsParams {
  userId: string;
  userAcc: StellarAccount;
  scavengerData: ScavengerData;
  followData: FollowData | null;
}

// Schema validation
const querySchema = z.object({ filterId: z.string() });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await EnableCors(req, res);

  // Auth check
  const token = await getToken({ req });
  const userId = token?.sub;

  if (!userId) {
    return res.status(401).json({ error: "User is not authenticated" });
  }

  // Validate query params
  const queryResult = querySchema.safeParse(req.query);
  if (!queryResult.success) {
    console.error("Validation error:", queryResult.error);
    return res.status(400).json({ error: queryResult.error });
  }

  try {
    // Parallel execution of independent queries
    const [userAcc, scavengerData, followData] = await Promise.all([
      StellarAccount.create(userId),
      getScavengerGroupIds(userId),
      queryResult.data.filterId === "1" ? getFollowedCreators(userId) : Promise.resolve(null)
    ]);

    // Get locations with optimized query
    const locations = await getLocations({
      userId,
      userAcc,
      scavengerData,
      followData
    });

    console.log("Locations found:", locations.length);
    return res.status(200).json({ locations });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Optimized: Filter at DB level, select only needed fields
async function getScavengerGroupIds(userId: string): Promise<ScavengerData> {
  const bounties = await db.bounty.findMany({
    where: {
      bountyType: "SCAVENGER_HUNT",
      participants: {
        some: { userId }
      }
    },
    select: {
      ActionLocation: {
        select: {
          locationGroupId: true,
          serial: true
        }
      },
      participants: {
        where: { userId },
        select: { currentStep: true }
      }
    }
  });

  const allGroupIds = new Set<string>();
  const currentStepGroupIds = new Set<string>();

  for (const bounty of bounties) {
    const currentStep = bounty.participants[0]?.currentStep ?? -1;

    for (const action of bounty.ActionLocation) {
      allGroupIds.add(action.locationGroupId);
      if (action.serial === currentStep + 1) {
        currentStepGroupIds.add(action.locationGroupId);
      }
    }
  }

  return { allGroupIds, currentStepGroupIds };
}

// Optimized: Simplified query, select only needed fields
async function getFollowedCreators(userId: string): Promise<FollowData> {
  const creators = await db.creator.findMany({
    where: {
      OR: [
        { followers: { some: { userId } } },
        { temporalFollows: { some: { userId } } }
      ]
    },
    select: {
      id: true,
      followers: {
        where: { userId },
        select: { userId: true }
      },
      temporalFollows: {
        where: { userId },
        select: { userId: true }
      }
    }
  });

  const followerOnlyIds: string[] = [];
  const memberIds: string[] = [];

  for (const creator of creators) {
    const isMember = creator.followers.length > 0;
    const isTemporalFollower = creator.temporalFollows.length > 0;

    if (isMember) {
      memberIds.push(creator.id);
    } else if (isTemporalFollower) {
      followerOnlyIds.push(creator.id);
    }
  }

  console.log("Temporal followers:", followerOnlyIds.length);
  console.log("Members with private access:", memberIds.length);

  return { followerOnlyIds, memberIds };
}

async function getLocations({
  userId,
  userAcc,
  scavengerData,
  followData
}: GetLocationsParams): Promise<Location[]> {

  // Build privacy filter
  const privacyConditions = buildPrivacyConditions(followData);

  // Build scavenger filter
  const scavengerFilter = buildScavengerFilter(scavengerData);

  // Single optimized query with all filters
  const locationGroups = await db.locationGroup.findMany({
    where: {
      approved: true,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
      subscriptionId: null,
      remaining: { gt: 0 },
      hidden: false,
      ...scavengerFilter,
      ...privacyConditions
    },
    select: {
      id: true,
      title: true,
      description: true,
      link: true,
      image: true,
      remaining: true,
      multiPin: true,
      privacy: true,
      creatorId: true,
      locations: {
        select: {
          id: true,
          latitude: true,
          longitude: true,
          autoCollect: true,
          consumers: {
            where: { userId },
            select: { userId: true }
          }
        }
      },
      Subscription: {
        select: {
          price: true
        }
      },
      creator: {
        select: {
          name: true,
          profileUrl: true,
          pageAsset: {
            select: {
              code: true,
              issuer: true
            }
          }
        }
      }
    }
  });

  return processLocationGroups(locationGroups, userId, userAcc);
}

function buildPrivacyConditions(followData: FollowData | null) {
  if (!followData) {
    return { privacy: ItemPrivacy.PUBLIC };
  }

  const { followerOnlyIds, memberIds } = followData;
  const conditions: Array<{
    creatorId: { in: string[] };
    privacy: { in: ItemPrivacy[] };
  }> = [];

  if (followerOnlyIds.length > 0) {
    conditions.push({
      creatorId: { in: followerOnlyIds },
      privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.FOLLOWER] }
    });
  }

  if (memberIds.length > 0) {
    conditions.push({
      creatorId: { in: memberIds },
      privacy: { in: [ItemPrivacy.PUBLIC, ItemPrivacy.FOLLOWER, ItemPrivacy.PRIVATE, ItemPrivacy.TIER] }
    });
  }

  return conditions.length > 0 ? { OR: conditions } : { privacy: ItemPrivacy.PUBLIC };
}

function buildScavengerFilter(scavengerData: ScavengerData) {
  const { allGroupIds, currentStepGroupIds } = scavengerData;

  if (allGroupIds.size === 0) {
    return {};
  }

  return {
    OR: [
      { id: { notIn: Array.from(allGroupIds) } },
      { id: { in: Array.from(currentStepGroupIds) } }
    ]
  };
}

function processLocationGroups(
  locationGroups: LocationGroupQuery[],
  userId: string,
  userAcc: StellarAccount
): Location[] {
  const locations: Location[] = [];

  for (const group of locationGroups) {
    const hasConsumedAny = group.locations.some((loc) =>
      loc.consumers.length > 0
    );

    // Check TIER privacy eligibility
    if (group.privacy === ItemPrivacy.TIER) {
      const asset = group.creator.pageAsset;
      const subscription = group.Subscription;

      if (!asset || !subscription) continue;

      const balance = userAcc.getTokenBalance(asset.code, asset.issuer);
      if (balance < subscription.price) continue;
    }

    // Process locations based on multiPin setting
    for (const location of group.locations) {
      const collected = group.multiPin
        ? location.consumers.length > 0
        : hasConsumedAny;

      locations.push({
        id: location.id,
        lat: location.latitude,
        lng: location.longitude,
        title: group.title,
        description: group.description ?? "No description provided",
        brand_name: group.creator.name,
        url: group.link ?? "https://app.action-tokens.com/",
        image_url: group.image ?? group.creator.profileUrl ?? WadzzoIconURL,
        collected,
        collection_limit_remaining: group.remaining,
        auto_collect: location.autoCollect,
        brand_image_url: group.creator.profileUrl ?? avaterIconUrl,
        brand_id: group.creatorId,
      });
    }
  }

  return locations;
}
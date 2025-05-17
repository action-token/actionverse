import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { EnableCors } from "~/server/api-cors";
import { db } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await EnableCors(req, res);
  const token = await getToken({ req });
  if (!token?.sub) {
    res.status(401).json({
      error: "User is not authenticated",
    });
    return;
  }

  const currentUserId = token.sub;

  const allBounty = await db.bounty.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      imageUrls: true,
      latitude: true,
      longitude: true,
      radius: true,
      creatorId: true,
      requiredBalance: true,
      priceInBand: true,
      priceInUSD: true,
      currentWinnerCount: true,
      BountyWinner: {
        select: {
          userId: true,
        },
      },
      totalWinner: true,
      status: true,
      _count: {
        select: {
          participants: true,
          BountyWinner: true,
        },
      },
      creator: {
        select: {
          name: true,
          profileUrl: true,
        },
      },
      ActionLocation: true,
      bountyType: true,
      participants: {
        where: { userId: currentUserId },
        select: {
          userId: true,
          currentStep: true,
        },
      },
    },
  });

  const bountiesWithJoinStatus = allBounty.map((bounty) => ({
    ...bounty,
    isOwner: bounty.creatorId === currentUserId,
    isJoined: bounty.participants.some((participant) => participant.userId === currentUserId),
    currentStep: bounty.participants.find((participant) => participant.userId === currentUserId)?.currentStep,

  }));

  res.status(200).json({ allBounty: bountiesWithJoinStatus });
}

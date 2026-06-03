import { ItemPrivacy } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { StellarAccount } from "~/lib/stellar/marketplace/test/Account";
import { EnableCors } from "~/server/api-cors";
import { AssetSelectAllProperty } from "~/server/api/routers/marketplace/marketplace";
import { db } from "~/server/db";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {

    const token = await getToken({ req });

    // Check if the user is authenticated
    if (!token) {
        return res.status(401).json({
            error: "User is not authenticated",
        });
    }

    const pubkey = token.sub;

    if (!pubkey) {
        return res.status(404).json({
            error: "pubkey not found",
        });
    }

    const data = z.object({ qrId: z.number() }).safeParse(req.body);

    if (!data.success) {
        return res.status(400).json({
            error: data.error,
        });
    }
    const qrData = data.data;
    console.log("Fetching market asset for QR ID:", qrData.qrId);


    const stellarAcc = await StellarAccount.create(pubkey);

    // check
    const marketAsset = await db.marketAsset.findUnique({
        where: { id: qrData.qrId ? Number(qrData.qrId) : 0 },
        include: {
            asset: {
                include: {
                    tier: { include: { creator: { include: { pageAsset: true } } } },
                },
            },
        },
    });
    console.log("marketAsset", marketAsset);
    if (!marketAsset) return res.status(200).json(false);


    if (marketAsset.privacy === ItemPrivacy.PUBLIC) {
        return res.status(200).json(true);
    }

    // secondary market if placerId is not the creatorId
    if (marketAsset.placerId !== marketAsset.asset.creatorId) {
        return res.status(200).json(true);
    }
    if (marketAsset.privacy === ItemPrivacy.PRIVATE && marketAsset.placerId) {
        const creatorPageAsset = await db.creator.findUniqueOrThrow({
            where: { id: marketAsset.placerId },
            select: {
                pageAsset: true,
            },
        });
        if (!creatorPageAsset.pageAsset) return false;
        const hasTrust = stellarAcc.hasTrustline(
            creatorPageAsset.pageAsset?.code,
            creatorPageAsset.pageAsset?.issuer,
        );
        if (hasTrust) {
            return res.status(200).json(true);
        }
    }
    const tier = marketAsset.asset.tier;
    if (tier) {
        const pageAsset = tier.creator.pageAsset;
        if (pageAsset) {
            if (marketAsset.privacy === ItemPrivacy.TIER) {
                const { code, issuer } = pageAsset;
                const bal = stellarAcc.getTokenBalance(code, issuer);
                if (bal >= tier.price) {
                    return res.status(200).json(true);
                }
            }
        }
    }
}

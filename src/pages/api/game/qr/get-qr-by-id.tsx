import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { EnableCors } from "~/server/api-cors";
import { AssetSelectAllProperty } from "~/server/api/routers/marketplace/marketplace";
import { db } from "~/server/db";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {


    const data = z.object({ qrId: z.string() }).safeParse(req.body);

    if (!data.success) {
        return res.status(400).json({
            error: data.error,
        });
    }
    const qrData = data.data;
    console.log("Fetching market asset for QR ID:", qrData.qrId);

    const item = await db.marketAsset.findUnique({
        where: { id: qrData.qrId ? Number(qrData.qrId) : 0 },
        include: {
            asset: {
                select: {
                    ...AssetSelectAllProperty,
                    tier: {
                        select: {
                            price: true,
                        },
                    },
                    creator: {
                        select: {
                            pageAsset: {
                                select: {
                                    code: true,
                                    issuer: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    console.log("marketAsset in getMarketAssetById:", item);
    return res.status(200).json(item);
}

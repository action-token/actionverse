import { Keypair } from "@stellar/stellar-sdk";
import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { z } from "zod";
import { env } from "~/env";
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

    const marketItem = await db.marketAsset.findUnique({
        where: { id: qrData.qrId ? Number(qrData.qrId) : 0 },
        include: { asset: { select: { code: true, issuer: true } } },
    });

    if (!marketItem) throw new Error("market item not found");

    const placerId = marketItem.placerId;

    if (placerId) {
        // placer have to be creator, have an storage account,
        const placer = await db.creator.findUnique({
            where: { id: placerId },
        });

        if (!placer) throw new Error("seller not found");

        const placerStorage = placer.storagePub;

        const bal = await StellarAccount.create(placerStorage);
        const copy = bal.getTokenBalance(
            marketItem.asset.code,
            marketItem.asset.issuer,
        );

        return res.status(200).json(copy);
    } else {
        // admin or original item
        const adminStorage = Keypair.fromSecret(env.STORAGE_SECRET).publicKey();

        const bal = await StellarAccount.create(adminStorage);
        const copy = bal.getTokenBalance(
            marketItem.asset.code,
            marketItem.asset.issuer,
        );

        return res.status(200).json(copy);

    }

}

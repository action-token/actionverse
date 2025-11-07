// PlatformAssetBalance

import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { getAccountInfos } from "~/lib/stellar/marketplace/test/acc";

import { PlatformAssetBalance } from "~/lib/stellar/walletBalance/acc";
import { EnableCors } from "~/server/api-cors";

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

    const userId = token.sub;

    const balances = await getAccountInfos(userId);
    return res.status(200).json(balances);
}

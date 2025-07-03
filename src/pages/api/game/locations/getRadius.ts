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

    // Check if the user is authenticated
    if (!token?.sub) {
        return res.status(401).json({
            error: "User is not authenticated",
        });
    }
    const radius = await db.appConfig.findFirst({
        select: { nearbyPinRadius: true },
    });
    return res.status(200).json({
        radius: radius?.nearbyPinRadius ?? 75, // Default to 75 if not set
    });
}


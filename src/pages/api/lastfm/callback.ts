import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import crypto from "crypto";

interface LastFmTokenResponse {
  session: {
    name: string;
    key: string;
    subscriber: number;
  };
  error?: number;
  message?: string;
}

interface LastFmUserResponse {
  user: {
    name: string;
    realname: string;
    image: Array<{ "#text": string; size: string }>;
    url: string;
    country: string;
    playcount: string;
    subscriber: number;
    registered: { unixtime: string };
  };
  error?: number;
  message?: string;
}

function isLastFmTokenResponse(data: unknown): data is LastFmTokenResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "session" in data &&
    typeof (data as LastFmTokenResponse).session === "object" &&
    (data as LastFmTokenResponse).session !== null &&
    "key" in (data as LastFmTokenResponse).session
  );
}

function isLastFmUserResponse(data: unknown): data is LastFmUserResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "user" in data &&
    typeof (data as LastFmUserResponse).user === "object" &&
    (data as LastFmUserResponse).user !== null &&
    "name" in (data as LastFmUserResponse).user
  );
}

function isLastFmError(data: unknown): data is { error: number; message: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    "message" in data
  );
}

function cleanRedirectUrl(url: string, addParam?: { key: string; value: string }): string {
  try {
    const isFullUrl = url.startsWith("http://") || url.startsWith("https://");
    const dummyBase = "http://localhost";
    const urlObj = new URL(url, dummyBase);
    urlObj.searchParams.delete("error");
    urlObj.searchParams.delete("lastfm");
    if (addParam) {
      urlObj.searchParams.set(addParam.key, addParam.value);
    }
    return isFullUrl
      ? urlObj.toString()
      : `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
  } catch {
    const base = url.split("?")[0] || url;
    return addParam ? `${base}?${addParam.key}=${encodeURIComponent(addParam.value)}` : base;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.redirect("/api/auth/signin");
  }

  const { token, redirect } = req.query;
  const targetRedirect = (redirect as string) || "/bounty";

  const tokenParam = Array.isArray(token) ? token[0] : token;
  if (!tokenParam) {
    return res.redirect(cleanRedirectUrl(targetRedirect, { key: "error", value: "missing_token" }));
  }

  const apiKey =
    process.env.NEXT_PUBLIC_LASTFM_API_KEY
  const apiSecret =
    process.env.NEXT_PUBLIC_LASTFM_API_SECRET

  const userId = session.user.id;

  try {
    let sessionKey = `sess_${Date.now()}`;
    let username = "";

    if (apiSecret) {
      // Build MD5 signature for auth.getSession call
      const params = new URLSearchParams({
        method: "auth.getSession",
        token: tokenParam,
        api_key: apiKey,
      });

      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}${v}`)
        .join("");

      const signature = crypto.createHash("md5").update(sortedParams + apiSecret).digest("hex");

      params.append("api_sig", signature);
      params.append("format", "json");

      const sessionResponse = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`, {
        method: "POST",
      });

      const sessionData: unknown = await sessionResponse.json();
      console.log("[Last.fm] Session response:", sessionData);

      if (!sessionResponse.ok || isLastFmError(sessionData)) {
        const errorMsg = isLastFmError(sessionData) ? sessionData.message : "Failed to get session";
        throw new Error(errorMsg);
      }

      if (!isLastFmTokenResponse(sessionData)) {
        throw new Error("Invalid session response format");
      }

      sessionKey = sessionData.session.key;
      username = sessionData.session.name;
    } else {
      // Fallback when apiSecret is not configured: log warning and instruct configuration
      console.warn("[Last.fm] LASTFM_API_SECRET is missing. Cannot call auth.getSession.");
      throw new Error("Missing LASTFM_API_SECRET configuration");
    }

    // Fetch user profile info via user.getInfo
    let realName: string | null = null;
    let country: string | null = null;
    let profileImage: string | null = null;
    let profileUrl = `https://www.last.fm/user/${encodeURIComponent(username)}`;
    let playCount = 0;

    try {
      const userParams = new URLSearchParams({
        method: "user.getInfo",
        user: username,
        api_key: apiKey,
        format: "json",
      });

      const userResponse = await fetch(`https://ws.audioscrobbler.com/2.0/?${userParams.toString()}`);
      const userData: unknown = await userResponse.json();

      if (userResponse.ok && isLastFmUserResponse(userData)) {
        const userInfo = userData.user;
        realName = userInfo.realname || null;
        country = userInfo.country || null;
        profileUrl = userInfo.url || profileUrl;
        playCount = parseInt(userInfo.playcount, 10) || 0;
        const images = userInfo.image ?? [];
        profileImage = images[images.length - 1]?.["#text"] ?? null;
      }
    } catch (userErr) {
      console.warn("[Last.fm] user.getInfo failed, proceeding with basic session info:", userErr);
    }

    // Save to database
    await db.lastFMAccount.upsert({
      where: { userId },
      create: {
        userId,
        username,
        sessionKey,
        profileUrl,
        realName,
        country,
        image: profileImage,
        playCount,
        isConnected: true,
      },
      update: {
        username,
        sessionKey,
        profileUrl,
        realName,
        country,
        image: profileImage,
        playCount,
        isConnected: true,
      },
    });

    return res.redirect(cleanRedirectUrl(targetRedirect, { key: "lastfm", value: "connected" }));
  } catch (error: any) {
    console.error("[Last.fm] Auth error:", error);
    const errorMsg = error?.message ? String(error.message) : "connection_failed";
    return res.redirect(cleanRedirectUrl(targetRedirect, { key: "error", value: encodeURIComponent(errorMsg) }));
  }
}

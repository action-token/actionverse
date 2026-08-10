import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/server/auth";

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
  const session = await getServerSession(req, res, authOptions);
  const rawRedirect = (req.query.redirect as string) || "/bounty";

  if (!session?.user) {
    const cleanRedirect = cleanRedirectUrl(rawRedirect);
    return res.redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(cleanRedirect)}`);
  }

  const apiKey = process.env.NEXT_PUBLIC_LASTFM_API_KEY
  if (!apiKey) {
    console.error("NEXT_PUBLIC_LASTFM_API_KEY environment variable is not defined.");
    const cleanRedirect = cleanRedirectUrl(rawRedirect, { key: "error", value: "api_keys_missing" });
    return res.redirect(cleanRedirect);
  }

  const cleanRedirect = cleanRedirectUrl(rawRedirect);
  const customCallback = process.env.NEXT_PUBLIC_LASTFM_CALLBACK_URL
  let callbackUrl: string;

  if (customCallback) {
    callbackUrl = cleanRedirectUrl(customCallback, { key: "redirect", value: cleanRedirect });
  } else {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const detectedBaseUrl = `${protocol}://${host}`;
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || detectedBaseUrl).replace(/\/$/, "");
    callbackUrl = `${baseUrl}/api/lastfm/callback?redirect=${encodeURIComponent(cleanRedirect)}`;
  }

  const lastFmAuthUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(callbackUrl)}`;

  return res.redirect(lastFmAuthUrl);
}

// nextjs 14 api routes

import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { db } from "~/server/db";
import { ipfsHashToPinataGatewayUrl, ipfsHashToUrl } from "~/utils/ipfs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  let FullTomlContent = defaultTomlString;

  const assets = await db.asset.findMany({
    select: {
      issuer: true,
      code: true,
      name: true,
      description: true,
      thumbnail: true,
      limit: true,
    },
  });

  const PageAssets = await db.creatorPageAsset.findMany({
    select: {
      issuer: true,
      code: true,
      thumbnail: true,
      limit: true,
      creator: true,
    },
  });

  for (const asset of assets) {
    FullTomlContent += dictionaryToTomlString(asset);
  }

  for (const asset of PageAssets) {
    const ipfsHash = asset.thumbnail?.split("/").pop();
    FullTomlContent += dictionaryToTomlString({
      code: asset.code,
      issuer: asset.issuer,
      name: asset.creator?.name || PLATFORM_ASSET.code,
      description: `Page Asset of ${asset.creator?.name}`,
      thumbnail: asset.thumbnail ?? "",
    });
  }

  res.send(FullTomlContent);

  return;

  // res.status(200).json({ message: assets });
}

export function dictionaryToTomlString(dict: {
  thumbnail: string;
  code: string;
  issuer: string;
  name: string;
  description: string | null;
}) {
  const ipfsHash = dict.thumbnail.split("/").pop();
  let tomlString = "[[CURRENCIES]]\n";
  tomlString += `code="${dict.code}"\n`;
  tomlString += `issuer="${dict.issuer}"\n`;
  tomlString += `display_decimals=7\n`;
  tomlString += `name="${dict.name}"\n`;
  tomlString += `desc="${dict.description}"\n`;
  if (ipfsHash) tomlString += `image="${ipfsHashToPinataGatewayUrl(ipfsHash)}"\n`;

  return tomlString + "\n";
}

const defaultTomlString = `[DOCUMENTATION]
ORG_NAME="Action Tokens"
ORG_URL="https://action-tokens.com/"
ORG_LOGO="https://raw.githubusercontent.com/action-token/actionverse/refs/heads/main/public/images/action/logo.png"
ORG_DESCRIPTION="Empowering Real-World Impact Through Digital Engagement"
ORG_OFFICIAL_EMAIL="support@action-tokens.com"

`;

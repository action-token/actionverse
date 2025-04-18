// nextjs 14 api routes

import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { db } from "~/server/db";
import { ipfsHashToUrl } from "~/utils/ipfs";

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
  if (ipfsHash) tomlString += `image="${ipfsHashToUrl(ipfsHash)}"\n`;

  return tomlString + "\n";
}

const defaultTomlString = `[DOCUMENTATION]
ORG_NAME="Bandcoin"
ORG_URL="https://bandcoin.io/"
ORG_LOGO="https://raw.githubusercontent.com/Bandcoin2023/assets/refs/heads/main/public/bandcoin.png"
ORG_DESCRIPTION="Bandcoin : Collect, Connect, Listen"
ORG_TWITTER="bandcoinio"
ORG_OFFICIAL_EMAIL="support@bandcoin.io"


`;

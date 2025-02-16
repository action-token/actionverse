import { Asset, MarketAsset } from "@prisma/client";
export type AssetType = Omit<Asset, "issuerPrivate">;

export type MarketAssetType = MarketAsset & {
    asset: AssetType;
};
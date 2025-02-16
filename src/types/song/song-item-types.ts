import { Song } from "@prisma/client";
import { AssetType } from "../market/market-asset-type";

export type SongItemType = Song & { asset: AssetType };
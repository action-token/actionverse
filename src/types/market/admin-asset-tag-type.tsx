import { AdminAsset } from "@prisma/client";

export type AdminAssetWithTag = AdminAsset & {
    tags: {
        tagName: string;
    }[];
};
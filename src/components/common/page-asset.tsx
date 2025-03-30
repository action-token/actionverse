import { Creator, CreatorPageAsset } from "@prisma/client";
import { useRouter } from "next/router";
import { usePopUpState } from "~/lib/state/right-pop";
import { usePageAssetRightStore } from "~/lib/state/wallete/page_asset_right";
import { useTagStore } from "~/lib/state/wallete/tag";
import AssetView from "./asset";

export type CreatorPageAssetType = {
    name: string;
    id: string;
    profileUrl: string | null;
    pageAsset: {
        code: string;
        limit: number;
        issuer: string;
        creatorId: string;
        issuerPrivate: string | null;
        thumbnail: string | null;
    } | null;
}

function PageAssetComponent({ item }: { item: CreatorPageAssetType }) {
    const router = useRouter();
    return (
        <div onClick={async () => {
            await router.push(`/organization/${item.id}`);
        }}>

            <AssetView
                code={
                    item.name
                }
                thumbnail={item.profileUrl}
                isNFT={item.pageAsset?.code ? true : false}
                isPageAsset={item.pageAsset?.code ? true : false}
                creatorId={item.pageAsset?.creatorId ?? ""}
            />

        </div>
    );
}

export default PageAssetComponent;

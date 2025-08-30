import { useRouter } from "next/router";

import AssetView from "./asset";

export type CreatorPageAssetType = {
    name: string;
    id: string;
    profileUrl: string | null;
    customPageAssetCodeIssuer: string | null;
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
            await router.push(`/artist/${item.id}`);
        }}>
            <AssetView
                code={item.name}
                thumbnail={item.profileUrl}
                isNFT={item.pageAsset?.code ? true : false}
                isPageAsset={item.pageAsset?.code ? true : item.customPageAssetCodeIssuer?.split("-")[1] ? true : false}
                creatorId={item.pageAsset?.creatorId ?? ""}
            />


        </div>
    );
}

export default PageAssetComponent;

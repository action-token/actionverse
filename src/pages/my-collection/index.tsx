import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import React, { useState } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";
import MarketAssetComponent from "~/components/common/market-asset";
import Asset from "~/components/common/admin-asset";
import AssetView from "~/components/common/asset";
import Link from "next/link";
import { useAssestInfoModalStore } from "~/components/store/asset-info-modal-store";
import { useCollectedPinInfoModalStore } from "~/components/store/collectedPin-info-modal-store";
import {
    MyCollectionMenu,
    useMyCollectionTabs,
} from "~/components/store/tabs/mycollection-tabs";
import { useRouter } from "next/navigation";
import { CreateStorage } from "~/components/creator/create-creator";
import { AssetType } from "~/types/market/market-asset-type";

const MyCollecton = () => {
    const { selectedMenu, setSelectedMenu } = useMyCollectionTabs();
    return (
        <Card className="rounded-none">
            <CardHeader className="flex w-full items-center justify-center border-b-2 bg-secondary p-2 md:p-4">
                <CardTitle className="flex items-center justify-center gap-2  p-0  md:w-1/2 md:gap-4">
                    {Object.values(MyCollectionMenu).map((tab) => (
                        <Button
                            key={tab}
                            onClick={() => setSelectedMenu(tab)}
                            className={cn(
                                "flex  w-1/2 px-2 text-sm shadow-sm shadow-black transition-all duration-300 ease-in-out lg:px-10",
                                selectedMenu === tab
                                    ? "shadow-sm shadow-black bg-primary text-primary-foreground"
                                    : "transparent  border-primary bg-secondary hover:bg-primary/10 font-bold text-primary shadow-sm shadow-black",
                            )}
                        >
                            {tab.toLocaleUpperCase()}
                        </Button>
                    ))}
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100vh-20vh)] overflow-y-auto p-0 scrollbar-hide ">
                <div>
                    {selectedMenu === MyCollectionMenu.COLLECTION && (
                        <div>
                            <MyCollection />
                        </div>
                    )}
                    {selectedMenu === MyCollectionMenu.SECONDARY && (
                        <div>
                            <SecondaryStorage />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default MyCollecton;

const MyCollection = () => {
    const acc = api.wallate.acc.getAccountInfo.useQuery();
    const { setData, setIsOpen } = useAssestInfoModalStore();
    const { setData: setPinModalData, setIsOpen: setPinModalIsOpen } =
        useCollectedPinInfoModalStore();
    const router = useRouter();
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isLoading,
        isFetchingNextPage,
        status,
    } = api.maps.pin.getMyCollectedPins.useInfiniteQuery(
        {
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    );
    const handleViewAsset = (asset: AssetType) => {
        router.push(`/asset/${asset.id}`);
    };

    if (acc.isLoading) {
        return (
            <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            </div>
        );
    }

    if (acc.data ?? data) {
        return (
            <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 overflow-y-auto rounded-md bg-white/40 p-4 shadow-md">
                {acc.data?.dbAssets.length === 0 &&
                    data?.pages[0]?.items.length === 0 && (
                        <div className="flex h-full items-center justify-center">
                            <h1 className="text-lg font-bold ">No Assets Found</h1>
                        </div>
                    )}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
                    <>
                        {acc.data?.dbAssets.map((asset, i) => (
                            <div key={i} className="cursor-pointer">
                                <AssetView
                                    code={asset.name}
                                    thumbnail={asset.thumbnail}
                                    isNFT={true}
                                    creatorId={asset.creatorId}
                                    mediaType={asset.mediaType}
                                    onView={() => handleViewAsset(asset)}
                                    onBuy={() => {
                                        setData(asset);
                                        setIsOpen(true);
                                    }}
                                />
                            </div>
                        ))}
                    </>
                    <>
                        {data?.pages.map((pin, i) => (
                            <React.Fragment key={i}>
                                {pin.items.map((item, j) => (
                                    <div key={j} className="cursor-pointer">
                                        <AssetView
                                            code={item.location.locationGroup?.title}
                                            thumbnail={
                                                item.location.locationGroup?.image ??
                                                "https://app.action-tokens.com/images/logo.png"
                                            }
                                            isPinned={true}
                                            creatorId={item.location.locationGroup?.creatorId}
                                            onBuy={() => {
                                                setPinModalData(item);
                                                setPinModalIsOpen(true);
                                            }}
                                        />
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </>
                </div>
                {hasNextPage && (
                    <Button
                        className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                        onClick={() => void fetchNextPage()}
                        disabled={isFetchingNextPage}
                    >
                        {isFetchingNextPage ? "Loading more..." : "Load More"}
                    </Button>
                )}
            </div>
        );
    }
};

const SecondaryStorage = () => {
    const acc = api.wallate.acc.getCreatorStorageInfo.useQuery();
    const { setData, setIsOpen } = useAssestInfoModalStore();
    const router = useRouter();
    const handleViewAsset = (asset: AssetType) => {
        router.push(`/asset/${asset.id}`);
    };

    return (
        <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 overflow-y-auto rounded-md bg-white/40 p-4 shadow-md">
            {acc.isLoading && (
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            )}
            {acc.data === undefined && !acc.isLoading && (
                <div className="flex h-[calc(100vh-20vh)]  flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                        <h1 className="text-lg font-bold ">
                            You don{"'t"} have storage account. please create one.
                        </h1>
                        {/* <Link href="/artist/home">
              <Button className="flex items-center justify-center shadow-sm shadow-black">
                Create Storage
              </Button>
            </Link> */}
                        <CreateStorage />
                    </div>
                </div>
            )}
            {acc.data?.dbAssets.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <h1 className="text-lg font-bold ">No Assets Found</h1>
                </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {acc.data?.dbAssets.map((asset, i) => {
                    return (
                        <div key={i} className="cursor-pointer">
                            <AssetView
                                code={asset.name}
                                thumbnail={asset.thumbnail}
                                isNFT={true}
                                creatorId={asset.creatorId}
                                mediaType={asset.mediaType}
                                onView={() => handleViewAsset(asset)}
                                onBuy={() => {
                                    setData(asset);
                                    setIsOpen(true);
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

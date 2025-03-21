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
import { MyCollectionMenu, useMyCollectionTabs } from "~/components/store/tabs/mycollection-tabs";


const MyCollecton = () => {
    const { selectedMenu, setSelectedMenu } = useMyCollectionTabs();
    return (
        <Card className="rounded-none">
            <CardHeader className="w-full bg-secondary border-b-2 p-2 md:p-4 flex items-center justify-center">
                <CardTitle className="flex md:w-1/2 items-center justify-center  p-0  gap-2 md:gap-4">
                    {Object.values(MyCollectionMenu).map((tab) => (
                        <Button
                            key={tab}
                            onClick={() => setSelectedMenu(tab)}
                            className={cn(
                                "flex  w-1/2 px-2 text-sm shadow-sm shadow-black transition-all duration-300 ease-in-out lg:px-10",
                                selectedMenu === tab
                                    ? "w-full border-2  font-bold text-destructive border-destructive bg-background hover:bg-background"
                                    : "",
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
    )
}

export default MyCollecton;


const MyCollection = () => {
    const acc = api.wallate.acc.getAccountInfo.useQuery();
    const { setData, setIsOpen } = useAssestInfoModalStore()
    const { setData: setPinModalData, setIsOpen: setPinModalIsOpen } = useCollectedPinInfoModalStore()
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

    if (acc.isLoading) {
        return (
            <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            </div>
        )
    }


    if (acc.data ?? data) {
        return (
            <div className="flex h-[calc(100vh-20vh)] overflow-y-auto flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">

                {
                    (acc.data?.dbAssets.length === 0 && data?.pages[0]?.items.length === 0) && (
                        <div className="flex items-center justify-center h-full">
                            <h1 className="text-lg font-bold ">No Assets Found</h1>
                        </div>
                    )
                }
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
                    <>
                        {acc.data?.dbAssets.map((asset, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    setData(asset)
                                    setIsOpen(true)
                                }}
                                className="cursor-pointer"
                            >
                                <AssetView
                                    code={asset.name}
                                    thumbnail={asset.thumbnail}
                                    isNFT={true}
                                    creatorId={asset.creatorId}
                                    mediaType={asset.mediaType}
                                />
                            </div>
                        ))}
                    </>
                    <>
                        {data?.pages.map((pin, i) => (
                            <React.Fragment key={i}>
                                {pin.items.map((item, j) => (
                                    <div
                                        key={j}
                                        onClick={() => {
                                            setPinModalData(item)
                                            setPinModalIsOpen(true)
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <AssetView
                                            code={item.location.locationGroup?.title}
                                            thumbnail={
                                                item.location.locationGroup?.image ??
                                                "https://bandcoin.io/images/loading.png"
                                            }
                                            isPinned={true}
                                            creatorId={item.location.locationGroup?.creatorId}
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
        )
    }
}

const SecondaryStorage = () => {
    const acc = api.wallate.acc.getCreatorStorageInfo.useQuery();
    const { setData, setIsOpen } = useAssestInfoModalStore()



    return (
        <div className="flex h-[calc(100vh-20vh)] overflow-y-auto flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
            {acc.isLoading && (
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            )}
            {
                acc.data === undefined && !acc.isLoading && (
                    <div className="flex h-[calc(100vh-20vh)]  flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">

                        <div className="flex items-center justify-center h-full flex-col gap-2">
                            <h1 className="text-lg font-bold ">You don{"'t"} have storage account. please create one.</h1>
                            <Link href="/organization/home">
                                <Button className="flex items-center justify-center shadow-sm shadow-black">
                                    Create Storage
                                </Button>
                            </Link>
                        </div>
                    </div>
                )
            }
            {
                (acc.data?.dbAssets.length === 0) && (
                    <div className="flex items-center justify-center h-full">
                        <h1 className="text-lg font-bold ">No Assets Found</h1>
                    </div>
                )
            }
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {acc.data?.dbAssets.map((asset, i) => {
                    return (
                        <div
                            key={i}
                            onClick={() => {
                                setData(asset)
                                setIsOpen(true)
                            }}
                            className="cursor-pointer"
                        >
                            <AssetView
                                code={asset.name}
                                thumbnail={asset.thumbnail}
                                isNFT={true}
                                creatorId={asset.creatorId}
                                mediaType={asset.mediaType}
                            />
                        </div>
                    );
                })}
            </div>

        </div>
    )
}
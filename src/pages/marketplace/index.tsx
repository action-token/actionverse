import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Button } from "~/components/shadcn/ui/button";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";
import MarketAssetComponent from "~/components/common/market-asset";
import Asset from "~/components/common/admin-asset";
const TABS = ["Action Curated", "ORG Tokens", "Trade"];

const Marketplace = () => {
    const [activeTab, setActiveTab] = useState("Action Curated");
    console.log("activeTab", activeTab);
    return (
        <Card className="">
            <CardHeader className="w-full bg-primary border-b-2 p-2 md:p-4 flex items-center justify-center">
                <CardTitle className="flex md:w-1/2 items-center justify-center  p-0  gap-2 md:gap-4">
                    {TABS.map((tab) => (
                        <Button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex  text-xs md:text-sm shadow-sm shadow-black transition-all duration-300 ease-in-out ",
                                activeTab === tab
                                    ? "w-full px-10  border-2 font-bold text-[#dbdd2c]"
                                    : " ",
                            )}
                        >
                            {tab.toLocaleUpperCase()}
                        </Button>
                    ))}
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100vh-20vh)] overflow-y-auto p-0 scrollbar-hide ">
                <div>
                    {activeTab === "Action Curated" && (
                        <div>
                            <CuratedItems />
                        </div>
                    )}
                    {activeTab === "Artist Tokens" && (
                        <div>
                            <ArtistTokens />
                        </div>
                    )}
                    {activeTab === "Trade" && (
                        <div>
                            <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                                <div className="flex items-center justify-center h-full flex-col gap-2">
                                    <h1 className="text-lg font-bold ">No Trade Items</h1>

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default Marketplace;


export const CuratedItems = () => {
    const curatedItems = api.wallate.asset.getBancoinAssets.useInfiniteQuery(
        { limit: 10 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    );

    return (
        <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
            {curatedItems.isLoading && (
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            )}
            {
                curatedItems.data?.pages[0]?.assets.length === 0 && (
                    <div className="flex items-center justify-center h-full flex-col gap-2">
                        <h1 className="text-lg font-bold ">No Curated Items</h1>

                    </div>
                )
            }
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
                {curatedItems.data?.pages.map((page, pageIndex) =>
                    page.assets.map((item, index) => (
                        <Asset
                            key={`music-${pageIndex}-${index}`}
                            asset={item}
                        />
                    )),
                )}

            </div>
            {curatedItems.hasNextPage && (
                <Button
                    className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                    onClick={() => void curatedItems.fetchNextPage()}
                    disabled={curatedItems.isFetchingNextPage}
                >
                    {curatedItems.isFetchingNextPage ? "Loading more..." : "Load More"}
                </Button>
            )}
        </div>
    )
}

const ArtistTokens = () => {
    const artistTokens = api.marketplace.market.getFanMarketNfts.useInfiniteQuery(
        { limit: 10 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    );

    return (
        <div className="flex h-[calc(100vh-20vh)] flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
            {artistTokens.isLoading && (
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            )}
            {
                artistTokens.data?.pages[0]?.nfts.length === 0 && (
                    <div className="flex items-center justify-center h-full flex-col gap-2">
                        <h1 className="text-lg font-bold ">No Artist Tokens</h1>

                    </div>
                )
            }
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {artistTokens.data?.pages.map((page, pageIndex) =>
                    page.nfts.map((item, index) => (
                        <MarketAssetComponent
                            key={`artist-token-${pageIndex}-${index}`}
                            item={item}
                        />
                    )),
                )}
            </div>
            {artistTokens.hasNextPage && (
                <Button
                    className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                    onClick={() => void artistTokens.fetchNextPage()}
                    disabled={artistTokens.isFetchingNextPage}
                >
                    {artistTokens.isFetchingNextPage ? "Loading more..." : "Load More"}
                </Button>
            )}
        </div>
    )
}
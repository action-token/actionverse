import { api } from "~/utils/api";
import { Card, CardContent, CardTitle } from "../shadcn/ui/card";
import Image from "next/image";
import { addrShort } from "~/utils/utils";
import { MoreAssetsSkeleton } from "../common/grid-loading";
import { Button } from "../shadcn/ui/button";
import { Eye, Info, MoveRight, Play } from "lucide-react";
import { useMusicBuyModalStore } from "../store/music-buy-store";
import Link from "next/link";

const AllSongsTab = () => {
    const allSongs = api.music.song.getAllSong.useInfiniteQuery({
        limit: 10,
    }, {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
    );


    const userAssets = api.wallate.acc.getAccountInfo.useQuery();
    const { setData, setIsOpen } = useMusicBuyModalStore()
    if (allSongs.isLoading) {
        return (
            <div className="flex min-h-[calc(100vh-20vh)]  flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                {Array.from({ length: 5 }, (_, index: number) => (
                    <Card key={index} className="my-2 flex w-full items-center gap-4 p-2">
                        <div className="h-16 w-16 bg-gray-700 animate-pulse rounded" />
                        <div className="flex w-full items-center justify-between rounded-lg bg-primary p-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-2">
                                    <div className="h-6 w-48 bg-gray-700 animate-pulse rounded" />
                                    <div className="h-4 w-32 bg-gray-700 animate-pulse rounded" />
                                </div>
                            </div>
                            <div className="h-10 w-24 bg-gray-700 animate-pulse rounded" />
                        </div>
                    </Card>
                ))}
            </div>

        )
    }
    if (!allSongs?.data || allSongs.data?.pages[0]?.songs.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="w-full">
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center justify-center space-y-4 text-center">
                            <CardTitle>No Songs Available</CardTitle>
                            <p className="text-gray-500">This album doesn{"'"}t have any songs yet.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="flex min-h-[calc(100vh-20vh)]  flex-col  rounded-md bg-white/40 p-4 shadow-md w-full">
                {allSongs.data.pages.map((pages, index) => (
                    pages.songs.map((song, index) => (
                        <Card key={index} className="my-2 flex w-full flex-col items-start gap-4 p-2 md:flex-row md:items-center shadow-sm shadow-slate-300">
                            <div className="h-16 w-16 flex items-center justify-center  rounded-lg">
                                <Image
                                    src={song.asset.thumbnail ?? "/placeholder.svg"}
                                    alt="Artist"
                                    width={300}
                                    height={300}
                                    className="ml-2  h-16 w-16 rounded-sm object-cover flex items-center justify-center "
                                />
                            </div>
                            <div className="flex w-full flex-col items-start gap-4 rounded-lg  bg-primary p-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">{song.asset.name}</h3>
                                        <p className="text-gray-400">
                                            ARTIST:{" "}
                                            {song.asset.creatorId
                                                ? addrShort(song.asset.creatorId, 5)
                                                : "ADMIN"}
                                        </p>
                                    </div>

                                </div>

                                <div className="flex gap-2">
                                    {(song.creatorId === null || userAssets.data?.dbAssets?.some(
                                        (el) => el.code === song.asset.code && el.issuer === song.asset.issuer
                                    )) && (
                                            <Button
                                                variant="destructive"
                                                className="shadow-sm shadow-black px-6 py-2 gap-1 flex items-center justify-center"
                                            >
                                                <Play className="h-6 w-6" />
                                                <span>PLAY</span>
                                            </Button>
                                        )}

                                    <Button
                                        onClick={() => {
                                            setData(song)
                                            setIsOpen(true)
                                        }}

                                        className="rounded-md bg-white px-6 py-2 font-medium shadow-sm shadow-black transition-colors hover:bg-gray-100">
                                        BUY NOW
                                    </Button>
                                    <Link href={`/music/album/${song.albumId}`}>
                                        <Button

                                            variant="default"

                                            className="shadow-sm relative shadow-black px-6 py-2 gap-1 flex items-center justify-center"
                                        >
                                            <span className="mb-3">
                                                <Eye className="h-5 w-5" />
                                            </span>
                                            <span className="absolute bottom-1 text-xs">View</span>
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </Card>

                    )
                    )
                ))}
                {
                    allSongs.hasNextPage && (
                        <Button
                            className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                            onClick={() => allSongs.fetchNextPage()}
                            disabled={allSongs.isFetchingNextPage}
                        >
                            {allSongs.isFetchingNextPage ? "Loading more..." : "Load More"}
                        </Button>

                    )
                }
            </div>



        </div >

    )
}

export default AllSongsTab;
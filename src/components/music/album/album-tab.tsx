import { api } from "~/utils/api";

import AlbumView from "./album-item";
import { Button } from "~/components/shadcn/ui/button";
import { MoreAssetsSkeleton } from "~/components/common/grid-loading";

const AlbumTab = () => {
    const albums = api.music.album.getAll.useInfiniteQuery({ limit: 10 }, {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

    return (
        <div className="flex min-h-[calc(100vh-20vh)]  flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
            {albums.isLoading && (
                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5">
                {albums.data?.pages.map((page, pageIndex) =>
                    page.albums.map((album, index) => (
                        <>
                            <AlbumView
                                albumId={album.id}
                                creatorId={album.creatorId}
                                coverImgUrl={album.coverImgUrl}
                                name={album.name}


                            />
                        </>
                    ))
                )}
            </div>
            {albums.hasNextPage && (
                <Button
                    className="flex w-1/2 items-center justify-center  shadow-sm shadow-black md:w-1/4"
                    onClick={() => albums.fetchNextPage()}
                    disabled={albums.isFetchingNextPage}
                >
                    {albums.isFetchingNextPage ? "Loading more..." : "Load More"}
                </Button>
            )}
        </div>
    )
}

export default AlbumTab;
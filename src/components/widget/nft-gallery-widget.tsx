"use client"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { Button } from "../shadcn/ui/button"
import { ImageIcon, Plus } from "lucide-react"
import { api } from "~/utils/api"
import { useSession } from "next-auth/react"
import { useNFTCreateModalStore } from "../store/nft-create-modal-store"
import { MoreAssetsSkeleton } from "../common/grid-loading"
import MarketAssetComponent from "../common/market-asset"

interface NFTGalleryWidgetProps {
    editMode?: boolean

}


export default function NFTGalleryWidget({ editMode }: NFTGalleryWidgetProps) {
    const { setIsOpen: setIsNFTModalOpen } = useNFTCreateModalStore()
    const session = useSession()
    const creatorNFT = api.marketplace.market.getCreatorNftsByCreatorID.useInfiniteQuery(
        { limit: 10, creatorId: session.data?.user.id ?? "" },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )
    return (
        <Card className="rounded-none">
            <CardHeader className="w-full sticky top-0 z-50 bg-secondary border-b-2 p-2 md:p-4 ">
                <div className="flex justify-between items-center ">
                    <h2 className="text-xl font-bold">Your NFT Collection</h2>
                    {
                        (creatorNFT.data?.pages[0]?.nfts?.length ?? 0) > 0 && (
                            <Button onClick={() => setIsNFTModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create New NFT
                            </Button>
                        )
                    }
                </div>
            </CardHeader>

            <CardContent className="p-2">
                {

                    <div className="min-h-[calc(100vh-20vh)] flex flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                        {creatorNFT.isLoading && (
                            <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5" />
                        )}

                        {creatorNFT.data?.pages[0]?.nfts.length === 0 && (
                            <div className="h-full flex items-center justify-center flex-col text-lg font-bold">
                                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">No NFTs Found</h3>
                                <p className="text-muted-foreground mb-4">Start creating your NFT collection</p>
                                <Button onClick={() => setIsNFTModalOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Your First NFT
                                </Button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
                            {creatorNFT.data?.pages.map((items, itemIndex) =>
                                items.nfts.map((item, index) => (
                                    <MarketAssetComponent key={`music-${itemIndex}-${index}`} item={item} />
                                )),
                            )}
                        </div>

                        {creatorNFT.hasNextPage && (
                            <Button
                                className="flex w-1/2 items-center justify-center shadow-sm shadow-black md:w-1/4"
                                onClick={() => creatorNFT.fetchNextPage()}
                                disabled={creatorNFT.isFetchingNextPage}
                            >
                                {creatorNFT.isFetchingNextPage ? "Loading more..." : "Load More"}
                            </Button>
                        )}
                    </div>

                }
            </CardContent>
        </Card>
    )
}

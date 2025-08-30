"use client"

import { useParams } from "next/navigation"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Play, Eye, ShoppingCart, User, Calendar, Hash, Copy, TrendingUp, Clock } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { api } from "~/utils/api"
import { useBuyModalStore } from "~/components/store/buy-modal-store"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useBottomPlayer } from "~/components/player/context/bottom-player-context"
import { useSession } from "next-auth/react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { MediaType } from "@prisma/client"
import ShowThreeDModel from "~/components/3d-model/model-show"
import { useRouter } from "next/router"
import { NFTVideoPlayer } from "~/components/player/nft-video-player"
const SingleAssetView = () => {
    const router = useRouter()

    const { id } = router.query as { id: string }
    const { hasTrust } = useUserStellarAcc()
    const [isLiked, setIsLiked] = useState(false)
    const [showFullDescription, setShowFullDescription] = useState(false)
    const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false)
    const [isVideoMinimized, setIsVideoMinimized] = useState(false)
    const { setIsOpen, setData } = useBuyModalStore()
    const marketId = Number.parseInt(id)
    const { showPlayer } = useBottomPlayer()
    const session = useSession()
    const [previewMedia, setPreviewMedia] = useState<{
        url: string;
        type: "IMAGE" | "VIDEO" | "MUSIC" | "THREE_D";
    } | null>(null)
    const [isOpenPreview, setIsOpenPreview] = useState(false)

    const { data, isLoading, error } = api.fan.asset.getMarketAssetById.useQuery({
        marketId: marketId,
    })

    const { data: copyData, isLoading: copyLoading } = api.marketplace.market.getMarketAssetAvailableCopy.useQuery(
        { id: marketId },
        { enabled: !!data },
    )

    const { data: canBuyUser, isLoading: buyLoading } = api.marketplace.market.userCanBuyThisMarketAsset.useQuery(
        marketId,
        { enabled: !!data },
    )

    const hasTrustonAsset = data ? hasTrust(data.asset.code, data.asset.issuer) : false

    // Core UI Logic
    const canBuy = copyData && copyData > 0 && canBuyUser

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const canPlayOrView = hasTrustonAsset || (data?.asset.creatorId === session.data?.user.id || data?.placerId === session.data?.user.id);

    const isVideo = data?.asset.mediaType === "VIDEO"
    const isAudio = data?.asset.mediaType === "MUSIC"
    const isThreeD = data?.asset.mediaType === "THREE_D"
    const isImage = data?.asset.mediaType === "IMAGE"

    const handlePlayVideo = () => {
        setIsVideoPlayerOpen(true)
        setIsVideoMinimized(false)
    }

    const handleCloseVideo = () => {
        setIsVideoPlayerOpen(false)
        setIsVideoMinimized(false)
    }

    const handleToggleMinimize = () => {
        setIsVideoMinimized(!isVideoMinimized)
    }

    if (isLoading) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Skeleton className="aspect-square rounded-2xl" />
                        <div className="flex justify-center">
                            <Skeleton className="h-6 w-20" />
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <Skeleton className="h-8 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full mb-1" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (error ?? !data) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="p-8 text-center">
                    <CardContent>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Asset Not Found</h2>
                        <p className="text-gray-600">The requested asset could not be loaded.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const copyAddress = (text: string | null | undefined) => {
        if (text) {
            navigator.clipboard.writeText(text)
        }
    }
    const handlePlaySong = (song: {

        title: string;
        artist: string;
        thumbnail: string
        url: string
    }) => {


        showPlayer(song.title, song.artist, song.url, song.thumbnail)

    }
    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>/</span>
                    <span>Assets</span>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">{data.id}</span>
                </div>
                {/* <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLiked(!isLiked)}
                        className={`transition-colors ${isLiked ? "text-red-500 border-red-200" : ""}`}
                    >
                        <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                    </Button>
                    <Button variant="outline" size="sm">
                        <Share2 className="w-4 h-4" />
                    </Button>
                </div> */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-6">
                    <div className="relative group">
                        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 shadow-lg">
                            <Image
                                src={data.asset?.thumbnail || "/placeholder.svg?height=600&width=600&query=digital asset thumbnail"}
                                alt={data.asset.name}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {isVideo && canPlayOrView && (
                                <button
                                    onClick={handlePlayVideo}
                                    className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                                >
                                    <div className="bg-black/60 backdrop-blur-sm rounded-full p-6 transition-all duration-300 group-hover:bg-black/70 group-hover:scale-110">
                                        <Play className="w-10 h-10 text-white fill-current" />
                                    </div>
                                </button>
                            )}
                            {isAudio && canPlayOrView && data.asset.mediaUrl && (
                                <button
                                    onClick={() => handlePlaySong({

                                        title: data.asset.name,
                                        artist: data.asset.creatorId ?? "ADMIN",
                                        thumbnail: data.asset.thumbnail,
                                        url: data.asset.mediaUrl
                                    })}
                                    className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                                >
                                    <div className="bg-black/60 backdrop-blur-sm rounded-full p-6 transition-all duration-300 group-hover:bg-black/70 group-hover:scale-110">
                                        <Play className="w-10 h-10 text-white fill-current" />
                                    </div>
                                </button>
                            )}

                            <div className="absolute top-4 left-4 flex gap-2">
                                <Badge className="bg-white/90 text-gray-900 shadow-sm">{data.asset.mediaType}</Badge>
                            </div>

                            <div className="absolute top-4 right-4">
                                <Badge className="bg-black/60 text-white shadow-sm">{copyData ?? 0} available</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">

                        <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                                <div className="text-2xl font-bold text-green-600">{copyData ?? 0}</div>
                                <div className="text-sm text-gray-600">Available</div>
                            </CardContent>
                        </Card>
                        <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                                <div className="text-2xl font-bold text-purple-600">{data?.price ?? 0}</div>
                                <div className="text-sm text-gray-600">{PLATFORM_ASSET.code} </div>
                            </CardContent>
                        </Card>
                        <Card className="p-4 text-center hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                                <div className="text-2xl font-bold text-purple-600">{data?.priceUSD ?? 0}</div>
                                <div className="text-sm text-gray-600">USD</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">{data.asset.name}</h1>
                        <div className="relative">
                            <p className={`text-gray-600 leading-relaxed text-lg ${!showFullDescription ? "line-clamp-3" : ""}`}>
                                {data.asset.description}
                            </p>
                            {data.asset.description && data.asset.description.length > 150 && (
                                <button
                                    onClick={() => setShowFullDescription(!showFullDescription)}
                                    className="text-blue-600 hover:text-blue-700 font-medium mt-2 text-sm"
                                >
                                    {showFullDescription ? "Show less" : "Read more"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Asset Information</h3>

                        <Card className="p-4 hover:shadow-md transition-shadow">
                            <CardContent className="p-0 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <User className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <div className="text-sm text-gray-500">Placer</div>
                                            <div className="font-mono text-sm">
                                                {data?.placerId?.slice(0, 12) ?? ""}...{data?.placerId?.slice(-12) ?? ""}
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => copyAddress(data?.placerId)}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Hash className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <div className="text-sm text-gray-500">Asset Code</div>
                                            <div className="font-semibold">{data.asset.code}</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => copyAddress(data.asset.code)}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <div className="text-sm text-gray-500">Created</div>
                                        <div className="font-medium">
                                            {new Date(data.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                        <CardContent className="p-0">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Availability Status
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <span className="text-sm font-medium">Available Copies</span>
                                    <Badge variant={copyData && copyData > 0 ? "default" : "secondary"}>
                                        {copyLoading ? "..." : copyData ?? 0}
                                    </Badge>
                                </div>
                                {/* <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <span className="text-sm font-medium">Trust Status</span>
                                    <Badge variant={hasTrustonAsset ? "default" : "destructive"}>
                                        {hasTrustonAsset ? "✓ Trusted" : "✗ Not Trusted"}
                                    </Badge>
                                </div> */}
                                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <span className="text-sm font-medium">Purchase Eligibility</span>
                                    <Badge variant={canBuyUser ? "default" : "secondary"}>
                                        {buyLoading ? "..." : canBuyUser ? "✓ Eligible" : "✗ Not Eligible"}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {/* Play Video Button */}
                        {canPlayOrView && isVideo && (
                            <Button
                                onClick={handlePlayVideo}
                                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
                                size="lg"
                            >
                                <Play className="w-5 h-5 mr-2 fill-current" />
                                Play Video
                            </Button>
                        )}

                        {/* Play Audio Button */}
                        {canPlayOrView && isAudio && (data.asset.mediaUrl) && (
                            <Button
                                onClick={() =>
                                    handlePlaySong({
                                        title: data.asset.name,
                                        artist: data.asset.creatorId ?? "ADMIN",
                                        thumbnail: data.asset.thumbnail,
                                        url: data.asset.mediaUrl
                                    })
                                }
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
                                size="lg"
                            >
                                <Play className="w-5 h-5 mr-2" />
                                Play Audio
                            </Button>
                        )}

                        {/* View Image Button */}
                        {canPlayOrView && isImage && (
                            <Button
                                onClick={() => {
                                    setPreviewMedia({
                                        url: data.asset.thumbnail,
                                        type: MediaType.IMAGE,
                                    });
                                    setIsOpenPreview(true);
                                }}
                                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
                                size="lg"
                            >
                                <Eye className="w-5 h-5 mr-2" />
                                View Image
                            </Button>
                        )}

                        {/* View 3D Asset Button */}
                        {canPlayOrView && isThreeD && (
                            <Button
                                onClick={() => {
                                    setPreviewMedia({
                                        url: data.asset.mediaUrl,
                                        type: MediaType.THREE_D,
                                    });
                                    setIsOpenPreview(true);
                                }}
                                className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
                                size="lg"
                            >
                                <Eye className="w-5 h-5 mr-2" />
                                View 3D Asset
                            </Button>
                        )}



                        {canBuy && (
                            <Button
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                                size="lg"
                                variant="accent"
                                onClick={() => {
                                    setData(data)
                                    setIsOpen(true)
                                }}
                            >
                                <ShoppingCart className="w-5 h-5 mr-2" />
                                Buy Asset ({data?.price} {PLATFORM_ASSET.code})<span className="ml-2 ">≈ ${data?.priceUSD}</span>
                            </Button>
                        )}

                        {!canPlayOrView && !canBuy && !buyLoading && (
                            <Card className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                                <CardContent className="p-0 text-center">
                                    <Clock className="w-8 h-8 text-amber-600 mx-auto mb-3" />
                                    <p className="text-amber-800 font-medium mb-3">No actions available</p>
                                    <div className="text-amber-700 text-sm space-y-2">
                                        {!hasTrustonAsset && (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                <span>You need to trust this asset to view/play it</span>
                                            </div>
                                        )}
                                        {(!copyData || copyData === 0) && (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                <span>No copies available for purchase</span>
                                            </div>
                                        )}
                                        {!canBuyUser && copyData && copyData > 0 && (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                                <span>You cannot purchase this asset at this time</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {
                isVideo && data.asset.mediaUrl && (
                    <NFTVideoPlayer
                        src={data.asset.mediaUrl}
                        title={data.asset.name}
                        isOpen={isVideoPlayerOpen}
                        onClose={handleCloseVideo}
                        isMinimized={isVideoMinimized}
                        onToggleMinimize={handleToggleMinimize}
                        autoPlay={true}
                    />
                )
            }
            <Dialog open={isOpenPreview} onOpenChange={
                (isOpen) => {
                    if (!isOpen) {
                        setPreviewMedia(null)
                        setIsOpenPreview(false)
                    }
                }}>
                <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden ">
                    <div className="relative">
                        {previewMedia?.type === MediaType.IMAGE && (
                            <div className="flex items-center justify-center p-4 h-[80vh] max-h-[600px]">
                                <Image
                                    src={previewMedia.url ?? "/placeholder.svg"}
                                    alt="Media preview"
                                    width={800}
                                    height={600}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                        )}
                        {previewMedia?.type === MediaType.THREE_D && (
                            <div className="flex items-center justify-center p-4 h-[80vh] max-h-[600px]">
                                <ShowThreeDModel
                                    url={previewMedia.url}
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div >
    )
}

export default SingleAssetView

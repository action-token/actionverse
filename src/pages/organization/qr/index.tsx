"use client"

import { Album, MediaType } from "@prisma/client"
import { motion, AnimatePresence } from "framer-motion"
import {
    Music,
    Video,
    ImageIcon,
    CuboidIcon as Cube,

    Crown,
    Filter,
    Search,
    Grid,
    List,
    Loader2,
    Plus,
    ShoppingBag,
    AlbumIcon,
    Coins,
    MoreVertical,
    QrCode,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Input } from "~/components/shadcn/ui/input"
import { Button } from "~/components/shadcn/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import Image from "next/image"
import { ToggleGroup, ToggleGroupItem } from "~/components/shadcn/ui/toggle-group"
import { api } from "~/utils/api"
import { useInView } from "react-intersection-observer"
import { useRouter } from "next/router"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { MoreAssetsSkeleton } from "~/components/common/grid-loading"
import MarketAssetComponent from "~/components/common/market-asset"
import { MarketAssetType } from "~/types/market/market-asset-type"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useNFTCreateModalStore } from "~/components/store/nft-create-modal-store"
import { useCreateAlbumStore } from "~/components/store/album-create-store"
import AlbumView from "~/components/music/album/album-item"
import { addrShort } from "~/utils/utils"
import AssetView from "~/components/common/asset"
import { useCreatorStoredAssetModalStore } from "~/components/store/creator-stored-asset-modal-store"
import { useSellPageAssetStore } from "~/components/store/sell-page-asset-store"
import SellPageAssetList from "~/components/sell-page-asset-list"

// Define our types
type MainCategory = "STORED" | "PAGE ASSET"

type RoyaltyItem = {
    id: number
    title: string
    image: string
    type?: string
    royaltyPercentage?: number
}
interface SellPageAsset {
    id: number
    title: string
    description: string | null
    amountToSell: number
    price: number
    priceUSD: number
    priceXLM: number
    isSold: boolean
    placedAt: Date
    soldAt: Date | null
}

export default function StoredItemsView() {
    const [activeTab, setActiveTab] = useState<MainCategory>("STORED")
    const { setIsOpen: setIsOpenNFTModal } = useNFTCreateModalStore()
    const { setIsOpen: setIsAlbumModalOpen } = useCreateAlbumStore()
    const { setIsOpen: setIsOpenSellPageAssetModal } = useSellPageAssetStore()
    const { setIsOpen: setIsOpenStoredModal, setData: setStoredModalData } = useCreatorStoredAssetModalStore()
    // Stored Items Tab State
    const [storedMediaType, setStoredMediaType] = useState<MediaType | "ALL">("ALL")
    const [storedSearchQuery, setStoredSearchQuery] = useState("")
    const [storedSortBy, setStoredSortBy] = useState<"newest" | "oldest" | "price-high" | "price-low">("newest")
    const [storedViewMode, setStoredViewMode] = useState<"grid" | "list">("grid")
    const [selectedStoredItem, setSelectedStoredItem] = useState<MarketAssetType | null>(null)

    // Album Tab State
    const [albumSearchQuery, setAlbumSearchQuery] = useState("")
    const [albumSortBy, setAlbumSortBy] = useState<"newest" | "oldest">("newest")
    const [albumViewMode, setAlbumViewMode] = useState<"grid" | "list">("grid")

    // Royalty Tab State
    const [royaltySearchQuery, setRoyaltySearchQuery] = useState("")
    const [royaltyType, setRoyaltyType] = useState<"ALL" | "MUSIC" | "ARTWORK" | "OTHER">("ALL")
    const [royaltySortBy, setRoyaltySortBy] = useState<"newest" | "highest" | "lowest">("highest")
    const [royaltyViewMode, setRoyaltyViewMode] = useState<"grid" | "list">("grid")

    const [isModalOpen, setIsModalOpen] = useState(false)
    const router = useRouter()

    // Refs for infinite scroll
    const { ref: storedRef, inView: storedInView } = useInView()
    const { ref: albumRef, inView: albumInView } = useInView()
    const { ref: royaltyRef, inView: royaltyInView } = useInView()
    const actions = [
        {
            label: "Mint New Item",
            icon: ShoppingBag,
            onClick: () => setIsOpenNFTModal(true),
        },
        {
            label: "QR Code",
            icon: QrCode,
            onClick: () => setIsAlbumModalOpen(true),
        },
        {
            label: "Sell Page Assets",
            icon: Coins,
            onClick: () => setIsOpenSellPageAssetModal(true),
        },
    ]

    // Stored Items Query
    const {
        data: storedItemsData,
        fetchNextPage: fetchNextStoredItems,
        hasNextPage: hasNextStoredItems,
        isFetchingNextPage: isFetchingNextStoredItems,
        isLoading: isStoredItemsLoading,
    } = api.marketplace.market.getACreatorNfts.useInfiniteQuery(
        {
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
            enabled: activeTab === "STORED",
        },
    )



    // Handle infinite scroll for stored items
    useEffect(() => {
        if (storedInView && activeTab === "STORED" && hasNextStoredItems && !isFetchingNextStoredItems) {
            fetchNextStoredItems()
        }
    }, [storedInView, activeTab, hasNextStoredItems, isFetchingNextStoredItems, fetchNextStoredItems])


    // Process stored items data
    const getFilteredStoredItems = (): MarketAssetType[] => {
        if (!storedItemsData?.pages) return []

        let items = storedItemsData.pages.flatMap((page) =>
            page.nfts.map((item) => ({
                ...item,
                id: item.id,
                title: item.asset.name ?? "Untitled",
                image: item.asset.thumbnail ?? "/placeholder.svg",
                mediaType: item.asset.mediaType as MediaType,
                price: item.price,
            })),
        )

        // Filter by media type
        if (storedMediaType !== "ALL") {
            items = items.filter((item) => item.mediaType === storedMediaType)
        }

        // Filter by search
        if (storedSearchQuery) {
            items = items.filter((item) => item.title.toLowerCase().includes(storedSearchQuery.toLowerCase()))
        }

        // Sort items
        items.sort((a, b) => {
            switch (storedSortBy) {
                case "price-high":
                    return (b.price ?? 0) - (a.price ?? 0)
                case "price-low":
                    return (a.price ?? 0) - (b.price ?? 0)
                case "oldest":
                    return a.id > b.id ? 1 : -1
                default: // newest
                    return a.id < b.id ? 1 : -1
            }
        })

        return items
    }

    // Process albums data


    // Process royalty items data

    const getMediaTypeIcon = (type: MediaType) => {
        switch (type) {
            case MediaType.MUSIC:
                return <Music className="h-4 w-4" />
            case MediaType.VIDEO:
                return <Video className="h-4 w-4" />
            case MediaType.IMAGE:
                return <ImageIcon className="h-4 w-4" />
            case MediaType.THREE_D:
                return <Cube className="h-4 w-4" />
            default:
                return <ImageIcon className="h-4 w-4" />
        }
    }

    const handleStoredItemClick = (item: MarketAssetType) => {
        setSelectedStoredItem(item)
        setIsModalOpen(true)
    }

    return (

        <Card>
            <CardHeader className="flex flex-row items-center justify-between w-full">
                <div className="flex items-center justify-between w-full">
                    <h2 className="text-4xl font-semibold text-center">Stores</h2>
                    <div className="hidden md:flex items-center gap-2">
                        {actions.map((action) => {
                            const Icon = action.icon
                            return (
                                <Button key={action.label} onClick={action.onClick} className="cursor-pointer shadow-sm shadow-foreground">
                                    <Icon className="mr-2 h-4 w-4" />
                                    <span>{action.label}</span>
                                </Button>
                            )
                        })}
                    </div>
                </div>
                <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="">
                                <Plus className="h-4 w-4" />
                                <span className="">Create</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {actions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <DropdownMenuItem key={action.label} onClick={action.onClick} className="cursor-pointer">
                                        <Icon className="mr-2 h-4 w-4" />
                                        <span>{action.label}</span>
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="overflow-y-auto  scrollbar-hide h-[calc(100vh-20vh)]">
                <Tabs
                    defaultValue="STORED"
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as MainCategory)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="STORED" className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Store Items
                        </TabsTrigger>
                        <TabsTrigger value="QR_CODE" className="flex items-center gap-2">
                            <QrCode className="h-4 w-4" />
                            QR Codes
                        </TabsTrigger>
                        <TabsTrigger value="PageAsset" className="flex items-center gap-2">
                            <Coins className="h-4 w-4" />
                            Page Assets
                        </TabsTrigger>
                    </TabsList>

                    {/* STORED ITEMS TAB */}
                    <TabsContent value="STORED" className="pt-4  ">
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search store items..."
                                    value={storedSearchQuery}
                                    onChange={(e) => setStoredSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>

                            <div className="flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full sm:w-auto">
                                            <Filter className="h-4 w-4 mr-2" />
                                            Sort
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem onClick={() => setStoredSortBy("newest")}>Newest First</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setStoredSortBy("oldest")}>Oldest First</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setStoredSortBy("price-high")}>Price: High to Low</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setStoredSortBy("price-low")}>Price: Low to High</DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <ToggleGroup
                                    type="single"
                                    value={storedViewMode}
                                    onValueChange={(value) => value && setStoredViewMode(value as "grid" | "list")}
                                >
                                    <ToggleGroupItem value="grid" aria-label="Grid view">
                                        <Grid className="h-4 w-4" />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="list" aria-label="List view">
                                        <List className="h-4 w-4" />
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        </div>

                        {/* Media Type Filters */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            <Badge
                                variant={storedMediaType === "ALL" ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/10 px-3 py-1 text-sm"
                                onClick={() => setStoredMediaType("ALL")}
                            >
                                All Types
                            </Badge>
                            <Badge
                                variant={storedMediaType === MediaType.MUSIC ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/10 px-3 py-1 text-sm"
                                onClick={() => setStoredMediaType(MediaType.MUSIC)}
                            >
                                <Music className="h-3 w-3 mr-1" />
                                Music
                            </Badge>
                            <Badge
                                variant={storedMediaType === MediaType.VIDEO ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/10 px-3 py-1 text-sm"
                                onClick={() => setStoredMediaType(MediaType.VIDEO)}
                            >
                                <Video className="h-3 w-3 mr-1" />
                                Video
                            </Badge>
                            <Badge
                                variant={storedMediaType === MediaType.IMAGE ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/10 px-3 py-1 text-sm"
                                onClick={() => setStoredMediaType(MediaType.IMAGE)}
                            >
                                <ImageIcon className="h-3 w-3 mr-1" />
                                Image
                            </Badge>
                            <Badge
                                variant={storedMediaType === MediaType.THREE_D ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/10 px-3 py-1 text-sm"
                                onClick={() => setStoredMediaType(MediaType.THREE_D)}
                            >
                                <Cube className="h-3 w-3 mr-1" />
                                3D
                            </Badge>
                        </div>

                        {isStoredItemsLoading ? (
                            <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4  xl:grid-cols-5" />
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`stored-${storedMediaType}-${storedViewMode}-${storedSortBy}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className={
                                        storedViewMode === "grid"
                                            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                                            : "flex flex-col gap-4"
                                    }
                                >
                                    {getFilteredStoredItems().length > 0 ? (
                                        <>
                                            {getFilteredStoredItems().map((item) => (
                                                <motion.div
                                                    key={item.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                    className={storedViewMode === "list" ? "w-full" : ""}
                                                >
                                                    {storedViewMode === "grid" ? (
                                                        <div
                                                            className=""
                                                            onClick={() => {
                                                                setIsOpenStoredModal(true)
                                                                setStoredModalData(item)
                                                            }}
                                                        >
                                                            <AssetView code={item.asset.name} thumbnail={item.asset.thumbnail}
                                                                isNFT={true} creatorId={item.asset.creatorId}
                                                                price={item.price}
                                                                priceInUSD={item.priceUSD}
                                                                mediaType={item.asset.mediaType}

                                                            />
                                                        </div>
                                                    ) : (
                                                        <Card className="overflow-hidden cursor-pointer" onClick={() => handleStoredItemClick(item)}>
                                                            <div className="flex">
                                                                <div className="relative w-24 h-24">
                                                                    <Image
                                                                        src={item.asset.thumbnail ?? "/placeholder.svg"}
                                                                        alt={item.asset.name}
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                </div>
                                                                <CardContent className="flex-1 p-4">
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <h3 className="font-semibold">{item.asset.name}</h3>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            {item.price && item.price > 0 && (
                                                                                <Badge>
                                                                                    {item.price} {PLATFORM_ASSET.code}
                                                                                </Badge>
                                                                            )}
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {getMediaTypeIcon(item.asset.mediaType)}
                                                                                <span className="ml-1">{item.asset.mediaType}</span>
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}
                                                </motion.div>
                                            ))}

                                            {/* Infinite scroll loading indicator */}
                                            {(hasNextStoredItems ?? isFetchingNextStoredItems) && (
                                                <div ref={storedRef} className="col-span-full flex justify-center py-8">
                                                    {isFetchingNextStoredItems ? (
                                                        <Loader2 className="h-6 w-6 animate-spin " />
                                                    ) : (
                                                        <Button variant="outline" onClick={() => fetchNextStoredItems()}>
                                                            Load More
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                                            <div className="rounded-full bg-muted p-6 mb-4">
                                                <Search className="h-10 w-10 text-muted-foreground" />
                                            </div>
                                            <h3 className="text-lg font-medium">No store items found</h3>
                                            <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
                                            <Button
                                                variant="outline"
                                                className="mt-4"
                                                onClick={() => {
                                                    setStoredMediaType("ALL")
                                                    setStoredSearchQuery("")
                                                }}
                                            >
                                                Reset Filters
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </TabsContent>



                    {/* PAGE ASSETS TAB */}
                    <TabsContent value="PageAsset" className="pt-4">
                        <SellPageAssetList />
                    </TabsContent>
                </Tabs>

            </CardContent>
        </Card>

    )
}


"use client"
import { useQuery } from "@tanstack/react-query"
import type React from "react"

import { ArrowUpDown, Eye, ScanLine, Trash2, Package, MapPin, Star } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"
import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { BASE_URL } from "~/lib/common"
import { useCollection } from "~/lib/state/augmented-reality/useCollection"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin"
import type { ConsumedLocation } from "~/types/game/location"

type ButtonLayout = {
    x: number
    y: number
    width: number
    height: number
}

export default function MyCollectionScreen() {
    const [refreshing, setRefreshing] = useState(false)
    const router = useRouter()
    const [sortBy, setSortBy] = useState("title")
    const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
    const { onOpen } = useModal()
    const { setData } = useCollection()
    const { setData: setNearByPinData } = useNearByPin()

    const filterButtonRef = useRef<HTMLButtonElement>(null)
    const arButtonRef = useRef<HTMLButtonElement>(null)
    const deleteButtonRef = useRef<HTMLButtonElement>(null)
    const viewButtonRef = useRef<HTMLButtonElement>(null)

    const { data: walkthroughData } = useWalkThrough()
    const [showWalkthrough, setShowWalkthrough] = useState(false)

    const steps = [
        {
            target: buttonLayouts[0],
            title: "Filter Collection",
            content: "User can filter Collection between Title and Remaining Limit",
        },
        {
            target: buttonLayouts[1],
            title: "View in AR",
            content:
                "Press the AR button to view your digital item in AR mode. In AR, explore your surroundings and see your pin as a real-life item.",
        },
        {
            target: buttonLayouts[2],
            title: "Delete Collection",
            content: "Once you've redeemed a reward, use it to permanently remove the pin from your collection.",
        },
        {
            target: buttonLayouts[3],
            title: "View Collection",
            content:
                "Pressing View on a pin reveals details like the brand, collection date, item info, a Claim button for more details, collection limits, and more.",
        },
    ]

    const dummyCollection: ConsumedLocation[] = [
        {
            id: "1",
            title: "Pin Title",
            description: "This is a dummy collected pin description",
            image_url: "https://app.action-tokens.com/images/action/logo.png",
            collection_limit_remaining: 1,
            lat: 1.0,
            lng: 1.0,
            url: "https://www.google.com",
            collected: true,
            auto_collect: false,
            brand_id: "1",
            brand_image_url: "https://app.action-tokens.com/images/action/logo.png",
            brand_name: "Dummy Brand",
            modal_url: "https://www.google.com",
            viewed: true,
        },
    ]

    const getCollections = async () => {
        try {
            const response = await fetch(new URL("api/game/locations/get_consumed_location", BASE_URL).toString(), {
                method: "GET",
                credentials: "include",
            })

            if (!response.ok) {
                throw new Error("Failed to fetch collections")
            }

            const data = (await response.json()) as { locations: ConsumedLocation[] }
            return data
        } catch (error) {
            console.error("Error fetching collections:", error)
            throw error
        }
    }

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["collection"],
        queryFn: getCollections,
    })

    const sortLocations = (locations: ConsumedLocation[]) => {
        return [...locations].sort((a, b) => {
            if (sortBy === "Title") {
                return a.title.localeCompare(b.title)
            } else if (sortBy === "Limit Remaining") {
                return b.collection_limit_remaining - a.collection_limit_remaining
            }
            return 0
        })
    }

    const handleFilterChange = (filter: string) => {
        setSortBy(filter)
    }

    const sortedLocations = useMemo(() => sortLocations(data?.locations ?? []), [data?.locations, sortBy])

    const onARPress = (item: ConsumedLocation) => {
        setNearByPinData({
            nearbyPins: item ? [item] : [],
            singleAR: true,
        })
        router.push("/augmented-reality/enter")
    }

    useLayoutEffect(() => {
        const updateButtonLayouts = () => {
            const filterButton = filterButtonRef.current
            const arButton = arButtonRef.current
            const deleteButton = deleteButtonRef.current
            const viewButton = viewButtonRef.current

            if (filterButton && arButton && deleteButton && viewButton) {
                const filterRect = filterButton.getBoundingClientRect()
                const arRect = arButton.getBoundingClientRect()
                const deleteRect = deleteButton.getBoundingClientRect()
                const viewRect = viewButton.getBoundingClientRect()

                setButtonLayouts([
                    {
                        x: filterRect.left,
                        y: filterRect.top,
                        width: filterRect.width,
                        height: filterRect.height,
                    },
                    {
                        x: arRect.left,
                        y: arRect.top,
                        width: arRect.width,
                        height: arRect.height,
                    },
                    {
                        x: deleteRect.left,
                        y: deleteRect.top,
                        width: deleteRect.width,
                        height: deleteRect.height,
                    },
                    {
                        x: viewRect.left,
                        y: viewRect.top,
                        width: viewRect.width,
                        height: viewRect.height,
                    },
                ])
            }
        }

        const observer = new MutationObserver(() => {
            updateButtonLayouts()
        })

        observer.observe(document.body, { childList: true, subtree: true })
        updateButtonLayouts()

        return () => {
            observer.disconnect()
        }
    }, [])

    const checkFirstTimeSignIn = async () => {
        if (walkthroughData.showWalkThrough) {
            setShowWalkthrough(true)
        } else {
            setShowWalkthrough(false)
        }
    }

    useEffect(() => {
        checkFirstTimeSignIn()
    }, [walkthroughData])

    if (isLoading) {
        return <Loading />
    }

    if (isError) {
        return (
            <div className="flex h-screen flex-col items-center justify-center">
                <p className="text-lg text-red-500">Error fetching collections</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* Modern Header */}
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <Package className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Collection</h1>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{sortedLocations.length} items collected</p>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    ref={filterButtonRef}
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent"
                                >
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                    {sortBy}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {["Title", "Limit Remaining"].map((filter) => (
                                    <DropdownMenuItem key={filter} onClick={() => handleFilterChange(filter)}>
                                        {filter}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="px-4 py-6 max-w-4xl mx-auto">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {showWalkthrough ? (
                        dummyCollection.map((item: ConsumedLocation) => (
                            <CollectionCard
                                key={item.id}
                                item={item}
                                onARPress={onARPress}
                                onDelete={(id, name) => onOpen("Delete", { collectionId: id, collectionName: name })}
                                onView={(item) => {
                                    setData({ collections: item })
                                    router.push(`/play/collections/${item.id}`)
                                }}
                                arButtonRef={arButtonRef}
                                deleteButtonRef={deleteButtonRef}
                                viewButtonRef={viewButtonRef}
                            />
                        ))
                    ) : sortedLocations.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20">
                            <div className="text-center">
                                <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 mb-6 inline-block">
                                    <Package className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No collections yet</h3>
                                <p className="text-slate-600 dark:text-slate-400 max-w-md">
                                    Start exploring and collecting pins to build your collection.
                                </p>
                            </div>
                        </div>
                    ) : (
                        sortedLocations.map((item: ConsumedLocation) => (
                            <CollectionCard
                                key={item.id}
                                item={item}
                                onARPress={onARPress}
                                onDelete={(id, name) => onOpen("Delete", { collectionId: id, collectionName: name })}
                                onView={(item) => {
                                    setData({ collections: item })
                                    router.push(`/augmented-reality/collections/${item.id}`)
                                }}
                                arButtonRef={arButtonRef}
                                deleteButtonRef={deleteButtonRef}
                                viewButtonRef={viewButtonRef}
                            />
                        ))
                    )}
                </div>
            </div>

            {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
        </div>
    )
}

interface CollectionCardProps {
    item: ConsumedLocation
    onARPress: (item: ConsumedLocation) => void
    onDelete: (id: string, name: string) => void
    onView: (item: ConsumedLocation) => void
    arButtonRef?: React.RefObject<HTMLButtonElement>
    deleteButtonRef?: React.RefObject<HTMLButtonElement>
    viewButtonRef?: React.RefObject<HTMLButtonElement>
}

function CollectionCard({
    item,
    onARPress,
    onDelete,
    onView,
    arButtonRef,
    deleteButtonRef,
    viewButtonRef,
}: CollectionCardProps) {
    return (
        <Card className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
            {/* Image Header */}
            <CardHeader className="p-0 relative">
                <div className="relative h-48 overflow-hidden">
                    <Image
                        src={item.image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                    {/* Collection Limit Badge */}
                    <div className="absolute top-4 right-4">
                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg border-0 px-3 py-1 font-semibold">
                            {item.collection_limit_remaining} left
                        </Badge>
                    </div>

                    {/* Brand Badge */}
                    {item.brand_name && (
                        <div className="absolute bottom-4 left-4">
                            <div className="flex items-center space-x-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg">
                                <Star className="h-3 w-3 text-amber-500" />
                                <span className="text-xs font-medium text-slate-900 dark:text-white">{item.brand_name}</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>

            {/* Content */}
            <CardContent className="p-6 space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">{item.description}</p>

                    {/* Location Info */}
                    <div className="flex items-center space-x-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>
                            {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                        </span>
                    </div>
                </div>
            </CardContent>

            {/* Actions */}
            <CardFooter className="p-6 pt-0">
                <div className="grid grid-cols-3 gap-2 w-full">
                    <Button
                        ref={arButtonRef}
                        size="sm"
                        variant="outline"
                        onClick={() => onARPress(item)}
                        className="rounded-xl bg-transparent border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        <ScanLine className="h-4 w-4" />
                    </Button>

                    <Button
                        ref={deleteButtonRef}
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete(item.id as string, item.title)}
                        className="rounded-xl bg-transparent border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>

                    <Button
                        ref={viewButtonRef}
                        size="sm"
                        onClick={() => onView(item)}
                        className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}

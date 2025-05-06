"use client"


import { Button } from "~/components/shadcn/ui/button"
import { Award, Calendar, Coins, Compass, DollarSign, Filter, Loader2, MapPin, Trophy, Users } from "lucide-react"
import { HorizontalScroll } from "../common/horizontal-scroll"
import { api } from "~/utils/api"
import { BountyType } from "@prisma/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { ImageWithFallback } from "../common/image-with-fallback"
import { Badge } from "../shadcn/ui/badge"
import { cn } from "~/lib/utils"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { Skeleton } from "../shadcn/ui/skeleton"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import toast from "react-hot-toast"
import { useRouter } from "next/router"
import { Spinner } from "../shadcn/ui/spinner"

export function BountySection() {
    const { data, isLoading, error, fetchNextPage, isFetchingNextPage } = api.bounty.Bounty.getPaginatedBounty.useInfiniteQuery(
        {
            limit: 7,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )

    const bounties = data?.pages.flatMap((page) => page.bountyWithIsOwnerNisJoined) ?? []
    const hasMore = data?.pages[data.pages.length - 1]?.nextCursor != null

    const handleLoadMore = async (direction: "left" | "right") => {
        if (direction === "right" && hasMore) {
            await fetchNextPage()
        }
    }

    if (isLoading) {
        return (
            <section id="bounties-section" className="bg-gray-100 py-20">
                <div className="container mx-auto px-4">
                    <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Available Bounties</h2>
                            <p className="mt-2 text-gray-600">Complete tasks and earn rewards in our digital ecosystem.</p>
                        </div>
                        <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                            <Filter className="mr-2 h-4 w-4" />
                            Filter Bounties
                        </Button>
                    </div>

                    <HorizontalScroll>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <BountyCardSkeleton key={`skeleton-${index}`} />
                        ))}
                    </HorizontalScroll>
                </div>
            </section>
        )
    }


    if (error) {
        return (
            <div className="flex h-40 w-full items-center justify-center">
                <p className="text-red-500">Error loading bounties: {error.message}</p>
            </div>
        )
    }

    if (!bounties || bounties.length === 0) {
        return (
            <div className="flex h-40 w-full items-center justify-center">
                <p className="text-gray-600">No bounties found.</p>
            </div>
        )
    }

    return (
        <section id="bounties-section" className="bg-gray-100 py-20">
            <div className="container mx-auto px-4">
                <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Available Bounties</h2>
                        <p className="mt-2 text-gray-600">Complete tasks and earn rewards in our digital ecosystem.</p>
                    </div>

                </div>

                <HorizontalScroll onNavigate={handleLoadMore} isLoadingMore={isFetchingNextPage}>
                    {bounties.map((bounty) => (
                        <BountyCard key={bounty.id} {...bounty} />
                    ))}
                </HorizontalScroll>
            </div>
        </section>
    )
}

interface BountyProps {
    id: number;
    title: string;
    description: string;
    priceInUSD: number;
    priceInBand: number;
    requiredBalance: number;
    currentWinnerCount: number;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number | null;

    imageUrls: string[];
    totalWinner: number;
    bountyType: "GENERAL" | "LOCATION_BASED" | "SCAVENGER_HUNT";
    status: "PENDING" | "APPROVED" | "REJECTED";
    creatorId: string;
    _count: {
        participants: number;
        BountyWinner: number;
    }
    creator: {
        name: string;
        profileUrl: string | null;
    },
    isJoined: boolean;
    isOwner: boolean;

}



export function BountyCard({
    id,
    title,
    description,
    priceInUSD,
    priceInBand,
    requiredBalance,
    currentWinnerCount,
    latitude,
    longitude,
    radius,

    imageUrls,
    totalWinner,
    _count,
    status,
    creatorId,
    bountyType,
    isJoined,
    isOwner,


}
    : BountyProps
) {
    const router = useRouter()
    const { platformAssetBalance } = useUserStellarAcc();

    const getBountyTypeIcon = (type: BountyType) => {
        switch (type) {
            case BountyType.GENERAL:
                return <Trophy className="h-4 w-4" />
            case BountyType.LOCATION_BASED:
                return <MapPin className="h-4 w-4" />
            case BountyType.SCAVENGER_HUNT:
                return <Compass className="h-4 w-4" />
        }
    }

    const getBountyTypeLabel = (type: BountyType) => {
        switch (type) {
            case BountyType.GENERAL:
                return "Regular"
            case BountyType.LOCATION_BASED:
                return "Location-based"
            case BountyType.SCAVENGER_HUNT:
                return "Scavenger Hunt"
        }
    }

    const getBountyTypeColor = (type: BountyType) => {
        switch (type) {
            case BountyType.GENERAL:
                return "bg-green-100 text-green-600"
            case BountyType.LOCATION_BASED:
                return "bg-blue-100 text-blue-600"
            case BountyType.SCAVENGER_HUNT:
                return "bg-yellow-100 text-yellow-600"
        }
    }

    const isEligible = (bounty: {
        currentWinnerCount: number;
        totalWinner: number;
        requiredBalance: number;
    }) => {
        return currentWinnerCount < totalWinner && requiredBalance <= platformAssetBalance
    }
    const joinBountyMutation = api.bounty.Bounty.joinBounty.useMutation({
        onSuccess: async (data, variables) => {
            toast.success("You have successfully joined the bounty")
            router.push(`/bounty/${variables?.BountyId}`)

        },
    });
    const handleJoinBounty = (id: number) => {
        joinBountyMutation.mutate({ BountyId: id });
    };
    return (
        <Card
            className={cn(
                "w-[320px] flex-shrink-0 overflow-hidden bg-white shadow-md snap-start",

            )}
        >
            <div className="relative h-40 w-full">
                <ImageWithFallback src={imageUrls[0] ?? "/images/action/logo.png"} alt={title} fill className={
                    `${imageUrls[0] ? "object-cover" : "object-contain"}`
                } />

            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("flex items-center gap-1", getBountyTypeColor(bountyType))}>
                        {getBountyTypeIcon(bountyType)}
                        {getBountyTypeLabel(bountyType)}
                    </Badge>
                    <div className="flex flex-col items-end gap-1">

                        <Badge variant="outline" >
                            {priceInBand.toFixed(2)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                        </Badge>
                    </div>

                </div>
                <CardTitle className="mt-2 text-lg truncate">{title}</CardTitle>
                {/* <CardDescription className="line-clamp-2 text-gray-600 truncate">{description}</CardDescription> */}
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-2 text-sm text-gray-600">

                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>
                            {currentWinnerCount} / {totalWinner} winners
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>
                            {_count.participants} participants
                        </span>
                    </div>


                </div>
            </CardContent>
            <CardFooter className="bg-secondary p-4 flex flex-col items-center ">
                <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center text-sm">
                        <Award className="mr-1 inline-block h-4 w-4" />
                        <span className="font-semibold">
                            {priceInBand.toFixed(2)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                        </span>
                    </div>
                    <Badge
                        className="shadow-sm shadow-black rounded-sm"
                        variant={currentWinnerCount === totalWinner ? "destructive" : "default"}
                    >
                        {currentWinnerCount === totalWinner ? "Completed" : "Active"}
                    </Badge>
                </div>
                {isJoined ?? isOwner ? (
                    <Button

                        onClick={() => {
                            router.push(`/bounty/${id}`)
                        }}
                        variant="default" className="w-full mt-2 shadow-sm shadow-foreground">
                        View
                    </Button>
                ) : (
                    <Button variant="default"

                        onClick={(e) => {
                            e.stopPropagation()
                            handleJoinBounty(id)
                        }}
                        className="w-full mt-2 shadow-sm shadow-foreground" disabled={!isEligible({
                            currentWinnerCount,
                            totalWinner,
                            requiredBalance,
                        })}>
                        {joinBountyMutation.isLoading
                            && id === joinBountyMutation.variables?.BountyId
                            ? <span className="flex items-center justify-center gap-2">
                                <Spinner size='small' className="text-black" />
                                Joining...
                            </span> : "Join"}
                    </Button>
                )}
                {!isEligible({
                    currentWinnerCount,
                    totalWinner,
                    requiredBalance,
                }) ? (
                    <p className="text-xs text-red-500 mt-2">
                        {currentWinnerCount >= totalWinner ? "No spots left" : `${requiredBalance.toFixed(1)} ${PLATFORM_ASSET.code.toLocaleUpperCase()} required`}
                    </p>
                ) :
                    <p className="text-xs text-green-500 mt-2">
                        {currentWinnerCount >= totalWinner ? "No spots left" :

                            isOwner ? "You are the owner" : isJoined ? "You have already joined" : "You are eligible to join"
                        }
                    </p>

                }
            </CardFooter>
        </Card>
    )
}
export function BountyCardSkeleton() {
    return (
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-white shadow-md snap-start">
            {/* Image placeholder */}
            <div className="relative h-40 w-full">
                <Skeleton className="h-full w-full" />
            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" /> {/* Badge */}
                    <Skeleton className="h-5 w-16" /> {/* Reward */}
                </div>
                <Skeleton className="mt-2 h-6 w-40" /> {/* Title */}
                <Skeleton className="mt-1 h-4 w-full" /> {/* Description line 1 */}
                <Skeleton className="mt-1 h-4 w-3/4" /> {/* Description line 2 */}
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-32" /> {/* Location */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-24" /> {/* Deadline */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-36" /> {/* Participants */}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Skeleton className="h-9 w-full" /> {/* Button */}
            </CardFooter>
        </Card>
    )
}

"use client"

import { Button } from "~/components/shadcn/ui/button"
import { Award, Calendar, Coins, Compass, DollarSign, DollarSignIcon, Filter, Loader2, MapPin, Share2, Trophy, Users } from 'lucide-react'
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
import { FaDollarSign } from "react-icons/fa"
import { useSession } from "next-auth/react"
import BountyList from "./bounty-list"
import { useEffect, useState } from "react"
import { checkStellarAccountActivity } from "~/lib/helper/helper_client"
import { useShareBountyModalStore } from "../store/share-bounty-modal-store"

export function BountySection() {
    const session = useSession()
    const [isActive, setIsActive] = useState<boolean>(false);
    const [isActiveStatusLoading, setIsActiveStatusLoading] = useState<boolean>(false);
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
    useEffect(() => {
        const checkAccountActivity = async () => {
            if (session.data?.user.id) {
                setIsActiveStatusLoading(true);
                const active = await checkStellarAccountActivity(session.data.user.id);
                setIsActive(active);
                setIsActiveStatusLoading(false);
            }
        }
        checkAccountActivity();
    }, [session.data?.user.id]);
    if (isLoading) {
        return (
            <section id="bounties-section" className="bg-muted py-20">
                <div className="container mx-auto px-4">
                    <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Available Bounties</h2>
                            <p className="mt-2 text-muted-foreground">Complete tasks and earn rewards in our digital ecosystem.</p>
                        </div>
                        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
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
                <p className="text-destructive">Error loading bounties: {error.message}</p>
            </div>
        )
    }

    if (!bounties || bounties.length === 0) {
        return (
            <div className="flex h-40 w-full items-center justify-center">
                <p className="text-muted-foreground">No bounties found.</p>
            </div>
        )
    }

    return (
        <section id="bounties-section" className="bg-muted py-20">
            <div className="container mx-auto px-4">
                <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-foreground md:text-4xl">Available Bounties</h2>
                        <p className="mt-2 text-muted-foreground">Complete tasks and earn rewards in our digital ecosystem.</p>
                    </div>
                </div>

                <HorizontalScroll onNavigate={handleLoadMore} isLoadingMore={isFetchingNextPage}>
                    <BountyList
                        isActive={isActive}
                        isActiveStatusLoading={isActiveStatusLoading}
                        bounties={bounties} />

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
    requiredBalanceCode?: string | null;
    requiredBalanceIssuer?: string | null;
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
    requiredBalanceCode,
    requiredBalanceIssuer,
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
}: BountyProps) {
    const router = useRouter()
    const { platformAssetBalance, getAssetBalance } = useUserStellarAcc();
    const session = useSession()
    const shareBountyModal = useShareBountyModalStore()

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
                return "bg-primary/10 text-primary"
            case BountyType.LOCATION_BASED:
                return "bg-blue-100 text-blue-600"
            case BountyType.SCAVENGER_HUNT:
                return "bg-yellow-100 text-yellow-600"
        }
    }

    const isEligible = () => {
        if (session.status === 'unauthenticated') return false
        if (currentWinnerCount >= totalWinner) return false
        if (requiredBalanceCode && requiredBalanceIssuer) {
            const balance = Number(getAssetBalance({ code: requiredBalanceCode, issuer: requiredBalanceIssuer }) ?? 0)
            return requiredBalance <= balance
        }
        return requiredBalance <= platformAssetBalance
    }

    const getIneligibleReason = () => {
        if (session.status === 'unauthenticated') return "Connect wallet to join"
        if (currentWinnerCount >= totalWinner) return "No spots left"
        const tokenName = requiredBalanceCode?.toUpperCase() ?? PLATFORM_ASSET.code.toUpperCase()
        return `${requiredBalance.toFixed(1)} ${tokenName} required`
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

    const spotsLeft = totalWinner - currentWinnerCount

    const getRewardText = () => {
        if (priceInUSD > 0) return `$${priceInUSD.toFixed(2)}`
        if (priceInBand > 0) return `${priceInBand.toFixed(2)} ${PLATFORM_ASSET.code.toUpperCase()}`
        return "Free"
    }

    return (
        <Card
            className={cn(
                "group w-[320px] flex-shrink-0 cursor-pointer overflow-hidden bg-card shadow-sm ring-1 ring-border/50 snap-start transition-all duration-300 hover:shadow-lg hover:ring-border",
            )}
            onClick={() => router.push(`/bounty/${id}`)}
        >
            <div className="relative h-44 w-full overflow-hidden">
                <ImageWithFallback
                    src={imageUrls[0] ?? "/images/action/logo.png"}
                    alt={title}
                    fill
                    className={`${imageUrls[0] ? "object-cover" : "object-contain"} transition-transform duration-500 group-hover:scale-105`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute left-3 top-3">
                    <Badge variant="secondary" className={cn("gap-1 bg-background/80 backdrop-blur-sm text-[10px]", getBountyTypeColor(bountyType))}>
                        {getBountyTypeIcon(bountyType)}
                        {getBountyTypeLabel(bountyType)}
                    </Badge>
                </div>

                <div className="absolute right-3 top-3">
                    <Badge className="bg-primary/90 text-[10px] font-semibold text-primary-foreground">
                        <Award className="mr-1 h-3 w-3" />
                        {getRewardText()}
                    </Badge>
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="truncate text-base font-bold text-white drop-shadow-sm">{title}</h3>
                </div>
            </div>

            <div className="p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {_count.participants} joined
                    </span>
                    <span className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5" />
                        {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` : "Full"}
                    </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    {(isJoined || isOwner) ? (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 rounded-lg text-xs font-medium"
                            onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/bounty/${id}`)
                            }}
                        >
                            View Bounty
                        </Button>
                    ) : isEligible() ? (
                        <Button
                            size="sm"
                            className="h-8 flex-1 rounded-lg text-xs font-medium"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleJoinBounty(id)
                            }}
                            disabled={joinBountyMutation.isLoading}
                        >
                            {joinBountyMutation.isLoading && id === joinBountyMutation.variables?.BountyId
                                ? <span className="flex items-center gap-1.5"><Spinner size='small' className="text-foreground" /> Joining...</span>
                                : "Join Bounty"}
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 rounded-lg text-xs font-medium"
                            onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/bounty/${id}`)
                            }}
                        >
                            View Bounty
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        onClick={(e) => {
                            e.stopPropagation()
                            shareBountyModal.openWithBounty(id)
                        }}
                    >
                        <Share2 className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {!isJoined && !isOwner && (
                    <p className={cn("mt-2 text-center text-[10px] font-medium", isEligible() ? "text-emerald-600" : "text-muted-foreground")}>
                        {isEligible() ? "You are eligible to join" : getIneligibleReason()}
                    </p>
                )}
            </div>
        </Card>
    )
}

export function BountyCardSkeleton() {
    return (
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-card shadow-sm ring-1 ring-border/50 snap-start">
            <Skeleton className="h-44 w-full" />
            <div className="p-3 space-y-3">
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-8 w-full" />
            </div>
        </Card>
    )
}

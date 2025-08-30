"use client"

import Image from "next/image"
import { Award, Trophy, User, Users, MapPin, Target } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { type BountyTypes } from "~/types/bounty/bounty-type"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useRouter } from "next/navigation"
import { Button } from "~/components/shadcn/ui/button"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { api } from "~/utils/api"
import { toast } from "~/hooks/use-toast"
import { addrShort } from "~/utils/utils"
import { Spinner } from "~/components/shadcn/ui/spinner"
import { Preview } from "../common/quill-preview"
import { Slider } from "../shadcn/ui/slider"
import { Progress } from "../shadcn/ui/progress"
export enum BountyTypeEnum {
    GENERAL = "GENERAL",
    LOCATION_BASED = "LOCATION_BASED",
    SCAVENGER_HUNT = "SCAVENGER_HUNT",
}
function SafeHTML({ html }: { html: string }) {
    return <Preview value={html} />
}

// Helper function to get bounty type icon
const getBountyTypeIcon = (type: BountyTypeEnum) => {
    switch (type) {
        case BountyTypeEnum.LOCATION_BASED:
            return <MapPin className="h-4 w-4" />
        case BountyTypeEnum.SCAVENGER_HUNT:
            return <Target className="h-4 w-4" />
        default:
            return <Trophy className="h-4 w-4" />
    }
}

// Helper function to get bounty type label
const getBountyTypeLabel = (type: BountyTypeEnum) => {
    switch (type) {
        case BountyTypeEnum.LOCATION_BASED:
            return "Location"
        case BountyTypeEnum.SCAVENGER_HUNT:
            return "Scavenger"
        default:
            return "General"
    }
}

export default function BountyList({ bounties }: { bounties: BountyTypes[] }) {

    const router = useRouter()
    const { getAssetBalance } = useUserStellarAcc();

    const isEligible = (bounty: BountyTypes) => {
        const balance = getAssetBalance({
            code: bounty.requiredBalanceCode,
            issuer: bounty.requiredBalanceIssuer
        })
        console.log("bounty.currentWinnerCount < bounty.totalWinner && bounty.requiredBalance <= getAssetBalance(bounty.requiredBalanceCode, bounty.requiredBalanceIssuer);")
        return bounty.currentWinnerCount < bounty.totalWinner && (bounty.requiredBalance <= Number(balance));
    }
    const joinBountyMutation = api.bounty.Bounty.joinBounty.useMutation({
        onSuccess: async (data, variables) => {
            toast({
                title: "Success",
                description: "You have successfully joined the bounty",
            })
            router.push(`/bounty/${variables?.BountyId}`)
        },
    })

    const handleJoinBounty = (id: number) => {
        joinBountyMutation.mutate({ BountyId: id })
    }

    if (bounties.length === 0) {
        return null // Empty state is handled in the parent component
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bounties.map((bounty, index) => {
                console.log(bounty.ActionLocation?.length)
                const totalSteps = bounty.ActionLocation?.length ?? 0

                return (
                    <Card
                        key={index}
                        className="overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"

                    >
                        <CardHeader className="relative p-0">
                            <div className="relative h-48 w-full overflow-hidden">
                                <Image
                                    src={bounty.imageUrls[0] ?? "/images/logo.png"}
                                    alt={bounty.title}
                                    width={400}
                                    height={200}
                                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                                />
                                <div className="absolute top-3 left-3 flex gap-2">
                                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                                        <div className="flex items-center gap-1">
                                            {getBountyTypeIcon(bounty.bountyType as BountyTypeEnum)}
                                            <span>{getBountyTypeLabel(bounty.bountyType as BountyTypeEnum)}</span>
                                        </div>
                                    </Badge>
                                </div>
                                <div className="absolute top-3 right-3">
                                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm font-semibold">
                                        ${bounty.priceInUSD}
                                    </Badge>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent h-16" />
                            </div>
                        </CardHeader>

                        <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                                <Badge
                                    variant={bounty.currentWinnerCount === bounty.totalWinner ? "destructive" : "outline"}
                                    className="font-medium"
                                >
                                    {bounty.currentWinnerCount === bounty.totalWinner ? "Completed" : "Active"}
                                </Badge>
                                <div className="flex items-center text-sm">
                                    <Award className="mr-1 h-4 w-4" />
                                    <span className="font-medium">
                                        {bounty.priceInBand.toFixed(2)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <CardTitle className="text-xl mb-2 line-clamp-1">{bounty.title}</CardTitle>

                            <div className="mb-3 h-[60px] overflow-hidden text-sm text-muted-foreground">
                                <SafeHTML html={bounty.description} />
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center">
                                    <Users className="mr-1 h-4 w-4" />
                                    <span>{bounty._count.participants} participants</span>
                                </div>
                                <div className="flex items-center">
                                    <Trophy className="mr-1 h-4 w-4" />
                                    <span>{bounty.totalWinner - bounty.currentWinnerCount} spots left</span>
                                </div>
                                <div className="flex items-center">
                                    <User className="mr-1 h-4 w-4" />
                                    <span>{addrShort(bounty.creatorId, 4)}</span>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="border-t bg-muted/20 p-4">
                            {bounty.isJoined || bounty.isOwner ? (
                                <div className="flex items-center flex-col gap-2 justify-between w-full">
                                    <Button
                                        variant="default"
                                        className="w-full"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            router.push(`/bounty/${bounty.id}`)
                                        }}
                                    >
                                        View Details
                                    </Button>
                                    {bounty.bountyType === BountyTypeEnum.SCAVENGER_HUNT && bounty.isJoined && (
                                        <div className="w-full space-y-1">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>
                                                    Step {(bounty.currentStep ?? 0)} of {totalSteps}
                                                </span>
                                                <span>{Math.round(((bounty.currentStep ?? 0) / Math.max(totalSteps, 1)) * 100)
                                                    === 100 ?
                                                    <Badge variant="secondary" className="text-xs">Completed</Badge>
                                                    : Math.round(((bounty.currentStep ?? 0) / Math.max(totalSteps, 1)) * 100) + "%"
                                                }</span>
                                            </div>
                                            <Progress
                                                className="h-2"
                                                value={Math.round(((bounty.currentStep ?? 0) / Math.max(totalSteps, 1)) * 100)}

                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full">
                                    <Button
                                        variant="default"
                                        className="w-full"
                                        disabled={!isEligible(bounty) || joinBountyMutation.isLoading}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleJoinBounty(bounty.id)
                                        }}
                                    >
                                        {joinBountyMutation.isLoading && bounty.id === joinBountyMutation.variables?.BountyId ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Spinner size="small" />
                                                Joining...
                                            </span>
                                        ) : (
                                            "Join Bounty"
                                        )}
                                    </Button>

                                    {!isEligible(bounty) ? (
                                        <p className="text-xs text-red-500 mt-2">
                                            {bounty.currentWinnerCount >= bounty.totalWinner ? "No spots left" : `${bounty.requiredBalance.toFixed(1)} ${bounty.requiredBalanceCode.toLocaleUpperCase()} required`}
                                        </p>
                                    ) :
                                        <p className="text-xs text-green-500 mt-2">
                                            {bounty.currentWinnerCount >= bounty.totalWinner ? "No spots left" :

                                                bounty.isOwner ? "You are the owner" : bounty.isJoined ? "You have already joined" : "You are eligible to join"
                                            }
                                        </p>

                                    }
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    )
}

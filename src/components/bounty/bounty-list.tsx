"use client";

import Image from "next/image";
import { Award, Trophy, User, Users, MapPin, Target, Share2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/shadcn/ui/card";
import { Badge } from "~/components/shadcn/ui/badge";
import { type BountyTypes } from "~/types/bounty/bounty-type";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { useRouter } from "next/navigation";
import { Button } from "~/components/shadcn/ui/button";
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances";
import { api } from "~/utils/api";
import { toast } from "~/hooks/use-toast";
import { addrShort } from "~/utils/utils";
import { Spinner } from "~/components/shadcn/ui/spinner";
import { Preview } from "../common/quill-preview";
import { Slider } from "../shadcn/ui/slider";
import { Progress } from "../shadcn/ui/progress";
import { useState } from "react";
import { ActivationModal } from "../modal/activation-modal";
import { useShareBountyModalStore } from "../store/share-bounty-modal-store";
export enum BountyTypeEnum {
    GENERAL = "GENERAL",
    LOCATION_BASED = "LOCATION_BASED",
    SCAVENGER_HUNT = "SCAVENGER_HUNT",
}
function SafeHTML({ html }: { html: string }) {
    return <Preview value={html} />;
}

// Helper function to get bounty type icon
const getBountyTypeIcon = (type: BountyTypeEnum) => {
    switch (type) {
        case BountyTypeEnum.LOCATION_BASED:
            return <MapPin className="h-4 w-4" />;
        case BountyTypeEnum.SCAVENGER_HUNT:
            return <Target className="h-4 w-4" />;
        default:
            return <Trophy className="h-4 w-4" />;
    }
};

// Helper function to get bounty type label
const getBountyTypeLabel = (type: BountyTypeEnum) => {
    switch (type) {
        case BountyTypeEnum.LOCATION_BASED:
            return "Location";
        case BountyTypeEnum.SCAVENGER_HUNT:
            return "Scavenger";
        default:
            return "General";
    }
};

export default function BountyList({ bounties,
    isActive,
    isActiveStatusLoading
}: {
    bounties: BountyTypes[],
    isActive: boolean,
    isActiveStatusLoading: boolean
}) {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const { getAssetBalance, platformAssetBalance } = useUserStellarAcc();
    const shareBountyModal = useShareBountyModalStore();
    const [failedReasons, setFailedReasons] = useState<Record<number, string>>(
        {},
    );

    const isEligible = (bounty: BountyTypes) => {
        if (bounty.currentWinnerCount >= bounty.totalWinner) return false;
        if (bounty.requiredBalanceCode && bounty.requiredBalanceIssuer) {
            const balance = Number(getAssetBalance({
                code: bounty.requiredBalanceCode,
                issuer: bounty.requiredBalanceIssuer,
            }) ?? 0);
            return bounty.requiredBalance <= balance;
        }
        return bounty.requiredBalance <= platformAssetBalance;
    };
    const joinBountyMutation = api.bounty.Bounty.joinBounty.useMutation({
        onSuccess: async (data, variables) => {
            toast({
                title: "Success",
                description: "You have successfully joined the bounty",
            });
            router.push(`/bounty/${variables?.BountyId}`);
        },
    });

    const handleJoinBounty = (id: number) => {
        joinBountyMutation.mutate({ BountyId: id });
    };
    // Helper: get current position as a Promise
    const getCurrentPosition = (): Promise<{
        latitude: number;
        longitude: number;
    }> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(
                    new Error("Geolocation is not supported by this browser."),
                );
            }
            navigator.geolocation.getCurrentPosition(
                (pos) =>
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    }),
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 10000 },
            );
        });
    };

    // Haversine - returns distance in meters
    const getDistanceMeters = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000; // meters
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Extract possible location fields from bounty; returns null if not location-based
    const getBountyLocation = (
        bounty: BountyTypes,
    ): { lat: number; lon: number; radiusMeters: number } | null => {
        // common field names tried
        const lat = bounty.latitude;
        const lon = bounty.longitude;
        const radius = bounty.radius;

        if (lat == null || lon == null || radius == null) return null;
        return { lat: Number(lat), lon: Number(lon), radiusMeters: Number(radius) };
    };

    // Attempt to join, checking location permission + distance if bounty requires location
    const handleJoinWithLocation = async (bounty: BountyTypes) => {
        // reset any previous reason
        setFailedReasons((s) => ({ ...s, [bounty.id]: "" }));

        // spots
        if (bounty.currentWinnerCount >= bounty.totalWinner) {
            const msg = "No spots left";
            setFailedReasons((s) => ({ ...s, [bounty.id]: msg }));
            return;
        }

        // balance
        const balance = getAssetBalance({
            code: bounty.requiredBalanceCode,
            issuer: bounty.requiredBalanceIssuer,
        });
        if (bounty.requiredBalance > Number(balance)) {
            const msg = `${bounty.requiredBalance.toFixed(1)} ${bounty.requiredBalanceCode.toLocaleUpperCase()} required`;
            setFailedReasons((s) => ({ ...s, [bounty.id]: msg }));
            return;
        }

        // location check if bounty is location-based
        const loc = getBountyLocation(bounty);
        if (loc) {
            try {
                const pos = await getCurrentPosition();
                const dist = getDistanceMeters(
                    pos.latitude,
                    pos.longitude,
                    loc.lat,
                    loc.lon,
                );
                if (dist > loc.radiusMeters) {
                    const km = (loc.radiusMeters / 1000).toFixed(2);
                    const msg = `You must be within ${km} km of the bounty location to join.`;
                    setFailedReasons((s) => ({ ...s, [bounty.id]: msg }));
                    toast({ title: "Out of range", description: msg });
                    return;
                }
            } catch (err) {
                const msg =
                    "Unable to access location. Permission denied or unavailable.";
                setFailedReasons((s) => ({ ...s, [bounty.id]: msg }));
                toast({ title: "Location required", description: msg });
                return;
            }
        }

        // all checks passed; perform mutation
        joinBountyMutation.mutate({ BountyId: bounty.id });
    };
    if (bounties.length === 0) {
        return null; // Empty state is handled in the parent component
    }
    return (
        <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {bounties.map((bounty) => {
                    const totalSteps = bounty.ActionLocation?.length ?? 0;
                    const eligible = isEligible(bounty);
                    const spotsLeft = bounty.totalWinner - bounty.currentWinnerCount;
                    const isFull = spotsLeft <= 0;
                    const joined = bounty.isJoined;
                    const owner = bounty.isOwner;

                    const getRewardText = () => {
                        if (bounty.priceInUSD > 0) return `$${bounty.priceInUSD.toFixed(2)}`
                        if (bounty.priceInBand > 0) return `${bounty.priceInBand.toFixed(2)} ${PLATFORM_ASSET.code.toUpperCase()}`
                        return "Free"
                    };

                    const getIneligibleReason = () => {
                        if (isFull) return "No spots left"
                        return `Need ${bounty.requiredBalance.toFixed(1)} ${bounty.requiredBalanceCode?.toUpperCase() ?? PLATFORM_ASSET.code.toUpperCase()}`
                    };

                    return (
                        <Card
                            key={bounty.id}
                            className="group cursor-pointer overflow-hidden shadow-sm ring-1 ring-border/50 transition-all duration-300 hover:shadow-lg hover:ring-border"
                            onClick={() => router.push(`/bounty/${bounty.id}`)}
                        >
                            {/* Cover image */}
                            <div className="relative h-44 w-full overflow-hidden">
                                <Image
                                    src={bounty.imageUrls[0] ?? "/images/logo.png"}
                                    alt={bounty.title}
                                    width={400}
                                    height={200}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                                <div className="absolute left-3 top-3">
                                    <Badge variant="secondary" className="gap-1 bg-background/80 text-[10px] backdrop-blur-sm">
                                        {getBountyTypeIcon(bounty.bountyType as BountyTypeEnum)}
                                        {getBountyTypeLabel(bounty.bountyType as BountyTypeEnum)}
                                    </Badge>
                                </div>

                                <div className="absolute right-3 top-3">
                                    <Badge className="bg-primary/90 text-[10px] font-semibold text-primary-foreground">
                                        <Award className="mr-1 h-3 w-3" />
                                        {getRewardText()}
                                    </Badge>
                                </div>

                                <div className="absolute bottom-3 left-3 right-3">
                                    <h3 className="line-clamp-1 text-base font-bold text-white drop-shadow-sm">
                                        {bounty.title}
                                    </h3>
                                </div>
                            </div>

                            {/* Info */}
                            <CardContent className="p-4 pb-2">
                                <div className="mb-3 h-[48px] overflow-hidden text-xs leading-relaxed text-muted-foreground">
                                    <SafeHTML html={bounty.description} />
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {bounty._count.participants} joined
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Trophy className="h-3.5 w-3.5" />
                                        {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` : "Full"}
                                    </span>
                                </div>

                                {/* Eligibility status */}
                                <div className="mt-2 flex items-center gap-1.5">
                                    <div className={`h-1.5 w-1.5 rounded-full ${joined || owner ? "bg-primary" : eligible ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                    <span className={`text-[11px] font-medium ${joined ? "text-primary" : owner ? "text-primary" : eligible ? "text-emerald-600" : "text-muted-foreground"}`}>
                                        {joined ? "Joined" : owner ? "Owner" : eligible ? "Eligible to join" : getIneligibleReason()}
                                    </span>
                                </div>
                            </CardContent>

                            {/* Actions */}
                            <CardFooter className="gap-2 border-t p-3">
                                {joined || owner ? (
                                    <>
                                        <Button
                                            size="sm"
                                            disabled
                                            variant="secondary"
                                            className="h-8 flex-1 rounded-lg text-xs"
                                        >
                                            {joined ? "Joined" : "Owner"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 flex-1 rounded-lg text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/bounty/${bounty.id}`);
                                            }}
                                        >
                                            View
                                        </Button>
                                    </>
                                ) : (isActive || isActiveStatusLoading) ? (
                                    <Button
                                        size="sm"
                                        className="h-8 flex-1 rounded-lg text-xs"
                                        disabled={!eligible || joinBountyMutation.isLoading}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleJoinWithLocation(bounty);
                                        }}
                                    >
                                        {joinBountyMutation.isLoading && bounty.id === joinBountyMutation.variables?.BountyId
                                            ? <span className="flex items-center gap-1.5"><Spinner size="small" /> Joining...</span>
                                            : eligible ? "Join Bounty" : "Join Bounty"}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-8 flex-1 rounded-lg text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDialogOpen(true);
                                        }}
                                    >
                                        Join Bounty
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 shrink-0 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        shareBountyModal.openWithBounty(bounty.id);
                                    }}
                                >
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </CardFooter>

                            {/* Scavenger hunt progress */}
                            {bounty.bountyType === BountyTypeEnum.SCAVENGER_HUNT && joined && totalSteps > 0 && (
                                <div className="border-t px-4 py-2">
                                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                        <span>Step {bounty.currentStep ?? 0} of {totalSteps}</span>
                                        <span>{Math.round(((bounty.currentStep ?? 0) / totalSteps) * 100)}%</span>
                                    </div>
                                    <Progress className="h-1.5" value={Math.round(((bounty.currentStep ?? 0) / totalSteps) * 100)} />
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
            <ActivationModal
                dialogOpen={dialogOpen}
                setDialogOpen={setDialogOpen}
            />
        </>
    );
}

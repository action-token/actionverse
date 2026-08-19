"use client"

import Link from "next/link"
import { CheckCircle2, ExternalLink, MapPin, ShieldAlert, Ticket } from "lucide-react"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { cn } from "~/lib/utils"
import { LockedMediaPanel } from "~/components/smart-contract/locked-media-panel"
import { stellarExpertTxUrl } from "~/lib/stellar/explorer"

const MAX_DOTS = 8

/**
 * Collected/required as a row of filled dots for a small pin count (more
 * concrete than a smooth bar for "visit these N places") — falls back to a
 * plain percentage bar once there are too many to read as individual dots.
 */
function CollectionMeter({ collected, required }: { collected: number; required: number }) {
    const pct = Math.min(100, Math.round((collected / Math.max(required, 1)) * 100))

    if (required <= MAX_DOTS) {
        return (
            <div className="flex items-center gap-1.5">
                {Array.from({ length: required }).map((_, i) => (
                    <span
                        key={i}
                        className={cn(
                            "h-2.5 flex-1 rounded-full transition-colors",
                            i < collected ? "bg-primary" : "bg-muted",
                        )}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

/**
 * One row per copy the caller owns of a gated edition — each copy unlocks
 * its reward independently, so there is no single aggregate progress for
 * "the ticket" the way there'd be for an ungated ordinary NFT. See
 * VIP_TICKET_UNLOCK_PLAN.md.
 */
export function UnlockProgressList({
    nftId,
    ticketName,
    ticketThumbnail,
}: {
    nftId: string
    ticketName: string
    ticketThumbnail?: string
}) {
    const { data, isLoading } = api.nft.unlockStatus.useQuery({ nftId })

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Card>
                    <CardContent className="space-y-5 p-5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>
                            <Skeleton className="h-5 w-14" />
                        </div>
                        <div className="space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-2.5 w-full rounded-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!data?.gated) return null

    if (data.tokens.length === 0) {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center gap-3 p-4">
                    <MapPin className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                        {data.required > 0
                            ? `Buy this ticket to start collecting the ${data.required} location${data.required === 1 ? "" : "s"} that unlock its reward.`
                            : "Buy this ticket to unlock its reward immediately."}
                    </p>
                </CardContent>
            </Card>
        )
    }

    const unlockedCount = data.tokens.filter((t) => t.unlocked).length

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Your tickets &amp; unlock progress</h3>
                <span className="text-xs font-medium text-muted-foreground">
                    {unlockedCount} of {data.tokens.length} unlocked
                </span>
            </div>

            {data.tokens.map((token, i) => (
                <Card
                    key={token.nftTokenId}
                    className={cn(
                        "overflow-hidden",
                        token.unlocked ? "border-green-500/50 bg-green-500/5" : "border-border",
                    )}
                >
                    <CardContent className="space-y-5 p-5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                        token.unlocked ? "bg-green-500/15 text-green-600" : "bg-primary/10 text-primary",
                                    )}
                                >
                                    <Ticket className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold leading-none text-foreground">Ticket #{i + 1}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">#{token.onChainTokenId}</p>
                                </div>
                            </div>
                            {token.unlocked ? (
                                <Badge className="gap-1 border-0 bg-green-600 text-white hover:bg-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Unlocked
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="tabular-nums">
                                    {token.collected}/{token.required}
                                </Badge>
                            )}
                        </div>

                        {!token.unlocked && (
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Locations collected</span>
                                        <span className="font-medium text-foreground">
                                            {token.collected} / {token.required}
                                        </span>
                                    </div>
                                    <CollectionMeter collected={token.collected} required={token.required} />
                                </div>
                                <Link href="/pins" className="block pt-1">
                                    <Button variant="outline" size="sm" className="w-full gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Go collect pins
                                    </Button>
                                </Link>
                            </div>
                        )}

                        {token.unlocked && (
                            <>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    {token.onChainUnlocked === true ? (
                                        <Badge variant="outline" className="gap-1 border-green-500/40 text-green-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Verified on-chain
                                        </Badge>
                                    ) : token.onChainUnlocked === false ? (
                                        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
                                            <ShieldAlert className="h-3 w-3" />
                                            Not yet visible on-chain
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                                            <ShieldAlert className="h-3 w-3" />
                                            On-chain check unavailable
                                        </Badge>
                                    )}
                                    {token.onChainUnlockTxHash && (
                                        <a
                                            href={stellarExpertTxUrl(token.onChainUnlockTxHash)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                        >
                                            View unlock tx
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                                <LockedMediaPanel
                                    items={token.lockedMedia}
                                    locked={false}
                                    ticketName={ticketName}
                                    ticketThumbnail={ticketThumbnail}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

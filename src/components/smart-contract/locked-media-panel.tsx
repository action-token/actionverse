"use client"

import { useState } from "react"
import {
    Lock,
    Music,
    Image as ImageIcon,
    Video as VideoIcon,
    Link as LinkIcon,
    Play,
    Footprints,
    Unlock,
    ChevronDown,
    ChevronUp,
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { useBottomPlayer } from "~/components/player/context/bottom-player-context"
import { NFTVideoPlayer } from "~/components/player/nft-video-player"
import { ImageViewer } from "~/components/player/ar/image-viewer"
import { cn } from "~/lib/utils"

export type LockedMediaItem = {
    // Null only when `locked` is true for this item (a still-gated item's
    // reward file is never sent to the client before it unlocks).
    url: string | null
    type: "SONG" | "IMAGE" | "VIDEO" | "OTHER"
    label?: string | null
    locked: boolean
}

const iconFor = (type: LockedMediaItem["type"]) => {
    switch (type) {
        case "SONG":
            return Music
        case "IMAGE":
            return ImageIcon
        case "VIDEO":
            return VideoIcon
        case "OTHER":
            return LinkIcon
    }
}

const typeTheme = (type: LockedMediaItem["type"]) => {
    switch (type) {
        case "SONG":
            return {
                bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                badge: "Song",
            }
        case "VIDEO":
            return {
                bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                badge: "Video",
            }
        case "IMAGE":
            return {
                bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
                badge: "Image",
            }
        case "OTHER":
            return {
                bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                badge: "Link",
            }
    }
}

const fallbackLabel = (type: LockedMediaItem["type"], index: number) => {
    switch (type) {
        case "SONG":
            return `Track ${index + 1}`
        case "IMAGE":
            return `Image ${index + 1}`
        case "VIDEO":
            return `Video ${index + 1}`
        case "OTHER":
            return `Link ${index + 1}`
    }
}

/**
 * Renders a gated ticket's reward content — one row per item, each shown
 * locked or unlocked by its own `item.locked` flag (a single token can now
 * mix already-unlocked and still-locked items at once, since each
 * locked-content item unlocks independently of the others). Locked: a
 * teaser row — type + label only, nothing clickable, no URL sent to the
 * client at all (the caller only ever puts a real `url` on an item once
 * that item's own `unlocked` is true; see `unlockStatus`). Unlocked: the
 * row opens the matching player — `useBottomPlayer` (the app's persistent
 * audio bar) for a song, the fullscreen `NFTVideoPlayer` for video, the
 * fullscreen `ImageViewer` for an image, and a plain new-tab link for
 * anything else (e.g. a SoundCloud page rather than a file we host).
 */
export function LockedMediaPanel({
    items,
    itemName,
    itemThumbnail,
}: {
    items: LockedMediaItem[]
    itemName: string
    itemThumbnail?: string
}) {
    const { showPlayer } = useBottomPlayer()
    const [openVideo, setOpenVideo] = useState<{ url: string; label?: string | null } | null>(null)
    const [videoMinimized, setVideoMinimized] = useState(false)
    const [openImage, setOpenImage] = useState<{ url: string; label?: string | null } | null>(null)

    return (
        <>
            <div className="space-y-2">
                {items.map((item, i) => {
                    const Icon = iconFor(item.type)
                    const label = item.label || fallbackLabel(item.type, i)

                    if (item.locked || !item.url) {
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-muted-foreground"
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="flex-1 text-sm">{label}</span>
                                <Lock className="h-4 w-4 shrink-0" />
                            </div>
                        )
                    }

                    const url = item.url
                    const onOpen = () => {
                        if (item.type === "SONG") {
                            showPlayer(label, itemName, url, itemThumbnail)
                        } else if (item.type === "VIDEO") {
                            setOpenVideo({ url, label: item.label })
                            setVideoMinimized(false)
                        } else if (item.type === "IMAGE") {
                            setOpenImage({ url, label: item.label })
                        } else {
                            window.open(url, "_blank", "noopener,noreferrer")
                        }
                    }
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={onOpen}
                            className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
                        >
                            <Icon className="h-4 w-4 shrink-0 text-primary" />
                            <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                            {item.type === "OTHER" ? (
                                <LinkIcon className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                                <Play className="h-4 w-4 shrink-0 text-primary" />
                            )}
                        </button>
                    )
                })}
            </div>

            {openVideo && (
                <NFTVideoPlayer
                    src={openVideo.url}
                    title={openVideo.label || "Video"}
                    isOpen
                    onClose={() => setOpenVideo(null)}
                    isMinimized={videoMinimized}
                    onToggleMinimize={() => setVideoMinimized((v) => !v)}
                    autoPlay
                />
            )}

            {openImage && (
                <ImageViewer
                    src={openImage.url}
                    alt={openImage.label || "Image"}
                    onClose={() => setOpenImage(null)}
                />
            )}
        </>
    )
}

/** Small summary line used on the ticket card / pre-purchase teaser. */
export function lockedMediaSummary(counts: { songs: number; images: number; videos: number; links: number }) {
    const parts: string[] = []
    if (counts.songs) parts.push(`${counts.songs} track${counts.songs > 1 ? "s" : ""}`)
    if (counts.videos) parts.push(`${counts.videos} video${counts.videos > 1 ? "s" : ""}`)
    if (counts.images) parts.push(`${counts.images} image${counts.images > 1 ? "s" : ""}`)
    if (counts.links) parts.push(`${counts.links} link${counts.links > 1 ? "s" : ""}`)
    return parts.join(", ")
}

/**
 * Pre-purchase disclosure for a gated ("conditional") NFT: this ticket's
 * rewards are not all handed over at checkout — some only unlock after the
 * buyer physically travels to specific places. That's a real precondition
 * on what they're paying for, so it gets a prominent amber callout above
 * the buy card rather than being buried in a tab they might never open.
 * When nothing is location-gated it flips to the reassuring inverse ("no
 * travel needed"), which is equally worth knowing before paying.
 */
export function UnlockRequirementNotice({
    requiredLocations,
    gatedItemCount,
    totalItemCount,
    onSeeLocations,
}: {
    /** Pins to collect, summed across every location-gated item. */
    requiredLocations: number
    /** How many reward items carry a location rule. */
    gatedItemCount: number
    /** Total reward items on the ticket, gated or not. */
    totalItemCount: number
    onSeeLocations?: () => void
}) {
    if (totalItemCount === 0) return null

    if (requiredLocations === 0) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Unlocks right away. </span>
                    All {totalItemCount} reward{totalItemCount === 1 ? "" : "s"} become available as soon as
                    you own a copy — no travel required.
                </p>
            </div>
        )
    }

    const allGated = gatedItemCount >= totalItemCount

    return (
        <div className="space-y-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
                <Footprints className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Requires travel to unlock</p>
                    <p className="text-sm text-muted-foreground">
                        {allGated ? (
                            <>
                                This item&apos;s rewards stay locked until you visit{" "}
                                <span className="font-semibold text-foreground">
                                    {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                                </span>{" "}
                                in person.
                            </>
                        ) : (
                            <>
                                {totalItemCount - gatedItemCount} of {totalItemCount} rewards unlock as soon
                                as you own a copy. The other {gatedItemCount} stay locked until you visit{" "}
                                <span className="font-semibold text-foreground">
                                    {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                                </span>{" "}
                                in person.
                            </>
                        )}{" "}
                        You&apos;ll need to be within 50 meters of each pin, with your device, to collect
                        it. Every copy you buy unlocks on its own.
                    </p>
                </div>
            </div>
            {onSeeLocations && (
                <button
                    type="button"
                    onClick={onSeeLocations}
                    className="ml-7 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-500"
                >
                    Check where before you buy →
                </button>
            )}
        </div>
    )
}

/**
 * Pre-purchase "what you get" list — one row per reward the ticket carries,
 * with the unlock condition stated *per item* rather than as one blanket
 * count. The tile grid this replaced could only say "1 Image, 1 Music, both
 * locked"; a buyer deciding whether the trip is worth it needs to know
 * which specific reward is the one behind 5 pins and which one lands the
 * moment they pay. Content itself stays hidden — a locked item's file is
 * never sent to a non-owner — so this is labels and conditions only.
 */
export function LockedContentList({
    items,
    maxVisible = 4,
}: {
    items: {
        type: LockedMediaItem["type"]
        label: string | null
        unlockRule?: { points: unknown[] } | null
    }[]
    maxVisible?: number
}) {
    const [isExpanded, setIsExpanded] = useState(false)

    if (items.length === 0) return null

    const hasMore = items.length > maxVisible
    const visibleItems = hasMore && !isExpanded ? items.slice(0, maxVisible) : items
    const remainingCount = items.length - maxVisible

    return (
        <div className="space-y-1.5">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {visibleItems.map((item, i) => {
                    const Icon = iconFor(item.type)
                    const theme = typeTheme(item.type)
                    const pins = item.unlockRule?.points.length ?? 0
                    const label = item.label ?? fallbackLabel(item.type, i)
                    return (
                        <div
                            key={i}
                            className="group flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2 transition-all hover:border-foreground/20 hover:bg-muted/50"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <div
                                    className={cn(
                                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-105",
                                        theme.bg,
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-foreground" title={label}>
                                        {label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{theme.badge}</p>
                                </div>
                            </div>
                            <div className="shrink-0">
                                {pins > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                        <Footprints className="h-2.5 w-2.5" />
                                        {pins} pin{pins === 1 ? "" : "s"}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        <Unlock className="h-2.5 w-2.5" />
                                        Instant
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/30 hover:text-foreground"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="h-3 w-3" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-3 w-3" />
                            and {remainingCount} more reward{remainingCount === 1 ? "" : "s"}
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

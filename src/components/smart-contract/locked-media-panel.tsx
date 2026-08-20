"use client"

import { useState } from "react"
import { Lock, Music, Image as ImageIcon, Video as VideoIcon, Link as LinkIcon, Play } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { useBottomPlayer } from "~/components/player/context/bottom-player-context"
import { NFTVideoPlayer } from "~/components/player/nft-video-player"
import { ImageViewer } from "~/components/player/ar/image-viewer"

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
    ticketName,
    ticketThumbnail,
}: {
    items: LockedMediaItem[]
    ticketName: string
    ticketThumbnail?: string
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
                            showPlayer(label, ticketName, url, ticketThumbnail)
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

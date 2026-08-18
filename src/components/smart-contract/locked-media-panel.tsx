"use client"

import { useState } from "react"
import { Lock, Music, Image as ImageIcon, Video as VideoIcon, Link as LinkIcon, Play } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { useBottomPlayer } from "~/components/player/context/bottom-player-context"
import { NFTVideoPlayer } from "~/components/player/nft-video-player"
import { ImageViewer } from "~/components/player/ar/image-viewer"

export type LockedMediaItem = {
    url: string
    type: "SONG" | "IMAGE" | "VIDEO" | "OTHER"
    label?: string | null
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
 * Renders a gated ticket's reward content. Locked: a teaser row per item —
 * type + label only, nothing clickable, no URL sent to the client at all
 * (the caller only ever passes real items here once `unlocked` is true;
 * see `unlockStatus`). Unlocked: each row opens the matching player —
 * `useBottomPlayer` (the app's persistent audio bar) for a song, the
 * fullscreen `NFTVideoPlayer` for video, the fullscreen `ImageViewer` for
 * an image, and a plain new-tab link for anything else (e.g. a SoundCloud
 * page rather than a file we host).
 */
export function LockedMediaPanel({
    items,
    locked,
    ticketName,
    ticketThumbnail,
}: {
    items: LockedMediaItem[]
    locked: boolean
    ticketName: string
    ticketThumbnail?: string
}) {
    const { showPlayer } = useBottomPlayer()
    const [openVideo, setOpenVideo] = useState<LockedMediaItem | null>(null)
    const [videoMinimized, setVideoMinimized] = useState(false)
    const [openImage, setOpenImage] = useState<LockedMediaItem | null>(null)

    if (locked) {
        return (
            <div className="space-y-2">
                {items.map((item, i) => {
                    const Icon = iconFor(item.type)
                    return (
                        <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-muted-foreground"
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-sm">{item.label || fallbackLabel(item.type, i)}</span>
                            <Lock className="h-4 w-4 shrink-0" />
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <>
            <div className="space-y-2">
                {items.map((item, i) => {
                    const Icon = iconFor(item.type)
                    const label = item.label || fallbackLabel(item.type, i)
                    const onOpen = () => {
                        if (item.type === "SONG") {
                            showPlayer(label, ticketName, item.url, ticketThumbnail)
                        } else if (item.type === "VIDEO") {
                            setOpenVideo(item)
                            setVideoMinimized(false)
                        } else if (item.type === "IMAGE") {
                            setOpenImage(item)
                        } else {
                            window.open(item.url, "_blank", "noopener,noreferrer")
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

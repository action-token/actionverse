"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    Image as ImageIcon,
    Info,
    Link as LinkIcon,
    Lock,
    MapPin,
    Music,
    Play,
    Package,
    Video as VideoIcon,
} from "lucide-react"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api, type RouterOutputs } from "~/utils/api"
import { cn } from "~/lib/utils"
import { useBottomPlayer } from "~/components/player/context/bottom-player-context"
import { NFTVideoPlayer } from "~/components/player/nft-video-player"
import { ImageViewer } from "~/components/player/ar/image-viewer"
import { UnlockLocationsPreview, type UnlockLocationPoint } from "~/components/smart-contract/unlock-locations-preview"

type UnlockStatus = RouterOutputs["nft"]["unlockStatus"]
type UnlockToken = Extract<UnlockStatus, { gated: true }>["tokens"][number]
type TokenItem = UnlockToken["items"][number]

type GatedMediaItem = {
    id: string
    label: string | null
    unlockRule?: { points: UnlockLocationPoint[] } | null
}

const MAX_DOTS = 8
// Past this many held copies the dot strip stops being a position indicator
// and turns into a dense row of targets — the "Item #N of M" label and the
// arrows carry position on their own from there.
const MAX_COPY_DOTS = 10

/**
 * Collected/required as a row of filled dots for a small pin count (more
 * concrete than a smooth bar for "visit these N places") — falls back to a
 * plain percentage bar once there are too many to read as individual dots.
 */
function CollectionMeter({ collected, required }: { collected: number; required: number }) {
    const pct = Math.min(100, Math.round((collected / Math.max(required, 1)) * 100))

    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

const TYPE_TABS: { type: TokenItem["type"]; label: string; icon: typeof Music }[] = [
    { type: "VIDEO", label: "Video", icon: VideoIcon },
    { type: "SONG", label: "Music", icon: Music },
    { type: "IMAGE", label: "Image", icon: ImageIcon },
    { type: "OTHER", label: "Link", icon: LinkIcon },
]

const iconFor = (type: TokenItem["type"]) => {
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

function actionForType(type: TokenItem["type"]) {
    switch (type) {
        case "IMAGE":
            return { label: "View", icon: Eye }
        case "OTHER":
            return { label: "Open", icon: LinkIcon }
        default:
            return { label: "Play", icon: Play }
    }
}

/**
 * One reward item, locked or unlocked. Locked: a dashed row with the label,
 * its collected/required fraction and a lock icon, expanding in place to
 * that item's own pin names and map — per item rather than in a shared
 * "Locations" tab, because a ticket's items each carry their own rule and a
 * pooled list can't say which places unlock which reward. Collapsed by
 * default when a copy has several locked items, since each expansion mounts
 * its own Google Map; `defaultExpanded` opens the sole locked item outright,
 * where there is nothing to disambiguate and hiding it is just a extra tap.
 * Unlocked: an "Unlocked" badge plus the matching action button for its
 * type, which opens it via `onOpen` (a song into the bottom player, a
 * video/image into their fullscreen viewers, a link in a new tab — see
 * `ItemContentByType`).
 */
function RewardItemRow({
    item,
    points,
    defaultExpanded = false,
    onOpen,
}: {
    item: TokenItem
    points: UnlockLocationPoint[] | undefined
    defaultExpanded?: boolean
    onOpen: () => void
}) {
    const label = item.label ?? "Reward"
    const isLocked = item.requiresUnlock && !item.unlocked
    const [expanded, setExpanded] = useState(defaultExpanded)
    const Icon = iconFor(item.type)

    if (isLocked) {
        const hasPoints = !!points && points.length > 0
        return (
            <div className="overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    disabled={!hasPoints}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-muted/50 disabled:hover:bg-transparent"
                >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        <Lock className="h-2.5 w-2.5" />
                        {item.collected}/{item.required} pins
                    </span>
                    {hasPoints && (
                        <ChevronDown
                            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
                        />
                    )}
                </button>

                <AnimatePresence initial={false}>
                    {hasPoints && expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <div className="space-y-1.5 border-t border-dashed border-muted-foreground/30 px-3 py-2">
                                <p className="text-[11px] text-muted-foreground">
                                    Get within{" "}
                                    <span className="font-semibold text-foreground">50 meters</span> of each
                                    pin, in person, to collect it.
                                </p>
                                <UnlockLocationsPreview points={points} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    const { label: actionLabel, icon: ActionIcon } = actionForType(item.type)
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 truncate text-xs font-medium text-foreground">{label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <Badge className="gap-1 border-0 bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-600">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Unlocked
                </Badge>
                <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" onClick={onOpen}>
                    <ActionIcon className="h-3 w-3" />
                    {actionLabel}
                </Button>
            </div>
        </div>
    )
}

/**
 * A ticket's reward items grouped into Video/Music/Image/Link pills — only
 * the types this ticket actually has get a pill, and the first one present
 * (in that order) is selected by default. Selecting a type swaps in that
 * type's items, each rendered by `RewardItemRow` locked or unlocked and
 * ordered unlocked-first; a song/video/image opened from here plays through
 * this same panel's players so only one thing is ever open at a time across
 * every type.
 */
function ItemContentByType({
    items,
    lockedMedia,
    itemName,
    itemThumbnail,
}: {
    items: TokenItem[]
    lockedMedia: GatedMediaItem[]
    itemName: string
    itemThumbnail?: string
}) {
    const presentTypes = TYPE_TABS.filter(({ type }) => items.some((i) => i.type === type))
    const [activeType, setActiveType] = useState<TokenItem["type"] | undefined>(presentTypes[0]?.type)
    const { showPlayer } = useBottomPlayer()
    const [openVideo, setOpenVideo] = useState<{ url: string; label?: string | null } | null>(null)
    const [videoMinimized, setVideoMinimized] = useState(false)
    const [openImage, setOpenImage] = useState<{ url: string; label?: string | null } | null>(null)

    if (presentTypes.length === 0) return null
    const selected = presentTypes.some((t) => t.type === activeType) ? activeType : presentTypes[0]!.type
    const isItemLocked = (i: TokenItem) => i.requiresUnlock && !i.unlocked
    const itemsOfType = items
        .filter((i) => i.type === selected)
        .sort((a, b) => Number(isItemLocked(a)) - Number(isItemLocked(b)))
    const lockedOfTypeCount = itemsOfType.filter(isItemLocked).length

    function handleOpen(item: TokenItem) {
        if (!item.url) return
        const url = item.url
        if (item.type === "SONG") {
            showPlayer(item.label ?? "Track", itemName, url, itemThumbnail)
        } else if (item.type === "VIDEO") {
            setOpenVideo({ url, label: item.label })
            setVideoMinimized(false)
        } else if (item.type === "IMAGE") {
            setOpenImage({ url, label: item.label })
        } else {
            window.open(url, "_blank", "noopener,noreferrer")
        }
    }

    const revealedCount = items.filter((i) => i.unlocked).length
    const totalCount = items.length

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-1">
                {presentTypes.length > 1 ? (
                    <div className="flex items-center gap-4">
                        {presentTypes.map(({ type, label, icon: Icon }) => {
                            const count = items.filter((i) => i.type === type).length
                            const isSelected = selected === type
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setActiveType(type)}
                                    className={cn(
                                        "group relative flex items-center gap-1.5 pb-1 text-xs font-medium transition-colors cursor-pointer",
                                        isSelected
                                            ? "text-foreground font-semibold"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-3.5 w-3.5 transition-colors",
                                            isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                                        )}
                                    />
                                    <span>{label}</span>
                                    <span
                                        className={cn(
                                            "rounded-full px-1.5 py-0.2 text-[10px]",
                                            isSelected
                                                ? "bg-primary/15 text-primary font-semibold"
                                                : "bg-muted text-muted-foreground",
                                        )}
                                    >
                                        {count}
                                    </span>
                                    {isSelected && (
                                        <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-primary" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div />
                )}

                <div className="shrink-0 pb-1">
                    <span className="rounded bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {revealedCount}/{totalCount} revealed
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                {itemsOfType.map((item) => (
                    <RewardItemRow
                        key={item.lockedMediaId}
                        item={item}
                        points={lockedMedia.find((m) => m.id === item.lockedMediaId)?.unlockRule?.points}
                        defaultExpanded={lockedOfTypeCount === 1}
                        onOpen={() => handleOpen(item)}
                    />
                ))}
            </div>

            {openVideo && (
                <NFTVideoPlayer
                    src={openVideo.url}
                    title={openVideo.label ?? "Video"}
                    isOpen
                    onClose={() => setOpenVideo(null)}
                    isMinimized={videoMinimized}
                    onToggleMinimize={() => setVideoMinimized((v) => !v)}
                    autoPlay
                />
            )}

            {openImage && (
                <ImageViewer src={openImage.url} alt={openImage.label ?? "Image"} onClose={() => setOpenImage(null)} />
            )}
        </div>
    )
}

/**
 * The manage page's main panel: everything about the copies you own, in one
 * card. Replaces the old split of `LockedContentPreview` (rewards, first
 * copy only) plus `UnlockProgressList` (per-copy progress).
 */
export function ItemVault({
    nftId,
    itemName,
    itemThumbnail,
    lockedMedia = [],
}: {
    nftId: string
    itemName: string
    itemThumbnail?: string
    lockedMedia?: GatedMediaItem[]
}) {
    const { data, isLoading } = api.nft.unlockStatus.useQuery({ nftId })
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [showHow, setShowHow] = useState(false)
    const [direction, setDirection] = useState(0)

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-between border-b bg-muted/30 px-3.5 py-2">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-lg" />
                        <div className="space-y-1">
                            <Skeleton className="h-3.5 w-20" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <CardContent className="space-y-3 p-3">
                    <div className="flex gap-1.5">
                        <Skeleton className="h-6 w-14 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-lg" />
                </CardContent>
            </Card>
        )
    }

    if (!data?.gated) return null

    const tokens = data.tokens

    if (tokens.length === 0) {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center gap-2.5 p-3">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs text-muted-foreground">
                        Buy this item to start unlocking its rewards — some may reveal immediately,
                        others once you visit the locations they require.
                    </p>
                </CardContent>
            </Card>
        )
    }

    const index = selectedIndex < tokens.length ? selectedIndex : 0
    const token = tokens[index]!
    const fullyUnlocked = token.items.every((item) => item.unlocked)
    const revealedCount = token.items.filter((item) => item.unlocked).length
    const lockedItems = token.items.filter((item) => item.requiresUnlock && !item.unlocked)
    const hasLockedItems = lockedItems.length > 0
    const pinsCollected = lockedItems.reduce((sum, item) => sum + item.collected, 0)
    const pinsRequired = lockedItems.reduce((sum, item) => sum + item.required, 0)
    const unlockedTokenCount = tokens.filter((t) => t.items.every((i) => i.unlocked)).length
    const multiCopy = tokens.length > 1

    function goTo(next: number) {
        const clamped = Math.min(tokens.length - 1, Math.max(0, next))
        if (clamped === index) return
        setDirection(clamped > index ? 1 : -1)
        setSelectedIndex(clamped)
    }

    return (
        <Card
            className={cn("overflow-hidden", fullyUnlocked ? "border-green-500/40" : "border-border")}
        >
            <CardContent className="space-y-2.5 p-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your rewards</h3>
                    {tokens.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                            {unlockedTokenCount} of {tokens.length} copies unlocked
                        </span>
                    )}
                </div>

                <div
                    className={cn(
                        "flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2",
                        fullyUnlocked ? "bg-green-500/5 border-green-500/20" : "bg-muted/40 border-border/60",
                    )}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <div
                            className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                                fullyUnlocked ? "bg-green-500/15 text-green-600" : "bg-primary/10 text-primary",
                            )}
                        >
                            <Package className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-foreground">
                                    Item #{index + 1}
                                    {tokens.length > 1 && (
                                        <span className="font-normal text-muted-foreground"> of {tokens.length}</span>
                                    )}
                                </p>
                                <span className="rounded border bg-background/80 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                                    #{token.onChainTokenId}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        {fullyUnlocked ? (
                            <Badge className="gap-1 border-0 bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-600">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Unlocked
                            </Badge>
                        ) : pinsRequired > 0 ? (
                            <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                                <div className="h-2 w-20 sm:w-28 overflow-hidden rounded-full bg-muted-foreground/20">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-300"
                                        style={{
                                            width: `${Math.round((pinsCollected / Math.max(pinsRequired, 1)) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {pinsCollected}/{pinsRequired} pins
                                </span>
                            </div>
                        ) : (
                            <Badge variant="secondary" className="px-2 py-0.5 text-xs tabular-nums">
                                {revealedCount}/{token.items.length} revealed
                            </Badge>
                        )}
                        {multiCopy && (
                            <div className="flex items-center gap-0.5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md"
                                    onClick={() => goTo(index - 1)}
                                    disabled={index === 0}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span className="sr-only">Previous item</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md"
                                    onClick={() => goTo(index + 1)}
                                    disabled={index === tokens.length - 1}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    <span className="sr-only">Next item</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={token.nftTokenId}
                        initial={{ opacity: 0, x: direction >= 0 ? 28 : -28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction >= 0 ? -28 : 28 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="space-y-3"
                    >
                        <ItemContentByType
                            items={token.items}
                            lockedMedia={lockedMedia}
                            itemName={itemName}
                            itemThumbnail={itemThumbnail}
                        />
                    </motion.div>
                </AnimatePresence>

                {hasLockedItems && (
                    <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                        <Link href="/action/home" className="block">
                            <Button className="h-8 w-full gap-1.5 text-xs">
                                <MapPin className="h-3.5 w-3.5" />
                                Go collect pins
                            </Button>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowHow((v) => !v)}
                            className="flex w-full items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                            <Info className="h-3 w-3" />
                            How unlocking works
                            <ChevronDown
                                className={cn("h-3 w-3 transition-transform", showHow && "rotate-180")}
                            />
                        </button>
                        {showHow && (
                            <ol className="list-decimal space-y-1 rounded-lg bg-muted/40 py-2.5 pl-7 pr-3 text-[11px] text-muted-foreground">
                                <li>
                                    Go to the pin&apos;s location — get within{" "}
                                    <span className="font-semibold text-foreground">50 meters</span>, in
                                    person, with this device.
                                </li>
                                <li>Open the AR camera once you&apos;re in range.</li>
                                <li>Collect the pin — the reward unlocks automatically from there.</li>
                            </ol>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


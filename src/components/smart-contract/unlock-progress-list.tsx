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
    Ticket,
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
// and turns into a dense row of targets — the "Ticket #N of M" label and the
// arrows carry position on their own from there.
const MAX_COPY_DOTS = 10

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

const TYPE_TABS: { type: TokenItem["type"]; label: string; icon: typeof Music }[] = [
    { type: "VIDEO", label: "Video", icon: VideoIcon },
    { type: "SONG", label: "Music", icon: Music },
    { type: "IMAGE", label: "Image", icon: ImageIcon },
    { type: "OTHER", label: "Link", icon: LinkIcon },
]

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
 * `TicketContentByType`).
 */
function TicketItemRow({
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

    if (isLocked) {
        const hasPoints = !!points && points.length > 0
        return (
            <div className="overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    disabled={!hasPoints}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-muted-foreground transition-colors hover:bg-muted/50 disabled:hover:bg-transparent"
                >
                    <Lock className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                    <span className="shrink-0 text-xs font-medium tabular-nums">
                        {item.collected}/{item.required}
                    </span>
                    {hasPoints && (
                        <ChevronDown
                            className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
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
                            <div className="space-y-2 border-t border-dashed border-muted-foreground/30 px-4 py-3">
                                <p className="text-xs text-muted-foreground">
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
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
            <div className="flex shrink-0 items-center gap-2">
                <Badge className="gap-1 border-0 bg-green-600 text-white hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Unlocked
                </Badge>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onOpen}>
                    <ActionIcon className="h-3.5 w-3.5" />
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
 * type's items, each rendered by `TicketItemRow` locked or unlocked and
 * ordered unlocked-first; a song/video/image opened from here plays through
 * this same panel's players so only one thing is ever open at a time across
 * every type.
 */
function TicketContentByType({
    items,
    lockedMedia,
    ticketName,
    ticketThumbnail,
}: {
    items: TokenItem[]
    lockedMedia: GatedMediaItem[]
    ticketName: string
    ticketThumbnail?: string
}) {
    const presentTypes = TYPE_TABS.filter(({ type }) => items.some((i) => i.type === type))
    const [activeType, setActiveType] = useState<TokenItem["type"] | undefined>(presentTypes[0]?.type)
    const { showPlayer } = useBottomPlayer()
    const [openVideo, setOpenVideo] = useState<{ url: string; label?: string | null } | null>(null)
    const [videoMinimized, setVideoMinimized] = useState(false)
    const [openImage, setOpenImage] = useState<{ url: string; label?: string | null } | null>(null)

    if (presentTypes.length === 0) return null
    const selected = presentTypes.some((t) => t.type === activeType) ? activeType : presentTypes[0]!.type
    // Unlocked first: those are playable right now and are what an owner
    // comes back to this page for, so they shouldn't sit below rewards that
    // can't be opened yet. Stable within each group — `sort` keeps the
    // server's order for items of the same lock state.
    const isItemLocked = (i: TokenItem) => i.requiresUnlock && !i.unlocked
    const itemsOfType = items
        .filter((i) => i.type === selected)
        .sort((a, b) => Number(isItemLocked(a)) - Number(isItemLocked(b)))
    const lockedOfTypeCount = itemsOfType.filter(isItemLocked).length

    function handleOpen(item: TokenItem) {
        if (!item.url) return
        const url = item.url
        if (item.type === "SONG") {
            showPlayer(item.label ?? "Track", ticketName, url, ticketThumbnail)
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
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {presentTypes.map(({ type, label, icon: Icon }) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                            selected === type
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-2.5">
                {itemsOfType.map((item) => (
                    <TicketItemRow
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
 * copy only) plus `UnlockProgressList` (per-copy progress) — those two
 * each carried their own ticket switcher and their own copy of the
 * "how this works" explainer, so an owner saw the same controls and the
 * same instructions twice. Here one selector drives both: pick a copy, and
 * its progress *and* its rewards below are that copy's.
 */
export function TicketVault({
    nftId,
    ticketName,
    ticketThumbnail,
    lockedMedia = [],
}: {
    nftId: string
    ticketName: string
    ticketThumbnail?: string
    lockedMedia?: GatedMediaItem[]
}) {
    const { data, isLoading } = api.nft.unlockStatus.useQuery({ nftId })
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [showHow, setShowHow] = useState(false)
    // Which way the copies just moved, so the swap animates *toward* the
    // arrow that was pressed. Copies otherwise look identical (same artwork,
    // often the same rewards), so without the slide a press can read as
    // "nothing happened" — the direction is the feedback.
    const [direction, setDirection] = useState(0)

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <CardContent className="space-y-4 p-4">
                    <Skeleton className="h-2.5 w-full rounded-full" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-20 rounded-full" />
                        <Skeleton className="h-8 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-14 w-full rounded-lg" />
                </CardContent>
            </Card>
        )
    }

    if (!data?.gated) return null

    // Bound once so `goTo` below can read it — TypeScript drops the
    // `data?.gated` narrowing inside a nested function, but keeps it on a
    // plain const captured from the narrowed scope.
    const tokens = data.tokens

    if (tokens.length === 0) {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center gap-3 p-4">
                    <MapPin className="h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                        Buy this ticket to start unlocking its rewards — some may reveal immediately,
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
    // Pins across every still-locked item on *this* copy, summed into one
    // bar — the per-item breakdown lives in each locked row's own expansion.
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
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Your rewards</h3>
                {tokens.length > 1 && (
                    <span className="text-xs font-medium text-muted-foreground">
                        {unlockedTokenCount} of {tokens.length} copies fully unlocked
                    </span>
                )}
            </div>

            <Card
                className={cn("overflow-hidden", fullyUnlocked ? "border-green-500/40" : "border-border")}
            >
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 border-b px-4 py-3",
                        fullyUnlocked ? "bg-green-500/5" : "bg-muted/30",
                    )}
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div
                            className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                fullyUnlocked ? "bg-green-500/15 text-green-600" : "bg-primary/10 text-primary",
                            )}
                        >
                            <Ticket className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold leading-none text-foreground">
                                Ticket #{index + 1}
                                {tokens.length > 1 && (
                                    <span className="font-normal text-muted-foreground">
                                        {" "}
                                        of {tokens.length}
                                    </span>
                                )}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                #{token.onChainTokenId}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {fullyUnlocked ? (
                            <Badge className="gap-1 border-0 bg-green-600 text-white hover:bg-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Unlocked
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="tabular-nums">
                                {revealedCount}/{token.items.length} revealed
                            </Badge>
                        )}
                        {multiCopy && (
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => goTo(index - 1)}
                                    disabled={index === 0}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="sr-only">Previous ticket</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => goTo(index + 1)}
                                    disabled={index === tokens.length - 1}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                    <span className="sr-only">Next ticket</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {multiCopy && tokens.length <= MAX_COPY_DOTS && (
                    <div className="flex items-center justify-center gap-1.5 border-b bg-muted/10 py-2">
                        {tokens.map((t, i) => (
                            <button
                                key={t.nftTokenId}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-current={i === index}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-200",
                                    i === index
                                        ? "w-5 bg-primary"
                                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                                )}
                            >
                                <span className="sr-only">Ticket {i + 1}</span>
                            </button>
                        ))}
                    </div>
                )}

                <CardContent className="space-y-4 p-4">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={token.nftTokenId}
                            initial={{ opacity: 0, x: direction >= 0 ? 28 : -28 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction >= 0 ? -28 : 28 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="space-y-4"
                        >
                            {hasLockedItems && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Pins collected</span>
                                        <span className="font-medium text-foreground">
                                            {pinsCollected} of {pinsRequired}
                                        </span>
                                    </div>
                                    <CollectionMeter collected={pinsCollected} required={pinsRequired} />
                                </div>
                            )}

                            <TicketContentByType
                                items={token.items}
                                lockedMedia={lockedMedia}
                                ticketName={ticketName}
                                ticketThumbnail={ticketThumbnail}
                            />
                        </motion.div>
                    </AnimatePresence>

                    {hasLockedItems && (
                        <div className="space-y-2 border-t border-border/60 pt-4">
                            <Link href="/action/home" className="block">
                                <Button className="w-full gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Go collect pins
                                </Button>
                            </Link>
                            <button
                                type="button"
                                onClick={() => setShowHow((v) => !v)}
                                className="flex w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                <Info className="h-3.5 w-3.5" />
                                How unlocking works
                                <ChevronDown
                                    className={cn("h-3.5 w-3.5 transition-transform", showHow && "rotate-180")}
                                />
                            </button>
                            {showHow && (
                                <ol className="list-decimal space-y-1 rounded-lg bg-muted/40 py-3 pl-8 pr-4 text-xs text-muted-foreground">
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
        </section>
    )
}


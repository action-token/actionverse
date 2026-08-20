"use client"

import { Music, Image as ImageIcon, Video as VideoIcon, Link as LinkIcon, Plus, X, MapPin } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Switch } from "~/components/shadcn/ui/switch"
import { MediaDropzone } from "~/components/smart-contract/media-dropzone"
import { UnlockLocationPicker, type UnlockPoint } from "~/components/smart-contract/unlock-location-picker"
import { cn } from "~/lib/utils"

export type LockedMediaType = "SONG" | "IMAGE" | "VIDEO" | "OTHER"
export type LockedMediaDraft = {
    url?: string
    type: LockedMediaType
    label: string
    // Optional per-item unlock condition — when set, this specific item
    // stays hidden until the buyer's own copy has visited every point
    // here; when absent, this item reveals the moment a copy is bought.
    unlockRule?: { points: UnlockPoint[] }
}

const MAX_ITEMS = 20

const TYPE_OPTIONS: { type: LockedMediaType; label: string; icon: typeof Music }[] = [
    { type: "SONG", label: "Song", icon: Music },
    { type: "IMAGE", label: "Image", icon: ImageIcon },
    { type: "VIDEO", label: "Video", icon: VideoIcon },
    { type: "OTHER", label: "Link", icon: LinkIcon },
]

const LABEL_PLACEHOLDER: Record<LockedMediaType, string> = {
    SONG: "Exclusive Track",
    IMAGE: "Backstage Photo",
    VIDEO: "Behind the Scenes",
    OTHER: "Secret Set on SoundCloud",
}

function endpointFor(type: LockedMediaType) {
    switch (type) {
        case "SONG":
            return "musicUploader" as const
        case "IMAGE":
            return "imageUploader" as const
        case "VIDEO":
            return "videoUploader" as const
        case "OTHER":
            return undefined
    }
}

function isValidHttpUrl(value: string) {
    try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch {
        return false
    }
}

/**
 * Repeatable rows for a gated ("VIP ticket") NFT's locked reward content —
 * a creator adds one or more items, each either a file uploaded to S3
 * (song/image/video) or a plain external link (e.g. a SoundCloud page
 * rather than a file this app hosts). See VIP_TICKET_UNLOCK_PLAN.md §3.
 */
export function LockedMediaEditor({
    items,
    onChange,
}: {
    items: LockedMediaDraft[]
    onChange: (items: LockedMediaDraft[]) => void
}) {
    function addRow() {
        if (items.length >= MAX_ITEMS) return
        onChange([...items, { type: "SONG", label: "", url: undefined }]);
    }

    function updateRow(index: number, patch: Partial<LockedMediaDraft>) {
        onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    }

    function removeRow(index: number) {
        onChange(items.filter((_, i) => i !== index));
    }

    return (
        <div className="space-y-3">
            {items.map((item, i) => {
                const endpoint = endpointFor(item.type)
                const linkInvalid = item.type === "OTHER" && !!item.url && !isValidHttpUrl(item.url)
                return (
                    <div key={i} className="relative space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(i)}
                        >
                            <X className="h-4 w-4" />
                        </Button>

                        <div className="inline-flex gap-1 rounded-full bg-muted p-1">
                            {TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => updateRow(i, { type, url: undefined })}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                                        item.type === type
                                            ? "bg-foreground text-background shadow-sm"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor={`locked-label-${i}`} className="text-xs text-muted-foreground">
                                Label
                            </Label>
                            <Input
                                id={`locked-label-${i}`}
                                value={item.label}
                                onChange={(e) => updateRow(i, { label: e.target.value })}
                                placeholder={`e.g. "${LABEL_PLACEHOLDER[item.type]}"`}
                            />
                        </div>

                        {endpoint ? (
                            <MediaDropzone
                                endpoint={endpoint}
                                label={`Drag & drop or click to upload ${item.type.toLowerCase()}`}
                                onUploadComplete={(url) => updateRow(i, { url })}
                            />
                        ) : (
                            <div className="space-y-1.5">
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="url"
                                        value={item.url ?? ""}
                                        onChange={(e) => updateRow(i, { url: e.target.value })}
                                        placeholder="https://soundcloud.com/…"
                                        className={cn("pl-9", linkInvalid && "border-destructive focus-visible:ring-destructive")}
                                    />
                                </div>
                                {linkInvalid && (
                                    <p className="text-xs text-destructive">Enter a valid http(s) link.</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-3 rounded-xl border border-dashed p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Add unlock condition</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.unlockRule
                                                ? "Buyer must visit these locations to reveal this item."
                                                : "Off — this item reveals the moment a copy is bought."}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={!!item.unlockRule}
                                    onCheckedChange={(checked) =>
                                        updateRow(i, { unlockRule: checked ? { points: [] } : undefined })
                                    }
                                />
                            </div>

                            {item.unlockRule && (
                                <UnlockLocationPicker
                                    points={item.unlockRule.points}
                                    onChange={(points) => updateRow(i, { unlockRule: { points } })}
                                />
                            )}
                        </div>
                    </div>
                )
            })}

            <Button
                type="button"
                variant="outline"
                onClick={addRow}
                disabled={items.length >= MAX_ITEMS}
                className="flex h-12 w-full items-center justify-center gap-2 border-dashed text-muted-foreground"
            >
                <Plus className="h-4 w-4" />
                Add reward item
            </Button>
        </div>
    )
}

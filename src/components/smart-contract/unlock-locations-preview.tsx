"use client"

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps"
import { MapPin } from "lucide-react"
import { LocationAddressDisplay } from "~/components/map/address-display"

export type UnlockLocationPoint = {
    label: string | null
    latitude: number
    longitude: number
}

// Older points (added before the picker stopped auto-naming a clicked pin)
// have a literal "Location 3" etc. saved as their label — not a real name,
// so treat it the same as no label and fall back to the reverse-geocoded
// address, same as a point added since then with no label at all.
const GENERIC_LABEL_PATTERN = /^Location \d+$/
function hasRealLabel(label: string | null): label is string {
    return !!label && !GENERIC_LABEL_PATTERN.test(label)
}

/**
 * Read-only "here's where you'll need to go" preview for one gated item's
 * unlock rule — a numbered list of the actual location names plus a small
 * map with a pin per location, so a buyer can judge feasibility before
 * paying instead of just seeing a bare "N locations" count. No search, no
 * click-to-add — see `UnlockLocationPicker` for the creator-facing editor
 * this is the read-only counterpart of.
 */
export function UnlockLocationsPreview({ points }: { points: UnlockLocationPoint[] }) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY

    if (points.length === 0) return null

    const lats = points.map((p) => p.latitude)
    const lngs = points.map((p) => p.longitude)
    const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
        padding: 40,
    }
    // A single point (or a tight cluster) gives Maps a zero-size bounds box,
    // which it handles fine, but zooms in far past street level — pin it to
    // a sane default instead of trusting `defaultBounds` for that case.
    const isSinglePoint = bounds.north === bounds.south && bounds.east === bounds.west

    return (
        <div className="space-y-2">
            <ol className="space-y-1">
                {points.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                            {i + 1}
                        </span>
                        {hasRealLabel(p.label) ? (
                            <span className="text-foreground">{p.label}</span>
                        ) : (
                            <LocationAddressDisplay
                                latitude={p.latitude}
                                longitude={p.longitude}
                                className="rounded-none border-0 bg-transparent p-0 shadow-none [&_span]:text-sm [&_span]:font-normal [&_span]:text-foreground"
                            />
                        )}
                    </li>
                ))}
            </ol>

            {apiKey ? (
                <div className="h-40 w-full overflow-hidden rounded-xl border">
                    <APIProvider apiKey={apiKey}>
                        <Map
                            {...(isSinglePoint
                                ? { defaultCenter: { lat: points[0]!.latitude, lng: points[0]!.longitude }, defaultZoom: 13 }
                                : { defaultBounds: bounds })}
                            gestureHandling="greedy"
                            disableDefaultUI
                        >
                            {points.map((p, i) => (
                                <Marker
                                    key={i}
                                    position={{ lat: p.latitude, lng: p.longitude }}
                                    label={String(i + 1)}
                                />
                            ))}
                        </Map>
                    </APIProvider>
                </div>
            ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Map unavailable right now — see the names above.
                </p>
            )}
        </div>
    )
}

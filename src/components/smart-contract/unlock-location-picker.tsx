"use client"

import { useEffect, useRef, useState } from "react"
import {
    APIProvider,
    Map,
    Marker,
    useMapsLibrary,
    type MapCameraChangedEvent,
    type MapMouseEvent,
} from "@vis.gl/react-google-maps"
import { X, MapPin, Search } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import { Button } from "~/components/shadcn/ui/button"
import { LocationAddressDisplay } from "~/components/map/address-display"

// `label` is optional — a point added by clicking the map (the only way to
// add one here; search only pans, see `LocationSearchBox`'s doc comment)
// has no name at all, not a placeholder like "Location 1". The list below
// reverse-geocodes an unnamed point's coordinates instead.
export type UnlockPoint = { lat: number; lng: number; label?: string }
type LatLng = { lat: number; lng: number }

const MAX_POINTS = 20

// Older points (added before this picker stopped auto-naming a clicked pin)
// have a literal "Location 3" etc. saved as their label — not a real name,
// so treat it the same as no label and fall back to the reverse-geocoded
// address, same as a point added since then with no label at all.
const GENERIC_LABEL_PATTERN = /^Location \d+$/
function hasRealLabel(label: string | undefined): label is string {
    return !!label && !GENERIC_LABEL_PATTERN.test(label)
}

/** Matches "23.8103, 90.4125" (optional signs/decimals, with or without the
 * space) so a creator can paste raw coordinates instead of a place name. */
const COORDS_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/

function parseCoordinates(text: string): LatLng | null {
    const match = COORDS_PATTERN.exec(text)
    if (!match) return null
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
}

/** A trimmed-down version of the places-autocomplete input used on the main
 * map page (`CustomMapControl`) — self-contained here since that one wires
 * up several props (cursor-search mode, etc.) this picker doesn't need.
 *
 * Selecting a result here only pans the map to it — it never drops a pin.
 * Pins are only ever added by clicking the map directly, so search is purely
 * "find and jump to this place," not "find and add this place." */
function LocationSearchBox({ onLocationFound }: { onLocationFound: (point: LatLng) => void }) {
    const [value, setValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const places = useMapsLibrary("places")
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

    useEffect(() => {
        if (!places || !inputRef.current) return
        setAutocomplete(
            new places.Autocomplete(inputRef.current, {
                fields: ["geometry", "formatted_address", "name"],
            }),
        )
    }, [places])

    useEffect(() => {
        if (!autocomplete) return
        const listener = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace()
            if (place.geometry?.location) {
                const label = place.name ?? place.formatted_address ?? "Location"
                onLocationFound({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
                setValue(label)
            }
        })
        return () => listener.remove()
    }, [autocomplete, onLocationFound])

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== "Enter") return
        // Raw coordinates never come back through Places, so handle them
        // here directly instead of waiting on the "place_changed" listener.
        const coords = parseCoordinates(value)
        if (coords) {
            e.preventDefault()
            onLocationFound(coords)
        }
    }

    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search a place, or paste lat, lng…"
                className="pl-9"
            />
        </div>
    )
}

/**
 * Lets a creator build the list of locations a gated ("VIP ticket") NFT's
 * unlock rule requires — search for a place or click the map to add one,
 * remove any from the list below. See VIP_TICKET_UNLOCK_PLAN.md §3.
 */
export function UnlockLocationPicker({
    points,
    onChange,
}: {
    points: UnlockPoint[]
    onChange: (points: UnlockPoint[]) => void
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY
    const defaultCenter = points[0] ?? { lat: 23.8103, lng: 90.4125 }

    // Controlled so a search result can re-point the map without touching
    // `points` — the camera moving and a pin being added are independent now.
    const [camera, setCamera] = useState<{ center: LatLng; zoom: number }>({
        center: defaultCenter,
        zoom: points.length ? 10 : 6,
    })

    function addPoint(point: UnlockPoint) {
        if (points.length >= MAX_POINTS) return
        onChange([...points, point])
    }

    function removePoint(index: number) {
        onChange(points.filter((_, i) => i !== index))
    }

    function handleMapClick(event: MapMouseEvent) {
        const position = event.detail.latLng
        if (position) {
            addPoint({ lat: position.lat, lng: position.lng })
        }
    }

    function handleLocationFound(point: LatLng) {
        setCamera({ center: point, zoom: 15 })
    }

    function handleCameraChanged(event: MapCameraChangedEvent) {
        setCamera({ center: event.detail.center, zoom: event.detail.zoom })
    }

    if (!apiKey) {
        return (
            <p className="text-sm text-destructive">
                Map is unavailable right now (missing Google Maps API key) — try again later.
            </p>
        )
    }

    return (
        <div className="space-y-3">
            <APIProvider apiKey={apiKey}>
                <LocationSearchBox onLocationFound={handleLocationFound} />
                <div className="h-64 w-full overflow-hidden rounded-xl border">
                    <Map
                        center={camera.center}
                        zoom={camera.zoom}
                        gestureHandling="greedy"
                        disableDefaultUI
                        onClick={handleMapClick}
                        onCameraChanged={handleCameraChanged}
                    >
                        {points.map((p, i) => (
                            <Marker key={i} position={{ lat: p.lat, lng: p.lng }} label={String(i + 1)} />
                        ))}
                    </Map>
                </div>
            </APIProvider>

            <p className="text-xs text-muted-foreground">
                Search for a place (or paste coordinates) to jump there, then click directly on the map to
                add a required location
                {points.length >= MAX_POINTS && ` — ${MAX_POINTS} is the most this can hold`}. A buyer will
                need to get within 50 meters of each pin, in person, to collect it.
            </p>

            {points.length > 0 && (
                <div className="space-y-1.5">
                    {points.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {hasRealLabel(p.label) ? (
                                    p.label
                                ) : (
                                    <LocationAddressDisplay
                                        latitude={p.lat}
                                        longitude={p.lng}
                                        className="rounded-none border-0 bg-transparent p-0 shadow-none [&_span]:text-sm [&_span]:font-normal [&_span]:text-foreground"
                                    />
                                )}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                            </span>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removePoint(i)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

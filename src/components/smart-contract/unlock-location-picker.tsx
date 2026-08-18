"use client"

import { useEffect, useRef, useState } from "react"
import { APIProvider, Map, Marker, useMapsLibrary, type MapMouseEvent } from "@vis.gl/react-google-maps"
import { X, MapPin, Search } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import { Button } from "~/components/shadcn/ui/button"

export type UnlockPoint = { lat: number; lng: number; label: string }

const MAX_POINTS = 20

/** A trimmed-down version of the places-autocomplete input used on the main
 * map page (`CustomMapControl`) — self-contained here since that one wires
 * up several props (cursor-search mode, etc.) this picker doesn't need. */
function LocationSearchBox({ onPlaceSelect }: { onPlaceSelect: (point: UnlockPoint) => void }) {
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
                const label = place.name || place.formatted_address || "Location"
                onPlaceSelect({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), label })
                setValue(label)
            }
        })
        return () => listener.remove()
    }, [autocomplete, onPlaceSelect])

    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search a place to add…"
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
            addPoint({ lat: position.lat, lng: position.lng, label: `Location ${points.length + 1}` })
        }
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
                <LocationSearchBox onPlaceSelect={addPoint} />
                <div className="h-64 w-full overflow-hidden rounded-xl border">
                    <Map
                        defaultCenter={defaultCenter}
                        defaultZoom={points.length ? 10 : 6}
                        gestureHandling="greedy"
                        disableDefaultUI
                        onClick={handleMapClick}
                    >
                        {points.map((p, i) => (
                            <Marker key={i} position={{ lat: p.lat, lng: p.lng }} label={String(i + 1)} />
                        ))}
                    </Map>
                </div>
            </APIProvider>

            <p className="text-xs text-muted-foreground">
                Search for a place above, or click directly on the map, to add a required location
                {points.length >= MAX_POINTS && ` — ${MAX_POINTS} is the most this can hold`}.
            </p>

            {points.length > 0 && (
                <div className="space-y-1.5">
                    {points.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" />
                            <span className="flex-1 truncate text-sm">{p.label}</span>
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

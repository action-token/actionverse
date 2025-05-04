"use client"

import { useEffect, useState } from "react"

import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Slider } from "~/components/shadcn/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { APIProvider, AdvancedMarker, Map, type MapMouseEvent } from "@vis.gl/react-google-maps"
import { MapPin, Trash2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { useFormContext } from "react-hook-form"

import { FormMessage } from "~/components/shadcn/ui/form"
import { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { Textarea } from "../shadcn/ui/textarea"
import { Switch } from "../shadcn/ui/switch"

// Replace with your actual Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!

export default function LocationsForm() {
    const {
        getValues,
        setValue,
        formState: { errors },
    } = useFormContext<ScavengerHuntFormValues>()
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number
        longitude: number
    } | null>(null)
    const [locationDialogOpen, setLocationDialogOpen] = useState(false)
    const [newLocationTitle, setNewLocationTitle] = useState("")
    const [newLocationDescription, setNewLocationDescription] = useState("") // Added description state
    const [newLocationCollectionLimit, setNewLocationCollectionLimit] = useState(1)
    const [newLocationRadius, setNewLocationRadius] = useState(100)
    const [newLocationAutoCollect, setNewLocationAutoCollect] = useState(false) // Added autoCollect state
    const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.006 })
    const [locationError, setLocationError] = useState("")

    const locations = getValues("locations")

    const handleMapClick = (e: MapMouseEvent) => {
        if (e.detail.latLng) {
            const { lat, lng } = e.detail.latLng
            setSelectedLocation({
                latitude: lat,
                longitude: lng,
            })
            setLocationDialogOpen(true)
        }
    }

    const handleAddLocation = () => {
        if (!selectedLocation) return
        if (!newLocationTitle.trim()) {
            setLocationError("Location title is required")
            return
        }

        const newLocation = {
            id: crypto.randomUUID(),
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            title: newLocationTitle,
            description: newLocationDescription, // Added description
            collectionLimit: newLocationCollectionLimit,
            radius: newLocationRadius,
            autoCollect: newLocationAutoCollect, // Added autoCollect
        }

        const updatedLocations = [...locations, newLocation]
        setValue("locations", updatedLocations, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })

        setLocationDialogOpen(false)
        setSelectedLocation(null)
        setNewLocationTitle("")
        setNewLocationDescription("") // Reset description
        setNewLocationCollectionLimit(1)
        setNewLocationRadius(100)
        setNewLocationAutoCollect(false) // Reset autoCollect
        setLocationError("")
    }

    const handleRemoveLocation = (id: string) => {
        const updatedLocations = locations.filter((loc) => loc.id !== id)
        setValue("locations", updatedLocations, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Locations</h2>
                <p className="text-sm text-muted-foreground">
                    Add at least one location for your scavenger hunt by clicking on the map.
                </p>
            </div>

            <div className="h-[300px] w-full rounded-md border">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                        defaultCenter={mapCenter}
                        defaultZoom={12}
                        mapId="scavenger-hunt-map"
                        onClick={handleMapClick}
                        className="h-full w-full"
                    >
                        {locations.map((location) => (
                            <AdvancedMarker
                                key={location.id}
                                position={{ lat: location.latitude, lng: location.longitude }}
                                title={location.title}
                            >
                                <div className="flex flex-col items-center">
                                    <MapPin className="h-8 w-8 text-red-500" />
                                    <div className="mt-1 rounded-md bg-white px-2 py-1 text-xs font-medium shadow">{location.title}</div>
                                </div>
                            </AdvancedMarker>
                        ))}
                    </Map>
                </APIProvider>
            </div>

            {errors.locations && <FormMessage>{errors.locations.message}</FormMessage>}

            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add Location</DialogTitle>
                        <DialogDescription>Enter details for this scavenger hunt location.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input id="latitude" value={selectedLocation?.latitude.toFixed(6) ?? ""} readOnly />
                            </div>
                            <div>
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input id="longitude" value={selectedLocation?.longitude.toFixed(6) ?? ""} readOnly />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="title">Location Title*</Label>
                            <Input
                                id="title"
                                value={newLocationTitle}
                                onChange={(e) => setNewLocationTitle(e.target.value)}
                                placeholder="Enter a title for this location"
                            />
                            {locationError && <p className="text-sm font-medium text-destructive mt-1">{locationError}</p>}
                        </div>
                        <div>
                            <Label htmlFor="description">Location Description</Label>
                            <Textarea
                                id="description"
                                value={newLocationDescription}
                                onChange={(e) => setNewLocationDescription(e.target.value)}
                                placeholder="Describe this location (optional)"
                                className="min-h-[80px]"
                            />
                        </div>
                        <div>
                            <Label htmlFor="collectionLimit">Collection Limit*</Label>
                            <Input
                                id="collectionLimit"
                                type="number"
                                min="1"
                                value={newLocationCollectionLimit}
                                onChange={(e) => setNewLocationCollectionLimit(Number.parseInt(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="radius">Radius (meters)*</Label>
                            <div className="flex items-center space-x-4">
                                <Slider
                                    id="radius"
                                    min={10}
                                    max={1000}
                                    step={10}
                                    value={[newLocationRadius]}
                                    onValueChange={(value) => setNewLocationRadius(value[0] ?? newLocationRadius)}
                                    className="flex-1"
                                />
                                <span className="w-12 text-right">{newLocationRadius}m</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="auto-collect" checked={newLocationAutoCollect} onCheckedChange={setNewLocationAutoCollect} />
                            <Label htmlFor="auto-collect">Auto Collect</Label>
                            <p className="text-sm text-muted-foreground ml-2">
                                When enabled, users will automatically collect this location when in range
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddLocation}>Add Location</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                <h3 className="text-base font-medium">Added Locations</h3>
                {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations added yet. Click on the map to add locations.</p>
                ) : (
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-4">
                            {locations.map((location) => (
                                <Card key={location.id}>
                                    <CardHeader className="p-4">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">{location.title}</CardTitle>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveLocation(location.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="font-medium">Coordinates:</span> {location.latitude.toFixed(6)},{" "}
                                                {location.longitude.toFixed(6)}
                                            </div>
                                            <div>
                                                <span className="font-medium">Collection Limit:</span> {location.collectionLimit}
                                            </div>
                                            <div>
                                                <span className="font-medium">Radius:</span> {location.radius}m
                                            </div>
                                            <div>
                                                <span className="font-medium">Auto Collect:</span> {location.autoCollect ? "Yes" : "No"}
                                            </div>
                                            {location.description && (
                                                <div className="col-span-2 mt-2">
                                                    <span className="font-medium">Description:</span> {location.description}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    )
}

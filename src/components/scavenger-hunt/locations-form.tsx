"use client"

import { useEffect, useState } from "react"

import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Slider } from "~/components/shadcn/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { APIProvider, AdvancedMarker, Map, type MapMouseEvent } from "@vis.gl/react-google-maps"
import { Edit, MapPin, Trash2, UploadCloud, X } from "lucide-react"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"
import { format, addDays } from "date-fns"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { useFormContext } from "react-hook-form"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog"
import { CalendarIcon } from "lucide-react"
import { cn } from "~/lib/utils"
import type { DateRange } from "react-day-picker"
import { FormMessage } from "~/components/shadcn/ui/form"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { Textarea } from "../shadcn/ui/textarea"
import { Checkbox } from "../shadcn/ui/checkbox"

import { UploadS3Button } from "../common/upload-button"
import toast from "react-hot-toast"
import { Calendar } from "../shadcn/ui/calendar"

// Replace with your actual Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!

interface Location {
    id: string
    latitude: number
    longitude: number
    title: string
    description?: string
    pinImage: string
    pinUrl: string
    startDate: Date
    endDate: Date
    collectionLimit: number
    radius: number
    autoCollect: boolean
}

export default function LocationsForm() {
    const {
        getValues,
        setValue,
        watch,
        formState: { errors },
        trigger,
    } = useFormContext<ScavengerHuntFormValues>()

    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number
        longitude: number
    } | null>(null)
    const [locationDialogOpen, setLocationDialogOpen] = useState(false)
    const [locationError, setLocationError] = useState("")
    const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.006 })
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null)

    // Form state for the location dialog
    const [newLocationData, setNewLocationData] = useState({
        title: "",
        description: "",
        pinImage: "",
        pinUrl: "",
        collectionLimit: 1,
        radius: 100,
        autoCollect: false,
        startDate: new Date(),
        endDate: addDays(new Date(), 7),
    })

    const locations = watch("locations") // Use watch instead of getValues to ensure reactivity
    const useSameInfoForAllSteps = watch("useSameInfoForAllSteps")
    const defaultLocationInfo = watch("defaultLocationInfo")
    const numberOfSteps = watch("numberOfSteps")

    // Use a separate state for the current image being edited
    const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleRemove = () => {
        setCurrentImagePreview(null)
        setError(null)
        setNewLocationData({ ...newLocationData, pinImage: "" })
    }

    // Check if default info is valid when using same info for all pins
    const [isDefaultInfoValid, setIsDefaultInfoValid] = useState(false)

    useEffect(() => {
        const checkDefaultInfoValidity = async () => {
            if (useSameInfoForAllSteps) {
                const isValid = await trigger("defaultLocationInfo")
                setIsDefaultInfoValid(isValid)
            } else {
                setIsDefaultInfoValid(true)
            }
        }

        checkDefaultInfoValidity()
    }, [useSameInfoForAllSteps, defaultLocationInfo, trigger])

    // Update the current image preview when editing a location or when newLocationData.pinImage changes
    useEffect(() => {
        setCurrentImagePreview(newLocationData.pinImage ?? null)
    }, [newLocationData.pinImage])

    const handleMapClick = (e: MapMouseEvent) => {
        // Don't allow adding more locations than steps
        if (locations.length >= numberOfSteps) {
            return
        }

        // If using same info for all pins, validate default info first
        if (useSameInfoForAllSteps && !isDefaultInfoValid) {
            return
        }

        if (e.detail.latLng) {
            const { lat, lng } = e.detail.latLng
            setSelectedLocation({
                latitude: lat,
                longitude: lng,
            })

            // Reset editing state
            setEditingLocationId(null)

            // If using same info for all steps, pre-populate with default info
            if (useSameInfoForAllSteps && defaultLocationInfo) {
                setNewLocationData({
                    title: defaultLocationInfo.title ?? "",
                    description: defaultLocationInfo.description ?? "",
                    pinImage: defaultLocationInfo.pinImage ?? "",
                    pinUrl: defaultLocationInfo.pinUrl ?? "",
                    collectionLimit: defaultLocationInfo.collectionLimit ?? 1,
                    radius: defaultLocationInfo.radius ?? 100,
                    autoCollect: defaultLocationInfo.autoCollect ?? false,
                    startDate: defaultLocationInfo.startDate || new Date(),
                    endDate: defaultLocationInfo.endDate || addDays(new Date(), 7),
                })
            } else {
                // Reset form for new location
                setNewLocationData({
                    title: "",
                    description: "",
                    pinImage: "",
                    pinUrl: "",
                    collectionLimit: 1,
                    radius: 100,
                    autoCollect: false,
                    startDate: new Date(),
                    endDate: addDays(new Date(), 7),
                })
            }

            setLocationDialogOpen(true)
        }
    }

    const handleEditLocation = (locationId: string) => {
        const locationToEdit = locations.find((loc) => loc.id === locationId)
        if (!locationToEdit) return

        setEditingLocationId(locationId)
        setSelectedLocation({
            latitude: locationToEdit.latitude,
            longitude: locationToEdit.longitude,
        })

        if (!useSameInfoForAllSteps) {
            // Set the form data for the specific location being edited
            setNewLocationData({
                title: locationToEdit.title ?? "",
                description: locationToEdit.description ?? "",
                pinImage: locationToEdit.pinImage ?? "",
                pinUrl: locationToEdit.pinUrl ?? "",
                collectionLimit: locationToEdit.collectionLimit ?? 1,
                radius: locationToEdit.radius ?? 100,
                autoCollect: locationToEdit.autoCollect ?? false,
                startDate: locationToEdit.startDate ?? new Date(),
                endDate: locationToEdit.endDate ?? addDays(new Date(), 7),
            })
        }

        setLocationDialogOpen(true)
    }

    // Handle date range changes
    const handleDateRangeChange = (startDate: Date, endDate: Date) => {
        setNewLocationData({
            ...newLocationData,
            startDate,
            endDate,
        })
    }

    // Update the validateLocationData function to properly validate all required fields
    const validateLocationData = () => {
        if (!selectedLocation) {
            setLocationError("Location coordinates are required")
            return false
        }

        if (!useSameInfoForAllSteps) {
            // When not using same info, only validate that the user clicked a location on the map
            // We already have the coordinates from the click, so we don't need to validate them again
            return true
        }

        // When using same info for all steps, we only need to validate coordinates
        // which are already set when clicking on the map
        return true
    }

    // Update the handleSaveLocation function to handle pinUrl properly
    const handleSaveLocation = () => {
        if (!selectedLocation) return

        // Validate location data with our updated validation function
        if (!validateLocationData()) {
            return
        }

        if (editingLocationId) {
            // Update existing location
            const updatedLocations = locations.map((loc) => {
                if (loc.id === editingLocationId) {
                    if (useSameInfoForAllSteps) {
                        return {
                            ...loc,
                            latitude: selectedLocation.latitude,
                            longitude: selectedLocation.longitude,
                        }
                    } else {
                        return {
                            ...loc,
                            latitude: selectedLocation.latitude,
                            longitude: selectedLocation.longitude,
                            title: newLocationData.title,
                            description: newLocationData.description,
                            pinImage: newLocationData.pinImage,
                            pinUrl: newLocationData.pinUrl,
                            startDate: newLocationData.startDate,
                            endDate: newLocationData.endDate,
                            collectionLimit: newLocationData.collectionLimit,
                            radius: newLocationData.radius,
                            autoCollect: newLocationData.autoCollect,
                        }
                    }
                }
                return loc
            })

            setValue("locations", updatedLocations, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
            })
        } else {
            // Add new location
            const newLocation: Location = {
                id: crypto.randomUUID(),
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                title: useSameInfoForAllSteps ? (defaultLocationInfo?.title ?? "") : newLocationData.title || "Location",
                description: useSameInfoForAllSteps
                    ? (defaultLocationInfo?.description ?? "")
                    : newLocationData.description || "",
                pinImage: useSameInfoForAllSteps ? (defaultLocationInfo?.pinImage ?? "") : newLocationData.pinImage || "",
                pinUrl: useSameInfoForAllSteps ? (defaultLocationInfo?.pinUrl ?? "") : newLocationData.pinUrl || "",
                startDate: useSameInfoForAllSteps
                    ? (defaultLocationInfo?.startDate ?? new Date())
                    : newLocationData.startDate || new Date(),
                endDate: useSameInfoForAllSteps
                    ? (defaultLocationInfo?.endDate ?? new Date())
                    : newLocationData.endDate || addDays(new Date(), 7),
                collectionLimit: useSameInfoForAllSteps
                    ? (defaultLocationInfo?.collectionLimit ?? 1)
                    : newLocationData.collectionLimit || 1,
                radius: useSameInfoForAllSteps ? (defaultLocationInfo?.radius ?? 100) : newLocationData.radius || 100,
                autoCollect: useSameInfoForAllSteps
                    ? (defaultLocationInfo?.autoCollect ?? false)
                    : newLocationData.autoCollect || false,
            }

            const updatedLocations = [...locations, newLocation]
            setValue("locations", updatedLocations, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
            })
        }

        setLocationDialogOpen(false)
        setSelectedLocation(null)
        setLocationError("")
        setEditingLocationId(null)
        setCurrentImagePreview(null) // Reset the current image preview
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
                <h2 className="text-lg font-semibold">Steps</h2>
                <p className="text-sm text-muted-foreground">
                    Add {numberOfSteps} location{numberOfSteps > 1 ? "s" : ""} for your scavenger hunt by clicking on the map.
                    {useSameInfoForAllSteps
                        ? " You only need to select the coordinates as all other details will be shared."
                        : " You'll need to provide complete information for each location."}
                </p>
            </div>

            {useSameInfoForAllSteps && !isDefaultInfoValid && (
                <Alert variant="destructive">
                    <AlertDescription>Please complete the Default Information step before adding locations.</AlertDescription>
                </Alert>
            )}

            {locations.length >= numberOfSteps && (
                <Alert>
                    <AlertDescription>
                        You{"'ve"} reached the maximum number of locations ({numberOfSteps}). Edit or remove existing locations if
                        needed.
                    </AlertDescription>
                </Alert>
            )}

            <div
                className={cn(
                    "h-[300px] w-full rounded-md border",
                    ((useSameInfoForAllSteps && !isDefaultInfoValid) ?? locations.length >= numberOfSteps) &&
                    "opacity-50 pointer-events-none",
                )}
            >
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
                                title={location.title ?? "Location"}
                            >
                                <div className="flex flex-col items-center">
                                    <MapPin className="h-8 w-8 text-red-500" />
                                    <div className="mt-1 rounded-md bg-white px-2 py-1 text-xs font-medium shadow">
                                        {location.title ?? (useSameInfoForAllSteps && defaultLocationInfo?.title) ?? "Location"}
                                    </div>
                                </div>
                            </AdvancedMarker>
                        ))}
                    </Map>
                </APIProvider>
            </div>

            {errors.locations && <FormMessage>{errors.locations.message}</FormMessage>}

            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingLocationId ? "Edit Location" : "Add Location"}</DialogTitle>
                        <DialogDescription>
                            {useSameInfoForAllSteps
                                ? "Confirm the coordinates for this location."
                                : `${editingLocationId ? "Edit" : "Enter"} details for this scavenger hunt location.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="latitude">Latitude*</Label>
                                <Input id="latitude" value={selectedLocation?.latitude.toFixed(6) ?? ""} readOnly />
                            </div>
                            <div>
                                <Label htmlFor="longitude">Longitude*</Label>
                                <Input id="longitude" value={selectedLocation?.longitude.toFixed(6) ?? ""} readOnly />
                            </div>
                        </div>

                        {!useSameInfoForAllSteps && (
                            <>
                                <div>
                                    <Label htmlFor="title">Location Title*</Label>
                                    <Input
                                        id="title"
                                        value={newLocationData.title}
                                        onChange={(e) => setNewLocationData({ ...newLocationData, title: e.target.value })}
                                        placeholder="Enter a title for this location"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Textarea
                                        id="description"
                                        value={newLocationData.description}
                                        onChange={(e) => setNewLocationData({ ...newLocationData, description: e.target.value })}
                                        placeholder="Enter a description for this location"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="pinImage">Pin Image*</Label>
                                    <div className={cn("space-y-2")}>
                                        {!currentImagePreview ? (
                                            <div
                                                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 transition-colors hover:border-gray-400 cursor-pointer"
                                                onClick={() => document.getElementById("pincoverimage")?.click()}
                                            >
                                                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground mb-1">Click to upload image</p>
                                                <p className="text-xs text-muted-foreground mb-4">PNG, JPG, GIF up to 1GB</p>
                                            </div>
                                        ) : (
                                            <div className="relative border rounded-lg overflow-hidden">
                                                <img
                                                    src={currentImagePreview ?? "/placeholder.svg"}
                                                    alt="Preview"
                                                    className="w-full h-48 object-cover"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-2 right-2 rounded-full"
                                                    onClick={handleRemove}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        <UploadS3Button
                                            id="pincoverimage"
                                            endpoint="imageUploader"
                                            variant="hidden"
                                            onUploadProgress={(progress) => {
                                                setIsUploading(true)

                                                if (progress === 100) {
                                                    setIsUploading(false)
                                                }
                                                setError(null)
                                            }}
                                            onClientUploadComplete={(res) => {
                                                const data = res
                                                if (data?.url) {
                                                    setNewLocationData({ ...newLocationData, pinImage: data.url })
                                                    setCurrentImagePreview(data.url)
                                                    setIsUploading(false)
                                                }
                                            }}
                                            onUploadError={(error: Error) => {
                                                toast.error(`ERROR! ${error.message}`)
                                            }}
                                        />
                                        {error && <p className="text-sm text-red-500">{error}</p>}
                                        {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="pinUrl">Pin URL*</Label>
                                    <Input
                                        id="pinUrl"
                                        value={newLocationData.pinUrl}
                                        onChange={(e) => setNewLocationData({ ...newLocationData, pinUrl: e.target.value })}
                                        placeholder="https://example.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label>Date Range*</Label>
                                    {/* Replace Popover with DateRangeDialog */}
                                    <DateRangeDialog
                                        startDate={newLocationData.startDate}
                                        endDate={newLocationData.endDate}
                                        onDateChange={handleDateRangeChange}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="collectionLimit">Collection Limit*</Label>
                                    <Input
                                        id="collectionLimit"
                                        type="number"
                                        min="1"
                                        value={newLocationData.collectionLimit}
                                        onChange={(e) =>
                                            setNewLocationData({ ...newLocationData, collectionLimit: Number.parseInt(e.target.value) })
                                        }
                                        required
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
                                            value={[newLocationData.radius]}
                                            onValueChange={(value) => setNewLocationData({ ...newLocationData, radius: value[0] ?? 0 })}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right">{newLocationData.radius}m</span>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <Checkbox
                                        id="autoCollect"
                                        checked={newLocationData.autoCollect}
                                        onCheckedChange={(checked) =>
                                            setNewLocationData({ ...newLocationData, autoCollect: checked === true })
                                        }
                                    />
                                    <div className="space-y-1 leading-none">
                                        <Label htmlFor="autoCollect">Auto Collect*</Label>
                                        <p className="text-sm text-muted-foreground">
                                            When enabled, this location will be automatically collected when users enter the radius
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {locationError && <div className="text-sm font-medium text-destructive">{locationError}</div>}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setLocationDialogOpen(false)
                                setLocationError("")
                                setEditingLocationId(null)
                                setCurrentImagePreview(null) // Reset the current image preview
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveLocation}>{editingLocationId ? "Update Location" : "Add Location"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                <h3 className="text-base font-medium">
                    Added Locations ({locations.length}/{numberOfSteps})
                </h3>
                {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations added yet. Click on the map to add locations.</p>
                ) : (
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-4">
                            {locations.map((location, index) => (
                                <Card key={location.id}>
                                    <CardHeader className="p-4">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">
                                                {useSameInfoForAllSteps
                                                    ? `${defaultLocationInfo?.title ?? "Location"} ${index + 1}`
                                                    : (location.title ?? "Unnamed Location")}
                                            </CardTitle>
                                            <div className="flex space-x-2">
                                                {
                                                    !useSameInfoForAllSteps && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditLocation(location.id)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )
                                                }
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveLocation(location.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                            <div>
                                                <span className="font-medium">Coordinates:</span> {location.latitude.toFixed(6)},{" "}
                                                {location.longitude.toFixed(6)}
                                            </div>
                                            {!useSameInfoForAllSteps && (
                                                <>
                                                    {location.collectionLimit && (
                                                        <div>
                                                            <span className="font-medium">Collection Limit:</span> {location.collectionLimit}
                                                        </div>
                                                    )}
                                                    {location.radius && (
                                                        <div>
                                                            <span className="font-medium">Radius:</span> {location.radius}m
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Add pin image preview */}
                                            <div className="col-span-full mt-2">
                                                <span className="font-medium">Pin Image:</span>
                                                <div className="mt-1 h-16 w-full overflow-hidden rounded-md border">
                                                    {useSameInfoForAllSteps ? (
                                                        defaultLocationInfo?.pinImage ? (
                                                            <img
                                                                src={defaultLocationInfo.pinImage ?? "/placeholder.svg"}
                                                                alt="Pin"
                                                                className="h-full w-16 object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                                                <p className="text-xs text-muted-foreground">No image</p>
                                                            </div>
                                                        )
                                                    ) : location.pinImage ? (
                                                        <img
                                                            src={location.pinImage ?? "/placeholder.svg"}
                                                            alt="Pin"
                                                            className="h-full w-16 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-muted">
                                                            <p className="text-xs text-muted-foreground">No image</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
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
interface DateRangeDialogProps {
    startDate: Date
    endDate: Date
    onDateChange: (startDate: Date, endDate: Date) => void
    className?: string
    disabled?: boolean
}

export function DateRangeDialog({
    startDate,
    endDate,
    onDateChange,
    className,
    disabled = false,
}: DateRangeDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startDate,
        to: endDate,
    })

    // Update internal state when props change
    useEffect(() => {
        setDateRange({
            from: startDate,
            to: endDate,
        })
    }, [startDate, endDate])

    const handleSelect = (range: DateRange | undefined) => {
        setDateRange(range)

        if (range?.from) {
            // If only the start date is selected, set end date to 7 days later by default
            if (!range.to) {
                const defaultEndDate = addDays(range.from, 7)
                setDateRange({ from: range.from, to: defaultEndDate })
            }
        }
    }

    const handleConfirm = () => {
        if (dateRange?.from && dateRange?.to) {
            onDateChange(dateRange.from, dateRange.to)
            setIsOpen(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", className)} disabled={disabled}>
                    {startDate && endDate ? (
                        <>
                            {format(startDate, "LLL dd, y")} - {format(endDate, "LLL dd, y")}
                        </>
                    ) : (
                        <span>Pick a date range</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Select Date Range</DialogTitle>
                </DialogHeader>

                <div className="p-4">
                    <div className="border rounded-md p-3 mb-4">
                        <div className="flex items-center mb-2">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            <span className="text-sm font-medium">
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Select date range</span>
                                )}
                            </span>
                        </div>

                        <div className="flex justify-center">
                            <Calendar
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={handleSelect}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                numberOfMonths={2}
                                initialFocus
                                className="rounded border shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleConfirm} disabled={!dateRange?.from || !dateRange?.to}>
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

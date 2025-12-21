"use client"

import { useEffect, useState } from "react"

import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Slider } from "~/components/shadcn/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { APIProvider, AdvancedMarker, Map, type MapMouseEvent } from "@vis.gl/react-google-maps"
import { Edit, MapPin, Trash2, UploadCloud, X, AlertCircle, CalendarIcon } from "lucide-react"
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
import { cn } from "~/lib/utils"
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

    const [locationValidationErrors, setLocationValidationErrors] = useState<{
        title?: string
        pinImage?: string
        pinUrl?: string
        collectionLimit?: string
        radius?: string
        dateRange?: string
    }>({})

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
            toast.error("Please complete the Default Information step before adding locations.")
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
            setLocationValidationErrors({})

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
                    startDate: defaultLocationInfo.startDate ?? new Date(),
                    endDate: defaultLocationInfo.endDate ?? addDays(new Date(), 7),
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
        setLocationValidationErrors({})

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

    const validateLocationData = () => {
        if (!selectedLocation) {
            setLocationError("Location coordinates are required")
            return false
        }

        if (!useSameInfoForAllSteps) {
            // Validate all required fields for individual locations
            const errors: typeof locationValidationErrors = {}

            if (!newLocationData.title || newLocationData.title.trim().length === 0) {
                errors.title = "Location title is required"
            }

            if (!newLocationData.pinImage || newLocationData.pinImage.trim().length === 0) {
                errors.pinImage = "Pin image is required"
            }

            if (!newLocationData.pinUrl || newLocationData.pinUrl.trim().length === 0) {
                errors.pinUrl = "Pin URL is required"
            } else {
                // Validate URL format
                try {
                    new URL(newLocationData.pinUrl)
                } catch {
                    errors.pinUrl = "Must be a valid URL"
                }
            }

            if (!newLocationData.collectionLimit || newLocationData.collectionLimit < 1) {
                errors.collectionLimit = "Collection limit must be at least 1"
            }

            if (!newLocationData.radius || newLocationData.radius < 10) {
                errors.radius = "Radius must be at least 10 meters"
            }

            if (!newLocationData.startDate || !newLocationData.endDate) {
                errors.dateRange = "Date range is required"
            } else if (newLocationData.startDate >= newLocationData.endDate) {
                errors.dateRange = "End date must be after start date"
            }

            setLocationValidationErrors(errors)

            if (Object.keys(errors).length > 0) {
                toast.error("Please fill in all required fields correctly")
                return false
            }
        }

        setLocationValidationErrors({})
        return true
    }

    // Update the handleSaveLocation function to handle pinUrl properly
    const handleSaveLocation = () => {
        if (!selectedLocation) return

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
        setLocationValidationErrors({})
        toast.success(editingLocationId ? "Location updated successfully" : "Location added successfully")
    }

    const handleRemoveLocation = (id: string) => {
        const updatedLocations = locations.filter((loc) => loc.id !== id)
        setValue("locations", updatedLocations, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })
        toast.success("Location removed successfully")
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
                    <AlertCircle className="h-4 w-4" />
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

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Locations Added</span>
                        <span
                            className={cn(
                                "text-sm font-semibold",
                                locations.length === numberOfSteps ? "text-green-600" : "text-orange-600",
                            )}
                        >
                            {locations.length} / {numberOfSteps}
                        </span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full transition-all duration-300",
                                locations.length === numberOfSteps ? "bg-green-500" : "bg-blue-500",
                            )}
                            style={{ width: `${(locations.length / numberOfSteps) * 100}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            <div
                className={cn(
                    "h-[300px] w-full rounded-md border",
                    ((useSameInfoForAllSteps && !isDefaultInfoValid) || locations.length >= numberOfSteps) &&
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
                                : `${editingLocationId ? "Edit" : "Enter"} details for this scavenger hunt location. All fields marked with * are required.`}
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
                                        placeholder="Enter location title"
                                    />
                                    {locationValidationErrors.title && (
                                        <p className="text-sm text-destructive mt-1">{locationValidationErrors.title}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="description">Location Description (Optional)</Label>
                                    <Textarea
                                        id="description"
                                        value={newLocationData.description}
                                        onChange={(e) => setNewLocationData({ ...newLocationData, description: e.target.value })}
                                        placeholder="Enter location description"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="pinImage">Pin Image*</Label>
                                    <div className="space-y-2">
                                        {!currentImagePreview ? (
                                            <div
                                                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 transition-colors hover:border-gray-400 cursor-pointer"
                                                onClick={() => document.getElementById("locationpinimage")?.click()}
                                            >
                                                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground mb-1">Click to upload image</p>
                                                <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 1GB</p>
                                            </div>
                                        ) : (
                                            <div className="relative border rounded-lg overflow-hidden">
                                                <img
                                                    src={currentImagePreview ?? "/images/action/logo.png"}
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
                                            id="locationpinimage"
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
                                        {locationValidationErrors.pinImage && (
                                            <p className="text-sm text-destructive">{locationValidationErrors.pinImage}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="pinUrl">Pin URL*</Label>
                                    <Input
                                        id="pinUrl"
                                        type="url"
                                        value={newLocationData.pinUrl}
                                        onChange={(e) => setNewLocationData({ ...newLocationData, pinUrl: e.target.value })}
                                        placeholder="https://example.com"
                                    />
                                    {locationValidationErrors.pinUrl && (
                                        <p className="text-sm text-destructive mt-1">{locationValidationErrors.pinUrl}</p>
                                    )}
                                </div>

                                <div>
                                    <Label>Date Range*</Label>
                                    <DateRangeDialog
                                        startDate={newLocationData.startDate}
                                        endDate={newLocationData.endDate}
                                        onDateChange={handleDateRangeChange}
                                    />
                                    {locationValidationErrors.dateRange && (
                                        <p className="text-sm text-destructive mt-1">{locationValidationErrors.dateRange}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="collectionLimit">Collection Limit*</Label>
                                    <Input
                                        id="collectionLimit"
                                        type="number"
                                        min="1"
                                        value={newLocationData.collectionLimit}
                                        onChange={(e) =>
                                            setNewLocationData({
                                                ...newLocationData,
                                                collectionLimit: Number.parseInt(e.target.value) || 1,
                                            })
                                        }
                                    />
                                    {locationValidationErrors.collectionLimit && (
                                        <p className="text-sm text-destructive mt-1">{locationValidationErrors.collectionLimit}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="radius">Radius (meters)*</Label>
                                    <div className="flex items-center space-x-4">
                                        <Slider
                                            min={10}
                                            max={1000}
                                            step={10}
                                            value={[newLocationData.radius]}
                                            onValueChange={(value) => setNewLocationData({ ...newLocationData, radius: value[0] ?? 100 })}
                                            className="flex-1"
                                        />
                                        <span className="w-16 text-right">{newLocationData.radius}m</span>
                                    </div>
                                    {locationValidationErrors.radius && (
                                        <p className="text-sm text-destructive mt-1">{locationValidationErrors.radius}</p>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="autoCollect"
                                        checked={newLocationData.autoCollect}
                                        onCheckedChange={(checked) =>
                                            setNewLocationData({ ...newLocationData, autoCollect: checked as boolean })
                                        }
                                    />
                                    <Label htmlFor="autoCollect" className="cursor-pointer">
                                        Auto Collect*
                                    </Label>
                                </div>
                            </>
                        )}
                    </div>

                    {locationError && <p className="text-sm text-destructive">{locationError}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setLocationDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveLocation}>
                            {editingLocationId ? "Update Location" : "Save Location"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Location List */}
            {locations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Added Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[200px]">
                            <div className="space-y-2">
                                {locations.map((location, index) => (
                                    <div key={location.id} className="flex items-center justify-between border rounded-lg p-3">
                                        <div className="flex items-center space-x-3">
                                            <MapPin className="h-5 w-5 text-red-500" />
                                            <div>
                                                <p className="font-medium">
                                                    {useSameInfoForAllSteps
                                                        ? `${defaultLocationInfo?.title ?? "Location"} ${index + 1}`
                                                        : (location.title ?? "Unnamed Location")}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleEditLocation(location.id)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => handleRemoveLocation(location.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// Date Range Dialog Component
function DateRangeDialog({
    startDate,
    endDate,
    onDateChange,
}: {
    startDate: Date
    endDate: Date
    onDateChange: (startDate: Date, endDate: Date) => void
}) {
    const [open, setOpen] = useState(false)
    const [localStartDate, setLocalStartDate] = useState<Date | undefined>(startDate)
    const [localEndDate, setLocalEndDate] = useState<Date | undefined>(endDate)

    const handleApply = () => {
        if (localStartDate && localEndDate) {
            onDateChange(localStartDate, localEndDate)
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                    type="button"
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate && endDate ? (
                        <>
                            {format(startDate, "PPP")} - {format(endDate, "PPP")}
                        </>
                    ) : (
                        <span>Pick a date range</span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="w-auto p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Select Date Range</DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Calendar
                            mode="single"
                            selected={localStartDate}
                            onSelect={setLocalStartDate}
                            disabled={(date) => date < new Date()}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <Calendar
                            mode="single"
                            selected={localEndDate}
                            onSelect={setLocalEndDate}
                            disabled={(date) => !localStartDate || date <= localStartDate}
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleApply} disabled={!localStartDate || !localEndDate}>
                            Apply
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

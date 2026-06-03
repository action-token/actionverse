"use client"

import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Checkbox } from "~/components/shadcn/ui/checkbox"
import { Slider } from "~/components/shadcn/ui/slider"
import { Button } from "~/components/shadcn/ui/button"
import { CalendarIcon, ImageIcon, Link, MapPin, UploadCloud, X } from "lucide-react"
import { cn } from "~/lib/utils"
import { useEffect, useState } from "react"
import { Label } from "~/components/shadcn/ui/label"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { UploadS3Button } from "../common/upload-button"
import toast from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn/ui/dialog"
import { format } from "date-fns"
import { Calendar } from "../shadcn/ui/calendar"

export default function DefaultInfoForm() {
    const {
        control,
        setValue,
        getValues,
        watch,
        formState: { errors },
    } = useFormContext<ScavengerHuntFormValues>()

    const [preview, setPreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const startDate = watch("defaultLocationInfo.startDate")
    const endDate = watch("defaultLocationInfo.endDate")
    const pinImage = watch("defaultLocationInfo.pinImage")

    // Set preview when pinImage changes
    useEffect(() => {
        if (pinImage) {
            setPreview(pinImage)
        }
    }, [pinImage])

    const handleRemove = () => {
        setValue("defaultLocationInfo.pinImage", "", {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })
        setPreview(null)
        setError(null)
        setIsUploading(false)
    }

    const handleDateChange = (start: Date, end: Date) => {
        setValue("defaultLocationInfo.startDate", start, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })
        setValue("defaultLocationInfo.endDate", end, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        })
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Default Location Information</h2>
                <p className="text-sm text-muted-foreground">
                    This information will be used for all locations in your scavenger hunt. All fields marked with * are required.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <MapPin className="h-6 w-6 text-red-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Location Title*</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter location title" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="">
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <MapPin className="h-6 w-6 text-red-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Location Description (Optional)</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Enter location description" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <ImageIcon className="h-6 w-6 text-blue-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.pinImage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pin Image*</FormLabel>
                                            <div className={cn("space-y-2")}>
                                                {!preview ? (
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
                                                            src={preview ?? "/images/action/logo.png"}
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
                                                            field.onChange(data.url)
                                                            setPreview(data.url)
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
                                            <FormDescription>This image will be displayed on the pins</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Link className="h-6 w-6 text-indigo-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.pinUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pin URL Link*</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://example.com" {...field} />
                                            </FormControl>
                                            <FormDescription> Link that opens when a pin is clicked</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 ">
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <CalendarIcon className="h-6 w-6 text-green-500" />
                            <div className="w-full space-y-1">
                                <div className="space-y-2">
                                    <Label>Date Range*</Label>
                                    {/* Replace the problematic Popover with our custom Dialog component */}
                                    <DateRangeDialog startDate={startDate} endDate={endDate} onDateChange={handleDateChange} />
                                    <p className="text-sm text-muted-foreground">Select the start and end dates for your locations</p>
                                    {errors.defaultLocationInfo?.startDate && (
                                        <p className="text-sm text-destructive">{errors.defaultLocationInfo.startDate.message}</p>
                                    )}
                                    {errors.defaultLocationInfo?.endDate && (
                                        <p className="text-sm text-destructive">{errors.defaultLocationInfo.endDate.message}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <MapPin className="h-6 w-6 text-orange-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.collectionLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Collection Limit*</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    {...field}
                                                    onChange={(e) => {
                                                        const value = e.target.value ? Number.parseInt(e.target.value, 10) : 1
                                                        field.onChange(value)
                                                    }}
                                                    value={typeof field.value === "number" ? field.value : 1}
                                                />
                                            </FormControl>
                                            <FormDescription>Maximum number of times this location can be collected</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <MapPin className="h-6 w-6 text-purple-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.radius"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Radius (meters)*</FormLabel>
                                            <div className="flex items-center space-x-4">
                                                <Slider
                                                    min={10}
                                                    max={1000}
                                                    step={10}
                                                    value={[typeof field.value === "number" ? field.value : 100]}
                                                    onValueChange={(value) => {
                                                        const radiusValue = value[0] ?? 100
                                                        field.onChange(radiusValue)
                                                    }}
                                                    className="flex-1"
                                                />
                                                <span className="w-12 text-right">{typeof field.value === "number" ? field.value : 100}m</span>
                                            </div>
                                            <FormDescription>Detection radius around the location</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Settings className="h-6 w-6 text-cyan-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.autoCollect"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>Auto Collect*</FormLabel>
                                                <FormDescription>
                                                    When enabled, users will automatically collect the pin when they enter the radius.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

import { Settings } from "lucide-react"

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

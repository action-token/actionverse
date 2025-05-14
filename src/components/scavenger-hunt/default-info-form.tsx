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
import type { DateRange } from "react-day-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/shadcn/ui/dialog"
import { format, addDays } from "date-fns"
import { Calendar } from "../shadcn/ui/calendar"

export default function DefaultInfoForm() {
    const {
        control,
        setValue,
        getValues,
        watch,
        formState: { errors },
        trigger,
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

    // Add a useEffect to validate the form when any default location info field changes
    useEffect(() => {
        // Trigger validation for all fields in defaultLocationInfo
        void trigger("defaultLocationInfo")
    }, [
        watch("defaultLocationInfo.title"),
        watch("defaultLocationInfo.pinImage"),
        watch("defaultLocationInfo.pinUrl"),
        watch("defaultLocationInfo.startDate"),
        watch("defaultLocationInfo.endDate"),
        watch("defaultLocationInfo.collectionLimit"),
        watch("defaultLocationInfo.radius"),
        watch("defaultLocationInfo.autoCollect"),
        trigger,
    ])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Default Location Information</h2>
                <p className="text-sm text-muted-foreground">
                    This information will be used for all locations in your scavenger hunt.
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
                                                <Input
                                                    placeholder="Enter location title"
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e)
                                                        // Trigger validation after change
                                                        //setTimeout(() => trigger("defaultLocationInfo"), 100)
                                                    }}
                                                />
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
                                                            // Trigger validation after upload
                                                            //setTimeout(() => trigger("defaultLocationInfo"), 100)
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
                                                <Input
                                                    placeholder="https://example.com"
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e)
                                                        // Trigger validation after change
                                                        //setTimeout(() => trigger("defaultLocationInfo"), 100)
                                                    }}
                                                />
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
                                                        // Trigger validation after change
                                                        //setTimeout(() => trigger("defaultLocationInfo"), 100)
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
                                                        // Trigger validation after change
                                                        //setTimeout(() => trigger("defaultLocationInfo"), 100)
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

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <MapPin className="h-6 w-6 text-teal-500" />
                            <div className="w-full space-y-1">
                                <FormField
                                    control={control}
                                    name="defaultLocationInfo.autoCollect"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value === true}
                                                    onCheckedChange={(checked) => {
                                                        field.onChange(checked === true)
                                                        // Trigger validation after change
                                                        //setTimeout(() => trigger("defaultLocationInfo"), 100)
                                                    }}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>Auto Collect</FormLabel>
                                                <FormDescription>
                                                    When enabled, locations will be automatically collected when users enter the radius
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
interface DateRangeDialogProps {
    startDate: Date
    endDate: Date
    onDateChange: (startDate: Date, endDate: Date) => void
    className?: string
}

function DateRangeDialog({ startDate, endDate, onDateChange, className }: DateRangeDialogProps) {
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
                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", className)}>
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

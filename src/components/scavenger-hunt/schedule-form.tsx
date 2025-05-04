"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Calendar } from "~/components/shadcn/ui/calendar"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { cn } from "~/lib/utils"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"

// Helper to safely format dates
const safeFormat = (date: Date | undefined, formatStr: string): string => {
    if (!date) return ""
    try {
        return format(date, formatStr)
    } catch (error) {
        console.error("Date formatting error:", error)
        return ""
    }
}

export default function ScheduleForm() {
    const { control, setValue, getValues } = useFormContext<ScavengerHuntFormValues>()

    // Initialize date range from form values
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const startDate = getValues("startDate")
        const endDate = getValues("endDate")

        if (startDate) {
            return {
                from: startDate,
                to: endDate ?? undefined,
            }
        }
        return undefined
    })

    // Monitor form values for external changes
    useEffect(() => {
        const startDate = getValues("startDate");
        const endDate = getValues("endDate");

        const rangeFromTime = dateRange?.from?.getTime();
        const rangeToTime = dateRange?.to?.getTime();
        const startTime = startDate?.getTime();
        const endTime = endDate?.getTime();

        const hasChanged =
            startTime !== rangeFromTime ||
            (endDate && endTime !== rangeToTime);

        if (startDate && hasChanged) {
            setDateRange({
                from: startDate,
                to: endDate ?? undefined,
            });
        }
    }, [getValues, dateRange]);


    // Add state to control popover open/close
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    // Handle date range selection with more debugging
    const handleDateRangeSelect = (range: DateRange | undefined) => {
        console.log("Date selection triggered:", range)

        // Update the local state even if range is undefined
        setDateRange(range)

        // Update form values if we have a from date
        if (range?.from) {
            // Set start date immediately
            console.log("Setting start date:", range.from)
            setValue("startDate", range.from, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
            })

            // If range.to exists, it means both dates are selected
            if (range.to) {
                console.log("Setting end date:", range.to)
                setValue("endDate", range.to, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                })

                // Close the calendar after a short delay to ensure values are set
                setTimeout(() => {
                    setIsCalendarOpen(false)
                }, 100)
            }
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Schedule</h2>
                <p className="text-sm text-muted-foreground">Set the start and end dates for your scavenger hunt.</p>
            </div>

            <FormField
                control={control}
                name="startDate"
                render={({ field: startDateField }) => (
                    <FormField
                        control={control}
                        name="endDate"
                        render={({ field: endDateField }) => (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-start space-x-4">
                                        <Clock className="h-6 w-6 text-green-500" />
                                        <div className="w-full space-y-4">
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Date Range*</FormLabel>

                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn("w-full pl-3 text-left font-normal", !dateRange && "text-muted-foreground")}
                                                        onClick={() => setIsCalendarOpen(true)}
                                                    >
                                                        {dateRange?.from ? (
                                                            dateRange.to ? (
                                                                <>
                                                                    {safeFormat(dateRange.from, "LLL dd, y")} - {safeFormat(dateRange.to, "LLL dd, y")}
                                                                </>
                                                            ) : (
                                                                safeFormat(dateRange.from, "LLL dd, y")
                                                            )
                                                        ) : (
                                                            <span>Pick a date range</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>

                                                <Calendar
                                                    mode="range"
                                                    defaultMonth={dateRange?.from ?? new Date()}
                                                    selected={dateRange}
                                                    onSelect={(value) => {
                                                        console.log("Calendar onSelect called with:", value)
                                                        handleDateRangeSelect(value)
                                                    }}
                                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                                    numberOfMonths={2}
                                                    initialFocus
                                                />

                                                <FormDescription>Select the start and end dates for your scavenger hunt</FormDescription>
                                                <FormMessage />
                                            </FormItem>

                                            <div className="mt-2">
                                                {dateRange?.from && dateRange?.to && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Duration:{" "}
                                                        {Math.max(
                                                            1,
                                                            Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)),
                                                        )}{" "}
                                                        days
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    />
                )}
            />
        </div>
    )
}

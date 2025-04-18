"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { cn } from "~/lib/utils"

interface CalendarWidgetProps {
    editMode?: boolean
}

// Sample events
const EVENTS = [
    { date: "2025-04-15", title: "NFT Launch" },
    { date: "2025-04-18", title: "Livestream" },
    { date: "2025-04-22", title: "Collector Meeting" },
    { date: "2025-04-25", title: "Art Exhibition" },
]

export default function CalendarWidget({ editMode }: CalendarWidgetProps) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const getMonthData = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()

        // First day of the month
        const firstDay = new Date(year, month, 1)
        // Day of the week of the first day (0 = Sunday, 1 = Monday, etc.)
        const firstDayOfWeek = firstDay.getDay()
        // Number of days in the month
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        // Create calendar grid with appropriate offset for the first day
        const calendarDays = []

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarDays.push(null)
        }

        // Add actual days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            calendarDays.push(new Date(year, month, day))
        }

        return calendarDays
    }

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const formatDateString = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    }

    const days = getMonthData(currentDate)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    return (
        <div className="h-full p-2 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">Event Calendar</h3>
                <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToPreviousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-7 gap-1 auto-rows-fr text-center">
                {/* Day names */}
                {dayNames.map((day) => (
                    <div key={day} className="text-xs font-medium text-muted-foreground">
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {days.map((day, index) => {
                    if (!day) {
                        return <div key={`empty-${index}`} className="text-xs p-1" />
                    }

                    const dateString = formatDateString(day)
                    const hasEvent = EVENTS.some((event) => event.date === dateString)
                    const isToday = new Date().toDateString() === day.toDateString()

                    return (
                        <div
                            key={dateString}
                            className={cn(
                                "text-xs p-1 flex flex-col items-center rounded-md",
                                isToday && "bg-primary/10",
                                hasEvent && "font-medium",
                            )}
                        >
                            <span>{day.getDate()}</span>
                            {hasEvent && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />}
                        </div>
                    )
                })}
            </div>

            {/* Events list */}
            <div className="mt-2 space-y-1">
                <p className="text-xs font-medium">Upcoming Events:</p>
                {EVENTS.slice(0, 3).map((event) => (
                    <div key={event.title} className="flex items-center gap-2 text-xs">
                        <div className="w-1 h-1 rounded-full bg-primary"></div>
                        <span className="font-medium">{event.date.split("-")[2]}</span>
                        <span className="truncate">{event.title}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

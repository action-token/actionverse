"use client"

import { useState } from "react"
import { Calendar, MapPin, Clock, Ticket } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card } from "~/components/shadcn/ui/card"
import { cn } from "~/lib/utils"
import { Theme } from "~/types/organization/dashboard"

interface TourDatesWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample tour dates
const TOUR_DATES = [
    {
        id: "show-1",
        date: "2025-05-15",
        venue: "Cosmic Arena",
        city: "Los Angeles, CA",
        time: "8:00 PM",
        ticketUrl: "#",
        soldOut: false,
    },
    {
        id: "show-2",
        date: "2025-05-18",
        venue: "Digital Soundstage",
        city: "San Francisco, CA",
        time: "7:30 PM",
        ticketUrl: "#",
        soldOut: false,
    },
    {
        id: "show-3",
        date: "2025-05-22",
        venue: "Neon Club",
        city: "Portland, OR",
        time: "9:00 PM",
        ticketUrl: "#",
        soldOut: true,
    },
    {
        id: "show-4",
        date: "2025-05-25",
        venue: "Horizon Hall",
        city: "Seattle, WA",
        time: "8:00 PM",
        ticketUrl: "#",
        soldOut: false,
    },
    {
        id: "show-5",
        date: "2025-06-01",
        venue: "Dream Theater",
        city: "Vancouver, BC",
        time: "7:00 PM",
        ticketUrl: "#",
        soldOut: false,
    },
]

export default function TourDatesWidget({ editMode, theme }: TourDatesWidgetProps) {
    const [filter, setFilter] = useState<"all" | "upcoming">("upcoming")

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        })
    }

    // Filter shows
    const filteredShows = TOUR_DATES.filter((show) => {
        if (filter === "all") return true
        const showDate = new Date(show.date)
        const today = new Date()
        return showDate >= today
    })

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ fontFamily: theme?.font?.heading ?? "inherit" }}>
                    Tour Dates
                </h3>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={filter === "upcoming" ? "default" : "outline"}
                        onClick={() => setFilter("upcoming")}
                    >
                        Upcoming
                    </Button>
                    <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                        All Dates
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {filteredShows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-2 opacity-20" />
                        <p>No upcoming shows</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredShows.map((show) => (
                            <Card
                                key={show.id}
                                className={cn("p-3 flex flex-col sm:flex-row sm:items-center gap-3", show.soldOut && "opacity-70")}
                                style={{
                                    borderRadius: theme?.style?.borderRadius ? `${theme.style.borderRadius}px` : undefined,
                                    borderWidth: theme?.style?.borderWidth ? `${theme.style.borderWidth}px` : undefined,
                                }}
                            >
                                <div className="sm:w-24 text-center sm:border-r sm:pr-3">
                                    <div className="font-bold text-lg">{formatDate(show.date).split(" ")[1]}</div>
                                    <div className="text-sm text-muted-foreground">{formatDate(show.date).split(" ")[0]}</div>
                                </div>

                                <div className="flex-1">
                                    <div className="font-medium">{show.venue}</div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                                        <div className="flex items-center">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {show.city}
                                        </div>
                                        <div className="flex items-center">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {show.time}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    {show.soldOut ? (
                                        <Badge variant="outline" className="whitespace-nowrap">
                                            Sold Out
                                        </Badge>
                                    ) : (
                                        <Button size="sm" className="whitespace-nowrap" asChild>
                                            <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer">
                                                <Ticket className="h-3 w-3 mr-1" />
                                                Get Tickets
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

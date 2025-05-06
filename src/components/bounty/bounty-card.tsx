import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { MapPin, Calendar, Trophy, Users, Compass } from "lucide-react"
import { cn } from "~/lib/utils"
import { ImageWithFallback } from "../common/image-with-fallback"

export type BountyType = "regular" | "location" | "scavenger"

export interface BountyProps {
    id: string
    title: string
    description: string
    type: BountyType
    reward: string
    participants: number
    maxParticipants?: number
    location?: string
    deadline?: string
    image: string
    featured?: boolean
}

export function BountyCard({
    title,
    description,
    type,
    reward,
    participants,
    maxParticipants,
    location,
    deadline,
    image,
    featured = false,
}: BountyProps) {
    const getBountyTypeIcon = (type: BountyType) => {
        switch (type) {
            case "regular":
                return <Trophy className="h-4 w-4" />
            case "location":
                return <MapPin className="h-4 w-4" />
            case "scavenger":
                return <Compass className="h-4 w-4" />
        }
    }

    const getBountyTypeLabel = (type: BountyType) => {
        switch (type) {
            case "regular":
                return "Regular"
            case "location":
                return "Location-based"
            case "scavenger":
                return "Scavenger Hunt"
        }
    }

    const getBountyTypeColor = (type: BountyType) => {
        switch (type) {
            case "regular":
                return "bg-green-100 text-green-600"
            case "location":
                return "bg-blue-100 text-blue-600"
            case "scavenger":
                return "bg-yellow-100 text-yellow-600"
        }
    }

    return (
        <Card
            className={cn(
                "w-[300px] flex-shrink-0 overflow-hidden bg-white shadow-md snap-start",
                featured && "border-green-500",
            )}
        >
            <div className="relative h-40 w-full">
                <ImageWithFallback src={image || "/placeholder.svg"} alt={title} fill className="object-cover" />
                {featured && (
                    <div className="absolute right-2 top-2">
                        <Badge className="bg-green-600 text-white">Featured</Badge>
                    </div>
                )}
            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn("flex items-center gap-1", getBountyTypeColor(type))}>
                        {getBountyTypeIcon(type)}
                        {getBountyTypeLabel(type)}
                    </Badge>
                    <span className="text-sm font-bold text-green-600">{reward}</span>
                </div>
                <CardTitle className="mt-2 text-lg">{title}</CardTitle>
                <CardDescription className="line-clamp-2 text-gray-600">{description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-2 text-sm text-gray-600">
                    {location && (
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span>{location}</span>
                        </div>
                    )}
                    {deadline && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span>{deadline}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>
                            {participants} {maxParticipants ? `/ ${maxParticipants}` : ""} participants
                        </span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button className="w-full bg-green-600 hover:bg-green-700">Join Bounty</Button>
            </CardFooter>
        </Card>
    )
}

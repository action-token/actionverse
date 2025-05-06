import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Users, Trophy, MapPin } from "lucide-react"
import { ImageWithFallback } from "../common/image-with-fallback"

export interface OrganizationProps {
    id: string
    name: string
    description: string
    members: number
    activeBounties: number
    location: string
    logo: string
    featured?: boolean
}

export function OrganizationCard({
    name,
    description,
    members,
    activeBounties,
    location,
    logo,
    featured = false,
}: OrganizationProps) {
    return (
        <Card className="w-[300px] flex-shrink-0 overflow-hidden bg-white shadow-md snap-start">
            <div className="relative flex h-32 items-center justify-center bg-gradient-to-r from-gray-100 to-gray-200 p-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white">
                    <ImageWithFallback src={logo || "/placeholder.svg"} alt={name} fill className="object-cover" />
                </div>
                {featured && (
                    <div className="absolute right-2 top-2">
                        <Badge className="bg-green-600 text-white">Featured</Badge>
                    </div>
                )}
            </div>
            <CardHeader className="p-4 pb-0 text-center">
                <CardTitle className="text-xl">{name}</CardTitle>
                <CardDescription className="line-clamp-2 text-gray-600">{description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="flex justify-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>{members}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-gray-500" />
                        <span>{activeBounties}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{location}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button className="w-full bg-green-600 hover:bg-green-700">Join Organization</Button>
            </CardFooter>
        </Card>
    )
}

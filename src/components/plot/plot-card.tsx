import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { MapPin } from "lucide-react"
import { ImageWithFallback } from "../common/image-with-fallback"

export interface PlotProps {
    id: string
    title: string
    location: string
    price: string
    image: string
    size: string
    type: string
    featured?: boolean
}

export function PlotCard({ title, location, price, image, size, type, featured = false }: PlotProps) {
    return (
        <Card className="w-[300px] flex-shrink-0 overflow-hidden bg-white shadow-md snap-start">
            <div className="relative h-40 w-full">
                <ImageWithFallback src={image || "/placeholder.svg"} alt={title} fill className="object-cover" />
                {featured && (
                    <div className="absolute right-2 top-2">
                        <Badge className="bg-green-600 text-white">Featured</Badge>
                    </div>
                )}
                <div className="absolute bottom-2 right-2">
                    <Badge className="bg-white/90 text-gray-800">{size}</Badge>
                </div>
            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <Badge variant="outline" className="bg-green-100 text-green-600">
                        {type}
                    </Badge>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-600">
                    <MapPin className="mr-1 h-4 w-4" />
                    {location}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="text-xl font-bold text-green-600">{price}</div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button className="w-full bg-green-600 hover:bg-green-700">View Details</Button>
            </CardFooter>
        </Card>
    )
}

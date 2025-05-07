"use client"

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { MapPin } from 'lucide-react'
import { ImageWithFallback } from "../common/image-with-fallback"
import { Skeleton } from "../shadcn/ui/skeleton"

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
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-card shadow-md snap-start">
            <div className="relative h-40 w-full">
                <ImageWithFallback src={image || "/placeholder.svg"} alt={title} fill className="object-cover" />
                {featured && (
                    <div className="absolute right-2 top-2">
                        <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                    </div>
                )}
                <div className="absolute bottom-2 right-2">
                    <Badge className="bg-background/90 text-foreground">{size}</Badge>
                </div>
            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                        {type}
                    </Badge>
                </div>
                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-1 h-4 w-4" />
                    {location}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="text-xl font-bold text-primary">{price}</div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">View Details</Button>
            </CardFooter>
        </Card>
    )
}

export function PlotCardSkeleton() {
    return (
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-card shadow-md snap-start">
            {/* Image placeholder */}
            <div className="relative h-40 w-full">
                <Skeleton className="h-full w-full" />
            </div>
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" /> {/* Title */}
                    <Skeleton className="h-5 w-16" /> {/* Type badge */}
                </div>
                <div className="mt-2 flex items-center">
                    <Skeleton className="mr-1 h-4 w-4" /> {/* Icon */}
                    <Skeleton className="h-4 w-32" /> {/* Location */}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <Skeleton className="h-6 w-24" /> {/* Price */}
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Skeleton className="h-9 w-full" /> {/* Button */}
            </CardFooter>
        </Card>
    )
}


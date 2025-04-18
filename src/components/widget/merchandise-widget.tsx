"use client"

import Image from "next/image"
import { ShoppingCart, Tag } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardFooter } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface MerchandiseWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample merchandise items
const MERCH_ITEMS = [
    {
        id: "merch-1",
        name: "Album T-Shirt",
        price: 25,
        image: "/placeholder.svg?height=300&width=300",
        category: "Apparel",
        isNew: true,
        isSoldOut: false,
    },
    {
        id: "merch-2",
        name: "Signed Vinyl",
        price: 40,
        image: "/placeholder.svg?height=300&width=300",
        category: "Music",
        isNew: false,
        isSoldOut: false,
    },
    {
        id: "merch-3",
        name: "Tour Hoodie",
        price: 45,
        image: "/placeholder.svg?height=300&width=300",
        category: "Apparel",
        isNew: true,
        isSoldOut: false,
    },
    {
        id: "merch-4",
        name: "Limited Edition Poster",
        price: 20,
        image: "/placeholder.svg?height=300&width=300",
        category: "Collectibles",
        isNew: false,
        isSoldOut: true,
    },
]

export default function MerchandiseWidget({ editMode, theme }: MerchandiseWidgetProps) {
    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold"

                // style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Merchandise
                </h3>
                <Button size="sm" variant="outline" asChild>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                        View All
                    </a>
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {MERCH_ITEMS.map((item) => (
                        <Card
                            key={item.id}
                            className="overflow-hidden flex flex-col"
                        // style={{
                        //     borderRadius: theme?.style?.borderRadius ? `${theme.style.borderRadius}px` : undefined,
                        //     borderWidth: theme?.style?.borderWidth ? `${theme.style.borderWidth}px` : undefined,
                        // }}
                        >
                            <div className="relative aspect-square">
                                <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                                {item.isNew && <Badge className="absolute top-2 left-2 bg-primary">New</Badge>}
                                {item.isSoldOut && (
                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                        <Badge variant="outline" className="text-lg">
                                            Sold Out
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-3 flex-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                    <Tag className="h-3 w-3" />
                                    {item.category}
                                </div>
                                <h4 className="font-medium line-clamp-1">{item.name}</h4>
                                <p className="font-bold mt-1">${item.price}</p>
                            </CardContent>
                            <CardFooter className="p-3 pt-0">
                                <Button className="w-full" size="sm" disabled={item.isSoldOut}>
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    {item.isSoldOut ? "Sold Out" : "Add to Cart"}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}

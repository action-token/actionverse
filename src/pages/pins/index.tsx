"use client"

import type { Location, LocationConsumer, LocationGroup } from "@prisma/client"
import { formatDate } from "date-fns"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { api } from "~/utils/api"
import { CheckCircle2, Gift, Loader2, Calendar, Navigation } from "lucide-react"
import { motion } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { useState } from "react"
import ClaimPinModal from "~/components/modal/claim-pin-modal"

export default function Page() {
    return (
        <div className="min-h-screen bg-background">
            <div className="border-b bg-gradient-to-r from-primary/5 via-accent/5 to-transparent">
                <div className="container mx-auto px-4 py-8">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="rounded-xl bg-primary/10 p-3">
                                <Gift className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-4xl font-bold text-foreground">My Pins</h1>
                        </div>
                        <p className="text-muted-foreground text-lg">View and claim your collected location pins</p>
                    </motion.div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <ConsumedPins />
            </div>
        </div>
    )
}

function ConsumedPins() {
    const consumedPins = api.maps.pin.getAUserConsumedPin.useQuery()

    if (consumedPins.isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (consumedPins.isError) {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6">
                    <p className="text-center text-destructive">Failed to load pins. Please try again later.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
            {consumedPins.data.map((pin, id) => (
                <ClaimConsumedPin key={id} pin={pin} location={pin.location} index={id} />
            ))}
        </motion.div>
    )
}

function ClaimConsumedPin({
    pin,
    location,
    index,
}: {
    pin: LocationConsumer
    location: Location & {
        locationGroup: LocationGroup | null
    }
    index: number
}) {
    const [isModalOpen, setIsModalOpen] = useState(false)

    if (!location.locationGroup) return null

    const isApproved = location.locationGroup.approved
    const isClaimed = pin.claimedAt
    const isClaimable = location.locationGroup.assetId ?? location.locationGroup.pageAsset

    return (
        <>
            <ClaimPinModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                location={location}
                locationConsumer={pin}
            />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
            >
                <Card className="group overflow-hidden border-border/50 bg-card hover:shadow-lg transition-all duration-300 hover:border-primary/30">
                    <CardHeader className="pb-4">
                        <div className="flex items-start gap-4">
                            <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-secondary ring-2 ring-border/50">
                                <Image
                                    height={64}
                                    width={64}
                                    className="h-full w-full object-cover"
                                    src={location.locationGroup.image ?? "/images/icons/wadzzo.svg"}
                                    alt={location.locationGroup.title}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg text-balance leading-tight mb-2">
                                    {formatTitle(location.locationGroup.title)}
                                </CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    {isApproved ? (
                                        <Badge className="bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">
                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                            Approved
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="border-primary/20">
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                            Pending
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Closes: {formatDate(new Date(location.locationGroup.endDate), "MMM dd, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Navigation className="h-4 w-4" />
                            <span className="truncate">
                                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </span>
                        </div>
                    </CardContent>

                    <CardFooter className="pt-4 border-t bg-secondary/30">
                        <ClaimButton />
                    </CardFooter>
                </Card>
            </motion.div>
        </>
    )

    function ClaimButton() {
        if (!location.locationGroup) return null

        if (isClaimed) {
            return (
                <Button variant="outline" className="w-full bg-transparent" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-accent" />
                    Claimed
                </Button>
            )
        } else if (isClaimable) {
            return (
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all group-hover:scale-[1.02]"
                >
                    <Gift className="mr-2 h-4 w-4" />
                    Claim Reward
                </Button>
            )
        } else {
            return (
                <Badge variant="outline" className="w-full justify-center py-2 border-muted-foreground/30">
                    Not Claimable
                </Badge>
            )
        }
    }
}

function formatTitle(title: string) {
    return title.length > 30 ? title.slice(0, 30) + "..." : title
}

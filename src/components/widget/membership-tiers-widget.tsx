"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronUp, Star, Music, Users, Plus, ImageIcon, CheckCircle2 } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { cn } from "~/lib/utils"
import { api } from "~/utils/api"
import { Creator, CreatorPageAsset } from "@prisma/client"
import { Skeleton } from "../shadcn/ui/skeleton"
import { SubscriptionContextMenu } from "../common/subscripton-context"
import { useAddSubsciptionModalStore } from "../store/add-subscription-modal-store"
import { CreatorWithPageAsset, Theme } from "~/types/organization/dashboard"



interface MembershipTiersWidgetProps {
    editMode?: boolean
    theme?: Theme
    creatorData: CreatorWithPageAsset
}
function SubscriptionPackagesSkeleton() {
    // Create an array of 3 items to represent the loading cards
    const skeletonCards = Array(3).fill(null)

    return (
        <>
            {skeletonCards.map((_, index) => (
                <div key={index}>
                    <Card className="relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200">
                        <div className="h-2 bg-muted" />
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="w-full">
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <div className="flex items-baseline mt-2">
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="h-4 w-12 ml-1" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-4 pb-2">
                            <div className="space-y-2">
                                {Array(4)
                                    .fill(null)
                                    .map((_, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    ))}
                            </div>
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center justify-between w-full">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            ))}
        </>
    )
}




export default function MembershipTiersWidget({ editMode, theme, creatorData }: MembershipTiersWidgetProps) {
    const subscriptionPackages = api.fan.creator.getCreatorPackages.useQuery()
    const { openForCreate, openForEdit } = useAddSubsciptionModalStore()
    const [expandedPackage, setExpandedPackage] = useState<number | null>(null)
    const togglePackageExpansion = (id: number) => {
        if (expandedPackage === id) {
            setExpandedPackage(null)
        } else {
            setExpandedPackage(id)
        }
    }
    console.log("creatorcustomPage", creatorData)



    return (
        <div className="mb-8">
            {
                subscriptionPackages.data && subscriptionPackages.data?.length > 0 && (
                    <div className="flex items-center justify-between p-2">
                        <h2 className="text-xl font-bold">Subscription Packages</h2>
                        <Button size="sm" onClick={() => openForCreate({
                            customPageAsset: creatorData?.customPageAssetCodeIssuer,
                            pageAsset: creatorData.pageAsset,
                        })}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Package
                        </Button>
                    </div>
                )
            }
            {
                subscriptionPackages.data?.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Subscription Packages Found</h3>
                        <p className="text-muted-foreground mb-4">Start creating subscription packages for your followers</p>
                        <Button onClick={() => openForCreate({
                            customPageAsset: creatorData?.customPageAssetCodeIssuer,
                            pageAsset: creatorData.pageAsset,
                        })}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Package
                        </Button>
                    </div>
                )
            }
            <div className="grid grid-cols-1 px-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-center justify-center w-full">
                {subscriptionPackages.isLoading && <SubscriptionPackagesSkeleton />}

                {subscriptionPackages.data?.map((pkg) => (
                    <Card
                        key={pkg.id}
                        className={cn(
                            "relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200",
                            pkg.popular ? "border-primary" : "border-border",
                            !pkg.isActive && "opacity-60",
                            expandedPackage === pkg.id && "ring-2 ring-primary",
                        )}
                    >
                        <div className={cn("h-2", pkg.color)} />
                        <CardHeader className="pb-2 w-full">
                            <div className="flex justify-between w-full">
                                <div className="flex flex-col w-full">
                                    <CardTitle className="w-full">
                                        <div className="flex items-center gap-2 justify-between  w-full">
                                            <span>  {pkg.name}</span>
                                            <SubscriptionContextMenu
                                                creatorId={pkg.creatorId}
                                                subscription={pkg}
                                                pageAsset={creatorData?.pageAsset}
                                                customPageAsset={creatorData?.customPageAssetCodeIssuer}

                                            />
                                        </div>

                                    </CardTitle>
                                    <div className="flex items-baseline mt-2">
                                        <span className="text-3xl font-bold">{pkg.price}</span>
                                        <span className="text-muted-foreground ml-1">
                                            {creatorData.pageAsset
                                                ? creatorData.pageAsset.code
                                                : creatorData.customPageAssetCodeIssuer?.split("-")[0]}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {pkg.popular && (
                                <div className="absolute top-0 right-0">
                                    <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        POPULAR
                                    </div>
                                </div>
                            )}
                            <CardDescription className="mt-2">{pkg.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-2">
                            <ul className="space-y-2">
                                {pkg.features
                                    .slice(0, expandedPackage === pkg.id ? pkg.features.length : 3)
                                    .map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                            </ul>

                            {pkg.features.length > 3 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => togglePackageExpansion(pkg.id)}
                                >
                                    {expandedPackage === pkg.id ? (
                                        <>
                                            <ChevronUp className="h-4 w-4 mr-1" />
                                            Show Less
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-4 w-4 mr-1" />
                                            Show All Features
                                        </>
                                    )}
                                </Button>
                            )}
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center justify-between w-full">
                                <Badge variant={pkg.isActive ? "default" : "outline"}>
                                    {pkg.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}

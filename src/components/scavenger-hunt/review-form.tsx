"use client"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { format } from "date-fns"
import { MapPin, DollarSign, Coins } from "lucide-react"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { Separator } from "~/components/shadcn/ui/separator"
import { useFormContext } from "react-hook-form"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"

export default function ReviewForm() {
    const { getValues } = useFormContext<ScavengerHuntFormValues>()
    const formData = getValues()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Review Your Scavenger Hunt</h2>
                <p className="text-sm text-muted-foreground">
                    Please review all the details of your scavenger hunt before creating it.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{formData.title ?? "Untitled Scavenger Hunt"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium">Description</h4>
                        <p className="text-sm">{formData.description ?? "No description provided."}</p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-medium">Cover Image</h4>
                        <div className="h-32 w-full overflow-hidden rounded-md border">
                            {formData?.coverImageUrl ? (
                                <img
                                    src={formData.coverImageUrl[0]?.url ?? "/images/action/logo.png"}
                                    alt="Cover"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted">
                                    <p className="text-sm text-muted-foreground">No image</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h4 className="font-medium">Configuration</h4>
                        <ul className="mt-2 space-y-1 text-sm">
                            <li>
                                <span className="font-medium">Number of Steps:</span> {formData.numberOfSteps}
                            </li>
                            <li>
                                <span className="font-medium">Using Same Info for All Steps:</span>{" "}
                                {formData.useSameInfoForAllSteps ? "Yes" : "No"}
                            </li>
                        </ul>
                    </div>

                    {formData.useSameInfoForAllSteps && formData.defaultLocationInfo && (
                        <>
                            <Separator />
                            <div>
                                <h4 className="font-medium">Default Location Information</h4>
                                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <ul className="space-y-1 text-sm">
                                            <li>
                                                <span className="font-medium">Title:</span> {formData.defaultLocationInfo.title}
                                            </li>
                                            <li>
                                                <span className="font-medium">Description:</span> {formData.defaultLocationInfo.description}
                                            </li>
                                            <li>
                                                <span className="font-medium">Collection Limit:</span>{" "}
                                                {formData.defaultLocationInfo.collectionLimit}
                                            </li>
                                            <li>
                                                <span className="font-medium">Radius:</span> {formData.defaultLocationInfo.radius}m
                                            </li>
                                            <li>
                                                <span className="font-medium">Auto Collect:</span>{" "}
                                                {formData.defaultLocationInfo.autoCollect ? "Yes" : "No"}
                                            </li>
                                            <li>
                                                <span className="font-medium">Date Range:</span>{" "}
                                                {format(formData.defaultLocationInfo.startDate, "PPP")} -{" "}
                                                {format(formData.defaultLocationInfo.endDate, "PPP")}
                                            </li>
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium">Pin Image:</span>
                                        <div className="mt-2 h-32 w-full overflow-hidden rounded-md border">
                                            {formData.defaultLocationInfo.pinImage ? (
                                                <img
                                                    src={formData.defaultLocationInfo.pinImage ?? "/images/action/logo.png"}
                                                    alt="Pin"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-muted">
                                                    <p className="text-sm text-muted-foreground">No image</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    <div>
                        <h4 className="font-medium">Prize Details</h4>
                        <ul className="mt-2 space-y-1 text-sm">
                            <li>
                                <span className="font-medium">Number of Winners:</span> {formData.winners}
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="font-medium">Reward Type:</span>
                                {formData.rewardType === "usdc" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                                        <DollarSign className="h-3 w-3" />
                                        USDC
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                                        <Coins className="h-3 w-3" />
                                        {PLATFORM_ASSET.code.toUpperCase()}
                                    </span>
                                )}
                            </li>
                            <li>
                                <span className="font-medium">Total Prize:</span>{" "}
                                {formData.rewardType === "usdc" ? (
                                    <span className="text-green-600 font-semibold">${(formData.usdcAmount ?? 0).toFixed(2)} USDC</span>
                                ) : (
                                    <span className="text-blue-600 font-semibold">
                                        {(formData.platformAssetAmount ?? 0).toFixed(5)} {PLATFORM_ASSET.code.toUpperCase()}
                                    </span>
                                )}
                            </li>
                            {(formData.winners ?? 1) > 1 && (
                                <li>
                                    <span className="font-medium">Prize Per Winner:</span>{" "}
                                    {formData.rewardType === "usdc" ? (
                                        <span className="text-green-600">
                                            ${((formData.usdcAmount ?? 0) / (formData.winners ?? 1)).toFixed(2)} USDC
                                        </span>
                                    ) : (
                                        <span className="text-blue-600">
                                            {((formData.platformAssetAmount ?? 0) / (formData.winners ?? 1)).toFixed(5)}{" "}
                                            {PLATFORM_ASSET.code.toUpperCase()}
                                        </span>
                                    )}
                                </li>
                            )}
                            <li>
                                <span className="font-medium">Required Balance:</span> {formData.requiredBalance}
                            </li>
                        </ul>
                    </div>

                    <Separator />

                    <div>
                        <h4 className="font-medium">
                            Locations ({formData.locations.length}/{formData.numberOfSteps})
                        </h4>
                        {formData.locations.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">No locations added to this scavenger hunt.</p>
                        ) : (
                            <ScrollArea className="h-[200px] mt-2">
                                <div className="space-y-3">
                                    {formData.locations.map((location, index) => (
                                        <div key={location.id} className="flex items-start space-x-3 rounded-md border p-3">
                                            <MapPin className="h-5 w-5 text-red-500 mt-0.5" />
                                            <div className="space-y-1">
                                                <h5 className="font-medium">
                                                    {formData.useSameInfoForAllSteps
                                                        ? `${formData.defaultLocationInfo?.title ?? "Location"} ${index + 1}`
                                                        : (location.title ?? "Unnamed Location")}
                                                </h5>
                                                <p className="text-xs text-muted-foreground">
                                                    Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                                </p>
                                                {!formData.useSameInfoForAllSteps && location.collectionLimit && location.radius && (
                                                    <p className="text-xs">
                                                        Collection Limit: {location.collectionLimit} | Radius: {location.radius}m
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

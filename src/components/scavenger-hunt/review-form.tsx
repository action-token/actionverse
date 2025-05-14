"use client"


import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { format } from "date-fns"
import { ImageIcon, MapPin } from "lucide-react"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { Separator } from "~/components/shadcn/ui/separator"
import { useFormContext } from "react-hook-form"
import { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"

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
                            <li>
                                <span className="font-medium">Total Prize in USD:</span> ${formData.priceUSD}
                            </li>
                            <li>
                                <span className="font-medium">Total Prize in Action:</span> {formData.priceBandcoin}
                            </li>
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
                                                        : location.title ?? "Unnamed Location"}
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

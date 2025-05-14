"use client"

import { useFormContext } from "react-hook-form"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Trophy, Coins, ShieldCheck } from "lucide-react"
import { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"

export default function PrizeDetailsForm() {
    const { control } = useFormContext<ScavengerHuntFormValues>()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Prize Details</h2>
                <p className="text-sm text-muted-foreground">Configure the prizes and requirements for your scavenger hunt.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Trophy className="h-6 w-6 text-amber-500" />
                            <div className="space-y-1">
                                <FormField
                                    control={control}
                                    name="winners"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of Winners*</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="1" {...field} />
                                            </FormControl>
                                            <FormDescription>How many participants can win prizes</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <ShieldCheck className="h-6 w-6 text-emerald-500" />
                            <div className="space-y-1">
                                <FormField
                                    control={control}
                                    name="requiredBalance"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Required Balance to Join*</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="0" step="0.01" {...field} />
                                            </FormControl>
                                            <FormDescription>Minimum balance required to participate</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Coins className="h-6 w-6 text-green-500" />
                            <div className="space-y-1">
                                <FormField
                                    control={control}
                                    name="priceUSD"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Total Prize in USD*</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="0" step="0.01" {...field} />
                                            </FormControl>
                                            <FormDescription>USD value of the prize</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Coins className="h-6 w-6 text-blue-500" />
                            <div className="space-y-1">
                                <FormField
                                    control={control}
                                    name="priceBandcoin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Total Prize in Action*</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="0" step="0.01" {...field} />
                                            </FormControl>
                                            <FormDescription>Action value of the prize</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

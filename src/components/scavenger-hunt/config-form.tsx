"use client"

import { useFormContext } from "react-hook-form"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Input } from "~/components/shadcn/ui/input"
import { Checkbox } from "~/components/shadcn/ui/checkbox"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Settings, Layers } from "lucide-react"
import { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"

export default function ConfigForm() {
    const { control } = useFormContext<ScavengerHuntFormValues>()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Configuration</h2>
                <p className="text-sm text-muted-foreground">
                    Configure how many steps your scavenger hunt will have and how to manage location information.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                            <Layers className="h-6 w-6 text-blue-500" />
                            <div className="space-y-1 w-full">
                                <FormField
                                    control={control}
                                    name="numberOfSteps"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of Steps*</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="1" {...field} />
                                            </FormControl>
                                            <FormDescription>How many locations/steps will be in your scavenger hunt</FormDescription>
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
                            <Settings className="h-6 w-6 text-green-500" />
                            <div className="space-y-1 w-full">
                                <FormField
                                    control={control}
                                    name="useSameInfoForAllSteps"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>Use same information for all steps</FormLabel>
                                                <FormDescription>
                                                    When enabled, all locations will share the same details (except coordinates). You{"'ll"} only need
                                                    to enter location information once.
                                                </FormDescription>
                                            </div>
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

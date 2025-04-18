"use client"

import { useState } from "react"
import { api } from "~/utils/api"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { type SubmitHandler, useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { addrShort } from "~/utils/utils"
import { Dialog, DialogContent, DialogTrigger } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"

export const PlaceMarketFormSchema = z.object({
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: z.string().min(56, { message: "Invalid issuer" }),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative(),
    priceUSD: z
        .number({
            required_error: "Price in USD must be a number",
            invalid_type_error: "Price in USD must be a number",
        })
        .nonnegative(),
})

export type PlaceMarketFormType = z.TypeOf<typeof PlaceMarketFormSchema>

export default function EnableInMarket({
    item,
    copy,
}: {
    item: { code: string; issuer: string; name: string }
    copy: number
}) {
    const [isOpen, setIsOpen] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<z.infer<typeof PlaceMarketFormSchema>>({
        resolver: zodResolver(PlaceMarketFormSchema),
        defaultValues: { code: item.code, issuer: item.issuer },
    })

    function resetState() {
        reset()
    }

    const enable = api.marketplace.market.placeToMarketDB.useMutation({
        onSuccess: () => {
            toast.success("Placed in market")
            setIsOpen(false)
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof PlaceMarketFormSchema>> = (data) => {
        enable.mutate(data)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="w-full my-2">
                    Place to market
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <div className="grid gap-4 py-4">
                    <h3 className="text-lg font-semibold">Enable in market</h3>

                    <Card>
                        <CardContent className="pt-6">
                            <p className="mb-2">Asset Name: {item.name}</p>
                            <p className="mb-2">
                                Asset Code: <Badge variant="secondary">{item.code}</Badge>
                            </p>
                            <p className="text-sm text-muted-foreground">Issuer: {addrShort(item.issuer, 15)}</p>
                        </CardContent>
                    </Card>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">Price ({PLATFORM_ASSET.code})</Label>
                            <Input id="price" type="number" {...register("price", { valueAsNumber: true })} min={0} required />
                            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="priceUSD">Price in USD</Label>
                            <Input id="priceUSD" type="number" {...register("priceUSD", { valueAsNumber: true })} min={0} required />
                            {errors.priceUSD && <p className="text-sm text-destructive">{errors.priceUSD.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={enable.isLoading || enable.isSuccess}>
                            {enable.isLoading ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Enabling...
                                </>
                            ) : (
                                "Enable to Market"
                            )}
                        </Button>
                    </form>

                    <Button
                        variant="outline"
                        onClick={() => {
                            resetState()
                            setIsOpen(false)
                        }}
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}


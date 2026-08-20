"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/router"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { type ChangeEvent, useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { z } from "zod"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { api } from "~/utils/api"
import { BADWORDS } from "~/utils/banned-word"

export const SellPageAssetSchema = z.object({
    title: z
        .string()
        .refine(
            (value) => {
                return !BADWORDS.some((word) => value.toLowerCase().includes(word.toLowerCase()))
            },
            {
                message: "Title contains banned words.",
            },
        )
        .optional(),
    description: z.string().optional(),
    amountToSell: z
        .number({
            required_error: "Amount to sell must be entered as a number",
            invalid_type_error: "Amount to sell must be entered as a number",
        })
        .int({ message: "Amount must be a whole number" })
        .positive({ message: "Amount must be greater than 0" }),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .positive({ message: "Price must be greater than 0" }),
    priceUSD: z
        .number({
            required_error: "USD price must be entered as a number",
            invalid_type_error: "USD price must be entered as a number",
        })
        .positive({ message: "USD price must be greater than 0" })
        .default(1),
    priceXLM: z
        .number({
            required_error: "XLM price must be entered as a number",
            invalid_type_error: "XLM price must be entered as a number",
        })
        .nonnegative({ message: "XLM price cannot be negative" })
        .default(0),
})

type SellPageAssetFormData = z.infer<typeof SellPageAssetSchema>

/**
 * Full page for listing a page asset for sale — replaces the old
 * `SellPageAssetModal` dialog. Living under `/organization/*` so it
 * automatically inherits `CreatorLayout` via `RootLayout`'s route-prefix
 * check, matching the other create pages (smart-contract NFT, classic
 * NFT, non-stellar item). Single flat form — the original dialog had no
 * steps — laid out as two columns (asset + pricing) instead of one long
 * column.
 */
export default function CreateSellPageAssetPage() {
    const router = useRouter()
    const session = useSession()
    const [submitLoading, setSubmitLoading] = useState(false)
    const [pageAsset, setPageAsset] = useState<string | null>(null)

    const validateAmountToSell = (value: number) => {
        const availableBalance = pageAsset ? Number.parseInt(pageAsset) : 0
        if (value > availableBalance) {
            return "Amount exceeds available balance"
        }
        return true
    }

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isValid },
        setValue,
        watch,
    } = useForm<SellPageAssetFormData>({
        resolver: zodResolver(SellPageAssetSchema),
        mode: "onChange",
        defaultValues: {
            title: "",
            priceUSD: 1,
            priceXLM: 0,
        },
    })

    const pageAssetBalance = api.wallate.acc.getCreatorPageAssetBallances.useQuery(undefined, {
        onSuccess: (data) => {
            if (data) {
                setPageAsset(data.balance)
            }
        },
        onError: (error) => {
            console.log(error)
        },
        refetchOnWindowFocus: false,
    })

    const watchedAmountToSell = watch("amountToSell")
    const watchedPrice = watch("price")

    const createSellPageAsset = api.fan.asset.sellPageAsset.useMutation({
        onSuccess: () => {
            toast.success("Sell Page Asset Created Successfully", {
                position: "top-center",
                duration: 4000,
            })
            reset()
            void router.push("/organization/store")
        },
        onError: (error) => {
            toast.error(`Failed to create asset: ${error.message}`)
        },
        onSettled: () => {
            setSubmitLoading(false)
        },
    })

    const calculateRemaining = () => {
        const availableBalance = pageAsset ? Number.parseInt(pageAsset) : 0
        const amountToSell = watchedAmountToSell ?? 0
        return Math.max(0, availableBalance - amountToSell)
    }

    const availableBalance = pageAsset ? Number.parseInt(pageAsset) : 0

    const onSubmit = (data: SellPageAssetFormData) => {
        if (!session.data?.user?.id) {
            toast.error("You must be logged in to create an asset")
            return
        }

        setSubmitLoading(true)

        const assetCode = `${data.amountToSell} ${pageAssetBalance.data?.code}` || "Unknown Asset"

        const modifiedData = {
            ...data,
            title: assetCode,
        }

        createSellPageAsset.mutate(modifiedData)
    }

    const handlePriceChange = (value: number) => {
        setValue("price", value)
        const usdValue = value * 0.5
        setValue("priceUSD", Number(usdValue.toFixed(2)))
    }

    return (
        <div className="mx-auto max-w-6xl p-4 md:p-6">
            <Link
                href="/organization/store"
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" />
                Back to store
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Sell Page Asset</h1>
                <p className="text-sm text-muted-foreground">
                    List some of your page asset balance for sale on the marketplace.
                </p>
            </div>

            {pageAssetBalance.isLoading && (
                <div className="mb-6 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                    Loading your asset balance...
                </div>
            )}
            {pageAssetBalance.isError && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
                    Failed to load asset balance. Please refresh and try again.
                </div>
            )}
            {availableBalance === 0 && !pageAssetBalance.isLoading && (
                <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-sm text-yellow-700">
                    You don{"'"}t have any page assets available to sell.
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Left column — Asset */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Asset</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        {...register("description")}
                                        placeholder="Enter asset description (optional)"
                                        rows={3}
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-destructive">{errors.description.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amountToSell">
                                        Amount to Sell {pageAssetBalance.data?.code} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="amountToSell"
                                        type="number"
                                        min="1"
                                        max={availableBalance}
                                        step="1"
                                        {...register("amountToSell", {
                                            valueAsNumber: true,
                                            validate: validateAmountToSell,
                                        })}
                                        placeholder="Enter quantity to sell"
                                    />

                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            Available: <span className="font-medium text-foreground">{availableBalance}</span>
                                        </span>
                                        {watchedAmountToSell > 0 && (
                                            <span className="text-muted-foreground">
                                                Remaining:{" "}
                                                <span
                                                    className={`font-medium ${calculateRemaining() === 0 ? "text-orange-500" : "text-green-600"}`}
                                                >
                                                    {calculateRemaining()}
                                                </span>
                                            </span>
                                        )}
                                    </div>

                                    {errors.amountToSell && (
                                        <p className="text-sm text-destructive">{errors.amountToSell.message}</p>
                                    )}

                                    {availableBalance > 0 && (
                                        <div className="mt-2 flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setValue("amountToSell", Math.floor(availableBalance * 0.25))}
                                                className="text-xs"
                                            >
                                                25%
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setValue("amountToSell", Math.floor(availableBalance * 0.5))}
                                                className="text-xs"
                                            >
                                                50%
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setValue("amountToSell", Math.floor(availableBalance * 0.75))}
                                                className="text-xs"
                                            >
                                                75%
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setValue("amountToSell", availableBalance)}
                                                className="text-xs"
                                            >
                                                Max
                                            </Button>
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        How many units of this asset do you want to sell?
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right column — Pricing */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Pricing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">
                                            {PLATFORM_ASSET.code} Price <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            {...register("price", {
                                                valueAsNumber: true,
                                                onChange: (e: ChangeEvent<HTMLInputElement>) => handlePriceChange(Number(e.target.value)),
                                            })}
                                            placeholder="0.00"
                                        />
                                        {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="priceXLM">Price in XLM</Label>
                                        <Input
                                            id="priceXLM"
                                            type="number"
                                            step="0.0000001"
                                            {...register("priceXLM", { valueAsNumber: true })}
                                            placeholder="0.00"
                                        />
                                        {errors.priceXLM && <p className="text-sm text-destructive">{errors.priceXLM.message}</p>}
                                    </div>
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    <p>• Platform Price: Main pricing in your platform currency</p>
                                    <p>• XLM Price: Optional price in Stellar Lumens (0 = not available in XLM)</p>
                                </div>

                                {watchedPrice > 0 && (
                                    <div className="rounded-lg border bg-muted/40 p-4">
                                        <p className="mb-2 text-sm font-semibold">Preview</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-1">
                                                <p>
                                                    <strong>Available:</strong> {availableBalance} units
                                                </p>
                                                <p>
                                                    <strong>Selling:</strong> {watchedAmountToSell ?? 0} units
                                                </p>
                                                <p className={calculateRemaining() === 0 ? "text-orange-500" : "text-green-600"}>
                                                    <strong>Remaining:</strong> {calculateRemaining()} units
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p>
                                                    <strong>Price/Unit:</strong> {watchedPrice ?? 0}
                                                </p>
                                                <p>
                                                    <strong>XLM/Unit:</strong> {watch("priceXLM") ?? 0} XLM
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>

            <div className="mt-6 flex justify-end border-t pt-6">
                <Button
                    type="button"
                    size="lg"
                    disabled={!isValid || submitLoading}
                    onClick={handleSubmit(onSubmit)}
                >
                    {submitLoading ? "Creating..." : "Create Sell Page Asset"}
                </Button>
            </div>
        </div>
    )
}

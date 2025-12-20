"use client"

import { Button } from "~/components/shadcn/ui/button"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { motion } from "framer-motion"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "~/components/shadcn/ui/form"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { Trophy, Coins, Users, DollarSign, Loader2 } from "lucide-react"
import type { ScavengerHuntFormValues } from "../modal/scavenger-hunt-modal"
import { Label } from "../shadcn/ui/label"
import { api } from "~/utils/api"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { useSession } from "next-auth/react"
import { clientsign } from "package/connect_wallet"
import { clientSelect } from "~/lib/stellar/fan/utils"
import toast from "react-hot-toast"
import useNeedSign from "~/lib/hook"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select"
import { Badge } from "../shadcn/ui/badge"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { USDC_ASSET_CODE, USDC_ISSUER } from "~/lib/usdc"
import { cn } from "~/lib/utils"

enum assetType {
    PAGEASSET = "PAGEASSET",
    PLATFORMASSET = "PLATFORMASSET",
    SHOPASSET = "SHOPASSET",
}

type selectedAssetType = {
    assetCode: string
    assetIssuer: string
    balance: number
    assetType: assetType
}

export default function PrizeDetailsForm() {
    const {
        control,
        setValue,
        register,
        watch,
        getValues,
        formState: { errors },
    } = useFormContext<ScavengerHuntFormValues>()
    const pageAssetbal = api.fan.creator.getCreatorPageAssetBalance.useQuery()
    const shopAssetbal = api.fan.creator.getCreatorShopAssetBalance.useQuery()
    const { platformAssetBalance } = useUserStellarAcc()
    const [selectedAsset, setSelectedAsset] = useState<selectedAssetType | null>(null)
    const [trustLoading, setTrustLoading] = useState(false)
    const session = useSession()
    const { needSign } = useNeedSign()
    const apiUtils = api.useUtils() // Moved to top level

    const rewardType = watch("rewardType")
    const usdcAmount = watch("usdcAmount")
    const platformAssetAmount = watch("platformAssetAmount")
    const totalWinner = watch("winners")

    console.log("rewardType, platformAssetAmount, usdcAmount", rewardType, platformAssetAmount, usdcAmount)

    const CheckUSDCTrustLine = api.bounty.Bounty.checkUSDCTrustLine.useQuery(undefined, {
        enabled: session.status === "authenticated" && rewardType === "usdc",
    })

    const AddTrustMutation = api.walletBalance.wallBalance.addTrustLine.useMutation({
        onSuccess: async (data) => {
            try {
                const clientResponse = await clientsign({
                    walletType: session?.data?.user?.walletType,
                    presignedxdr: data.xdr,
                    pubkey: data.pubKey,
                    test: clientSelect(),
                })

                if (clientResponse) {
                    toast.success("Added USDC trustline successfully")
                    try {
                        await apiUtils.walletBalance.wallBalance.getWalletsBalance.refetch()
                        await CheckUSDCTrustLine.refetch()
                    } catch (refetchError) {
                        console.log("Error refetching balance", refetchError)
                    }
                } else {
                    toast.error("No Data Found at TrustLine Operation")
                }
            } catch (error) {
                if (error instanceof Error) {
                    toast.error(`Error: ${error.message}`)
                } else {
                    toast.error("An unknown error occurred.")
                }
                console.log("Error", error)
            } finally {
                setTrustLoading(false)
            }
        },
        onError: (error) => {
            setTrustLoading(false)
            toast.error(error.message)
        },
    })

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Prize Details</h2>
                <p className="text-sm text-muted-foreground">Configure the prizes and requirements for your scavenger hunt.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-6">
                    {/* Winners Card */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-start space-x-4">
                                <Trophy className="h-6 w-6 text-amber-500" />
                                <div className="space-y-1 flex-1">
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

                    <Card className="border-0 shadow-sm bg-gradient-to-br from-accent/20 to-accent/20">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                                    <DollarSign className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Prize Rewards</h3>
                                    <p className="text-sm text-muted-foreground">Choose reward type and configure amounts</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Reward Type Toggle */}
                            <div className="space-y-3">
                                <div className="inline-flex rounded-lg border p-1 bg-muted/30">
                                    <button
                                        type="button"
                                        onClick={() => setValue("rewardType", "usdc")}
                                        className={cn(
                                            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                                            rewardType === "usdc"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        <DollarSign className="h-4 w-4" />
                                        USDC
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValue("rewardType", "platform_asset")}
                                        className={cn(
                                            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                                            rewardType === "platform_asset"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        <Coins className="h-4 w-4" />
                                        {PLATFORM_ASSET.code.toUpperCase()}
                                    </button>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    {rewardType === "usdc" ? "USDC Amount" : `${PLATFORM_ASSET.code.toUpperCase()} Amount`}
                                </Label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        {rewardType === "usdc" ? (
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Coins className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    {rewardType === "usdc" ? (
                                        <Input
                                            type="number"
                                            step={0.01}
                                            min={0.01}
                                            {...register("usdcAmount", { valueAsNumber: true })}
                                            className="pl-10"
                                            placeholder="0.00"
                                        />
                                    ) : (
                                        <Input
                                            type="number"
                                            step={0.00001}
                                            min={0.00001}
                                            {...register("platformAssetAmount", { valueAsNumber: true })}
                                            className="pl-10"
                                            placeholder="0.00001"
                                        />
                                    )}
                                </div>
                                {errors.usdcAmount && <p className="text-xs text-red-500">{errors.usdcAmount.message}</p>}
                                {errors.platformAssetAmount && (
                                    <p className="text-xs text-red-500">{errors.platformAssetAmount.message}</p>
                                )}
                            </div>

                            {/* Reward Summary */}
                            {(rewardType === "usdc" ? (usdcAmount ?? 0) > 0 : (platformAssetAmount ?? 0) > 0) && (
                                <div className="rounded-lg bg-muted/50 p-4 flex justify-between items-center">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Total Pool</p>
                                            <p className="text-lg font-semibold">
                                                {rewardType === "usdc"
                                                    ? `$${(usdcAmount ?? 0).toFixed(5)} USDC`
                                                    : `${(platformAssetAmount ?? 0).toFixed(5)} ${PLATFORM_ASSET.code.toUpperCase()}`}
                                            </p>
                                        </div>
                                        {(totalWinner ?? 1) > 1 && (
                                            <div className="text-right space-y-1">
                                                <p className="text-xs text-muted-foreground">Per Winner</p>
                                                <p className="text-lg font-semibold">
                                                    {rewardType === "usdc"
                                                        ? `$${((usdcAmount ?? 0) / (totalWinner ?? 1)).toFixed(5)}`
                                                        : `${((platformAssetAmount ?? 0) / (totalWinner ?? 1)).toFixed(5)}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rewardType === "usdc" && CheckUSDCTrustLine.data === false && (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setTrustLoading(true)
                                        AddTrustMutation.mutate({
                                            asset_code: USDC_ASSET_CODE,
                                            asset_issuer: USDC_ISSUER,
                                            signWith: needSign(),
                                        })
                                    }}
                                    disabled={AddTrustMutation.isLoading || trustLoading}
                                    variant="outline"
                                    className="w-full"
                                >
                                    {AddTrustMutation.isLoading || trustLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Adding Trust...
                                        </>
                                    ) : (
                                        <>
                                            <DollarSign className="mr-2 h-4 w-4" />
                                            Trust USDC
                                        </>
                                    )}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Participation Requirements Card */}
                <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-indigo-50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                                <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-purple-900">Participation Requirements</h3>
                                <p className="text-sm text-purple-700">Set minimum balance requirements for participants (optional)</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Asset Selection */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-purple-800">Select Required Asset</Label>
                            <Select
                                onValueChange={(value) => {
                                    const parts = value.split(" ")
                                    if (parts.length === 4) {
                                        setValue("requiredBalanceCode", parts[0] ?? "")
                                        setValue("requiredBalanceIssuer", parts[1] ?? "")
                                        setSelectedAsset({
                                            assetCode: parts[0] ?? "",
                                            assetIssuer: parts[1] ?? "",
                                            balance: Number.parseFloat(parts[2] ?? "0"),
                                            assetType: (parts[3] as assetType) ?? "defaultAssetType",
                                        })
                                    } else {
                                        setSelectedAsset(null)
                                        setValue("requiredBalance", 0)
                                    }
                                }}
                            >
                                <SelectTrigger className="bg-white/70 focus-visible:ring-2 focus-visible:ring-purple-500/20">
                                    <SelectValue placeholder="Choose an asset for minimum balance requirement" />
                                </SelectTrigger>
                                <SelectContent className="w-full">
                                    <SelectGroup>
                                        <SelectLabel className="text-center font-semibold text-purple-600 py-2">PAGE ASSET</SelectLabel>
                                        {pageAssetbal.data && (
                                            <>
                                                <SelectItem
                                                    value={
                                                        pageAssetbal?.data?.assetCode +
                                                        " " +
                                                        pageAssetbal?.data.assetCode +
                                                        " " +
                                                        pageAssetbal?.data.balance +
                                                        " " +
                                                        "PAGEASSET"
                                                    }
                                                    className="my-1"
                                                >
                                                    <div className="flex w-full items-center justify-between">
                                                        <span className="font-medium">{pageAssetbal?.data.assetCode}</span>
                                                        <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">
                                                            {pageAssetbal?.data.balance}
                                                        </Badge>
                                                    </div>
                                                </SelectItem>

                                                <SelectLabel className="text-center font-semibold text-purple-600 py-2 mt-3">
                                                    PLATFORM ASSET
                                                </SelectLabel>
                                                <SelectItem
                                                    value={
                                                        PLATFORM_ASSET.code +
                                                        " " +
                                                        PLATFORM_ASSET.issuer +
                                                        " " +
                                                        platformAssetBalance +
                                                        " " +
                                                        "PLATFORMASSET"
                                                    }
                                                    className="my-1"
                                                >
                                                    <div className="flex w-full items-center justify-between">
                                                        <span className="font-medium">{PLATFORM_ASSET.code}</span>
                                                        <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">
                                                            {platformAssetBalance}
                                                        </Badge>
                                                    </div>
                                                </SelectItem>
                                            </>
                                        )}

                                        <SelectLabel className="text-center font-semibold text-purple-600 py-2 mt-3">
                                            SHOP ASSETS
                                        </SelectLabel>
                                        {!shopAssetbal.data ? (
                                            <div className="flex w-full items-center justify-center p-3 text-sm text-muted-foreground">
                                                <span>No Shop Assets Available</span>
                                            </div>
                                        ) : (
                                            shopAssetbal.data.map((asset) =>
                                                asset.asset_type === "credit_alphanum4" ||
                                                    (asset.asset_type === "credit_alphanum12" &&
                                                        asset.asset_code !== pageAssetbal.data?.assetCode &&
                                                        asset.asset_issuer !== pageAssetbal.data?.assetIssuer) ? (
                                                    <SelectItem
                                                        key={asset.asset_code}
                                                        value={
                                                            asset.asset_code + " " + asset.asset_issuer + " " + asset.balance + " " + "SHOPASSET"
                                                        }
                                                        className="my-1"
                                                    >
                                                        <div className="flex w-full items-center justify-between">
                                                            <span className="font-medium">{asset.asset_code}</span>
                                                            <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700">
                                                                {asset.balance}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ) : null,
                                            )
                                        )}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Required Balance Input */}
                        {selectedAsset && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-3"
                            >
                                <Label htmlFor="requiredBalance" className="text-sm font-medium text-purple-800">
                                    Minimum Balance Required
                                </Label>
                                <div className="relative max-w-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Coins className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <Input
                                        id="requiredBalance"
                                        type="number"
                                        step={0.00001}
                                        min={0}
                                        {...register("requiredBalance", {
                                            valueAsNumber: true,
                                        })}
                                        className="pl-10 bg-white/70 transition-all duration-200 focus:ring-2 focus:ring-purple-500/20"
                                        placeholder={`Min ${selectedAsset.assetCode} balance`}
                                    />
                                </div>
                                {errors.requiredBalance && (
                                    <p className="text-sm text-red-500 flex items-center gap-1">
                                        <span className="h-1 w-1 rounded-full bg-red-500"></span>
                                        {errors.requiredBalance.message}
                                    </p>
                                )}
                                <div className="rounded-lg bg-white/60 p-3 border border-purple-200">
                                    <p className="text-xs text-purple-700">
                                        Participants must hold at least this amount of{" "}
                                        <span className="font-semibold">{selectedAsset.assetCode}</span> to be eligible for this bounty.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {!selectedAsset && (
                            <div className="rounded-lg bg-white/60 p-4 border border-purple-200 text-center">
                                <p className="text-sm text-purple-600">
                                    Select an asset above to set minimum balance requirements for participants
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

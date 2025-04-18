"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
    Loader,
    MapPin,
    Calendar,
    LinkIcon,
    ImageIcon,
    Coins,
    Target,
    Hash,
    Layers,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Trophy,
} from "lucide-react"
import Image from "next/image"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { Controller, type SubmitHandler, useForm, FormProvider, useFormContext } from "react-hook-form"
import toast from "react-hot-toast"
import { match } from "ts-pattern"
import { z } from "zod"
import { useCreatorStorageAcc } from "~/lib/state/wallete/stellar-balances"
import { api } from "~/utils/api"
import { BADWORDS } from "~/utils/banned-word"
import { error, loading, success } from "~/utils/trcp/patterns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "~/lib/utils"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { Checkbox } from "~/components/shadcn/ui/checkbox"
import { Button } from "~/components/shadcn/ui/button"
import { Label } from "~/components/shadcn/ui/label"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Separator } from "~/components/shadcn/ui/separator"
import { useCreatorMapModalStore } from "../store/creator-map-modal-store"
import { UploadS3Button } from "../common/upload-button"
import { useCreateLocationBasedBountyStore } from "../store/create-locationbased-bounty-store"

type AssetType = {
    id: number
    code: string
    issuer: string
    thumbnail: string
}

export const PAGE_ASSET_NUM = -10
export const NO_ASSET = -99

// Define the steps as a type for better type safety
type FormStep = "basic" | "tokens" | "advanced"
const FORM_STEPS: FormStep[] = ["basic", "tokens", "advanced"]

export const createPinFormSchema = z.object({
    lat: z
        .number({
            message: "Latitude is required",
        })
        .min(-180)
        .max(180),
    lng: z
        .number({
            message: "Longitude is required",
        })
        .min(-180)
        .max(180),
    description: z.string(),
    title: z
        .string()
        .min(3)
        .refine(
            (value) => {
                return !BADWORDS.some((word) => value.includes(word))
            },
            {
                message: "Input contains banned words.",
            },
        ),
    image: z.string().url().optional(),
    startDate: z.date(),
    endDate: z.date().min(new Date(new Date().setHours(0, 0, 0, 0))),
    url: z.string().url().optional(),
    autoCollect: z.boolean(),
    token: z.number().optional(),
    tokenAmount: z.number().nonnegative().optional(), // if it optional then no token selected
    pinNumber: z.number().nonnegative().min(1),
    radius: z.number().nonnegative(),
    pinCollectionLimit: z.number().min(0),
    tier: z.string().optional(),
    multiPin: z.boolean().optional(),
})

export default function CreatePinModal() {
    // hooks
    const { manual, position, duplicate, isOpen, setIsOpen, prevData } = useCreatorMapModalStore()
    const [coverUrl, setCover] = useState<string>()
    const [selectedToken, setSelectedToken] = useState<AssetType & { bal: number }>()
    const [isPageAsset, setIsPageAsset] = useState<boolean>()
    const { getAssetBalance } = useCreatorStorageAcc()
    const [storageBalance, setStorageBalance] = useState<number>(0)
    const [remainingBalance, setRemainingBalance] = useState<number>(0)
    const [activeStep, setActiveStep] = useState<FormStep>("basic")
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const { setData, setIsOpen: setBountyOpen } = useCreateLocationBasedBountyStore()
    // Format dates for input fields
    const formatDateForInput = (date: Date) => {
        return date.toISOString().split("T")[0]
    }

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const methods = useForm<z.infer<typeof createPinFormSchema>>({
        resolver: zodResolver(createPinFormSchema),
        defaultValues: {
            lat: position?.lat,
            lng: position?.lng,
            radius: 0,
            pinNumber: 1,
            description: prevData?.description ?? "",
            pinCollectionLimit: 1,
            autoCollect: false,
            multiPin: false,
            startDate: prevData?.startDate ?? today,
            endDate: prevData?.endDate ?? tomorrow,
            title: prevData?.title ?? "",
            url: prevData?.url ?? "",
        },
        mode: "onChange",
    })

    const {
        register,
        handleSubmit,
        setValue,
        setError,
        getValues,
        reset,
        watch,
        formState: { errors, isValid, isDirty },
        control,
    } = methods

    const tokenAmount = watch("pinCollectionLimit")
    const startDate = watch("startDate")
    const endDate = watch("endDate")

    // query
    const assets = api.fan.asset.myAssets.useQuery(undefined, {
        enabled: isOpen,
    })
    const tiers = api.fan.member.getAllMembership.useQuery()

    const assetsDropdown = match(assets)
        .with(success, () => {
            const pageAsset = assets.data?.pageAsset
            const shopAsset = assets.data?.shopAsset

            if (isPageAsset && pageAsset) {
                return <p>{pageAsset.code}</p>
            }
            // if (isPageAsset === false && shopAsset)
            if (true)
                return (
                    <div className="space-y-2 w-full">
                        <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-primary" />
                            <Label htmlFor="token-select" className="text-sm font-medium">
                                Choose Token
                            </Label>
                        </div>
                        <Select
                            onValueChange={(value) => {
                                handleTokenOptionChange({
                                    target: { value },
                                } as ChangeEvent<HTMLSelectElement>)
                            }}
                        >
                            <SelectTrigger id="token-select" className="w-full">
                                <SelectValue placeholder="Select a token" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_ASSET.toString()}>Pin (No asset)</SelectItem>
                                <SelectItem value={PAGE_ASSET_NUM.toString()}>{pageAsset?.code} - Page Asset</SelectItem>
                                {assets.data?.shopAsset.map((asset: AssetType) => (
                                    <SelectItem key={asset.id} value={asset.id.toString()}>
                                        {asset.code}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )
        })
        .with(loading, (data) => (
            <div className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin" />
                <p>Loading tokens...</p>
            </div>
        ))
        .with(error, (data) => (
            <div className="text-red-500">
                <p>{data.failureReason?.message}</p>
            </div>
        ))
        .otherwise(() => <p>Failed to fetch assets</p>)

    function TiersOptions() {
        if (tiers.isLoading) return <div className="h-10 w-full bg-muted animate-pulse rounded-md"></div>
        if (tiers.data) {
            return (
                <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        <Label htmlFor="tier-select" className="text-sm font-medium">
                            Choose Tier
                        </Label>
                    </div>
                    <Controller
                        name="tier"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger id="tier-select" className="w-full">
                                    <SelectValue placeholder="Choose Tier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="public">Public</SelectItem>
                                    <SelectItem value="private">Only Followers</SelectItem>
                                    {tiers.data.map((model) => (
                                        <SelectItem key={model.id} value={model.id.toString()}>
                                            {`${model.name} : ${model.price} ${model.creator.pageAsset?.code}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )
        }
    }

    const openPopup = () => setIsOpen(true)
    const closePopup = () => {
        setIsOpen(false)
        resetState()
    }

    // mutations
    const addPinM = api.maps.pin.createPin.useMutation({
        onSuccess: () => {
            toast.success("Pin sent for approval")
            closePopup()
        },
    })

    // functions
    function resetState() {
        setCover(undefined)
        setSelectedToken(undefined)
        setRemainingBalance(0)
        setIsPageAsset(undefined)
        setActiveStep("basic")
        reset()
    }

    const onSubmit: SubmitHandler<z.infer<typeof createPinFormSchema>> = (data) => {
        setValue("token", selectedToken?.id)

        if (selectedToken) {
            if (data.pinCollectionLimit > selectedToken.bal) {
                setError("pinCollectionLimit", {
                    type: "manual",
                    message: "Collection limit can't be more than token balance",
                })
                return
            }
        }

        if (position) {
            setValue("lat", position.lat)
            setValue("lng", position.lng)
            console.log("data", data)
            addPinM.mutate({ ...data, lat: position.lat, lng: position.lng })
        } else {
            console.log("data", data)
            addPinM.mutate({ ...data })
        }
    }

    function handleTokenOptionChange(event: ChangeEvent<HTMLSelectElement>): void {
        const selectedAssetId = Number(event.target.value)
        if (selectedAssetId === NO_ASSET) {
            setSelectedToken(undefined)
            return
        }
        if (selectedAssetId === PAGE_ASSET_NUM) {
            const pageAsset = assets.data?.pageAsset

            if (pageAsset) {
                const bal = getAssetBalance({
                    code: pageAsset.code,
                    issuer: pageAsset.issuer,
                })
                setSelectedToken({
                    bal,
                    code: pageAsset.code,
                    issuer: pageAsset.issuer,
                    id: PAGE_ASSET_NUM,
                    thumbnail: pageAsset.thumbnail ?? "",
                })
                setRemainingBalance(bal)
                setValue("token", PAGE_ASSET_NUM)
            } else {
                toast.error("No page asset found")
            }
        }

        const selectedAsset = assets.data?.shopAsset.find((asset) => asset.id === selectedAssetId)
        if (selectedAsset) {
            const bal = getAssetBalance({
                code: selectedAsset.code,
                issuer: selectedAsset.issuer,
            })
            setSelectedToken({ ...selectedAsset, bal: bal })
            setRemainingBalance(bal)
            setValue("token", selectedAsset.id)
        }
    }

    // Navigation functions
    const goToNextStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep)
        if (currentIndex < FORM_STEPS.length - 1) {
            const nextStep = FORM_STEPS[currentIndex + 1]
            if (nextStep) {
                setActiveStep(nextStep)
            }
        }
    }

    const goToPreviousStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep)
        if (currentIndex > 0) {
            const previousStep = FORM_STEPS[currentIndex - 1]
            if (previousStep) {
                setActiveStep(previousStep)
            }
        }
    }

    useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
        }
        if (duplicate) {
            if (prevData) {
                if (prevData.title) {
                    setValue("title", prevData.title)
                }
                if (prevData.description) {
                    setValue("description", prevData.description)
                }
                if (prevData.image) {
                    setCover(prevData.image)
                    setValue("image", prevData.image)
                }
                if (prevData.startDate) {
                    setValue("startDate", prevData.startDate)
                }
                if (prevData.endDate) {
                    setValue("endDate", prevData.endDate)
                }
                if (prevData.url) {
                    setValue("url", prevData.url)
                }
                if (prevData.autoCollect) {
                    setValue("autoCollect", prevData.autoCollect)
                }
                if (prevData.pinCollectionLimit) {
                    setValue("pinCollectionLimit", prevData.pinCollectionLimit)
                }
                if (prevData.token) {
                    handleTokenOptionChange({
                        target: { value: prevData.token.toString() },
                    } as ChangeEvent<HTMLSelectElement>)
                }

                if (prevData.tier) {
                    setValue("tier", prevData.tier)
                }
                if (prevData.image) {
                    setCover(prevData.image)
                }

                if (prevData.pinNumber) {
                    setValue("pinNumber", prevData.pinNumber)
                }
            }
        }

        if (position) {
            setValue("lat", position.lat)
            setValue("lng", position.lng)
        }
    }, [isOpen, duplicate, prevData, position, setValue]) // Removed handleTokenOptionChange from dependencies

    useEffect(() => {
        if (selectedToken && tokenAmount) {
            setRemainingBalance(selectedToken.bal - tokenAmount)
        }
    }, [tokenAmount, selectedToken])

    useEffect(() => {
        // If there's a token value in the form but no selectedToken state, restore it
        const tokenValue = getValues("token")
        if (tokenValue && !selectedToken && assets.data) {
            if (tokenValue === PAGE_ASSET_NUM) {
                const pageAsset = assets.data?.pageAsset
                if (pageAsset) {
                    const bal = getAssetBalance({
                        code: pageAsset.code,
                        issuer: pageAsset.issuer,
                    })
                    setSelectedToken({
                        bal,
                        code: pageAsset.code,
                        issuer: pageAsset.issuer,
                        id: PAGE_ASSET_NUM,
                        thumbnail: pageAsset.thumbnail ?? "",
                    })
                    setRemainingBalance(bal - (getValues("pinCollectionLimit") || 0))
                }
            } else if (tokenValue !== NO_ASSET) {
                const selectedAsset = assets.data?.shopAsset.find((asset) => asset.id === tokenValue)
                if (selectedAsset) {
                    const bal = getAssetBalance({
                        code: selectedAsset.code,
                        issuer: selectedAsset.issuer,
                    })
                    setSelectedToken({ ...selectedAsset, bal: bal })
                    setRemainingBalance(bal - (getValues("pinCollectionLimit") || 0))
                }
            }
        }
    }, [assets.data, getValues, getAssetBalance, selectedToken])
    return (
        <>
            <AnimatePresence>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-0">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col h-full"
                        >
                            <DialogHeader className=" px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-5 w-5" />
                                        <DialogTitle className="text-xl font-bold">Create New Pin</DialogTitle>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setBountyOpen(true)
                                            setIsOpen(false)
                                            if (position?.lat !== undefined && position?.lng !== undefined) {
                                                setData({ lat: position.lat, lng: position.lng })
                                            }
                                        }}
                                        className="flex items-center gap-1 text-xs mr-2"
                                    >
                                        <Trophy className="h-3.5 w-3.5" />
                                        Switch to Bounty
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                    </Button>
                                </div>
                                <DialogDescription>Create manual and specific pin hot spot</DialogDescription>
                            </DialogHeader>

                            <div className="w-full px-6 pt-6">
                                <div className="flex items-center justify-between">
                                    {FORM_STEPS.map((step, index) => (
                                        <div key={step} className="flex flex-col items-center">
                                            <div
                                                className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm mb-1 ",
                                                    activeStep === step ? "bg-primary text-primary-foreground shadow-sm shadow-foreground" : "bg-muted text-muted-foreground",
                                                )}
                                            >
                                                {index + 1}
                                            </div>
                                            <span
                                                className={cn(
                                                    "text-xs",
                                                    activeStep === step ? " font-medium" : "text-muted-foreground",
                                                )}
                                            >
                                                {step === "basic" ? "Basic Info" : step === "tokens" ? "Tokens & Tiers" : "Advanced"}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="absolute left-0 right-0 top-[6.5rem] px-6 z-0">
                                        <div className="h-[2px] bg-muted w-full relative">
                                            <div
                                                className="absolute h-full bg-destructive transition-all duration-300"
                                                style={{
                                                    width: activeStep === "basic" ? "0%" : activeStep === "tokens" ? "50%" : "100%",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto px-4 ">
                                <FormProvider {...methods}>
                                    <form className="mt-2" onSubmit={handleSubmit(onSubmit)}>
                                        {activeStep === "basic" && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3 }}
                                                className="space-y-4"
                                            >
                                                <ManualLatLanInputField />

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Hash className="h-4 w-4" />
                                                        <Label htmlFor="title" className="text-sm font-medium">
                                                            Title
                                                        </Label>
                                                    </div>
                                                    <Input id="title" {...register("title")} placeholder="Enter pin title" />
                                                    {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <ImageIcon className="h-4 w-4" />
                                                        <Label className="text-sm font-medium">Pin Cover Image</Label>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <UploadS3Button
                                                            endpoint="imageUploader"
                                                            variant="button"
                                                            className="w-full"
                                                            label="Upload Pin Cover Image"
                                                            onClientUploadComplete={(res) => {
                                                                const data = res
                                                                if (data?.url) {
                                                                    setCover(data.url)
                                                                    setValue("image", data.url)
                                                                }
                                                            }}
                                                            onUploadError={(error: Error) => {
                                                                toast.error(`ERROR! ${error.message}`)
                                                            }}
                                                        />

                                                        <AnimatePresence>
                                                            {coverUrl && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    className="mt-2 rounded-lg border p-2"
                                                                >
                                                                    <Image
                                                                        className="rounded-md"
                                                                        width={120}
                                                                        height={120}
                                                                        alt="preview image"
                                                                        src={coverUrl || "/placeholder.svg"}
                                                                    />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <LinkIcon className="h-4 w-4" />
                                                        <Label htmlFor="url" className="text-sm font-medium">
                                                            URL / LINK
                                                        </Label>
                                                    </div>
                                                    <Input id="url" {...register("url")} placeholder="https://example.com" />
                                                    {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4" />
                                                        <Label htmlFor="startDate" className="text-sm font-medium">
                                                            Start Date
                                                        </Label>
                                                    </div>
                                                    <Controller
                                                        name="startDate"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="date"
                                                                id="startDate"
                                                                value={field.value instanceof Date ? formatDateForInput(field.value) : ""}
                                                                onChange={(e) => {
                                                                    field.onChange(e.target.value ? new Date(e.target.value) : null)
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                    {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4" />
                                                        <Label htmlFor="endDate" className="text-sm font-medium">
                                                            End Date
                                                        </Label>
                                                    </div>
                                                    <Controller
                                                        name="endDate"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input
                                                                type="date"
                                                                id="endDate"
                                                                value={field.value instanceof Date ? formatDateForInput(field.value) : ""}
                                                                onChange={(e) => {
                                                                    field.onChange(e.target.value ? new Date(e.target.value) : null)
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                    {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeStep === "tokens" && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="h-4 w-4" />
                                                        <Label htmlFor="description" className="text-sm font-medium">
                                                            Description
                                                        </Label>
                                                    </div>
                                                    <Textarea
                                                        id="description"
                                                        {...register("description")}
                                                        className="min-h-24"
                                                        placeholder="Describe what this pin is about..."
                                                    />
                                                    {errors.description && (
                                                        <p className="text-sm text-destructive">{errors.description.message}</p>
                                                    )}
                                                </div>

                                                <TiersOptions />

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    {assetsDropdown}

                                                    <AnimatePresence>
                                                        {selectedToken && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: 10 }}
                                                                className="space-y-2"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Coins className="h-4 w-4" />
                                                                    <Label htmlFor="perUserTokenAmount" className="text-sm font-medium">
                                                                        Collection limit
                                                                    </Label>
                                                                </div>
                                                                <Input
                                                                    type="number"
                                                                    defaultValue={1}
                                                                    id="perUserTokenAmount"
                                                                    {...register("pinCollectionLimit", {
                                                                        valueAsNumber: true,
                                                                        min: 1,
                                                                        max: 2147483647,
                                                                    })}
                                                                    max={2147483647}
                                                                />

                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        variant={remainingBalance < 0 ? "destructive" : "outline"}
                                                                        className="px-2 py-0 h-5"
                                                                    >
                                                                        {remainingBalance < 0
                                                                            ? "Insufficient token balance"
                                                                            : `Limit Remaining: ${remainingBalance}`}
                                                                    </Badge>
                                                                </div>

                                                                {errors.pinCollectionLimit && (
                                                                    <p className="text-sm text-destructive">{errors.pinCollectionLimit.message}</p>
                                                                )}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeStep === "advanced" && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="h-4 w-4" />
                                                        <Label htmlFor="radius" className="text-sm font-medium">
                                                            Radius (meters)
                                                        </Label>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <div className="rounded-full bg-muted px-1 text-xs">?</div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="max-w-xs text-xs">
                                                                        Set the radius around the pin location where users can collect it
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                    <Input min={0} type="number" id="radius" {...register("radius", { valueAsNumber: true })} />
                                                    {errors.radius && <p className="text-sm text-destructive">{errors.radius.message}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="h-4 w-4" />
                                                        <Label htmlFor="pinNumber" className="text-sm font-medium">
                                                            Number of pins
                                                        </Label>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <div className="rounded-full bg-muted px-1 text-xs">?</div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="max-w-xs text-xs">How many identical pins to create at this location</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        id="pinNumber"
                                                        {...register("pinNumber", { valueAsNumber: true })}
                                                    />
                                                    {errors.pinNumber && <p className="text-sm text-destructive">{errors.pinNumber.message}</p>}
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div className="flex items-start space-x-2">
                                                        <Checkbox id="autoCollect" {...register("autoCollect")} />
                                                        <div className="grid gap-1.5 leading-none">
                                                            <Label
                                                                htmlFor="autoCollect"
                                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                Auto Collect
                                                            </Label>
                                                            <p className="text-xs text-muted-foreground">Automatically collect when in range</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start space-x-2">
                                                        <Checkbox id="multiPin" {...register("multiPin")} />
                                                        <div className="grid gap-1.5 leading-none">
                                                            <Label
                                                                htmlFor="multiPin"
                                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                Multi Pin
                                                            </Label>
                                                            <p className="text-xs text-muted-foreground">Allow multiple collections</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}




                                        {addPinM.isError && (
                                            <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-destructive">
                                                <p>{addPinM.failureReason?.message}</p>
                                            </div>
                                        )}
                                    </form>
                                </FormProvider>
                            </div>
                        </motion.div>
                        <DialogFooter className="px-4 py-2 border-t-2 ">
                            <div className="flex items-center justify-between w-full">
                                <Button type="button" variant="outline" onClick={closePopup}>
                                    Cancel
                                </Button>

                                <div className="flex items-center gap-2">
                                    {activeStep !== "basic" && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={goToPreviousStep}
                                            className="flex items-center gap-1"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                    )}

                                    {activeStep !== "advanced" ? (
                                        <Button
                                            variant='sidebar'
                                            type="button" onClick={goToNextStep} className="flex items-center gap-1 shadow-sm shadow-foreground">
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleSubmit(onSubmit)}
                                            variant="sidebar"
                                            disabled={addPinM.isLoading || remainingBalance < 0 || !isValid}
                                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                                        >
                                            {addPinM.isLoading ? (
                                                <>
                                                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>Create Pin</>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div></DialogFooter>
                    </DialogContent>
                </Dialog>
            </AnimatePresence>
        </>
    )
}

// components
function ManualLatLanInputField() {
    const { manual, position } = useCreatorMapModalStore()
    // Use the parent form context instead of creating a new one
    const {
        register,
        formState: { errors },
    } = useFormContext<z.infer<typeof createPinFormSchema>>()

    if (manual)
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <Label className="text-sm font-medium">Latitude</Label>
                    </div>
                    <Input type="number" step={0.0000000000000000001} {...register("lat", { valueAsNumber: true })} />
                    {errors.lat && <p className="text-sm text-destructive">{errors.lat?.message}</p>}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <Label className="text-sm font-medium">Longitude</Label>
                    </div>
                    <Input step={0.0000000000000000001} type="number" {...register("lng", { valueAsNumber: true })} />
                    {errors.lng && <p className="text-sm text-destructive">{errors.lng?.message}</p>}
                </div>
            </div>
        )
    else
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <p className="font-medium">Pin Location</p>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm">
                        <p>
                            Latitude:{" "}
                            <Badge variant="outline" className="font-mono">
                                {position?.lat.toFixed(6)}
                            </Badge>
                        </p>
                        <p>
                            Longitude:{" "}
                            <Badge variant="outline" className="font-mono">
                                {position?.lng.toFixed(6)}
                            </Badge>
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
}


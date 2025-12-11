"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MediaType } from "@prisma/client"
import {
    Camera,
    Coins,
    MapPin,
    FileText,
    Target,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Trophy,
    Check,
    Loader2,
    Users,
    Sparkles,
    Ticket,
    Clock,
    X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import { useState, useEffect } from "react"
import { FormProvider, useForm, useFormContext, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"
import { Label } from "~/components/shadcn/ui/label"
import { Progress } from "~/components/shadcn/ui/progress"
import { Switch } from "~/components/shadcn/ui/switch"
import useNeedSign from "~/lib/hook"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import { UploadS3Button } from "../common/upload-button"
import { Editor } from "../common/quill-editor"
import { useCreatorMapModalStore } from "../store/creator-map-modal-store"
import { useCreateLocationBasedBountyStore } from "../store/create-locationbased-bounty-store"
import { cn } from "~/lib/utils"

// Schema definitions
const MediaInfo = z.object({
    url: z.string(),
    type: z.string().default(MediaType.IMAGE),
})

type MediaInfoType = z.TypeOf<typeof MediaInfo>

const USDCIssuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
const USDCCode = "USDC"

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

// Define the schema for the bounty form
export const LocationBasedBountyFormSchema = z
    .object({
        title: z.string().min(3, "Title must be at least 3 characters").max(65, "Title must be at most 65 characters"),
        description: z.string().min(10, "Description must be at least 10 characters"),
        latitude: z
            .string()
            .refine(
                (val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= -90 && Number.parseFloat(val) <= 90,
                {
                    message: "Latitude must be between -90 and 90",
                },
            ),
        longitude: z
            .string()
            .refine(
                (val) => !isNaN(Number.parseFloat(val)) && Number.parseFloat(val) >= -180 && Number.parseFloat(val) <= 180,
                {
                    message: "Longitude must be between -180 and 180",
                },
            ),
        radius: z.number().min(10, "Radius must be at least 10 meters").max(1000, "Radius cannot exceed 1000 meters"),
        // Reward type selection
        rewardType: z.enum(["usdc", "platform_asset"]),
        // USDC amount (used when rewardType is 'usdc')
        usdcAmount: z.number().optional(),
        // Platform asset amount (used when rewardType is 'platform_asset')
        platformAssetAmount: z.number().optional(),
        winners: z.number().int().min(1, "Must have at least 1 winner").max(100, "Cannot have more than 100 winners"),
        requiredBalanceCode: z.string().min(1, { message: "Please select an asset" }),
        requiredBalanceIssuer: z.string().min(1, { message: "Please select an asset" }),
        requiredBalance: z
            .number({
                required_error: "Required Balance must be a number",
                invalid_type_error: "Required Balance must be a number",
            })
            .nonnegative({ message: "Required Balance can't be less than 0" })
            .default(0),
        medias: z.array(MediaInfo).optional(),
        generateRedeemCodes: z.boolean().default(false),
    })
    .refine(
        (data) => {
            if (data.rewardType === "usdc") {
                return data.usdcAmount && data.usdcAmount >= 0.00001
            }
            if (data.rewardType === "platform_asset") {
                return data.platformAssetAmount && data.platformAssetAmount >= 0.00001
            }
            return false
        },
        {
            message: "Please enter a valid reward amount",
            path: ["usdcAmount"],
        },
    )

type LocationBasedBountyFormType = z.infer<typeof LocationBasedBountyFormSchema>

// Define the steps
type FormStep = "details" | "location" | "media" | "settings" | "review"
const FORM_STEPS: FormStep[] = ["details", "location", "media", "settings", "review"]

export default function CreateLocationBasedBountyModal() {
    // State management
    const [media, setMedia] = useState<MediaInfoType[]>([])
    const [activeStep, setActiveStep] = useState<FormStep>("details")
    const [formProgress, setFormProgress] = useState(20)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)

    // Hooks
    const { setIsOpen: SetIsBountyOpen, data, isOpen: isBountyOpen } = useCreateLocationBasedBountyStore()
    const { isOpen, setIsOpen, paymentMethod, setPaymentMethod } = usePaymentMethodStore()
    const { platformAssetBalance } = useUserStellarAcc()
    const totalFees = 0
    const { data: sessionData, status } = useSession()
    const { needSign } = useNeedSign()

    const methods = useForm<LocationBasedBountyFormType>({
        mode: "onChange",
        resolver: zodResolver(LocationBasedBountyFormSchema),
        defaultValues: {
            title: "",
            description: "",
            latitude: "",
            longitude: "",
            radius: 100,
            rewardType: "usdc",
            usdcAmount: 0,
            platformAssetAmount: 0,
            winners: 1,
            requiredBalance: 0,
            requiredBalanceCode: "",
            requiredBalanceIssuer: "",
            generateRedeemCodes: false,
        },
    })

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        reset,
        trigger,
        watch,
        formState: { errors, isValid },
    } = methods
    const utils = api.useUtils()

    useEffect(() => {
        if (data) {
            setValue("latitude", data.lat.toString())
            setValue("longitude", data.lng.toString())
        }
    }, [data, setValue])

    // Update progress based on active step
    useEffect(() => {
        const stepIndex = FORM_STEPS.indexOf(activeStep)
        setFormProgress((stepIndex + 1) * (100 / FORM_STEPS.length))
    }, [activeStep])

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

    // Check if current step is valid before allowing to proceed
    const canProceed = async () => {
        const fieldsToValidate: Record<FormStep, (keyof LocationBasedBountyFormType)[]> = {
            details: ["title", "description", "rewardType", "winners"],
            location: ["latitude", "longitude", "radius"],
            media: [],
            settings: ["requiredBalanceCode", "requiredBalanceIssuer"],
            review: [],
        }
        return await trigger(fieldsToValidate[activeStep])
    }

    const handleNext = async () => {
        const isValid = await canProceed()
        if (isValid) {
            goToNextStep()
        }
    }

    // API mutations
    const CreateBountyMutation = api.bounty.Bounty.createLocationBounty.useMutation({
        onSuccess: async () => {
            toast.success("Bounty Created Successfully! 🎉")
            setShowConfetti(true)
            utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
                console.error("Error refetching bounties", error)
            })
            handleClose()
        },
    })

    const CreateBountyPayLaterMutation = api.bounty.Bounty.createLocationBountyPayLater.useMutation({
        onSuccess: async () => {
            toast.success("Bounty Created Successfully! Payment pending. 🎉")
            setShowConfetti(true)
            utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
                console.error("Error refetching bounties", error)
            })
            handleClose()
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            setIsSubmitting(false)
        },
    })

    const SendBalanceToBountyMother = api.bounty.Bounty.sendBountyBalanceToMotherAcc.useMutation({
        onSuccess: async (data, { method }) => {
            if (data) {
                try {
                    setIsSubmitting(true)
                    const clientResponse = await clientsign({
                        presignedxdr: data.xdr,
                        walletType: sessionData?.user?.walletType,
                        pubkey: data.pubKey,
                        test: clientSelect(),
                    })

                    if (clientResponse) {
                        const rewardType = getValues("rewardType")
                        CreateBountyMutation.mutate({
                            title: getValues("title"),
                            rewardType: getValues("rewardType"),
                            description: getValues("description"),
                            latitude: getValues("latitude"),
                            longitude: getValues("longitude"),
                            radius: getValues("radius"),
                            winners: getValues("winners"),
                            platformAssetAmount: rewardType === "platform_asset" ? (getValues("platformAssetAmount") ?? 0) : 0,
                            usdcAmount: rewardType === "usdc" ? (getValues("usdcAmount") ?? 0) : 0,
                            requiredBalance: getValues("requiredBalance") ?? 0,
                            requiredBalanceCode: getValues("requiredBalanceCode"),
                            requiredBalanceIssuer: getValues("requiredBalanceIssuer"),
                            medias: media.map((item) => ({
                                ...item,
                                type: item.type as MediaType,
                            })),
                            generateRedeemCodes: getValues("generateRedeemCodes"),
                        })
                        setIsSubmitting(false)
                        reset()
                        setMedia([])
                    } else {
                        setIsSubmitting(false)
                        reset()
                        toast.error("Error in signing transaction")
                        setMedia([])
                    }
                    setIsOpen(false)
                } catch (error) {
                    setIsSubmitting(false)
                    console.error("Error sending balance to bounty mother", error)
                    reset()
                    setMedia([])
                }
            }
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            reset()
            setMedia([])
            setIsSubmitting(false)
            setIsOpen(false)
        },
    })

    const onSubmit: SubmitHandler<LocationBasedBountyFormType> = (data) => {
        data.medias = media
        setIsSubmitting(true)

        const rewardType = getValues("rewardType")
        const prizeAmount =
            rewardType === "platform_asset" ? Number(getValues("platformAssetAmount")) : Number(getValues("usdcAmount"))

        SendBalanceToBountyMother.mutate({
            signWith: needSign(),
            prize: prizeAmount,
            fees: 0,
            method: paymentMethod,
        })
    }

    const handlePayLater = () => {
        setIsSubmitting(true)
        const rewardType = getValues("rewardType")

        CreateBountyPayLaterMutation.mutate({
            title: getValues("title"),
            description: getValues("description"),
            rewardType: getValues("rewardType"),
            latitude: getValues("latitude"),
            longitude: getValues("longitude"),
            radius: getValues("radius"),
            platformAssetAmount: rewardType === "platform_asset" ? (getValues("platformAssetAmount") ?? 0) : 0,
            winners: getValues("winners"),
            usdcAmount: rewardType === "usdc" ? (getValues("usdcAmount") ?? 0) : 0,
            requiredBalance: getValues("requiredBalance") ?? 0,
            requiredBalanceCode: getValues("requiredBalanceCode"),
            requiredBalanceIssuer: getValues("requiredBalanceIssuer"),
            medias: media.map((item) => ({
                ...item,
                type: item.type as MediaType,
            })),
            generateRedeemCodes: getValues("generateRedeemCodes"),
        })
    }

    const addMediaItem = (url: string, type: MediaType) => {
        setMedia((prevMedia) => [...prevMedia, { url, type }])
    }

    const removeMediaItem = (index: number) => {
        setMedia((prevMedia) => prevMedia.filter((_, i) => i !== index))
    }

    const handleClose = () => {
        SetIsBountyOpen(false)
        reset()
        setMedia([])
        setActiveStep("details")
        setIsSubmitting(false)
    }

    // Watch values
    const watchedTitle = watch("title")
    const watchedRewardType = watch("rewardType")
    const watchedUsdcAmount = watch("usdcAmount")
    const watchedPlatformAssetAmount = watch("platformAssetAmount")
    const watchedWinners = watch("winners")
    const watchedRequiredBalance = watch("requiredBalance")
    const watchedGenerateRedeemCodes = watch("generateRedeemCodes")
    const watchedRequiredBalanceCode = watch("requiredBalanceCode")
    const watchedLatitude = watch("latitude")
    const watchedLongitude = watch("longitude")
    const watchedRadius = watch("radius")

    const getPrizeAmount = () => {
        if (watchedRewardType === "platform_asset") {
            return watchedPlatformAssetAmount ?? 0
        }
        return watchedUsdcAmount ?? 0
    }

    useEffect(() => {
        setPaymentMethod(watchedRewardType === "usdc" ? "usdc" : "asset")
    }, [watchedRewardType, setPaymentMethod])

    return (
        <Dialog open={isBountyOpen} onOpenChange={handleClose}>
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-2"
            >
                {/* {showConfetti && (
                    <div className="pointer-events-none fixed inset-0 z-50">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1, opacity: [0, 1, 0] }}
                                transition={{ duration: 2 }}
                                className="text-4xl"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Sparkles className="h-8 w-8" />
                                    <span className="font-bold">Bounty created successfully!</span>
                                    <Sparkles className="h-8 w-8" />
                                </div>
                            </motion.div>
                        </div>
                        {Array.from({ length: 100 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute h-2 w-2 rounded-full"
                                initial={{
                                    top: "50%",
                                    left: "50%",
                                    scale: 0,
                                    backgroundColor: ["#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33F3"][
                                        Math.floor(Math.random() * 5)
                                    ],
                                }}
                                animate={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    scale: [0, 1, 0],
                                    opacity: [0, 1, 0],
                                }}
                                transition={{
                                    duration: 2 + Math.random() * 2,
                                    delay: Math.random() * 0.5,
                                    ease: "easeOut",
                                }}
                            />
                        ))}
                    </div>
                )} */}

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex h-full flex-col"
                >
                    <DialogHeader className="px-2 py-4 md:px-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                <DialogTitle className="text-xl font-bold">Create Location Action</DialogTitle>
                            </div>
                        </div>
                        <DialogDescription>Create a location-based action for users to claim</DialogDescription>
                        <Progress value={formProgress} className="mt-2 h-2" />
                        <div className="w-full px-2 md:px-4">
                            <div className="flex items-center justify-between">
                                {FORM_STEPS.map((step, index) => (
                                    <div key={step} className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "mb-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                                                activeStep === step
                                                    ? "bg-primary shadow-sm shadow-foreground"
                                                    : "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {index + 1}
                                        </div>
                                        <span className={cn("text-xs", activeStep === step ? "font-medium" : "text-muted-foreground")}>
                                            {step === "details"
                                                ? "Details"
                                                : step === "location"
                                                    ? "Location"
                                                    : step === "media"
                                                        ? "Media"
                                                        : step === "settings"
                                                            ? "Settings"
                                                            : "Review"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </DialogHeader>

                    <FormProvider {...methods}>
                        <form>
                            <div className="p-2 md:p-4">
                                <AnimatePresence mode="wait">
                                    {activeStep === "details" && <DetailsStep key="details" />}
                                    {activeStep === "location" && <LocationStep key="location" />}
                                    {activeStep === "media" && (
                                        <MediaStep
                                            key="media"
                                            media={media}
                                            removeMediaItem={removeMediaItem}
                                            addMediaItem={addMediaItem}
                                            loading={isSubmitting}
                                        />
                                    )}
                                    {activeStep === "settings" && <SettingsStep key="settings" />}
                                    {activeStep === "review" && (
                                        <ReviewStep
                                            key="review"
                                            media={media}
                                            title={watchedTitle}
                                            rewardType={watchedRewardType}
                                            usdcAmount={watchedUsdcAmount}
                                            platformAssetAmount={watchedPlatformAssetAmount}
                                            winners={watchedWinners}
                                            requiredBalance={watchedRequiredBalance}
                                            requiredBalanceCode={watchedRequiredBalanceCode}
                                            generateRedeemCodes={watchedGenerateRedeemCodes}
                                            latitude={watchedLatitude}
                                            longitude={watchedLongitude}
                                            radius={watchedRadius}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex justify-between border-t p-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={goToPreviousStep}
                                    disabled={activeStep === "details" || isSubmitting}
                                    className=" bg-transparent"
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>

                                {activeStep !== "review" ? (
                                    <Button type="button" onClick={handleNext} className="shadow-sm shadow-foreground">
                                        Next
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        {/* Pay Later Button */}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handlePayLater}
                                            disabled={isSubmitting || !isValid || watchedGenerateRedeemCodes}

                                            className="border-amber-300 hover:bg-amber-50 bg-transparent"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <Clock className="mr-2 h-4 w-4" />
                                                    Pay Later
                                                </>
                                            )}
                                        </Button>

                                        {/* Pay Now Button */}
                                        {platformAssetBalance < getPrizeAmount() ? (
                                            <Button disabled className="shadow-sm shadow-foreground">
                                                Insufficient Balance
                                            </Button>
                                        ) : (
                                            <PaymentChoose
                                                costBreakdown={[
                                                    {
                                                        label: "Action Prize",
                                                        amount: getPrizeAmount(),
                                                        highlighted: true,
                                                        type: "cost",
                                                    },
                                                    {
                                                        label: "Platform Fee",
                                                        amount: 0,
                                                        highlighted: false,
                                                        type: "fee",
                                                    },
                                                    {
                                                        label: "Total Cost",
                                                        amount: getPrizeAmount() + totalFees,
                                                        highlighted: false,
                                                        type: "total",
                                                    },
                                                ]}
                                                {...(watchedRewardType === "usdc"
                                                    ? { USDC_EQUIVALENT: getPrizeAmount() + totalFees }
                                                    : {
                                                        requiredToken: getPrizeAmount() + totalFees,
                                                    })}
                                                handleConfirm={handleSubmit(onSubmit)}
                                                loading={isSubmitting}
                                                trigger={
                                                    <Button disabled={isSubmitting || !isValid} className="shadow-sm shadow-foreground">
                                                        {isSubmitting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Creating Action...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Coins className="mr-2 h-4 w-4" />
                                                                Pay Now
                                                            </>
                                                        )}
                                                    </Button>
                                                }
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </form>
                    </FormProvider>
                </motion.div>
            </DialogContent>
        </Dialog>
    )
}

function DetailsStep() {
    const {
        register,
        getValues,
        setValue,
        watch,
        formState: { errors },
    } = useFormContext<LocationBasedBountyFormType>()

    const session = useSession()
    const { needSign } = useNeedSign()
    const title = watch("title", "")
    const rewardType = watch("rewardType")
    const usdcAmount = watch("usdcAmount")
    const platformAssetAmount = watch("platformAssetAmount")
    const totalWinner = watch("winners")
    const [loading, setLoading] = useState(false)

    const handleEditorChange = (value: string): void => {
        setValue("description", value)
    }

    const CheckUSDCTrustLine = api.bounty.Bounty.checkUSDCTrustLine.useQuery(undefined, {
        enabled: session.status === "authenticated" && getValues("rewardType") === "usdc",
    })

    const AddTrustMutation = api.walletBalance.wallBalance.addTrustLine.useMutation({
        onSuccess: async (data) => {
            try {
                const clientResponse = await clientsign({
                    walletType: session.data?.user?.walletType,
                    presignedxdr: data.xdr,
                    pubkey: data.pubKey,
                    test: clientSelect(),
                })
                if (clientResponse) {
                    toast.success("Added trustline successfully")
                    try {
                        await api.useUtils().walletBalance.wallBalance.getWalletsBalance.refetch()
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
                setLoading(false)
            }
        },
        onError: (error) => {
            setLoading(false)
            toast.error(error.message)
        },
    })

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            {/* Basic Information Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                            <FileText className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Basic Information</h3>
                            <p className="text-sm text-muted-foreground">Enter the essential details about your action</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="title" className="text-sm font-medium">
                            Action Title
                        </Label>
                        <div className="relative">
                            <Input
                                id="title"
                                {...register("title")}
                                placeholder="Enter a compelling title that attracts participants"
                                maxLength={65}
                                className="pr-20 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                            />
                            <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                                {65 - (title?.length || 0)} left
                            </div>
                        </div>
                        {errors.title && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-red-500"></span>
                                {errors.title.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="description" className="text-sm font-medium">
                            Description
                        </Label>
                        <Editor
                            value={getValues("description")}
                            onChange={handleEditorChange}
                            placeholder="Provide clear instructions on what participants need to do to earn this action..."
                            className="min-h-32 resize-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-red-500"></span>
                                {errors.description.message}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Bounty Rewards Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-accent/20 to-accent/20">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                            <DollarSign className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Action Rewards</h3>
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

                    <div className="grid grid-cols-2 gap-4">
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
                                        placeholder="0.00000"
                                    />
                                )}
                            </div>
                            {errors.usdcAmount && <p className="text-xs text-red-500">{errors.usdcAmount.message}</p>}
                            {errors.platformAssetAmount && (
                                <p className="text-xs text-red-500">{errors.platformAssetAmount.message}</p>
                            )}
                        </div>

                        {/* Winners Input */}
                        <div className="space-y-2">
                            <Label htmlFor="winners" className="text-sm font-medium">
                                Number of Winners
                            </Label>
                            <div className="relative">
                                <Trophy className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="winners"
                                    type="number"
                                    step={1}
                                    min={1}
                                    {...register("winners", { valueAsNumber: true })}
                                    className="pl-10"
                                    placeholder="1"
                                />
                            </div>
                            {errors.winners && <p className="text-xs text-red-500">{errors.winners.message}</p>}
                        </div>
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
                            {rewardType === "usdc" && CheckUSDCTrustLine.data === false && (
                                <Button
                                    type="button"
                                    onClick={() =>
                                        AddTrustMutation.mutate({
                                            asset_code: USDCCode,
                                            asset_issuer: USDCIssuer,
                                            signWith: needSign(),
                                        })
                                    }
                                    disabled={AddTrustMutation.isLoading}
                                    variant={"outline"}
                                >
                                    {AddTrustMutation.isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Adding Trust
                                        </>
                                    ) : (
                                        "Add Trust"
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}

function LocationStep() {
    const {
        register,
        watch,
        setValue,
        formState: { errors },
    } = useFormContext<LocationBasedBountyFormType>()

    const radius = watch("radius")
    const { setIsOpen: setMapModalOpen, setPosition } = useCreatorMapModalStore()

    const handleOpenMapModal = () => {
        const latitude = watch("latitude")
        const longitude = watch("longitude")
        if (latitude && longitude) {
            setPosition({
                lat: Number.parseFloat(latitude),
                lng: Number.parseFloat(longitude),
            })
        }
        setMapModalOpen(true)
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                            <MapPin className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Location Settings</h3>
                            <p className="text-sm text-muted-foreground">
                                Set the exact location where users need to be to claim this action
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-2 text-amber-800">
                                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <p className="text-sm">
                                    Enter the exact coordinates where users need to be to claim this action. The proximity radius
                                    determines how close they need to be.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="latitude" className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Latitude
                            </Label>
                            <Input
                                id="latitude"
                                {...register("latitude")}
                                placeholder="e.g. 40.7128"
                                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                            />
                            {errors.latitude && <p className="text-sm text-destructive">{errors.latitude.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="longitude" className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Longitude
                            </Label>
                            <Input
                                id="longitude"
                                {...register("longitude")}
                                placeholder="e.g. -74.0060"
                                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                            />
                            {errors.longitude && <p className="text-sm text-destructive">{errors.longitude.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="radius" className="flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Proximity Radius
                            </Label>
                            <span className="text-sm font-medium text-blue-600">{radius} meters</span>
                        </div>
                        <input
                            type="range"
                            id="radius"
                            min="10"
                            max="1000"
                            step="10"
                            value={radius}
                            onChange={(e) => setValue("radius", Number.parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">Users must be within this distance to claim the action</p>
                    </div>

                    <Card className="bg-gray-50 border-gray-200">
                        <CardContent className="p-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">How to find coordinates:</h4>
                            <ol className="text-xs text-gray-600 list-decimal pl-4 space-y-1">
                                <li>Open Artist Maps</li>
                                <li>Right-click on your desired location</li>
                                <li>Click Copy Coordinates</li>
                                <li>The coordinates will be copied.</li>
                            </ol>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function MediaStep({
    media,
    removeMediaItem,
    addMediaItem,
    loading,
}: {
    media: MediaInfoType[]
    removeMediaItem: (index: number) => void
    addMediaItem: (url: string, type: MediaType) => void
    loading: boolean
}) {
    const { trigger } = useFormContext<LocationBasedBountyFormType>()

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Action Media</h2>
                <p className="text-sm text-muted-foreground">Add images to make your action more engaging</p>
            </div>

            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                    <div className="flex items-start gap-2 text-amber-800">
                        <Camera className="mt-0.5 h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">
                            Upload up to 4 images to showcase your action. The first image will be used as the main thumbnail.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {media.map((item, index) => (
                            <div key={index} className="relative aspect-square overflow-hidden rounded-md border">
                                <Image
                                    src={item.url || "/placeholder.svg"}
                                    alt={`Uploaded media ${index + 1}`}
                                    fill
                                    className="object-cover"
                                />
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="absolute right-1 top-1 h-6 w-6 rounded-full"
                                    onClick={() => removeMediaItem(index)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                                {index === 0 && <Badge className="absolute bottom-1 left-1 bg-primary/80">Main</Badge>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                        <Camera className="mb-2 h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground">No images uploaded yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">Upload images to increase user engagement</p>
                    </div>
                )}

                {media.length < 4 && (
                    <UploadS3Button
                        variant="button"
                        className="w-full"
                        label={media.length === 0 ? "Upload Thumbnail Images" : "Add More Images"}
                        disabled={media.length >= 4 || loading}
                        endpoint="imageUploader"
                        onClientUploadComplete={(res) => {
                            const data = res
                            if (data?.url) {
                                addMediaItem(data.url, MediaType.IMAGE)
                                trigger().catch((e) => console.log(e))
                            }
                        }}
                        onUploadError={(error: Error) => {
                            toast.error(`Upload Error: ${error.message}`)
                        }}
                    />
                )}

                {media.length >= 4 && <p className="text-xs text-amber-600">Maximum number of uploads reached (4/4)</p>}
            </div>

            <Card className="border-gray-200 bg-gray-50">
                <CardContent className="p-4">
                    <h4 className="mb-2 text-sm font-medium text-gray-700">Tips for great action images:</h4>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                        <li>Use high-quality, relevant images</li>
                        <li>Include a clear main thumbnail</li>
                        <li>Show examples of what you{"'re"} looking for</li>
                        <li>Avoid text-heavy images; put details in the description</li>
                    </ul>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function SettingsStep() {
    const {
        register,
        setValue,
        watch,
        formState: { errors },
    } = useFormContext<LocationBasedBountyFormType>()

    const generateRedeemCodes = watch("generateRedeemCodes")
    const totalWinner = watch("winners")
    const selectedAssetCode = watch("requiredBalanceCode")
    const { platformAssetBalance } = useUserStellarAcc()

    const pageAssetbal = api.fan.creator.getCreatorPageAssetBalance.useQuery()
    const shopAssetbal = api.fan.creator.getCreatorShopAssetBalance.useQuery()

    const [selectedAsset, setSelectedAsset] = useState<selectedAssetType | null>(null)

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Action Settings</h2>
                <p className="text-sm text-muted-foreground">Configure participation requirements and additional options</p>
            </div>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-indigo-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                            <Users className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Participation Requirements</h3>
                            <p className="text-sm text-muted-foreground">Set minimum balance requirements for participants</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-4 items-center">
                        {/* Required Asset Selection */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Required Asset <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                onValueChange={(value) => {
                                    const parts = value.split(" ")
                                    if (parts.length === 4) {
                                        setValue("requiredBalanceCode", parts[0] ?? "", { shouldValidate: true })
                                        setValue("requiredBalanceIssuer", parts[1] ?? "", { shouldValidate: true })
                                        setValue("requiredBalance", 0)
                                        setSelectedAsset({
                                            assetCode: parts[0] ?? "",
                                            assetIssuer: parts[1] ?? "",
                                            balance: Number.parseFloat(parts[2] ?? "0"),
                                            assetType: (parts[3] as assetType) ?? "defaultAssetType",
                                        })
                                    }
                                }}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "focus-visible:ring-2 focus-visible:ring-purple-500/20",
                                        errors.requiredBalanceCode && "border-red-500",
                                    )}
                                >
                                    <SelectValue placeholder="Select an asset (required)" />
                                </SelectTrigger>
                                <SelectContent className="w-full max-w-sm max-h-64 overflow-y-auto">
                                    <SelectGroup className="w-full">
                                        <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                                            <SelectLabel className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                                                Page Asset
                                            </SelectLabel>
                                        </div>
                                        {pageAssetbal.data && (
                                            <>
                                                <SelectItem
                                                    value={`${pageAssetbal.data.assetCode} ${pageAssetbal.data.assetIssuer} ${pageAssetbal.data.balance} PAGEASSET`}
                                                    className="px-3 py-3 w-full hover:bg-purple-50/80 focus:bg-purple-50 cursor-pointer transition-colors"
                                                >
                                                    <div className="grid grid-cols-2 items-center justify-between w-full ">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                                                                <span className="text-xs font-bold text-purple-700">
                                                                    {pageAssetbal.data.assetCode.slice(0, 2)}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-gray-900 text-sm">
                                                                    {pageAssetbal.data.assetCode}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="grid justify-end">
                                                            <Badge
                                                                variant="secondary"
                                                                className="bg-purple-100 text-purple-800 font-medium text-xs px-2 py-1"
                                                            >
                                                                {Number(pageAssetbal.data.balance).toLocaleString(undefined, {
                                                                    maximumFractionDigits: 2,
                                                                })}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                                <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 mt-2">
                                                    <SelectLabel className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                                                        Platform Asset
                                                    </SelectLabel>
                                                </div>
                                                <SelectItem
                                                    value={`${PLATFORM_ASSET.code} ${PLATFORM_ASSET.issuer} ${platformAssetBalance} PLATFORMASSET`}
                                                    className="px-3 py-3 hover:bg-amber-50/80 focus:bg-amber-50 cursor-pointer transition-colors"
                                                >
                                                    <div className="items-center justify-between w-full  grid grid-cols-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                                                                <span className="text-xs font-bold text-amber-700">
                                                                    {PLATFORM_ASSET.code.slice(0, 2)}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-gray-900 text-sm">{PLATFORM_ASSET.code}</span>
                                                            </div>
                                                        </div>
                                                        <div className="grid justify-end">
                                                            <Badge
                                                                variant="secondary"
                                                                className="bg-amber-100 text-amber-800 font-medium text-xs px-2 py-1"
                                                            >
                                                                {Number(platformAssetBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            </>
                                        )}
                                        <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100 mt-2">
                                            <SelectLabel className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                                                Shop Assets
                                            </SelectLabel>
                                        </div>
                                        {!shopAssetbal.data ? (
                                            <div className="flex w-full items-center justify-center p-6 text-sm text-muted-foreground">
                                                <div className="text-center">
                                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                                                        <span className="text-gray-400">💼</span>
                                                    </div>
                                                    <span className="text-gray-500">No Shop Assets Available</span>
                                                </div>
                                            </div>
                                        ) : (
                                            shopAssetbal.data.map((asset) =>
                                                asset.asset_type === "credit_alphanum4" ||
                                                    (asset.asset_type === "credit_alphanum12" &&
                                                        asset.asset_code !== pageAssetbal.data?.assetCode &&
                                                        asset.asset_issuer !== pageAssetbal.data?.assetIssuer) ? (
                                                    <SelectItem
                                                        key={asset.asset_code}
                                                        value={`${asset.asset_code} ${asset.asset_issuer} ${asset.balance} SHOPASSET`}
                                                        className="px-3 py-3 hover:bg-blue-50/80 focus:bg-blue-50 cursor-pointer transition-colors"
                                                    >
                                                        <div className="grid items-center justify-between w-full ">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-blue-700">
                                                                        {asset.asset_code.slice(0, 2)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-900 text-sm">{asset.asset_code}</span>
                                                                    <span className="text-xs text-gray-500">Shop Asset</span>
                                                                </div>
                                                            </div>
                                                            <div className="grid justify-end">
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="bg-blue-100 text-blue-800 font-medium text-xs px-2 py-1"
                                                                >
                                                                    {Number(asset.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ) : null,
                                            )
                                        )}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {errors.requiredBalanceCode && (
                                <p className="text-sm text-red-500 flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-red-500"></span>
                                    {errors.requiredBalanceCode.message}
                                </p>
                            )}
                        </div>

                        {/* Minimum Balance - shown after asset selection */}
                        {selectedAsset && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-2"
                            >
                                <Label htmlFor="requiredBalance" className="text-sm font-medium">
                                    Minimum Balance Required
                                </Label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Coins className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <Input
                                        id="requiredBalance"
                                        type="number"
                                        step={0.00001}
                                        min={0}
                                        {...register("requiredBalance", { valueAsNumber: true })}
                                        className="pl-10 pr-12"
                                        placeholder="0"
                                    />
                                    <div className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                        {selectedAsset.assetCode}
                                    </div>
                                </div>
                                {errors.requiredBalance && <p className="text-sm text-red-500">{errors.requiredBalance.message}</p>}
                            </motion.div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Generate Redeem Codes Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-indigo-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                            <Ticket className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Redeem Codes</h3>
                            <p className="text-sm text-muted-foreground">Generate unique codes for winners</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="generateRedeemCodes" className="text-sm font-medium cursor-pointer">
                                    Generate Redeem Codes
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Automatically generate unique redeem codes for each winner
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="generateRedeemCodes"
                            checked={generateRedeemCodes}
                            onCheckedChange={(checked) => setValue("generateRedeemCodes", checked)}
                        />
                    </div>

                    {generateRedeemCodes && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-lg bg-emerald-50 p-3 border border-emerald-200"
                        >
                            <div className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-emerald-700">
                                    <p className="font-medium mb-1">
                                        {totalWinner} unique redeem code{totalWinner > 1 ? "s" : ""} will be generated
                                    </p>
                                    <p>Each winner will receive a unique code that can only be redeemed once.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}

function ReviewStep({
    media,
    title,
    rewardType,
    usdcAmount,
    platformAssetAmount,
    winners,
    requiredBalance,
    requiredBalanceCode,
    generateRedeemCodes,
    latitude,
    longitude,
    radius,
}: {
    media: MediaInfoType[]
    title: string
    rewardType: "usdc" | "platform_asset"
    usdcAmount?: number
    platformAssetAmount?: number
    winners: number
    requiredBalance?: number
    requiredBalanceCode?: string
    generateRedeemCodes?: boolean
    latitude: string
    longitude: string
    radius: number
}) {
    const { watch } = useFormContext<LocationBasedBountyFormType>()
    const description = watch("description")

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Review Your Action</h2>
                <p className="text-sm text-muted-foreground">Please review all information before submitting</p>
            </div>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="space-y-4 p-4">
                    <div>
                        <h3 className="text-lg font-semibold">{title || "Untitled Action"}</h3>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium">Description</p>
                        <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: description }} />
                    </div>

                    <Separator />

                    {/* Location Section */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Location</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Badge className="font-mono bg-muted text-muted-foreground hover:bg-muted">Lat: {latitude}</Badge>
                            </div>
                            <div>
                                <Badge className="font-mono bg-muted text-muted-foreground hover:bg-muted">Lng: {longitude}</Badge>
                            </div>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Proximity Radius:</span>
                            <span className="font-medium">{radius} meters</span>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Reward Details</p>
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Reward Type:</span>
                                <Badge
                                    variant="secondary"
                                    className={rewardType === "usdc" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                                >
                                    {rewardType === "usdc" ? "USDC" : PLATFORM_ASSET.code.toUpperCase()}
                                </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Prize Amount:</span>
                                <span className="font-medium">
                                    {rewardType === "usdc"
                                        ? `$${usdcAmount?.toFixed(5) ?? 0} USDC`
                                        : `${(platformAssetAmount ?? 0).toFixed(5)} ${PLATFORM_ASSET.code.toUpperCase()}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Number of Winners:</span>
                                <span className="font-medium">{winners || 1}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Prize per Winner:</span>
                                <span className="font-medium">
                                    {rewardType === "usdc"
                                        ? `$${((usdcAmount ?? 0) / (winners || 1)).toFixed(5)} USDC`
                                        : `${((platformAssetAmount ?? 0) / (winners || 1)).toFixed(5)} ${PLATFORM_ASSET.code.toUpperCase()}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Participation Requirements</p>
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Required Asset:</span>
                                <Badge variant="outline" className="font-medium">
                                    {requiredBalanceCode ?? "Not set"}
                                </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Minimum Balance:</span>
                                <span className="font-medium">
                                    {requiredBalance !== undefined && requiredBalance > 0
                                        ? `${requiredBalance} ${requiredBalanceCode}`
                                        : "No minimum (trustline required)"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium">Redeem Codes</p>
                        <div className="flex items-center gap-2 mt-1">
                            {generateRedeemCodes ? (
                                <>
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                                        <Ticket className="h-3 w-3 mr-1" />
                                        Enabled
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {winners} unique code{winners > 1 ? "s" : ""} will be generated
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-muted-foreground">No redeem codes will be generated</span>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium">Media</p>
                        {media.length > 0 ? (
                            <div className="mt-2 grid grid-cols-4 gap-2">
                                {media.map((item, index) => (
                                    <div key={index} className="relative aspect-square overflow-hidden rounded-md border">
                                        <Image
                                            src={item.url || "/placeholder.svg"}
                                            alt={`Thumbnail ${index + 1}`}
                                            fill
                                            className="object-cover"
                                        />
                                        {index === 0 && <Badge className="absolute bottom-1 left-1 bg-primary/80">Main</Badge>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No images uploaded</p>
                        )}
                    </div>

                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="flex items-center gap-2 p-3">
                            <Check className="h-5 w-5 text-green-500" />
                            <p className="text-sm text-amber-800">
                                Your action is ready to be created. Choose to pay now or pay later.
                            </p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </motion.div>
    )
}

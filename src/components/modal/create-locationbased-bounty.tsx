"use client"

import { useState, useEffect } from "react"
import { useForm, FormProvider, useFormContext, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"
// Add the missing Users icon import
import {
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
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Progress } from "~/components/shadcn/ui/progress"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Separator } from "~/components/shadcn/ui/separator"
import { Badge } from "~/components/shadcn/ui/badge"
import { cn } from "~/lib/utils"
import { useCreatorMapModalStore } from "../store/creator-map-modal-store"
import { useCreateLocationBasedBountyStore } from "../store/create-locationbased-bounty-store"
import { PLATFORM_ASSET, PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { api } from "~/utils/api"
import { Editor } from "../common/quill-editor"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { clientsign } from "package/connect_wallet"
import useNeedSign from "~/lib/hook"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { clientSelect } from "~/lib/stellar/fan/utils"


// Define the schema for the bounty form
export const BountyFormSchema = z
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
        brandAmount: z
            .number({
                required_error: "Prize must be a number",
                invalid_type_error: "Prize must be a number",
            })
            .min(0.00001, { message: "Prize can't be less than 0.00001" }),
        usdtAmount: z
            .number({
                required_error: "Prize must be a number",
                invalid_type_error: "Prize must be a number",
            })
            .min(0.00001, { message: "Prize can't be less than 0.00001" }),
        winners: z.number().int().min(1, "Must have at least 1 winner").max(100, "Cannot have more than 100 winners"),
        requiredBalance: z
            .number({
                required_error: "Required Balance must be a number",
                invalid_type_error: "Required Balance must be a number",
            })
            .nonnegative({ message: "Required Balance can't be less than 0" })

    })
    .refine((data) => data.brandAmount ?? data.usdtAmount, {
        message: "You must specify at least one currency amount",
        path: ["brandAmount"],
    })

type BountyFormType = z.infer<typeof BountyFormSchema>


// Define the steps
type FormStep = "details" | "location" | "reward" | "review"
const FORM_STEPS: FormStep[] = ["details", "location", "reward", "review"]

export default function CreateLocationBasedBountyModal() {
    const [activeStep, setActiveStep] = useState<FormStep>("details")
    const [formProgress, setFormProgress] = useState(25)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { setIsOpen: SetIsBountyOpen, data, isOpen: isBountyOpen } = useCreateLocationBasedBountyStore()
    const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore()
    const { platformAssetBalance } = useUserStellarAcc()
    const totalFees = 2 * Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)
    const utils = api.useUtils()
    const { needSign } = useNeedSign()
    const session = useSession()
    const { data: prizeRate } = api.bounty.Bounty.getCurrentUSDFromAsset.useQuery()
    const [showConfetti, setShowConfetti] = useState(false)

    const methods = useForm<BountyFormType>({
        mode: "onChange",
        resolver: zodResolver(BountyFormSchema),
        defaultValues: {
            title: "",
            description: "",
            latitude: "",
            longitude: "",
            radius: 100,
            brandAmount: 0,
            usdtAmount: 0,
            winners: 1,
            requiredBalance: 0,
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

    useEffect(() => {
        if (data) {
            setValue("latitude", data.lat.toString())
            setValue("longitude", data.lng.toString())
        }
    }, [data, methods])

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
    const canProceed = () => {
        const { trigger } = methods

        // Define fields to validate for each step
        const fieldsToValidate: Record<FormStep, (keyof BountyFormType)[]> = {
            details: ["title", "description"],
            location: ["latitude", "longitude", "radius"],
            reward: ["brandAmount", "usdtAmount", "winners"],
            review: [],
        }

        // Trigger validation for the current step's fields
        return trigger(fieldsToValidate[activeStep])
    }

    const handleNext = async () => {
        const isValid = await canProceed()
        if (isValid) {
            goToNextStep()
        }
    }
    const CreateBountyMutation = api.bounty.Bounty.createLocationBounty.useMutation({
        onSuccess: async (data) => {
            toast.success("Bounty Created Successfully! 🎉")
            setShowConfetti(true)
            utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
                console.error("Error refetching bounties", error)
            })
            setTimeout(() => {
                handleClose()


            }, 2000)
        },
    })
    const XLMRate = api.bounty.Bounty.getXLMPrice.useQuery().data

    const SendBalanceToBountyMother = api.bounty.Bounty.sendBountyBalanceToMotherAcc.useMutation({
        onSuccess: async (data, { method }) => {
            if (data) {
                try {
                    setIsSubmitting(true)
                    const clientResponse = await clientsign({
                        presignedxdr: data.xdr,
                        walletType: session.data?.user?.walletType,
                        pubkey: data.pubKey,
                        test: clientSelect(),
                    })

                    if (clientResponse) {
                        CreateBountyMutation.mutate({
                            title: getValues("title"),
                            description: getValues("description"),
                            latitude: getValues("latitude"),
                            longitude: getValues("longitude"),
                            radius: getValues("radius"),
                            brandAmount: getValues("brandAmount"),
                            usdtAmount: getValues("usdtAmount"),
                            winners: getValues("winners"),
                            requiredBalance: getValues("requiredBalance"),
                        })
                        setIsSubmitting(false)
                        reset()
                    } else {
                        setIsSubmitting(false)
                        reset()
                        toast.error("Error in signing transaction")
                    }
                    setIsOpen(false)
                } catch (error) {
                    setIsSubmitting(false)
                    console.error("Error sending balance to bounty mother", error)
                    reset()
                }
            }
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            reset()
            setIsSubmitting(false)
            setIsOpen(false)
        },
    })

    const onSubmit: SubmitHandler<z.infer<typeof BountyFormSchema>> = async () => {
        const isValid = await trigger()
        if (isValid) {
            setIsSubmitting(true)
            console.log("Submitting form", getValues())
            // Get the prize amount from brandAmount
            const prizeAmount = Number(getValues("brandAmount") || 0)
            console.log("Prize amount", prizeAmount)
            SendBalanceToBountyMother.mutate({
                signWith: needSign(),
                prize: prizeAmount,
                method: paymentMethod,
                fees: paymentMethod === "asset" ? totalFees :
                    paymentMethod === "xlm" ? 1 :
                        paymentMethod === "usdc" ? 3 * (Number(getValues("usdtAmount") ?? 1) * (XLMRate ?? 1)) :
                            0,
            })
        }
    }


    const handleClose = () => {
        SetIsBountyOpen(false)
        setActiveStep("details")
        reset()
    }



    return (
        <>
            <Dialog open={isBountyOpen} onOpenChange={handleClose}>
                <DialogContent
                    onInteractOutside={(e) => {
                        e.preventDefault()
                    }}
                    className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-2"
                >
                    {showConfetti && (
                        <div className="fixed inset-0 pointer-events-none z-50">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1, opacity: [0, 1, 0] }}
                                    transition={{ duration: 2 }}
                                    className="text-4xl"
                                >
                                    <div className="flex items-center justify-center gap-2 text-primary">
                                        <Sparkles className="h-8 w-8" />
                                        <span className="font-bold">Bounty created successfully!</span>
                                        <Sparkles className="h-8 w-8" />
                                    </div>
                                </motion.div>
                            </div>
                            {Array.from({ length: 100 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 rounded-full"
                                    initial={{
                                        top: "50%",
                                        left: "50%",
                                        scale: 0,
                                        backgroundColor: ["#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33F3"][Math.floor(Math.random() * 5)],
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
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col h-full"
                    >
                        <DialogHeader className="px-2 md:px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Coins className="h-5 w-5" />
                                    <DialogTitle className="text-xl font-bold">Create New Bounty</DialogTitle>
                                </div>

                            </div>
                            <DialogDescription>Create a location-based bounty for users to claim</DialogDescription>

                            <Progress value={formProgress} className="mt-2 h-2" />

                            <div className="w-full px-2 md:px-4">
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
                                            <span className={cn("text-xs", activeStep === step ? "font-medium" : "text-muted-foreground")}>
                                                {step === "details"
                                                    ? "Details"
                                                    : step === "location"
                                                        ? "Location"
                                                        : step === "reward"
                                                            ? "Reward"
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
                                        {activeStep === "reward" && <RewardStep key="reward" />}
                                        {activeStep === "review" && <ReviewStep key="review" />}
                                    </AnimatePresence>
                                </div>

                                <div className="flex justify-between border-t p-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={goToPreviousStep}
                                        disabled={activeStep === "details" || isSubmitting}
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
                                        <>
                                            {platformAssetBalance < getValues("brandAmount") + totalFees ? (
                                                <Button disabled className="shadow-sm shadow-foreground">
                                                    Insufficient Balance
                                                </Button>
                                            ) : (
                                                <PaymentChoose
                                                    costBreakdown={[
                                                        {
                                                            label: "Bounty Prize",
                                                            amount: paymentMethod === "asset"
                                                                ? Number(getValues("brandAmount") + totalFees)
                                                                : paymentMethod === "xlm"
                                                                    ? Number(getValues("usdtAmount") / (XLMRate ?? 1))
                                                                    : paymentMethod === "usdc"
                                                                        ? Number(getValues("usdtAmount") / (XLMRate ?? 1))
                                                                        : 0,
                                                            highlighted: true,
                                                            type: "cost",
                                                        },
                                                        {
                                                            label: "Platform Fee",
                                                            amount: paymentMethod === "asset"
                                                                ? totalFees
                                                                : paymentMethod === "xlm"
                                                                    ? 1
                                                                    : paymentMethod === "usdc"
                                                                        ? 3 * (Number(getValues("usdtAmount") ?? 1) * (XLMRate ?? 1))
                                                                        : 0,
                                                            highlighted: false,
                                                            type: "fee",
                                                        },
                                                        {
                                                            label: "Total Cost",
                                                            amount: paymentMethod === "asset"
                                                                ? Number(getValues("brandAmount")) + totalFees
                                                                : paymentMethod === "xlm"
                                                                    ? Number(getValues("usdtAmount") / (XLMRate ?? 1)) + 1
                                                                    : paymentMethod === "usdc"
                                                                        ? Number(getValues("usdtAmount") / (XLMRate ?? 1)) + (3 * (Number(getValues("usdtAmount") ?? 1) * (XLMRate ?? 1)))
                                                                        : 0,
                                                            highlighted: false,
                                                            type: "total",
                                                        },
                                                    ]}
                                                    XLM_EQUIVALENT={Number(getValues("usdtAmount") / (XLMRate ?? 1)) + 1}
                                                    USDC_EQUIVALENT={Number(getValues("usdtAmount") / (XLMRate ?? 1)) + (3 * (Number(getValues("usdtAmount") ?? 1) * (XLMRate ?? 1)))}
                                                    handleConfirm={methods.handleSubmit(onSubmit)}
                                                    loading={isSubmitting}
                                                    requiredToken={getValues('brandAmount') + totalFees}
                                                    trigger={
                                                        <Button disabled={isSubmitting || !isValid} className="shadow-sm shadow-foreground">
                                                            {isSubmitting ? (
                                                                <>
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    Creating Bounty...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Coins className="mr-2 h-4 w-4" />
                                                                    Create Bounty
                                                                </>
                                                            )}
                                                        </Button>
                                                    }
                                                />
                                            )}
                                        </>
                                    )}

                                </div>
                            </form>
                        </FormProvider>
                    </motion.div>
                </DialogContent>
            </Dialog>
        </>
    )
}

function DetailsStep() {
    const {
        register,
        watch,
        getValues,
        setValue,
        formState: { errors },
    } = useFormContext<BountyFormType>()

    const title = watch("title")
    const handleEditorChange = (value: string): void => {
        setValue("description", value)
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Enter the basic details about your bounty</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Bounty Title
                    </Label>
                    <div className="relative">
                        <Input
                            id="title"
                            {...register("title")}
                            placeholder="Enter a catchy title"
                            maxLength={65}
                            className="transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                        />
                        <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
                            {65 - (title?.length || 0)} characters left
                        </div>
                    </div>
                    {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Description
                    </Label>
                    <Editor
                        value={getValues("description")}
                        onChange={handleEditorChange}
                        placeholder="Describe what users need to do to claim this bounty"
                        className="min-h-24 resize-none transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                    />
                    {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>

            </div>
        </motion.div>
    )
}

function LocationStep() {
    const {
        register,
        watch,
        setValue,
        formState: { errors },
    } = useFormContext<BountyFormType>()

    const radius = watch("radius")
    const { setIsOpen: setMapModalOpen, setPosition } = useCreatorMapModalStore()

    const handleOpenMapModal = () => {
        const latitude = watch("latitude")
        const longitude = watch("longitude")

        // If coordinates are already set, pass them to the map modal
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
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Location Settings</h2>
                <p className="text-sm text-muted-foreground">
                    Set the exact location where users need to be to claim this bounty
                </p>
            </div>

            <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                    <div className="flex items-start gap-2 text-amber-800">
                        <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">
                            Enter the exact coordinates where users need to be to claim this bounty. The proximity radius determines
                            how close they need to be.
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
                        className="transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
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
                        className="transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
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
                    <span className="text-sm font-medium text-amber-600">{radius} meters</span>
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
                <p className="text-xs text-muted-foreground">Users must be within this distance to claim the bounty</p>
            </div>

            <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">How to find coordinates:</h4>
                    <ol className="text-xs text-gray-600 list-decimal pl-4 space-y-1">
                        <li>Open Artist Maps</li>
                        <li>Right-click on your desired location</li>
                        <li>Click Copy Coordinates</li>
                        <li>The coordinates will copied.</li>
                    </ol>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function RewardStep() {
    const {
        register,
        watch,
        setValue,
        formState: { errors },
    } = useFormContext<BountyFormType>()
    const { data: prizeRate } = api.bounty.Bounty.getCurrentUSDFromAsset.useQuery()

    const winners = watch("winners")
    const brandAmount = watch("brandAmount")
    const usdtAmount = watch("usdtAmount")
    const handlePrizeChange = (value: string) => {
        const prizeUSD = Number(value) || 0
        setValue("usdtAmount", prizeUSD)

        // Make sure prize is a valid number before dividing
        if (prizeRate && Number(prizeRate) > 0) {
            const prizeValue = prizeUSD / Number(prizeRate)
            setValue("brandAmount", prizeValue)
        } else {
            setValue("brandAmount", 0)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Reward Settings</h2>
                <p className="text-sm text-muted-foreground">Define the rewards for completing this bounty</p>
            </div>

            <Card className="p-0">
                <CardContent className="p-0 md:p-4 space-y-4">
                    <h3 className="text-base font-medium text-amber-800">Bounty Rewards</h3>
                    <p className="text-sm text-amber-700">Specify reward amounts in one or both currencies</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* USD Prize */}
                        <div className="space-y-2">
                            <Label htmlFor="usdtAmount" className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-amber-600" />
                                USD Amount
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <DollarSign className="h-4 w-4 text-amber-500" />
                                </div>
                                <Input
                                    id="usdtAmount"
                                    onChange={(e) => handlePrizeChange(e.target.value)}
                                    value={watch("usdtAmount") || ""}
                                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                                    type="number"
                                    step={0.00001}
                                    min={0.00001}
                                    placeholder="Enter USD amount"
                                />
                            </div>
                            {errors.usdtAmount && <p className="text-sm text-destructive">{errors.usdtAmount.message}</p>}
                        </div>

                        {/* Platform asset amount */}
                        <div className="space-y-2">
                            <Label htmlFor="prize" className="flex items-center gap-2">
                                <Coins className="h-4 w-4 text-amber-600" />
                                {PLATFORM_ASSET.code.toLocaleUpperCase()} Amount
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <Coins className="h-4 w-4 text-amber-500" />
                                </div>
                                <Input
                                    id="prize"
                                    value={watch("brandAmount") ? watch("brandAmount").toFixed(5) : ""}
                                    readOnly
                                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                                    placeholder={`${PLATFORM_ASSET.code.toLocaleUpperCase()} equivalent`}
                                />
                            </div>
                            {errors.brandAmount && <p className="text-sm text-destructive">{errors.brandAmount.message}</p>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label htmlFor="winners" className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Number of Winners
                    </Label>
                    <span className="text-sm font-medium text-amber-600">
                        {winners} {winners === 1 ? "winner" : "winners"}
                    </span>
                </div>
                <input
                    type="range"
                    id="winners"
                    min="1"
                    max="20"
                    step="1"
                    value={winners}
                    onChange={(e) => setValue("winners", Number.parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">The reward will be split equally among all winners</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="requiredBalance" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Required Balance
                </Label>
                <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="requiredBalance"
                        type="number"
                        step={0.00001}
                        min={0}
                        {...register("requiredBalance", {
                            valueAsNumber: true,
                        })}
                        className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                        placeholder={`Min balance in ${PLATFORM_ASSET.code}`}
                    />
                </div>
                {errors.requiredBalance && <p className="text-sm text-destructive">{errors.requiredBalance.message}</p>}
                <p className="text-xs text-muted-foreground">Minimum balance users need to claim this bounty (optional)</p>
            </div>
            {(brandAmount ?? usdtAmount) && (
                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                        <h3 className="font-medium text-amber-800 mb-2">Reward Summary</h3>
                        <div className="space-y-3">
                            {brandAmount && (
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-600">Total {PLATFORM_ASSET.code.toLocaleUpperCase()}:</div>
                                    <div className="font-medium">{brandAmount} {PLATFORM_ASSET.code.toLocaleUpperCase()}</div>
                                    <div className="text-gray-600">Per Winner:</div>
                                    <div className="font-medium">{(Number(brandAmount) / winners).toFixed(2)} {PLATFORM_ASSET.code.toLocaleUpperCase()}</div>
                                </div>
                            )}

                            {usdtAmount && (
                                <div
                                    className={`grid grid-cols-2 gap-2 text-sm ${brandAmount ? "mt-3 pt-3 border-t border-amber-200" : ""}`}
                                >
                                    <div className="text-gray-600">Total USDT:</div>
                                    <div className="font-medium">{usdtAmount} USDT</div>
                                    <div className="text-gray-600">Per Winner:</div>
                                    <div className="font-medium">{(Number.parseFloat(usdtAmount.toString()) / winners).toFixed(2)} USDT</div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </motion.div>
    )
}

function ReviewStep() {
    const { watch } = useFormContext<BountyFormType>()
    const { setIsOpen: setMapModalOpen, setPosition } = useCreatorMapModalStore()

    const title = watch("title")
    const description = watch("description")
    const latitude = watch("latitude")
    const longitude = watch("longitude")
    const radius = watch("radius")
    const brandAmount = watch("brandAmount")
    const usdtAmount = watch("usdtAmount")
    const winners = watch("winners")
    const requiredBalance = watch("requiredBalance")



    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Review Your Bounty</h2>
                <p className="text-sm text-muted-foreground">Please review all information before submitting</p>
            </div>

            <Card className="border-amber-200">
                <CardContent className="p-4 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium">Description</p>
                        <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: description }} />
                    </div>

                    <Separator />

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Location</p>

                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Badge className="font-mono bg-muted text-muted-foreground hover:bg-muted">Lat: {latitude}</Badge>
                            </div>
                            <div>
                                <Badge className="font-mono bg-muted text-muted-foreground hover:bg-muted">Lng: {longitude}</Badge>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium">Proximity Radius</p>
                        <p className="text-sm text-muted-foreground">{radius} meters</p>
                    </div>

                    <Separator />

                    <div>
                        <p className="text-sm font-medium">Rewards</p>
                        <div className="mt-2 space-y-2">
                            {brandAmount && (
                                <div className="flex justify-between text-sm">
                                    <span>{PLATFORM_ASSET.code.toLocaleUpperCase()}:</span>
                                    <span className="font-medium">
                                        {brandAmount} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                                    </span>
                                </div>
                            )}
                            {usdtAmount && (
                                <div className="flex justify-between text-sm">
                                    <span>USDT:</span>
                                    <span className="font-medium">{usdtAmount} USDT</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span>Per Winner ({PLATFORM_ASSET.code.toLocaleUpperCase()}):</span>
                                <span className="font-medium">
                                    {(Number(brandAmount) / Number(winners)).toFixed(5)} {PLATFORM_ASSET.code.toLocaleUpperCase()}
                                </span>
                            </div>
                            {usdtAmount && (
                                <div className="flex justify-between text-sm">
                                    <span>Per Winner (USDT):</span>
                                    <span className="font-medium">{(Number(usdtAmount) / Number(winners)).toFixed(2)} USDT</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium">Winners</p>
                        <p className="text-sm text-muted-foreground">
                            {winners} {winners === 1 ? "winner" : "winners"}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-medium">Required Balance</p>
                        <p className="text-sm text-muted-foreground">
                            {requiredBalance ? `${requiredBalance} ${PLATFORM_ASSET.code}` : "No minimum balance required"}
                        </p>
                    </div>

                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-3 flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <p className="text-sm text-amber-800">
                                Your bounty is ready to be created. Click the button below to finalize.
                            </p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </motion.div>
    )
}

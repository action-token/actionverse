"use client"

import { useState, useEffect } from "react"
import { useForm, FormProvider, useFormContext } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"
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
    ArrowRight,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Progress } from "~/components/shadcn/ui/progress"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Separator } from "~/components/shadcn/ui/separator"
import { Badge } from "~/components/shadcn/ui/badge"
import { cn } from "~/lib/utils"
import { useCreatorMapModalStore } from "../store/creator-map-modal-store"
import { useCreateLocationBasedBountyStore } from "../store/create-locationbased-bounty-store"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"

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
        actionAmount: z
            .string()
            .optional()
            .refine((val) => !val || Number.parseFloat(val) > 0, {
                message: `${PLATFORM_ASSET.code.toLocaleUpperCase()} amount must be a positive number`,
            }),
        usdtAmount: z
            .string()
            .optional()
            .refine((val) => !val || Number.parseFloat(val) > 0, {
                message: "USDT amount must be a positive number",
            }),
        winners: z.number().int().min(1, "Must have at least 1 winner").max(100, "Cannot have more than 100 winners"),
    })
    .refine((data) => data.actionAmount ?? data.usdtAmount, {
        message: "You must specify at least one currency amount",
        path: ["actionAmount"],
    })

type BountyFormType = z.infer<typeof BountyFormSchema>

// Define the steps
type FormStep = "details" | "location" | "reward" | "review"
const FORM_STEPS: FormStep[] = ["details", "location", "reward", "review"]

export default function CreateBountyModal() {
    const [activeStep, setActiveStep] = useState<FormStep>("details")
    const [formProgress, setFormProgress] = useState(25)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { setIsOpen, data, isOpen } = useCreateLocationBasedBountyStore()

    const methods = useForm<BountyFormType>({
        mode: "onChange",
        resolver: zodResolver(BountyFormSchema),
        defaultValues: {
            title: "",
            description: "",
            latitude: "",
            longitude: "",
            radius: 100,
            actionAmount: "",
            usdtAmount: "",
            winners: 1,
        },
    })

    useEffect(() => {
        if (data) {
            methods.setValue("latitude", data.lat.toString())
            methods.setValue("longitude", data.lng.toString())
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
            reward: ["actionAmount", "usdtAmount", "winners"],
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

    const handleSubmit = async () => {
        const isValid = await methods.trigger()
        if (isValid) {
            setIsSubmitting(true)

            // Simulate API call
            setTimeout(() => {
                console.log("Form data:", methods.getValues())
                setIsSubmitting(false)
                setIsOpen(false)
                alert("Bounty created successfully!")
                methods.reset()
                setActiveStep("details")
            }, 1500)
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setActiveStep("details")
        methods.reset()
    }



    return (
        <>


            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent
                    onInteractOutside={(e) => {
                        e.preventDefault()
                    }}
                    className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-2"
                >
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
                                        <Button
                                            type="button"
                                            onClick={handleNext}
                                            className="shadow-sm shadow-foreground"
                                        >
                                            Next
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={isSubmitting}
                                            className="shadow-sm shadow-foreground"
                                        >
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
        formState: { errors },
    } = useFormContext<BountyFormType>()

    const title = watch("title")

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
                    <Textarea
                        id="description"
                        {...register("description")}
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

    const winners = watch("winners")
    const actionAmount = watch("actionAmount")
    const usdtAmount = watch("usdtAmount")

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

                    <div className="space-y-4">
                        {/* Action input */}
                        <div className="space-y-2">
                            <Label htmlFor="actionAmount" className="flex items-center gap-2">
                                <Coins className="h-4 w-4 text-amber-600" />
                                {PLATFORM_ASSET.code.toLocaleUpperCase()} Amount
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <Coins className="h-4 w-4 text-amber-500" />
                                </div>
                                <Input
                                    id="actionAmount"
                                    {...register("actionAmount")}
                                    placeholder={`Enter ${PLATFORM_ASSET.code.toLocaleUpperCase()} amount`}
                                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                                />
                            </div>
                            {errors.actionAmount && <p className="text-sm text-destructive">{errors.actionAmount.message}</p>}
                        </div>

                        {/* USDT input */}
                        <div className="space-y-2">
                            <Label htmlFor="usdtAmount" className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                USDT Amount
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <DollarSign className="h-4 w-4 text-green-500" />
                                </div>
                                <Input
                                    id="usdtAmount"
                                    {...register("usdtAmount")}
                                    placeholder="Enter USDT amount"
                                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-amber-500/20"
                                />
                            </div>
                            {errors.usdtAmount && <p className="text-sm text-destructive">{errors.usdtAmount.message}</p>}
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

            {(actionAmount ?? usdtAmount) && (
                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                        <h3 className="font-medium text-amber-800 mb-2">Reward Summary</h3>
                        <div className="space-y-3">
                            {actionAmount && (
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-600">Total {PLATFORM_ASSET.code.toLocaleUpperCase()}:</div>
                                    <div className="font-medium">{actionAmount} {PLATFORM_ASSET.code.toLocaleUpperCase()}</div>
                                    <div className="text-gray-600">Per Winner:</div>
                                    <div className="font-medium">{(Number.parseFloat(actionAmount) / winners).toFixed(2)} {PLATFORM_ASSET.code.toLocaleUpperCase()}</div>
                                </div>
                            )}

                            {usdtAmount && (
                                <div
                                    className={`grid grid-cols-2 gap-2 text-sm ${actionAmount ? "mt-3 pt-3 border-t border-amber-200" : ""}`}
                                >
                                    <div className="text-gray-600">Total USDT:</div>
                                    <div className="font-medium">{usdtAmount} USDT</div>
                                    <div className="text-gray-600">Per Winner:</div>
                                    <div className="font-medium">{(Number.parseFloat(usdtAmount) / winners).toFixed(2)} USDT</div>
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
    const actionAmount = watch("actionAmount")
    const usdtAmount = watch("usdtAmount")
    const winners = watch("winners")

    const handleViewOnMap = () => {
        if (latitude && longitude) {
            setPosition({
                lat: Number.parseFloat(latitude),
                lng: Number.parseFloat(longitude),
            })
            setMapModalOpen(true)
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
                        <p className="text-sm text-muted-foreground">{description}</p>
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
                            {actionAmount && (
                                <div className="flex justify-between text-sm">
                                    <span>{PLATFORM_ASSET.code.toLocaleUpperCase()}:</span>
                                    <span className="font-medium">{actionAmount} {PLATFORM_ASSET.code.toLocaleUpperCase()}</span>
                                </div>
                            )}
                            {usdtAmount && (
                                <div className="flex justify-between text-sm">
                                    <span>USDT:</span>
                                    <span className="font-medium">{usdtAmount} USDT</span>
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


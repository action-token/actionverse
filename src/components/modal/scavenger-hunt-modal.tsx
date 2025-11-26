"use client"

import { useEffect, useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import BasicInfoForm from "~/components/scavenger-hunt/basic-info-form"
import LocationsForm from "~/components/scavenger-hunt/locations-form"
import ReviewForm from "~/components/scavenger-hunt/review-form"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import PrizeDetailsForm from "~/components/scavenger-hunt/prize-details-form"

import { ChevronLeft, ChevronRight, Coins, Loader2 } from "lucide-react"
import { useScavengerHuntModalStore } from "../store/scavenger-hunt-modal-store"
import { api } from "~/utils/api"
import { clientsign } from "package/connect_wallet"
import { useSession } from "next-auth/react"
import { clientSelect } from "~/lib/stellar/fan/utils"

import { MediaType } from "@prisma/client"
import useNeedSign from "~/lib/hook"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import ConfigForm from "../scavenger-hunt/config-form"
import DefaultInfoForm from "../scavenger-hunt/default-info-form"
import toast from "react-hot-toast"
import { PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"

// Define the location type

export const MediaInfo = z.object({
    url: z.string(),
    type: z.nativeEnum(MediaType),
})
type MediaInfoType = z.TypeOf<typeof MediaInfo>

export const scavengerHuntSchema = z
    .object({
        title: z.string().min(3, { message: "Title must be at least 3 characters" }),
        description: z.string().min(10, { message: "Description must be at least 10 characters" }),
        coverImageUrl: z.array(MediaInfo).optional(),
        numberOfSteps: z.coerce.number().int().min(1, { message: "At least one step is required" }),
        useSameInfoForAllSteps: z.boolean(),
        defaultLocationInfo: z
            .object({
                title: z.string().min(1, { message: "Title is required" }),
                description: z.string().optional(), // Description is optional
                pinImage: z.string().min(1, { message: "Pin image is required" }),
                pinUrl: z.string().url({ message: "Must be a valid URL" }),
                startDate: z.date({ required_error: "Start date is required" }),
                endDate: z.date({ required_error: "End date is required" }),
                collectionLimit: z.coerce.number().int().positive({ message: "Collection limit must be positive" }),
                radius: z.coerce.number().positive({ message: "Radius must be positive" }),
                autoCollect: z.boolean(),
            })
            .optional()
            .superRefine((data, ctx) => {
                // Only validate if useSameInfoForAllSteps is true
                if (ctx.path[0] === "defaultLocationInfo" && data) {
                    if (!data.title) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Title is required",
                            path: ["title"],
                        })
                    }
                    if (!data.pinImage) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Pin image is required",
                            path: ["pinImage"],
                        })
                    }
                    if (!data.startDate) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Start date is required",
                            path: ["startDate"],
                        })
                    }
                    if (!data.endDate) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "End date is required",
                            path: ["endDate"],
                        })
                    }
                    if (!data.pinUrl) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Pin URL is required",
                            path: ["pinUrl"],
                        })
                    }
                    if (!data.collectionLimit || data.collectionLimit < 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Collection limit must be at least 1",
                            path: ["collectionLimit"],
                        })
                    }
                    if (!data.radius || data.radius < 10) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Radius must be at least 10 meters",
                            path: ["radius"],
                        })
                    }
                }
            }),
        priceInXLM: z.coerce.number().nonnegative({ message: "Price must be a positive number" }).optional(),
        winners: z.coerce.number().int().positive({ message: "Must have at least 1 winner" }),
        priceUSD: z.coerce.number().nonnegative({ message: "Price must be a positive number" }),
        priceBandcoin: z.coerce.number().nonnegative({ message: "Price must be a positive number" }),
        requiredBalance: z.coerce.number().nonnegative({ message: "Required balance must be a positive number" }),
        requiredBalanceCode: z.string().min(2, { message: "Asset Code can't be empty" }),
        requiredBalanceIssuer: z.string().min(2, { message: "Asset Isseuer can't be empty" }),
        locations: z
            .array(
                z.object({
                    id: z.string(),
                    latitude: z.number(),
                    longitude: z.number(),
                    title: z.string().optional(),
                    description: z.string().optional(),
                    pinImage: z.string().optional(),
                    pinUrl: z.string().optional(),
                    startDate: z.date().optional(),
                    endDate: z.date().optional(),
                    collectionLimit: z.number().int().positive().optional(),
                    radius: z.number().positive().optional(),
                    autoCollect: z.boolean().default(false).optional(),
                }),
            )
            .min(1, { message: "At least one location is required" })
            .superRefine((locations, ctx) => {
                // Basic validation for all locations - coordinates are always required
                locations.forEach((location, index) => {
                    if (!location.latitude || !location.longitude) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "Location coordinates are required",
                            path: [`locations`, index, "latitude"],
                        })
                    }
                })
            }),
    })
    .superRefine((data, ctx) => {
        // If not using same info for all steps, we need to validate each location has coordinates
        if (!data.useSameInfoForAllSteps && data.locations.length > 0) {
            // We only need to validate that coordinates exist, other fields can have fallbacks
            const invalidLocations = data.locations.filter(
                (loc) => typeof loc.latitude !== "number" || typeof loc.longitude !== "number",
            )

            if (invalidLocations.length > 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "All locations must have valid coordinates",
                    path: ["locations"],
                })
            }
        }
    })

export type ScavengerHuntFormValues = z.infer<typeof scavengerHuntSchema>

export default function ScavengerHuntDialog() {
    const { isOpen: isScavengerModalOpen, setIsOpen: SetIsScavengerModalOpen } = useScavengerHuntModalStore()
    const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore()

    const [currentStep, setCurrentStep] = useState(0)
    const [useSameInfo, setUseSameInfo] = useState(true)
    const { needSign } = useNeedSign()
    const [loading, setLoading] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)
    const [isSubmitDisabled, setIsSubmitDisabled] = useState(false)
    const session = useSession()
    const utils = api.useUtils()
    // Initialize the form with React Hook Form and Zod validation
    const methods = useForm<ScavengerHuntFormValues>({
        resolver: zodResolver(scavengerHuntSchema),
        defaultValues: {
            title: "",
            description: "",
            coverImageUrl: [],
            numberOfSteps: 1,
            useSameInfoForAllSteps: true,
            defaultLocationInfo: {
                title: "",
                description: "",
                pinImage: "",
                pinUrl: "",
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                collectionLimit: 1,
                radius: 100,
                autoCollect: false,
            },
            winners: 1,
            priceUSD: 1,
            priceBandcoin: 1,
            requiredBalance: 0,
            locations: [],
        },
        mode: "onChange",
    })

    const { trigger, formState, getValues, watch, setValue } = methods
    //api calling
    const totalFees = 2 * Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)

    const CreateBountyMutation = api.bounty.ScavengerHunt.createScavengerHunt.useMutation({
        onSuccess: async (data) => {
            toast.success("Bounty Created Successfully! 🎉")
            setShowConfetti(true)
            utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
                console.error("Error refetching bounties", error)
            })
            setTimeout(() => {
                handleClose()
            }, 2000)
            SetIsScavengerModalOpen(false)
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            setLoading(false)
            SetIsScavengerModalOpen(false)
        },
    })
    const XLMRate = api.bounty.Bounty.getXLMPrice.useQuery().data

    const SendBalanceToBountyMother = api.bounty.Bounty.sendBountyBalanceToMotherAcc.useMutation({
        onSuccess: async (data, { method }) => {
            if (data) {
                try {
                    setLoading(true)
                    const clientResponse = await clientsign({
                        presignedxdr: data.xdr,
                        walletType: session.data?.user?.walletType,
                        pubkey: data.pubKey,
                        test: clientSelect(),
                    })

                    if (clientResponse) {
                        CreateBountyMutation.mutate({
                            title: getValues("title"),
                            priceBandcoin: getValues("priceBandcoin"),
                            winners: getValues("winners"),
                            priceUSD: getValues("priceUSD"),
                            requiredBalance: getValues("requiredBalance") ?? 0,
                            priceInXLM: method == "xlm" ? getValues("priceUSD") * 0.7 : undefined,
                            description: getValues("description"),
                            useSameInfoForAllSteps: getValues("useSameInfoForAllSteps"),
                            defaultLocationInfo: getValues("defaultLocationInfo"),
                            numberOfSteps: getValues("numberOfSteps"),
                            locations: getValues("locations"),
                            coverImageUrl: getValues("coverImageUrl"),
                            requiredBalanceCode: getValues("requiredBalanceCode"),
                            requiredBalanceIssuer: getValues("requiredBalanceIssuer"),
                        })
                        setLoading(false)
                    } else {
                        setLoading(false)

                        toast.error("Error in signing transaction")
                    }
                } catch (error) {
                    setLoading(false)
                    console.error("Error sending balance to bounty mother", error)
                }
            }
        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)

            setLoading(false)
            SetIsScavengerModalOpen(false)
        },
    })
    // Watch for changes to useSameInfoForAllSteps and numberOfSteps
    const useSameInfoForAllSteps = watch("useSameInfoForAllSteps")
    const numberOfSteps = watch("numberOfSteps")
    const locations = watch("locations")

    // Check if form is valid for submission
    useEffect(() => {
        const checkFormValidity = () => {
            // Basic checks that apply to all forms
            if ((Number(locations.length)) !== Number(numberOfSteps)) {
                console.log("number of numberOfSteps", numberOfSteps)
                console.log("number of locations", locations.length)
                console.log("line 285")
                setIsSubmitDisabled(true)
                return
            }

            // If using same info for all steps
            if (useSameInfoForAllSteps) {
                const defaultInfo = getValues("defaultLocationInfo")
                if (!defaultInfo) {
                    console.log("line 293")
                    setIsSubmitDisabled(true)
                    return
                }

                // Check if all required fields in defaultInfo are filled
                const { title, pinImage, pinUrl, startDate, endDate, collectionLimit, radius } = defaultInfo
                if (!title || !pinImage || !pinUrl || !startDate || !endDate || !collectionLimit || !radius) {
                    console.log("line 300")
                    setIsSubmitDisabled(true)
                    return
                }

                // If we have all locations and all required default info, enable the submit button
                setIsSubmitDisabled(false)
                return
            } else {
                // When not using same info, only check for required fields
                // This code is more accommodating and only checks that each location has coordinates
                const hasInvalidCoordinates = locations.some((loc) => !loc.latitude || !loc.longitude)

                if (hasInvalidCoordinates) {
                    console.log("line 313")
                    setIsSubmitDisabled(true)
                    return
                }

                // If we have filled all the locations and they all have coordinates,
                // allow the user to proceed to the next step
                if (Number(locations.length) === Number(numberOfSteps)) {
                    console.log("line 320")
                    setIsSubmitDisabled(false)
                    return
                } else {
                    console.log("line 323")
                    setIsSubmitDisabled(true)
                }
            }
        }

        checkFormValidity()
    }, [useSameInfoForAllSteps, locations, numberOfSteps, getValues])

    useEffect(() => {
        setUseSameInfo(useSameInfoForAllSteps)
    }, [useSameInfoForAllSteps])

    // Define the steps dynamically based on useSameInfo
    const getSteps = () => {
        const baseSteps = [
            {
                id: "basic-info",
                title: "Basic Info",
                fields: ["title", "description", "coverImageUrl"],
                component: BasicInfoForm,
            },
            {
                id: "config",
                title: "Config",
                fields: ["numberOfSteps", "useSameInfoForAllSteps"],
                component: ConfigForm,
            },
        ]

        // Add default info step if using same info for all steps
        if (useSameInfo) {
            baseSteps.push({
                id: "default-info",
                title: "Default Info",
                fields: ["defaultLocationInfo"],
                component: DefaultInfoForm,
            })
        }

        // Add remaining steps
        return [
            ...baseSteps,
            {
                id: "prize-details",
                title: "Prize Details",
                fields: ["winners", "priceUSD", "priceBandcoin", "requiredBalance"],
                component: PrizeDetailsForm,
            },
            {
                id: "locations",
                title: "Steps",
                fields: ["locations"],
                component: LocationsForm,
            },
            {
                id: "review",
                title: "Review",
                fields: [],
                component: ReviewForm,
            },
        ]
    }

    const steps = getSteps()
    const CurrentStepComponent = steps[currentStep]?.component
    const handleClose = () => {
        SetIsScavengerModalOpen(false)
        setCurrentStep(0)
        methods.reset()
    }
    // Update the handleNext function to be more lenient with the locations step
    const handleNext = async () => {
        const fields = steps[currentStep]?.fields as Array<keyof ScavengerHuntFormValues>

        // Skip validation for defaultLocationInfo if not using same info for all steps
        let fieldsToValidate = fields
        if (!useSameInfoForAllSteps && fields.includes("defaultLocationInfo")) {
            fieldsToValidate = fields.filter((field) => field !== "defaultLocationInfo")
        }

        // For locations step, be more lenient with validation
        if (steps[currentStep]?.id === "locations") {
            // Check if we have enough locations
            if (Number(locations.length) < Number(numberOfSteps)) {
                toast.error(`You need to add ${numberOfSteps} locations.`)
                return
            }

            // If using same info for all steps, validate that defaultLocationInfo exists
            if (useSameInfoForAllSteps && !getValues("defaultLocationInfo")) {
                toast.error("Please fill in the default location information.")
                return
            }

            // Allow proceeding to next step without validating all location fields
            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
            return
        }

        // For other steps, validate normally
        const isValid = await trigger(fieldsToValidate)
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
        }
    }

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0))
    }

    // Update the onSubmit function to handle final validation appropriately
    const onSubmit = (data: ScavengerHuntFormValues) => {
        console.log("Form submitted:", data)

        try {
            // Final validation to ensure we have the correct number of locations
            if (Number(data.locations.length) !== Number(data.numberOfSteps)) {
                toast.error(`Number of locations must match the number of steps (${data.numberOfSteps}).`)
                return
            }

            // If using same info for all steps, ensure defaultLocationInfo exists
            if (Number(data.useSameInfoForAllSteps)) {
                if (!data.defaultLocationInfo) {
                    toast.error("Please fill in the default location information.")
                    return
                }
            } else {
                // When not using same info, ensure each location has coordinates
                const incompleteLocations = data.locations.filter((loc) => !loc.latitude || !loc.longitude)

                if (incompleteLocations.length > 0) {
                    toast.error("All locations must have coordinates.")
                    return
                }

                // We don't need additional validation here - if the user has coordinates for all locations
                // they should be able to submit the form
            }

            console.log("Form submitted:", data)

            SendBalanceToBountyMother.mutate({
                signWith: needSign(),
                prize: data.priceBandcoin,
                method: paymentMethod,
                fees: 0,
                // paymentMethod === "asset" ? totalFees :
                // paymentMethod === "xlm" ? 1 :
                //     (3 * (Number(getValues("priceUSD") ?? 1) * (XLMRate ?? 1))),
            })
        } catch (error) {
            console.error("Form submission error:", error)
            toast.error("An error occurred while creating the scavenger hunt.")
        }
    }

    return (
        <Dialog open={isScavengerModalOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create a New Scavenger Hunt</DialogTitle>
                    <DialogDescription>Set up your scavenger hunt details, locations, and prizes.</DialogDescription>
                </DialogHeader>

                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Step indicator */}
                        <div className="relative mb-8">
                            <div className="absolute left-0 right-0 h-1 bg-muted top-1/2 -translate-y-1/2" />
                            <div className="relative flex justify-between">
                                {steps.map((step, index) => (
                                    <div
                                        key={step.id}
                                        className={`flex flex-col items-center ${index <= currentStep ? "text-primary" : "text-muted-foreground"
                                            }`}
                                    >
                                        <div
                                            className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {index + 1}
                                        </div>
                                        <span className="mt-2 text-xs font-medium">{step.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Current step content */}
                        <div className="min-h-[400px]">{CurrentStepComponent ? <CurrentStepComponent /> : null}</div>

                        {/* Navigation buttons */}
                        <div className="flex justify-between pt-4">
                            <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
                                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                            </Button>

                            {currentStep < steps.length - 1 ? (
                                <Button type="button" onClick={handleNext}>
                                    Next <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <PaymentChoose
                                    costBreakdown={[
                                        {
                                            label: "Bounty Prize",
                                            amount: paymentMethod === "asset"
                                                ? Number(getValues("priceBandcoin"))
                                                : paymentMethod === "xlm"
                                                    ? Number(getValues("priceUSD") / (XLMRate ?? 1))
                                                    : Number(getValues("priceUSD") / (XLMRate ?? 1)),
                                            highlighted: true,
                                            type: "cost",
                                        },
                                        {
                                            label: "Platform Fee",
                                            amount: 0,
                                            // paymentMethod === "asset"
                                            // ? totalFees
                                            // : paymentMethod === "xlm"
                                            //     ? 1
                                            //     : (3 * (Number(getValues("priceUSD") ?? 1) * (XLMRate ?? 1))),
                                            highlighted: false,
                                            type: "fee",
                                        },
                                        {
                                            label: "Total Cost",
                                            amount: paymentMethod === "asset"
                                                ? Number(getValues("priceBandcoin")) + totalFees
                                                : paymentMethod === "xlm"
                                                    ? Number(getValues("priceUSD") / (XLMRate ?? 1)) + 1
                                                    : Number(getValues("priceUSD") / (XLMRate ?? 1)) + (3 * (Number(getValues("priceUSD") ?? 1) * (XLMRate ?? 1))),
                                            highlighted: false,
                                            type: "total",
                                        },
                                    ]}
                                    XLM_EQUIVALENT={Number(getValues("priceUSD") / (XLMRate ?? 1)) + 1}
                                    USDC_EQUIVALENT={Number(getValues("priceUSD") / (XLMRate ?? 1)) + (3 * (Number(getValues("priceUSD") ?? 1) * (XLMRate ?? 1)))}
                                    handleConfirm={() => onSubmit(getValues())}
                                    loading={loading}
                                    requiredToken={Number(getValues("priceBandcoin")) + totalFees}
                                    trigger={
                                        <Button disabled={isSubmitDisabled
                                            || CreateBountyMutation.isLoading
                                            || SendBalanceToBountyMother.isLoading} className="shadow-sm shadow-foreground">
                                            {loading ? (
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
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog >
    )
}

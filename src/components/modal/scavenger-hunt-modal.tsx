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

// Define the location type

export const MediaInfo = z.object({
    url: z.string(),
    type: z.nativeEnum(MediaType),
})
type MediaInfoType = z.TypeOf<typeof MediaInfo>

export const scavengerHuntSchema = z
    .object({
        title: z.string().min(1, { message: "Title must be at least 3 characters" }),
        description: z.string().min(10, { message: "Description must be at least 10 characters" }),
        coverImageUrl: z.array(MediaInfo).optional(),
        numberOfSteps: z.coerce.number().int().min(1, { message: "At least one step is required" }),
        useSameInfoForAllSteps: z.boolean(),
        defaultLocationInfo: z
            .object({
                title: z.string().min(1, { message: "Title is required" }),
                description: z.string().optional(),
                pinImage: z.string().min(1, { message: "Pin image is required" }),
                pinUrl: z.string().url({ message: "Must be a valid URL" }),
                startDate: z.date({ required_error: "Start date is required" }),
                endDate: z.date({ required_error: "End date is required" }),
                collectionLimit: z.coerce.number().int().positive({ message: "Collection limit must be positive" }),
                radius: z.coerce.number().positive({ message: "Radius must be positive" }),
                autoCollect: z.boolean(),
            })
            .optional(),
        priceInXLM: z.coerce.number().nonnegative({ message: "Price must be a positive number" }).optional(),
        winners: z.coerce.number().int().positive({ message: "Must have at least 1 winner" }),
        rewardType: z.enum(["usdc", "platform_asset"]),
        usdcAmount: z.coerce.number().optional(),
        platformAssetAmount: z.coerce.number().optional(),
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
        if (!data.useSameInfoForAllSteps && data.locations.length > 0) {
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
    const { isOpen, setIsOpen, paymentMethod, setPaymentMethod } = usePaymentMethodStore()

    const [currentStep, setCurrentStep] = useState(0)
    const [useSameInfo, setUseSameInfo] = useState(true)
    const { needSign } = useNeedSign()
    const [loading, setLoading] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)
    const [isSubmitDisabled, setIsSubmitDisabled] = useState(false)
    const session = useSession()
    const utils = api.useUtils()

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
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                collectionLimit: 1,
                radius: 100,
                autoCollect: false,
            },
            winners: 1,
            rewardType: "usdc",
            usdcAmount: 0,
            platformAssetAmount: 0,
            priceUSD: 1,
            priceBandcoin: 1,
            requiredBalance: 0,
            locations: [],
        },
        mode: "onChange",
    })

    const { trigger, formState, getValues, watch, setValue } = methods

    const totalFees = 0
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
                        const rewardType = getValues("rewardType")
                        CreateBountyMutation.mutate({
                            title: getValues("title"),
                            priceBandcoin: rewardType === "platform_asset" ? (getValues("platformAssetAmount") ?? 0) : getValues("priceBandcoin"),
                            winners: getValues("winners"),
                            priceUSD: rewardType === "usdc" ? (getValues("usdcAmount") ?? 0) : getValues("priceUSD"),
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
                            rewardType: rewardType
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

    const useSameInfoForAllSteps = watch("useSameInfoForAllSteps")
    const numberOfSteps = watch("numberOfSteps")
    const locations = watch("locations")
    const watchedRewardType = watch("rewardType")

    useEffect(() => {
        setPaymentMethod(watchedRewardType === "usdc" ? "usdc" : "asset")
    }, [watchedRewardType, setPaymentMethod])

    useEffect(() => {
        const checkFormValidity = () => {
            if (Number(locations.length) !== Number(numberOfSteps)) {
                setIsSubmitDisabled(true)
                return
            }

            if (useSameInfoForAllSteps) {
                const defaultInfo = getValues("defaultLocationInfo")
                if (!defaultInfo) {
                    setIsSubmitDisabled(true)
                    return
                }

                const { title, pinImage, pinUrl, startDate, endDate, collectionLimit, radius } = defaultInfo
                if (!title || !pinImage || !pinUrl || !startDate || !endDate || !collectionLimit || !radius) {
                    setIsSubmitDisabled(true)
                    return
                }

                setIsSubmitDisabled(false)
                return
            } else {
                const hasInvalidCoordinates = locations.some((loc) => !loc.latitude || !loc.longitude)

                if (hasInvalidCoordinates) {
                    setIsSubmitDisabled(true)
                    return
                }

                if (Number(locations.length) === Number(numberOfSteps)) {
                    setIsSubmitDisabled(false)
                    return
                } else {
                    setIsSubmitDisabled(true)
                }
            }
        }

        checkFormValidity()
    }, [useSameInfoForAllSteps, locations, numberOfSteps, getValues])

    useEffect(() => {
        setUseSameInfo(useSameInfoForAllSteps)
    }, [useSameInfoForAllSteps])

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

        if (useSameInfo) {
            baseSteps.push({
                id: "default-info",
                title: "Default Info",
                fields: ["defaultLocationInfo"],
                component: DefaultInfoForm,
            })
        }

        return [
            ...baseSteps,
            {
                id: "prize-details",
                title: "Prize Details",
                fields: ["winners", "rewardType", "usdcAmount", "platformAssetAmount", "requiredBalance"],
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

    const handleNext = async () => {
        const fields = steps[currentStep]?.fields as Array<keyof ScavengerHuntFormValues>

        let fieldsToValidate = fields
        if (!useSameInfoForAllSteps && fields.includes("defaultLocationInfo")) {
            fieldsToValidate = fields.filter((field) => field !== "defaultLocationInfo")
        }

        if (steps[currentStep]?.id === "locations") {
            if (Number(locations.length) < Number(numberOfSteps)) {
                toast.error(`You need to add ${numberOfSteps} locations.`)
                return
            }

            if (useSameInfoForAllSteps && !getValues("defaultLocationInfo")) {
                toast.error("Please fill in the default location information.")
                return
            }

            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
            return
        }

        const isValid = await trigger(fieldsToValidate)
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
        }
    }

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0))
    }

    const getPrizeAmount = () => {
        const rewardType = getValues("rewardType")
        if (rewardType === "platform_asset") {
            return getValues("platformAssetAmount") ?? 0
        }
        return getValues("usdcAmount") ?? 0
    }

    const onSubmit = (data: ScavengerHuntFormValues) => {
        console.log("Form submitted:", data)

        try {
            if (Number(data.locations.length) !== Number(data.numberOfSteps)) {
                toast.error(`Number of locations must match the number of steps (${data.numberOfSteps}).`)
                return
            }

            if (Number(data.useSameInfoForAllSteps)) {
                if (!data.defaultLocationInfo) {
                    toast.error("Please fill in the default location information.")
                    return
                }
            } else {
                const incompleteLocations = data.locations.filter((loc) => !loc.latitude || !loc.longitude)

                if (incompleteLocations.length > 0) {
                    toast.error("All locations must have coordinates.")
                    return
                }
            }

            console.log("Form submitted:", data)

            SendBalanceToBountyMother.mutate({
                signWith: needSign(),
                prize: getPrizeAmount(),
                method: paymentMethod,
                fees: 0,
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
                                        : { requiredToken: getPrizeAmount() + totalFees })}
                                    handleConfirm={() => onSubmit(getValues())}
                                    loading={loading}
                                    trigger={
                                        <Button
                                            disabled={
                                                isSubmitDisabled || CreateBountyMutation.isLoading || SendBalanceToBountyMother.isLoading
                                            }
                                            className="shadow-sm shadow-foreground"
                                        >
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
        </Dialog>
    )
}

"use client"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/shadcn/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import BasicInfoForm from "~/components/scavenger-hunt/basic-info-form"
import LocationsForm from "~/components/scavenger-hunt/locations-form"
import ReviewForm from "~/components/scavenger-hunt/review-form"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import PrizeDetailsForm from "~/components/scavenger-hunt/prize-details-form"
import PinDetailsForm from "~/components/scavenger-hunt/pin-details-form"
import ScheduleForm from "~/components/scavenger-hunt/schedule-form"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useScavengerHuntModalStore } from "../store/scavenger-hunt-modal-store"
import { PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { api } from "~/utils/api"
import { clientsign } from "package/connect_wallet"
import { useSession } from "next-auth/react"
import { clientSelect } from "~/lib/stellar/fan/utils"
import toast from "react-hot-toast"
import { MediaType } from "@prisma/client"
import useNeedSign from "~/lib/hook"
import { usePaymentMethodStore } from "../common/payment-options"
// Define the location type
export type Location = {
    id: string
    latitude: number
    longitude: number
    title: string
    collectionLimit: number
    radius: number
}

export const MediaInfo = z.object({
    url: z.string(),
    type: z.nativeEnum(MediaType),
});
type MediaInfoType = z.TypeOf<typeof MediaInfo>

// Define the form schema with Zod
export const scavengerHuntSchema = z.object({
    title: z.string().min(3, { message: "Title must be at least 3 characters" }),
    description: z.string().min(10, { message: "Description must be at least 10 characters" }),
    coverImageUrl: z.array(MediaInfo).optional(),
    winners: z.coerce.number().int().positive({ message: "Must have at least 1 winner" }),
    priceUSD: z.coerce.number().nonnegative({ message: "Price must be a positive number" }),
    priceBandcoin: z.coerce.number().nonnegative({ message: "Price must be a positive number" }),
    requiredBalance: z.coerce.number().nonnegative({ message: "Required balance must be a positive number" }),
    pinImageUrl: z.string().min(1, { message: "Pin image is required" }),
    pinUrl: z.string().url({ message: "Must be a valid URL" }),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    priceInXLM: z.number().optional(),
    locations: z
        .array(
            z.object({
                id: z.string(),
                latitude: z.number(),
                longitude: z.number(),
                title: z.string().min(1, { message: "Location title is required" }),
                description: z.string().optional(), // Added description field
                collectionLimit: z.number().int().positive({ message: "Collection limit must be positive" }),
                radius: z.number().positive({ message: "Radius must be positive" }),
                autoCollect: z.boolean().default(false), // Added autoCollect field with default false
            }),
        )
        .min(1, { message: "At least one location is required" }),
})

export type ScavengerHuntFormValues = z.infer<typeof scavengerHuntSchema>

// Define the steps
const steps = [
    {
        id: "basic-info",
        title: "Basic Info",
        fields: ["title", "description"],
        component: BasicInfoForm,
    },
    {
        id: "prize-details",
        title: "Prize Details",
        fields: ["winners", "priceUSD", "priceBandcoin", "requiredBalance"],
        component: PrizeDetailsForm,
    },
    {
        id: "pin-details",
        title: "Pin Details",
        fields: ["pinImageUrl", "pinUrl"],
        component: PinDetailsForm,
    },
    {
        id: "schedule",
        title: "Schedule",
        fields: ["startDate", "endDate"],
        component: ScheduleForm,
    },
    {
        id: "locations",
        title: "Locations",
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
export default function ScavengerHuntModal() {
    const { isOpen: isScavengerModalOpen, setIsOpen: SetIsScavengerModalOpen } = useScavengerHuntModalStore()
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)
    const session = useSession()
    const utils = api.useUtils()
    const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore()

    const [media, setMedia] = useState<MediaInfoType[]>([])
    const { needSign } = useNeedSign()
    // Initialize the form with React Hook Form and Zod validation
    const methods = useForm<ScavengerHuntFormValues>({
        resolver: zodResolver(scavengerHuntSchema),
        defaultValues: {
            title: "",
            description: "",
            winners: 1,
            priceUSD: 1,
            priceBandcoin: 1,
            requiredBalance: 0,
            pinImageUrl: "",
            pinUrl: "",
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            locations: [],
        },
        mode: "onChange",
    })

    const { trigger, formState, getValues } = methods
    //APIS
    // Calculate fees
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

        },
        onError: (error) => {
            console.error("Error creating bounty", error)
            toast.error(error.message)
            setLoading(false)
            SetIsScavengerModalOpen(false)
        },
    })

    // Functions
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
                            pinUrl: getValues("pinUrl"),
                            pinImageUrl: getValues("pinImageUrl"),
                            startDate: getValues("startDate"),
                            endDate: getValues("endDate"),
                            locations: getValues("locations"),
                            coverImageUrl: media.map((item) => ({ ...item, type: item.type as MediaType })),
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
    const handleNext = async () => {
        const fields = steps[currentStep]?.fields as Array<keyof ScavengerHuntFormValues>
        const isValid = await trigger(fields)

        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
        }
    }

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0))
    }

    const onSubmit = (data: ScavengerHuntFormValues) => {

        SendBalanceToBountyMother.mutate({
            signWith: needSign(),
            prize: data.priceBandcoin,
            method: paymentMethod,
        })


    }
    const handleClose = () => {
        SetIsScavengerModalOpen(false)
        setCurrentStep(0)
        methods.reset()
    }
    const CurrentStepComponent = steps[currentStep]?.component

    return (

        <Dialog open={isScavengerModalOpen} onOpenChange={handleClose}>

            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
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
                        <div className="min-h-[400px]">
                            {CurrentStepComponent ? <CurrentStepComponent /> : null}
                        </div>

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
                                <Button type="button"
                                    onClick={methods.handleSubmit(onSubmit)}
                                    disabled={!formState.isValid || formState.isSubmitting}

                                >Create Scavenger Hunt</Button>
                            )}
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>

    )
}

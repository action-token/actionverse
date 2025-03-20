"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MediaType } from "@prisma/client"
import { Camera, Coins, DollarSign, Trophy, Users, X } from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { z } from "zod"

import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Input } from "~/components/shadcn/ui/input"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"

import useNeedSign from "~/lib/hook"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { PLATFORM_ASSET, PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import { UploadS3Button } from "../common/upload-button"
import { Editor } from "../common/quill-editor"
import { useCreateBountyStore } from "../store/create-bounty-store"
import { RiGalleryFill } from "react-icons/ri"

// Schema definitions
const MediaInfo = z.object({
    url: z.string(),
    type: z.string().default(MediaType.IMAGE),
})

type MediaInfoType = z.TypeOf<typeof MediaInfo>

const BountySchema = z.object({
    title: z
        .string()
        .max(65, {
            message: "Title can't be more than 65 characters",
        })
        .min(1, { message: "Title can't be empty" }),
    totalWinner: z
        .number({
            required_error: "Total Winner must be a number",
            invalid_type_error: "Total Winner must be a number",
        })
        .min(1, { message: "Please select at least 1 winner" }),
    prizeInUSD: z
        .number({
            required_error: "Prize must be a number",
            invalid_type_error: "Prize must be a number",
        })
        .min(0.00001, { message: "Prize can't be less than 0.00001" }),
    prize: z
        .number({
            required_error: "Prize must be a number",
            invalid_type_error: "Prize must be a number",
        })
        .min(0.00001, { message: "Prize can't be less than 0.00001" }),
    requiredBalance: z
        .number({
            required_error: "Required Balance must be a number",
            invalid_type_error: "Required Balance must be a number",
        })
        .nonnegative({ message: "Required Balance can't be less than 0" })
        .optional(),
    content: z.string().min(2, { message: "Description can't be empty" }),
    medias: z.array(MediaInfo).optional(),
})

const CreateBountyModal = () => {
    // State management
    const [media, setMedia] = useState<MediaInfoType[]>([])
    const [wantMediaType, setWantMedia] = useState<MediaType>()
    const [loading, setLoading] = useState(false)
    const [prizeInAsset, setPrizeInAsset] = useState<number>(0)
    const [activeTab, setActiveTab] = useState("details")

    // Hooks
    const { needSign } = useNeedSign()
    const session = useSession()
    const { platformAssetBalance } = useUserStellarAcc()
    const { isOpen, setIsOpen, paymentMethod } = usePaymentMethodStore()
    const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = useCreateBountyStore()
    const utils = api.useUtils()

    // Calculate fees
    const totalFees = 2 * Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)

    // Form setup
    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        reset,
        trigger,
        watch,
        formState: { errors, isValid },
    } = useForm<z.infer<typeof BountySchema>>({
        resolver: zodResolver(BountySchema),
        mode: "onChange",
        defaultValues: {
            content: "",
            title: "",
            totalWinner: 1,
            requiredBalance: 0,
        },
    })

    // Watch values for preview
    const watchedTitle = watch("title")
    const watchedPrize = watch("prizeInUSD")
    const watchedWinners = watch("totalWinner")
    const watchedRequiredBalance = watch("requiredBalance")

    // API mutations
    const CreateBountyMutation = api.bounty.Bounty.createBounty.useMutation({
        onSuccess: async (data) => {
            toast.success("Bounty Created Successfully! 🎉")
            handleClose()
            setPrizeInAsset(0)
            utils.bounty.Bounty.getAllBounties.refetch().catch((error) => {
                console.error("Error refetching bounties", error)
            })
        },
    })

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
                            prizeInUSD: getValues("prizeInUSD"),
                            totalWinner: getValues("totalWinner"),
                            prize: getValues("prize"),
                            requiredBalance: getValues("requiredBalance") ?? 0,
                            priceInXLM: method == "xlm" ? getValues("prize") * 0.7 : undefined,
                            content: getValues("content"),
                            medias: media.map((item) => ({ ...item, type: item.type as MediaType })),
                        })
                        setLoading(false)
                        reset()
                        setMedia([])
                    } else {
                        setLoading(false)
                        reset()
                        toast.error("Error in signing transaction")
                        setMedia([])
                    }
                    setIsOpen(false)
                } catch (error) {
                    setLoading(false)
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
            setLoading(false)
            setIsOpen(false)
        },
    })

    // Queries
    const { data: prize } = api.bounty.Bounty.getCurrentUSDFromAsset.useQuery()

    // Handlers
    const onSubmit: SubmitHandler<z.infer<typeof BountySchema>> = (data) => {
        data.medias = media
        setLoading(true)
        SendBalanceToBountyMother.mutate({
            signWith: needSign(),
            prize: data.prize,
            method: paymentMethod,
        })
    }

    const handleEditorChange = (value: string): void => {
        setValue("content", value)
    }

    const addMediaItem = (url: string, type: MediaType) => {
        setMedia((prevMedia) => [...prevMedia, { url, type }])
    }

    const removeMediaItem = (index: number) => {
        setMedia((prevMedia) => prevMedia.filter((_, i) => i !== index))
    }

    const handleClose = () => {
        setIsDialogOpen(false)
        reset()
        setMedia([])
        setActiveTab("details")
    }

    const handlePrizeChange = (value: string) => {
        const prizeUSD = Number(value)
        setValue("prizeInUSD", prizeUSD)

        // Make sure prize is a valid number before dividing
        if (prize && Number(prize) > 0) {
            const prizeValue = prizeUSD / Number(prize)
            setValue("prize", prizeValue)
            setPrizeInAsset(prizeValue)
        } else {
            setValue("prize", 0)
            setPrizeInAsset(0)
        }
    }

    const goToNextTab = () => {
        if (activeTab === "details") {
            setActiveTab("media")
        } else if (activeTab === "media") {
            setActiveTab("review")
        }
    }

    const goToPreviousTab = () => {
        if (activeTab === "media") {
            setActiveTab("details")
        } else if (activeTab === "review") {
            setActiveTab("media")
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-xl">
                <DialogHeader className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                    <DialogTitle className="text-2xl font-bold">Create New Bounty</DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pt-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger
                                value="details"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="media"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                            >
                                Media
                            </TabsTrigger>
                            <TabsTrigger
                                value="review"
                                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                            >
                                Review
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <TabsContent value="details" className="p-6 space-y-6">
                            {/* Title Input */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">Bounty Title</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        Required
                                    </Badge>
                                </div>
                                <Input
                                    maxLength={65}
                                    readOnly={loading}
                                    type="text"
                                    placeholder="Enter an engaging title for your bounty..."
                                    {...register("title")}
                                    className="w-full text-lg"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{errors.title && <span className="text-destructive">{errors.title.message}</span>}</span>
                                    <span>{getValues("title").length}/65</span>
                                </div>
                            </div>

                            {/* Description Editor */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">Description</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        Required
                                    </Badge>
                                </div>
                                <Editor
                                    value={getValues("content")}
                                    onChange={handleEditorChange}
                                    placeholder="Describe your bounty in detail. What are you looking for? What are the requirements?"
                                    className="min-h-[180px] w-full border rounded-md"
                                />
                                {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
                            </div>

                            {/* Prize Inputs */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">Reward Details</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        Required
                                    </Badge>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                step={0.00001}
                                                readOnly={loading}
                                                onChange={(e) => handlePrizeChange(e.target.value)}
                                                className="w-full pl-10"
                                                type="number"
                                                placeholder="Prize in USD"
                                            />
                                        </div>
                                        {errors.prizeInUSD && <p className="text-xs text-destructive">{errors.prizeInUSD.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                readOnly
                                                type="number"
                                                {...register("prize")}
                                                className="w-full pl-10"
                                                placeholder={`Prize in ${PLATFORM_ASSET.code}`}
                                            />
                                        </div>
                                        {errors.prize && <p className="text-xs text-destructive">{errors.prize.message}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">Number of Winners</span>
                                        <Badge variant="outline" className="text-xs font-normal">
                                            Required
                                        </Badge>
                                    </div>
                                    <div className="relative">
                                        <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            readOnly={loading}
                                            type="number"
                                            step={1}
                                            min={1}
                                            {...register("totalWinner", {
                                                valueAsNumber: true,
                                            })}
                                            className="w-full pl-10"
                                            placeholder="How many winners?"
                                        />
                                    </div>
                                    {errors.totalWinner && <p className="text-xs text-destructive">{errors.totalWinner.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">Required Balance</span>
                                        <Badge variant="outline" className="text-xs font-normal">
                                            Optional
                                        </Badge>
                                    </div>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            readOnly={loading}
                                            type="number"
                                            step={0.00001}
                                            min={0}
                                            {...register("requiredBalance", {
                                                valueAsNumber: true,
                                            })}
                                            className="w-full pl-10"
                                            placeholder={`Min balance in ${PLATFORM_ASSET.code}`}
                                        />
                                    </div>
                                    {errors.requiredBalance && (
                                        <p className="text-xs text-destructive">{errors.requiredBalance.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button
                                    type="button"
                                    onClick={goToNextTab}
                                    disabled={!getValues("title") || !getValues("content") || !getValues("prizeInUSD")}
                                >
                                    Continue to Media
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="media" className="p-6 space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">Bounty Thumbnails</span>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        Optional
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Add up to 4 images to showcase your bounty. The first image will be used as the main thumbnail.
                                </p>
                            </div>

                            {/* Media Upload */}
                            <div className="space-y-4">
                                {media.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {media.map((item, index) => (
                                            <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                                                <Image
                                                    src={item.url || "/placeholder.svg"}
                                                    alt={`Uploaded media ${index + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute top-1 right-1 h-6 w-6 rounded-full"
                                                    onClick={() => removeMediaItem(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                                {index === 0 && <Badge className="absolute bottom-1 left-1 bg-primary/80">Main</Badge>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="border border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center">
                                        <RiGalleryFill className="h-10 w-10 text-muted-foreground mb-2" />
                                        <p className="text-muted-foreground">No images uploaded yet</p>
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
                                                setWantMedia(undefined)
                                            }
                                        }}
                                        onUploadError={(error: Error) => {
                                            toast.error(`Upload Error: ${error.message}`)
                                        }}
                                    />
                                )}

                                {media.length >= 4 && <p className="text-xs text-amber-600">Maximum number of uploads reached (4/4)</p>}
                            </div>

                            <div className="pt-4 flex justify-between">
                                <Button type="button" variant="outline" onClick={goToPreviousTab}>
                                    Back to Details
                                </Button>
                                <Button type="button" onClick={goToNextTab}>
                                    Continue to Review
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="review" className="p-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">Review Your Bounty</h3>
                                <p className="text-sm text-muted-foreground">Please review your bounty details before submitting.</p>
                            </div>

                            <Card>
                                <CardContent className="p-4 space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Title</h4>
                                        <p className="font-medium">{watchedTitle || "No title provided"}</p>
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-muted-foreground">Prize</h4>
                                            <p className="font-medium">${watchedPrize || 0}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-muted-foreground">Winners</h4>
                                            <p className="font-medium">{watchedWinners || 1}</p>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Required Balance</h4>
                                        <p className="font-medium">
                                            {watchedRequiredBalance ? `${watchedRequiredBalance} ${PLATFORM_ASSET.code}` : "None"}
                                        </p>
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Media</h4>
                                        {media.length > 0 ? (
                                            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                                                {media.map((item, index) => (
                                                    <div key={index} className="relative w-16 h-16 flex-shrink-0">
                                                        <Image
                                                            src={item.url || "/placeholder.svg"}
                                                            alt={`Thumbnail ${index + 1}`}
                                                            fill
                                                            className="object-cover rounded-md"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No images uploaded</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <DialogFooter className="pt-4">
                                {platformAssetBalance < prizeInAsset + totalFees ? (
                                    <Alert variant="destructive">
                                        <AlertDescription className="text-center">
                                            {`Insufficient balance. You need at least ${(prizeInAsset + totalFees).toFixed(5)} ${PLATFORM_ASSET.code} to create this bounty.`}
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="flex w-full flex-col gap-4">
                                        <PaymentChoose
                                            costBreakdown={[
                                                {
                                                    label: "Bounty Prize",
                                                    amount: paymentMethod === "asset" ? prizeInAsset : prizeInAsset * 0.7,
                                                    highlighted: true,
                                                    type: "cost",
                                                },
                                                {
                                                    label: "Platform Fee",
                                                    amount: paymentMethod === "asset" ? totalFees : 2 + 1,
                                                    highlighted: false,
                                                    type: "fee",
                                                },
                                                {
                                                    label: "Total Cost",
                                                    amount: paymentMethod === "asset" ? prizeInAsset + totalFees : prizeInAsset * 0.7 + 2 + 1,
                                                    highlighted: false,
                                                    type: "total",
                                                },
                                            ]}
                                            XLM_EQUIVALENT={prizeInAsset * 0.7 + 2 + 1}
                                            handleConfirm={handleSubmit(onSubmit)}
                                            loading={loading}
                                            requiredToken={prizeInAsset + totalFees}
                                            trigger={
                                                <Button disabled={loading || !isValid} className="w-full shadow-sm shadow-foreground" size="lg">
                                                    {loading ? "Creating Bounty..." : "Create Bounty"}
                                                </Button>
                                            }
                                        />

                                        <Alert>
                                            <AlertDescription className="text-center text-sm">
                                                {`You will be charged ${(prizeInAsset + totalFees).toFixed(5)} ${PLATFORM_ASSET.code} to create this bounty`}
                                            </AlertDescription>
                                        </Alert>

                                        <div className="flex justify-start">
                                            <Button type="button" variant="outline" onClick={goToPreviousTab}>
                                                Back to Media
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </DialogFooter>
                        </TabsContent>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

export default CreateBountyModal


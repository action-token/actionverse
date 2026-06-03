"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MediaType } from "@prisma/client"
import {
    ArrowRight,
    Check,
    Coins,
    DollarSign,
    Eye,
    EyeOff,
    ImageIcon,
    Loader2,
    Music,
    Upload,
    Video,
    X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import { WalletType } from "package/connect_wallet/src/lib/enums"
import { type ChangeEvent, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { z } from "zod"
import { Dialog, DialogContent } from "~/components/shadcn/ui/dialog"
import useNeedSign from "~/lib/hook"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { PLATFORM_ASSET, PLATFORM_FEE, SIMPLIFIED_FEE_IN_XLM, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { AccountSchema, clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { BADWORDS } from "~/utils/banned-word"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select"

import * as React from "react"

import { Button } from "../shadcn/ui/button"
import { UploadS3Button } from "../common/upload-button"
import { Label } from "../shadcn/ui/label"
import { Input } from "../shadcn/ui/input"
import { Textarea } from "../shadcn/ui/textarea"
import { useNFTCreateModalStore } from "../store/nft-create-modal-store"

import { AnimatePresence, motion } from "framer-motion"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import { ipfsHashToPinataGatewayUrl } from "~/utils/ipfs"
import { CubeIcon } from "@heroicons/react/24/solid"
import { Progress } from "../shadcn/ui/progress"
import { cn } from "~/lib/utils"
import { Badge } from "../shadcn/ui/badge"
import { Alert, AlertDescription } from "../shadcn/ui/alert"
import { Separator } from "../shadcn/ui/separator"
import RechargeLink from "../payment/recharge-link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"

function CreateQrCodeModal({
    open,
    onClose,
}: {
    open: boolean
    onClose: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] overflow-auto max-w-2xl py-0">
                <QrCodeCreate onClose={onClose} />
            </DialogContent>
        </Dialog>
    )
}

export const ExtraSongInfo = z.object({
    artist: z.string(),
    albumId: z.number(),
})

const FORM_STEPS = ["details", "media", "pricing"]
export const NftFormSchema = z.object({
    name: z.string().refine(
        (value) => {
            return !BADWORDS.some((word) => value.includes(word))
        },
        {
            message: "Input contains banned words.",
        },
    ),
    description: z.string(),
    mediaUrl: z.string({
        message: "Media is required",
        required_error: "Media is required",
    }),
    coverImgUrl: z.string().min(1, { message: "Thumbnail is required" }),
    mediaType: z.nativeEnum(MediaType),
    price: z
        .number({
            required_error: "Price must be entered as a number",
            invalid_type_error: "Price must be entered as a number",
        })
        .nonnegative()
        .default(2),
    priceUSD: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative()
        .default(1),
    limit: z
        .number({
            required_error: "Limit must be entered as a number",
            invalid_type_error: "Limit must be entered as a number",
        })
        .nonnegative(),
    code: z
        .string()
        .min(4, { message: "Must be a minimum of 4 characters" })
        .max(12, { message: "Must be a maximum of 12 characters" }),
    issuer: AccountSchema.optional(),
    songInfo: ExtraSongInfo.optional(),
    isAdmin: z.boolean().optional(),
    tier: z.string().optional(),
})

function QrCodeCreate({ onClose }: { onClose: () => void }) {
    // cost in xlm
    const requiredXlm = 2
    const feeInXLM = SIMPLIFIED_FEE_IN_XLM
    const totalXlmCost = requiredXlm + feeInXLM

    const { isOpen: isNFTModalOpen, setIsOpen: setNFTModalOpen } = useNFTCreateModalStore()
    const requiredToken = api.fan.trx.getRequiredPlatformAsset.useQuery({
        xlm: requiredXlm,
    })

    const session = useSession()
    const { platformAssetBalance } = useUserStellarAcc()
    const [isOpen, setIsOpen] = useState(false)
    const [parentIsOpen, setParentIsOpen] = useState(false)
    const [file, setFile] = useState<File>()
    const [ipfs, setCid] = useState<string>()
    const [uploading, setUploading] = useState(false)
    const [mediaUpload, setMediaUpload] = useState(false)
    const inputFile = useRef(null)

    const [tier, setTier] = useState<string>()

    const modalRef = useRef<HTMLDialogElement>(null)
    const [submitLoading, setSubmitLoading] = useState(false)
    const [mediaUploadSuccess, setMediaUploadSuccess] = useState(false)
    const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE)
    const [activeStep, setActiveStep] = useState<string>("details")
    const [formProgress, setFormProgress] = useState(25)

    const [mediaUrl, setMediaUrl] = useState<string>()
    const [coverUrl, setCover] = useState<string>()
    const { needSign } = useNeedSign()

    const walletType = session.data?.user.walletType ?? WalletType.none

    const requiredTokenAmount = requiredToken.data ?? 0
    const totalFees = Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)

    const { paymentMethod, setIsOpen: setPaymentModalOpen } = usePaymentMethodStore()

    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        reset,
        formState: { errors, isValid },
        control,
        trigger,
    } = useForm<z.infer<typeof NftFormSchema>>({
        resolver: zodResolver(NftFormSchema),
        mode: "onChange",
        defaultValues: {
            mediaType: MediaType.IMAGE,
            price: 2,
            priceUSD: 1,
        },
    })

    const tiers = api.fan.member.getAllMembership.useQuery({})

    const addAsset = api.fan.asset.createAsset.useMutation({
        onSuccess: () => {
            toast.success("NFT Created", {
                position: "top-center",
                duration: 4000,
            })
            setParentIsOpen(false)
            setPaymentModalOpen(false)
            setIsOpen(false)
            setMediaUploadSuccess(false)
            setMediaUrl(undefined)
            setCover(undefined)
            handleClose()
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const xdrMutation = api.fan.trx.createUniAssetTrx.useMutation({
        onSuccess(data, variables, context) {
            const { issuer, xdr } = data
            setValue("issuer", issuer)

            setSubmitLoading(true)

            toast.promise(
                clientsign({
                    presignedxdr: xdr,
                    pubkey: session.data?.user.id,
                    walletType,
                    test: clientSelect(),
                })
                    .then((res) => {
                        if (res) {
                            setValue("tier", tier)
                            const data = getValues()

                            addAsset.mutate({ ...data, isQRItem: true })
                        } else {
                            toast.error("Transaction Failed")
                        }
                    })
                    .catch((e) => console.log(e))
                    .finally(() => setSubmitLoading(false)),
                {
                    loading: "Signing Transaction",
                    success: "",
                    error: "Signing Transaction Failed",
                },
            )
        },
    })

    const onSubmit = () => {
        console.log("vlaues", getValues())
        if (ipfs) {
            xdrMutation.mutate({
                code: getValues("code"),
                limit: getValues("limit"),
                signWith: needSign(),
                ipfsHash: ipfs,
                native: paymentMethod === "xlm",
            })
        } else {
            toast.error("Please upload a thumbnail image.")
        }
    }

    function getEndpoint(mediaType: MediaType) {
        switch (mediaType) {
            case MediaType.IMAGE:
                return "imageUploader"
            case MediaType.MUSIC:
                return "musicUploader"
            case MediaType.VIDEO:
                return "videoUploader"
            case MediaType.THREE_D:
                return "modelUploader"
            default:
                return "imageUploader"
        }
    }

    function handleMediaChange(media: MediaType) {
        setMediaType(media)
        setValue("mediaType", media)
        setMediaUrl(undefined)
    }

    const uploadFile = async (fileToUpload: File) => {
        try {
            setUploading(true)
            const formData = new FormData()
            formData.append("file", fileToUpload, fileToUpload.name)
            const res = await fetch("/api/file", {
                method: "POST",
                body: formData,
            })
            const ipfsHash = await res.text()
            const thumbnail = ipfsHashToPinataGatewayUrl(ipfsHash)
            setCover(thumbnail)
            setValue("coverImgUrl", thumbnail)
            setCid(ipfsHash)
            toast.success("Thumbnail uploaded successfully")
            await trigger()

            setUploading(false)
        } catch (e) {
            setUploading(false)
            toast.error("Failed to upload file")
        }
    }

    const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files

        if (files) {
            if (files.length > 0) {
                const file = files[0]
                if (file) {
                    if (file.size > 1024 * 1024) {
                        toast.error("File size should be less than 1MB")
                        return
                    }
                    setFile(file)
                    await uploadFile(file)
                }
            }
        }
    }

    const loading = xdrMutation.isLoading ?? addAsset.isLoading ?? submitLoading ?? requiredToken.isLoading

    const getMediaIcon = (type: MediaType) => {
        switch (type) {
            case MediaType.IMAGE:
                return <ImageIcon className="h-4 w-4" />
            case MediaType.MUSIC:
                return <Music className="h-4 w-4" />
            case MediaType.VIDEO:
                return <Video className="h-4 w-4" />
            case MediaType.THREE_D:
                return <CubeIcon className="h-4 w-4" />
            default:
                return <ImageIcon className="h-4 w-4" />
        }
    }

    const nextStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep)
        if (currentIndex < FORM_STEPS.length - 1) {
            const nextStep = FORM_STEPS[currentIndex + 1]
            if (nextStep) {
                setActiveStep(nextStep)
            }
        }
    }

    const prevStep = () => {
        const currentIndex = FORM_STEPS.indexOf(activeStep)
        if (currentIndex > 0) {
            const previousStep = FORM_STEPS[currentIndex - 1]
            if (previousStep) {
                setActiveStep(previousStep)
            }
        }
    }

    React.useEffect(() => {
        const stepIndex = FORM_STEPS.indexOf(activeStep)
        setFormProgress((stepIndex + 1) * (100 / FORM_STEPS.length))
    }, [activeStep])

    const handleClose = () => {
        onClose()
        setActiveStep("details")
        setNFTModalOpen(false)
        setMediaUploadSuccess(false)
        setMediaUrl(undefined)
        setCover(undefined)
        reset()
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col"
            >
                <div className="border-b border-border bg-gradient-to-r from-primary/5 to-primary/0 px-6 py-6">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-foreground">Create QR Code Item</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Create and list your digital asset on the marketplace</p>
                    </div>


                    <div className="mt-6">
                        <div className="flex items-center justify-between gap-2">
                            {FORM_STEPS.map((step, index) => (
                                <React.Fragment key={step}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200",
                                                activeStep === step
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                                    : index < FORM_STEPS.indexOf(activeStep)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-secondary text-secondary-foreground border border-border",
                                            )}
                                        >
                                            {index < FORM_STEPS.indexOf(activeStep) ? <Check className="h-4 w-4" /> : index + 1}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-xs font-medium transition-colors duration-200",
                                                activeStep === step ? "text-foreground" : "text-muted-foreground",
                                            )}
                                        >
                                            {step === "media" ? "Media" : step === "details" ? "Details" : "Pricing"}
                                        </span>
                                    </div>
                                    {index < FORM_STEPS.length - 1 && (
                                        <div
                                            className={cn(
                                                "mb-8 flex-1 h-0.5 transition-colors duration-200",
                                                index < FORM_STEPS.indexOf(activeStep) ? "bg-primary" : "bg-border",
                                            )}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-0 py-6">
                    <form id="nft-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {activeStep === "details" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Card className="border-0 bg-secondary/30 shadow-none">
                                    <CardContent className="space-y-5 pt-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="font-semibold text-foreground">
                                                Item Name
                                            </Label>
                                            <Input
                                                id="name"
                                                {...register("name")}
                                                placeholder="e.g., Exclusive Digital Art"
                                                className="border border-input"
                                            />
                                            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name.message}</p>}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="description" className="font-semibold text-foreground">
                                                Description
                                            </Label>
                                            <Textarea
                                                id="description"
                                                {...register("description")}
                                                placeholder="Describe your digital asset and its unique features..."
                                                className="min-h-24 resize-none border border-input"
                                            />
                                            {errors.description && (
                                                <p className="text-xs font-medium text-destructive">{errors.description.message}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="code" className="font-semibold text-foreground">
                                                    Asset Code
                                                </Label>
                                                <Input id="code" {...register("code")} placeholder="ASSET" className="border border-input" />
                                                {errors.code && <p className="text-xs font-medium text-destructive">{errors.code.message}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="limit" className="font-semibold text-foreground">
                                                    Supply Limit
                                                </Label>
                                                <Input
                                                    id="limit"
                                                    type="number"
                                                    {...register("limit", { valueAsNumber: true })}
                                                    placeholder="1"
                                                    className="border border-input"
                                                />
                                                {errors.limit && <p className="text-xs font-medium text-destructive">{errors.limit.message}</p>}
                                            </div>
                                        </div>

                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            💡 The supply limit determines how many copies of this item can exist
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {activeStep === "media" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Card className="border-0 bg-secondary/30 shadow-none">
                                    <CardContent className="pt-6 space-y-6">
                                        <div>
                                            <Label className="mb-3 block text-sm font-semibold text-foreground">Media Type</Label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {Object.values(MediaType).map((media, i) => (
                                                    <Button
                                                        key={i}
                                                        type="button"
                                                        variant={media === mediaType ? "default" : "outline"}
                                                        onClick={() => handleMediaChange(media)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-1 py-4 h-auto transition-all duration-200",
                                                            media === mediaType && "ring-2 ring-primary ring-offset-2",
                                                        )}
                                                    >
                                                        {getMediaIcon(media)}
                                                        <span className="text-xs font-medium leading-tight">
                                                            {media === MediaType.THREE_D ? "3D" : media}
                                                        </span>
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        {tiers.data && (
                                            <div>
                                                <Label className="mb-3 block text-sm font-semibold text-foreground">Access Tier</Label>
                                                <TiersOptions
                                                    handleTierChange={(value: string) => {
                                                        setTier(value)
                                                    }}
                                                    tiers={tiers.data}
                                                />
                                            </div>
                                        )}

                                        <Separator className="my-2" />

                                        <div className="space-y-3">
                                            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                Thumbnail Image
                                                <Badge variant="secondary" className="ml-auto text-xs">
                                                    Required
                                                </Badge>
                                            </Label>
                                            <p className="text-xs text-muted-foreground">This will be displayed as your NFT preview image</p>
                                            <AnimatePresence>
                                                {!coverUrl ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => document.getElementById("coverImg")?.click()}
                                                        className="relative flex h-40 w-full flex-col items-center justify-center gap-3 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors duration-200"
                                                    >
                                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                                        <div className="text-center">
                                                            <p className="text-sm font-medium text-foreground">Click to upload</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, max 1MB</p>
                                                        </div>
                                                        {uploading && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                                    <p className="text-xs font-medium text-foreground">Uploading...</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        className="relative w-full overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/5"
                                                    >
                                                        <div className="relative aspect-video w-full overflow-hidden">
                                                            <Image
                                                                fill
                                                                alt="preview image"
                                                                src={coverUrl ?? "/placeholder.svg"}
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute right-2 top-2 h-7 w-7 shadow-md"
                                                            onClick={() => {
                                                                setCover(undefined)
                                                                setValue("coverImgUrl", "")
                                                                setCid(undefined)
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent px-3 py-2">
                                                            <Badge className="bg-primary text-primary-foreground">
                                                                <Check className="mr-1 h-3 w-3" /> Uploaded
                                                            </Badge>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            <Input id="coverImg" type="file" accept=".jpg, .png" onChange={handleChange} className="hidden" />

                                            {errors.coverImgUrl && (
                                                <p className="text-xs font-medium text-destructive">{errors.coverImgUrl.message}</p>
                                            )}
                                        </div>

                                        <Separator className="my-2" />

                                        <div className="space-y-3">
                                            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                Locked Content
                                                <Badge variant="secondary" className="ml-auto text-xs">
                                                    Required
                                                </Badge>
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Upload the exclusive content that users receive when they purchase
                                            </p>
                                            <div className="flex flex-col gap-2">
                                                <UploadS3Button
                                                    endpoint={getEndpoint(mediaType)}
                                                    variant="button"
                                                    label={`UPLOAD ${mediaType !== "THREE_D" ? mediaType : "3D"} CONTENT`}
                                                    className="w-full"
                                                    onClientUploadComplete={(res) => {
                                                        const data = res
                                                        if (data?.url) {
                                                            setMediaUrl(data.url)
                                                            setValue("mediaUrl", data.url)
                                                            setMediaUpload(false)
                                                            setMediaUploadSuccess(true)
                                                            trigger("mediaUrl")
                                                        }
                                                    }}
                                                    onUploadError={(error: Error) => {
                                                        toast.error(`ERROR! ${error.message}`)
                                                    }}
                                                />

                                                {mediaType === "THREE_D" && (
                                                    <Alert variant="default" className="border-primary/30 bg-primary/5">
                                                        <AlertDescription className="text-xs text-muted-foreground">
                                                            <p className="font-medium text-foreground">Supported Format:</p>
                                                            Only .obj files are accepted for 3D models
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                <AnimatePresence>
                                                    {mediaUrl && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            transition={{ duration: 0.3 }}
                                                            className="mt-3"
                                                        >
                                                            <Card className="overflow-hidden border-primary/30 bg-primary/5">
                                                                <CardContent className="p-3">
                                                                    <PlayableMedia mediaType={mediaType} mediaUrl={mediaUrl} />
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {errors.mediaUrl && (
                                                    <p className="text-xs font-medium text-destructive">{errors.mediaUrl.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {activeStep === "pricing" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Card className="border-0 bg-secondary/30 shadow-none">
                                    <CardContent className="space-y-6 pt-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="priceUSD" className="flex items-center gap-2 font-semibold text-foreground">
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    Price (USD)
                                                </Label>
                                                <Input
                                                    id="priceUSD"
                                                    type="number"
                                                    step="0.01"
                                                    {...register("priceUSD", { valueAsNumber: true })}
                                                    placeholder="0.00"
                                                    className="border border-input"
                                                />
                                                {errors.priceUSD && (
                                                    <p className="text-xs font-medium text-destructive">{errors.priceUSD.message}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="price" className="flex items-center gap-2 font-semibold text-foreground">
                                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                                    {PLATFORM_ASSET.code}
                                                </Label>
                                                <Input
                                                    id="price"
                                                    type="number"
                                                    {...register("price", { valueAsNumber: true })}
                                                    placeholder="0.00"
                                                    className="border border-input"
                                                />
                                                {errors.price && <p className="text-xs font-medium text-destructive">{errors.price.message}</p>}
                                            </div>
                                        </div>

                                        <Separator />

                                        <Alert
                                            className={cn(
                                                "border-l-4 bg-opacity-50",
                                                requiredTokenAmount > platformAssetBalance
                                                    ? "border-l-destructive bg-destructive/10"
                                                    : "border-l-primary bg-primary/10",
                                            )}
                                        >
                                            <AlertDescription
                                                className={cn(
                                                    "font-medium",
                                                    requiredTokenAmount > platformAssetBalance ? "text-destructive" : "text-foreground",
                                                )}
                                            >
                                                {`You'll need ${requiredTokenAmount} ${PLATFORM_ASSET.code} in your wallet`}
                                            </AlertDescription>
                                        </Alert>

                                        {requiredTokenAmount > platformAssetBalance && <RechargeLink />}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </form>
                </div>

                <div className="border-t border-border bg-background px-6 py-4">
                    <div className="flex w-full items-center justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={prevStep}
                            disabled={activeStep === "details"}
                            className="px-6 bg-transparent"
                        >
                            Previous
                        </Button>

                        {activeStep !== "pricing" ? (
                            <Button type="button" onClick={nextStep} className="flex items-center gap-2 px-6">
                                Next
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <PaymentChoose
                                costBreakdown={[
                                    {
                                        label: "Stellar Fee",
                                        amount: paymentMethod === "asset" ? requiredTokenAmount - totalFees : requiredXlm,
                                        type: "cost",
                                        highlighted: true,
                                    },
                                    {
                                        label: "Platform Fee",
                                        amount: paymentMethod === "asset" ? totalFees : feeInXLM,
                                        highlighted: false,
                                        type: "fee",
                                    },
                                    {
                                        label: "Total Cost",
                                        amount: paymentMethod === "asset" ? requiredTokenAmount : totalXlmCost,
                                        highlighted: false,
                                        type: "total",
                                    },
                                ]}
                                XLM_EQUIVALENT={totalXlmCost}
                                handleConfirm={handleSubmit(onSubmit)}
                                loading={loading}
                                requiredToken={requiredTokenAmount}
                                trigger={
                                    <Button disabled={loading || requiredTokenAmount > platformAssetBalance || !isValid} className="px-6">
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            "Create NFT"
                                        )}
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    )
}

function TiersOptions({
    tiers,
    handleTierChange,
}: {
    tiers: { id: number; name: string; price: number }[]
    handleTierChange: (value: string) => void
}) {
    return (
        <Select onValueChange={handleTierChange}>
            <SelectTrigger className="w-full border border-input">
                <SelectValue placeholder="Select an access tier..." />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel className="font-semibold">Access Options</SelectLabel>
                    <SelectItem value="public">
                        <span className="font-medium">Public</span>
                    </SelectItem>
                    <SelectItem value="private">
                        <span className="font-medium">Only Followers</span>
                    </SelectItem>
                    {tiers.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                            <div className="flex w-full items-center justify-between gap-2">
                                <span className="font-medium">{model.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                    ${model.price}
                                </Badge>
                            </div>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}

function PlayableMedia({
    mediaUrl,
    mediaType,
}: {
    mediaUrl?: string
    mediaType: MediaType
}) {
    return mediaUrl && <MediaComponent mediaType={mediaType} mediaUrl={mediaUrl} />

    function MediaComponent({
        mediaType,
        mediaUrl,
    }: {
        mediaType: MediaType
        mediaUrl: string
    }) {
        const [isLoading, setIsLoading] = useState(true)

        React.useEffect(() => {
            const timer = setTimeout(() => {
                setIsLoading(false)
            }, 1000)

            return () => clearTimeout(timer)
        }, [])

        if (isLoading) {
            return (
                <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )
        }

        switch (mediaType) {
            case MediaType.IMAGE:
                return (
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary">
                        <Image alt="NFT preview" src={mediaUrl ?? "/placeholder.svg"} fill className="object-cover" />
                    </div>
                )
            case MediaType.MUSIC:
                return (
                    <div className="w-full space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Audio Preview</p>
                        <audio controls className="w-full">
                            <source src={mediaUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )
            case MediaType.VIDEO:
                return (
                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-secondary">
                        <video controls className="h-full w-full">
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video element.
                        </video>
                    </div>
                )
            case MediaType.THREE_D:
                return (
                    <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-primary/20 p-2">
                                <Check className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">3D Model Ready</p>
                                <p className="text-xs text-muted-foreground">Successfully uploaded</p>
                            </div>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }
}

interface VisibilityToggleProps {
    isVisible: boolean
    toggleVisibility: () => void
}

export function VisibilityToggle({ isVisible, toggleVisibility }: VisibilityToggleProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleVisibility}
                        aria-label={isVisible ? "Set to private" : "Set to visible"}
                    >
                        {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isVisible ? "Visible to all" : "Private"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export default CreateQrCodeModal

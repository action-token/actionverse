"use client"

import type React from "react"

import { useForm, FormProvider, useFormContext } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    Music,
    ImageIcon,
    FileText,
    DollarSign,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Upload,
    Check,
    X,
    Coins,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { WalletType, clientsign } from "package/connect_wallet"
import { useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { z } from "zod"
import { PLATFORM_ASSET, PLATFORM_FEE, TrxBaseFeeInPlatformAsset } from "~/lib/stellar/constant"
import { AccountSchema, clientSelect } from "~/lib/stellar/fan/utils"
import { ipfsHashToUrl } from "~/utils/ipfs"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { api } from "~/utils/api"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "~/components/shadcn/ui/select"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import useNeedSign from "~/lib/hook"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Progress } from "~/components/shadcn/ui/progress"
import { Separator } from "~/components/shadcn/ui/separator"
import { useCreateSongModalStore } from "../store/create-song-modal"
import { UploadS3Button } from "../common/upload-button"
import { PaymentChoose, usePaymentMethodStore } from "../common/payment-options"
import { Dialog, DialogContent, DialogDescription, DialogHeader } from "../shadcn/ui/dialog"
import { cn } from "~/lib/utils"

export const SongFormSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    artist: z.string().min(2, "Artist must be at least 2 characters"),
    musicUrl: z.string({
        required_error: "Music file is required",
    }),
    description: z.string(),
    coverImgUrl: z.string({
        required_error: "Cover image is required",
    }),
    albumId: z.number(),
    price: z
        .number({
            required_error: "Price is required",
        })
        .nonnegative({
            message: "Price must be a positive number",
        }),
    priceUSD: z
        .number({
            required_error: "USD Price is required",
        })
        .nonnegative({
            message: "Price must be a positive number",
        }),
    limit: z
        .number({
            required_error: "Limit is required",
        })
        .nonnegative({
            message: "Limit must be a positive number",
        }),
    code: z
        .string({
            required_error: "Asset name is required",
        })
        .min(4, {
            message: "Asset name must be at least 4 characters",
        })
        .max(12, {
            message: "Asset name must be at most 12 characters",
        }),
    issuer: AccountSchema.optional(),
    tier: z.string().optional(),
})

type SongFormType = z.infer<typeof SongFormSchema>

// Define the steps
type FormStep = "basics" | "media" | "pricing" | "review"
const FORM_STEPS: FormStep[] = ["basics", "media", "pricing", "review"]

export default function CreateSongModal() {
    const [activeStep, setActiveStep] = useState<FormStep>("basics")
    const [formProgress, setFormProgress] = useState(25)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { albumId, isOpen, setIsOpen } = useCreateSongModalStore()
    const methods = useForm<SongFormType>({
        mode: "onChange",
        resolver: zodResolver(SongFormSchema),
        defaultValues: {
            albumId,
            price: 2,
            priceUSD: 2,
            name: "",
            artist: "",
            description: "",
            code: "",
            limit: 100,
        },
    })

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
        const { formState, getValues, trigger } = methods

        // Define fields to validate for each step
        const fieldsToValidate: Record<FormStep, (keyof SongFormType)[]> = {
            basics: ["name", "artist", "description", "tier"],
            media: ["coverImgUrl", "musicUrl"],
            pricing: ["code", "limit", "price", "priceUSD"],
            review: [],
        }

        // Trigger validation for the current step's fields
        const validateStep = async () => {
            const result = await trigger(fieldsToValidate[activeStep])
            return result
        }

        return validateStep()
    }

    const handleNext = async () => {
        const isValid = await canProceed()
        if (isValid) {
            goToNextStep()
        }
    }
    const handleClose = () => {
        setIsOpen(false)
        setActiveStep("basics")
        methods.reset()

    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                onInteractOutside={(e) => {
                    e.preventDefault()
                }}
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl p-2">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col h-full"
                >
                    <DialogHeader className=" px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Music className="h-5 w-5 " />
                            <CardTitle>Create New Song</CardTitle>
                        </div>
                        <DialogDescription>Add a new song to your collection</DialogDescription>

                        <Progress value={formProgress} className="mt-2 h-2" />

                        <div className="w-full px-6 ">
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
                                            {
                                                step === "basics" ? "Basics" : step === "media" ? "Media" : step === "pricing" ? "Pricing" : "Review"
                                            }
                                        </span>
                                    </div>
                                ))}

                            </div>
                        </div>
                    </DialogHeader>

                    <FormProvider {...methods}>
                        <form>
                            <CardContent className="p-6">
                                <AnimatePresence mode="wait">
                                    {activeStep === "basics" && <BasicsStep key="basics" />}
                                    {activeStep === "media" && <MediaStep key="media" />}
                                    {activeStep === "pricing" && <PricingStep key="pricing" />}
                                    {activeStep === "review" && <ReviewStep key="review" />}
                                </AnimatePresence>
                            </CardContent>

                            <CardFooter className="flex justify-between border-t p-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={goToPreviousStep}
                                    disabled={activeStep === "basics" || isSubmitting}
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>

                                {activeStep !== "review" ? (
                                    <Button type="button"
                                        className="shadow-foreground"

                                        onClick={handleNext}>
                                        Next
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <SubmitButton albumId={albumId} setIsOpen={setIsOpen} />
                                )}
                            </CardFooter>
                        </form>
                    </FormProvider>
                </motion.div>
            </DialogContent>

        </Dialog >
    )
}

function BasicsStep() {
    const {
        register,
        formState: { errors },
        control,
    } = useFormContext<SongFormType>()
    const tiers = api.fan.member.getAllMembership.useQuery({})

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
                <p className="text-sm text-muted-foreground">Enter the basic details about your song</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                        <Music className="h-4 w-4 " />
                        Song Name
                    </Label>
                    <Input
                        id="name"
                        {...register("name")}
                        placeholder="Enter song name"
                        className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="artist" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 " />
                        Artist
                    </Label>
                    <Input
                        id="artist"
                        {...register("artist")}
                        placeholder="Enter artist name"
                        className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.artist && <p className="text-sm text-destructive">{errors.artist.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 " />
                        Description
                    </Label>
                    <Textarea
                        id="description"
                        {...register("description")}
                        placeholder="Write a short description about this song"
                        className="min-h-24 resize-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>

                {tiers.data && (
                    <div className="space-y-2">
                        <Label htmlFor="tier" className="flex items-center gap-2">
                            <FileText className="h-4 w-4 " />
                            Access Tier
                        </Label>
                        <TiersOptions tiers={tiers.data} />
                        {errors.tier && <p className="text-sm text-destructive">{errors.tier.message}</p>}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function MediaStep() {
    const {
        register,
        setValue,
        watch,
        formState: { errors },
    } = useFormContext<SongFormType>()
    const [file, setFile] = useState<File>()
    const [ipfs, setIpfs] = useState<string>()
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const inputFile = useRef<HTMLInputElement>(null)

    const musicUrl = watch("musicUrl")
    const coverImgUrl = watch("coverImgUrl")

    const uploadFile = async (fileToUpload: File) => {
        try {
            setUploading(true)
            setUploadProgress(10)

            const formData = new FormData()
            formData.append("file", fileToUpload, fileToUpload.name)

            setUploadProgress(30)

            const res = await fetch("/api/file", {
                method: "POST",
                body: formData,
            })

            setUploadProgress(70)

            const ipfsHash = await res.text()
            const thumbnail = ipfsHashToUrl(ipfsHash)

            setUploadProgress(90)

            setValue("coverImgUrl", thumbnail)
            setIpfs(ipfsHash)

            setUploadProgress(100)
            setUploading(false)

            toast.success("Cover image uploaded successfully")
        } catch (e) {
            console.error(e)
            setUploading(false)
            setUploadProgress(0)
            toast.error("Trouble uploading file")
        }
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
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

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Media Files</h2>
                <p className="text-sm text-muted-foreground">Upload your song and cover image</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <Label htmlFor="coverImg" className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 " />
                        Cover Image
                    </Label>
                    <AnimatePresence>
                        <>
                            {!coverImgUrl ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => inputFile.current?.click()}
                                    className="w-full h-32 relative border-dashed flex flex-col items-center justify-center gap-2"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="h-6 w-6 animate-spin " />
                                            <span className="text-sm">Uploading... {uploadProgress}%</span>
                                            <Progress value={uploadProgress} className="w-4/5" />
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-6 w-6 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Click to upload cover image</span>
                                            <span className="text-xs text-muted-foreground">JPG, PNG (max 1MB)</span>
                                        </>
                                    )}
                                </Button>
                            ) :
                                (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2 }}
                                        className="relative aspect-square 
                                        rounded-md overflow-hidden border"
                                    >
                                        <Image fill alt="Cover preview" src={coverImgUrl ?? "/images/action/logo.png"} className="object-cover " />
                                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 py-1 px-2">
                                            <Badge variant="outline" className="bg-green-100 text-green-800">
                                                <Check className="h-3 w-3 mr-1" /> Uploaded
                                            </Badge>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-6 w-6"
                                            onClick={() => {
                                                setValue("coverImgUrl", "")
                                                setIpfs(undefined)
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </motion.div>
                                )}
                        </>
                    </AnimatePresence>

                    <Input
                        id="coverImg"
                        type="file"
                        accept=".jpg, .png"
                        onChange={handleChange}
                        className="hidden"
                    />
                    {errors.coverImgUrl && <p className="text-sm text-destructive">{errors.coverImgUrl.message}</p>}
                </div><Separator /><div className="space-y-4">
                    <Label htmlFor="musicFile" className="flex items-center gap-2">
                        <Music className="h-4 w-4 " />
                        Music File
                    </Label>

                    <UploadS3Button
                        endpoint="musicUploader"
                        variant="button"
                        className="w-full"
                        label="Upload Music File"
                        onClientUploadComplete={(res) => {
                            if (res?.url) {
                                setValue("musicUrl", res.url)
                                toast.success("Music file uploaded successfully")
                            }
                        }}
                        onUploadError={(error: Error) => {
                            toast.error(`ERROR! ${error.message}`)
                        }} />

                    <AnimatePresence>
                        {musicUrl && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.3 }}
                                className="mt-2"
                            >
                                <Card className="overflow-hidden">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-primary/10 p-3 rounded-full">
                                                <Music className="h-5 w-5 " />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">Music file uploaded</p>
                                                <audio controls className="w-full mt-2">
                                                    <source src={musicUrl} type="audio/mpeg" />
                                                    Your browser does not support the audio element.
                                                </audio>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {errors.musicUrl && <p className="text-sm text-destructive">{errors.musicUrl.message}</p>}
                </div>
            </div >
        </motion.div >
    )
}

function PricingStep() {
    const {
        register,
        formState: { errors },
    } = useFormContext<SongFormType>()

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Pricing & Asset Details</h2>
                <p className="text-sm text-muted-foreground">Set up your song{"'s"} pricing and asset information</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="code" className="flex items-center gap-2">
                            <FileText className="h-4 w-4 " />
                            Asset Name
                        </Label>
                        <Input
                            id="code"
                            {...register("code")}
                            placeholder="Enter asset name (4-12 chars)"
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="limit" className="flex items-center gap-2">
                            <FileText className="h-4 w-4 " />
                            Supply Limit
                        </Label>
                        <Input
                            id="limit"
                            type="number"
                            {...register("limit", { valueAsNumber: true })}
                            placeholder="Enter supply limit"
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                        {errors.limit && <p className="text-sm text-destructive">{errors.limit.message}</p>}
                        <p className="text-xs text-muted-foreground">This determines how many copies of this song can exist</p>
                    </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="price" className="flex items-center gap-2">
                            <Coins className="h-4 w-4 " />
                            Price in {PLATFORM_ASSET.code}
                        </Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.1"
                            {...register("price", { valueAsNumber: true })}
                            placeholder={`Enter price in ${PLATFORM_ASSET.code}`}
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                        {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priceUSD" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 " />
                            Price in USD
                        </Label>
                        <Input
                            id="priceUSD"
                            type="number"
                            step="0.1"
                            {...register("priceUSD", { valueAsNumber: true })}
                            placeholder="Enter price in USD"
                            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        />
                        {errors.priceUSD && <p className="text-sm text-destructive">{errors.priceUSD.message}</p>}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function ReviewStep() {
    const { watch } = useFormContext<SongFormType>()

    const name = watch("name")
    const artist = watch("artist")
    const description = watch("description")
    const coverImgUrl = watch("coverImgUrl")
    const musicUrl = watch("musicUrl")
    const code = watch("code")
    const limit = watch("limit")
    const price = watch("price")
    const priceUSD = watch("priceUSD")
    const tier = watch("tier")

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Review Your Song</h2>
                <p className="text-sm text-muted-foreground">Please review all information before submitting</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="relative aspect-square rounded-md overflow-hidden border">
                        <Image fill alt="Cover preview" src={coverImgUrl ?? "/images/action/logo.png"} className="object-cover" />
                    </div>

                    <audio controls className="w-full">
                        <source src={musicUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">{name}</h3>
                        <p className="text-muted-foreground">{artist}</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium">Description</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className="text-sm font-medium">Asset Name</p>
                            <p className="text-sm text-muted-foreground">{code}</p>
                        </div>

                        <div>
                            <p className="text-sm font-medium">Supply Limit</p>
                            <p className="text-sm text-muted-foreground">{limit}</p>
                        </div>

                        <div>
                            <p className="text-sm font-medium">Price ({PLATFORM_ASSET.code})</p>
                            <p className="text-sm text-muted-foreground">
                                {price} {PLATFORM_ASSET.code}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium">Price (USD)</p>
                            <p className="text-sm text-muted-foreground">${priceUSD}</p>
                        </div>

                        <div>
                            <p className="text-sm font-medium">Access Tier</p>
                            <p className="text-sm text-muted-foreground">{tier ?? "Public"}</p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function SubmitButton({ albumId, setIsOpen }: {
    albumId: number | undefined;
    setIsOpen: (isOpen: boolean) => void;
}
) {
    const { getValues, setValue } = useFormContext<SongFormType>()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [tier, setTier] = useState<string>()
    const session = useSession()
    const { platformAssetBalance } = useUserStellarAcc()
    const { needSign } = useNeedSign()
    const { paymentMethod, setIsOpen: setPaymentModalOpen } = usePaymentMethodStore()

    const requiredToken = api.fan.trx.getRequiredPlatformAsset.useQuery(
        {
            xlm: 2,
        },
        {
            enabled: !!albumId,
        },
    )

    const totalFeees = Number(TrxBaseFeeInPlatformAsset) + Number(PLATFORM_FEE)

    const addSong = api.fan.music.create.useMutation({
        onSuccess: () => {
            toast.success("Song added successfully!")
            setIsSubmitting(false)
            setIsOpen(false)
            setPaymentModalOpen(false)
        },
        onError: (error) => {
            toast.error(error.message || "Failed to add song")
            setIsSubmitting(false)
        },
    })

    const xdrMutation = api.fan.trx.createUniAssetTrx.useMutation({
        onSuccess(data, variables, context) {
            const { issuer, xdr } = data
            setValue("issuer", issuer)

            setIsSubmitting(true)

            toast.promise(
                clientsign({
                    presignedxdr: xdr,
                    pubkey: session.data?.user.id,
                    walletType: session.data?.user.walletType,
                    test: clientSelect(),
                })
                    .then((res) => {
                        if (res) {
                            setValue("tier", tier)
                            const data = getValues()
                            addSong.mutate({ ...data })
                        } else {
                            toast.error("Transaction Failed")
                            setIsSubmitting(false)
                        }
                    })
                    .catch((e) => {
                        console.error(e)
                        setIsSubmitting(false)
                    }),
                {
                    loading: "Signing Transaction...",
                    success: "Transaction Signed",
                    error: "Signing Transaction Failed",
                },
            )
        },
        onError: (error) => {
            toast.error(error.message || "Failed to create transaction")
            setIsSubmitting(false)
        },
    })

    const handleSubmit = () => {
        const ipfs = getValues("coverImgUrl")
        if (!ipfs) {
            toast.error("Please upload a cover image")
            return
        }

        setIsSubmitting(true)

        xdrMutation.mutate({
            code: getValues("code"),
            limit: getValues("limit"),
            signWith: needSign(),
            ipfsHash: ipfs,
            native: paymentMethod === "xlm",
        })
    }

    if (requiredToken.isLoading) {
        return (
            <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
            </Button>
        )
    }

    const requiredTokenAmount = requiredToken.data ?? 0
    const insufficientBalance = requiredTokenAmount > platformAssetBalance

    return (
        <PaymentChoose
            costBreakdown={[
                {
                    label: "Cost",
                    amount: paymentMethod === "asset" ? requiredTokenAmount - totalFeees : 2,
                    type: "cost",
                    highlighted: true,
                },
                {
                    label: "Platform Fee",
                    amount: paymentMethod === "asset" ? totalFeees : 2,
                    highlighted: false,
                    type: "fee",
                },
                {
                    label: "Total Cost",
                    amount: paymentMethod === "asset" ? requiredTokenAmount : 4,
                    highlighted: false,
                    type: "total",
                },
            ]}
            XLM_EQUIVALENT={4}
            handleConfirm={handleSubmit}
            loading={isSubmitting}
            requiredToken={requiredTokenAmount}
            trigger={
                <Button
                    variant="sidebarAccent"
                    disabled={isSubmitting || insufficientBalance} className="flex items-center gap-2
                        shadow-sm shadow-black hover:shadow-xl transition-shadow duration-200"
                >
                    {
                        isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating Song...
                            </>
                        ) : (
                            <>
                                <Music className="h-4 w-4" />
                                Create Song
                            </>
                        )
                    }
                </ Button >
            }
        />
    )
}

function TiersOptions({
    tiers,
}: {
    tiers: { id: number; name: string; price: number }[]
}) {
    const { setValue } = useFormContext<SongFormType>()

    return (
        <Select onValueChange={(value) => setValue("tier", value)}>
            <SelectTrigger className="w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Select a tier" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Choose Tier</SelectLabel>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Only Members</SelectItem>                    {tiers.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                                <span>{model.name}</span>
                                <Badge variant="outline">{model.price}</Badge>
                            </div>
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}


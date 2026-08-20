"use client"

import { type ChangeEvent, useState } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import Image from "next/image"
import { zodResolver } from "@hookform/resolvers/zod"
import { MediaType } from "@prisma/client"
import { motion, AnimatePresence } from "framer-motion"
import {
    ChevronLeft,
    Upload,
    Check,
    X,
    Loader2,
    Music,
    Video,
    ImageIcon,
    CuboidIcon as Cube,
    DollarSign,
    Coins,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { clientsign, extractTxHash } from "package/connect_wallet"
import { WalletType } from "package/connect_wallet/src/lib/enums"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { z } from "zod"
import { Button } from "~/components/shadcn/ui/button"
import { Label } from "~/components/shadcn/ui/label"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"
import { PaymentChoose, usePaymentMethodStore } from "~/components/common/payment-options"
import { MediaDropzone } from "~/components/smart-contract/media-dropzone"
import { TiersOptions, PlayableMedia } from "~/components/nft-create/nft-create-helpers"
import { NftFormSchema } from "~/components/modal/nft-create-modal"
import useNeedSign from "~/lib/hook"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import {
    PLATFORM_ASSET,
    PLATFORM_FEE,
    SIMPLIFIED_FEE_IN_XLM,
    TrxBaseFeeInPlatformAsset,
} from "~/lib/stellar/constant"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { ipfsHashToPinataGatewayUrl } from "~/utils/ipfs"
import { cn } from "~/lib/utils"

/**
 * Full page for minting a classic Stellar-asset NFT — replaces the old
 * step-by-step `ClassicNftForm` dialog. Two-column layout, no steps:
 * everything is visible and editable at once, matching the smart-contract
 * NFT create page. Living under `/organization/*` so it automatically
 * inherits `CreatorLayout` via `RootLayout`'s route-prefix check.
 */
export default function CreateClassicNftPage() {
    const router = useRouter()

    // cost in xlm
    const requiredXlm = 2
    const feeInXLM = SIMPLIFIED_FEE_IN_XLM
    const totalXlmCost = requiredXlm + feeInXLM

    const requiredToken = api.fan.trx.getRequiredPlatformAsset.useQuery({
        xlm: requiredXlm,
    })

    const session = useSession()
    const { platformAssetBalance } = useUserStellarAcc()
    const [ipfs, setCid] = useState<string>()
    const [uploading, setUploading] = useState(false)

    const [tier, setTier] = useState<string>()

    const [submitLoading, setSubmitLoading] = useState(false)
    const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE)

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
        formState: { errors, isValid },
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
            setPaymentModalOpen(false)
            void router.push("/organization/store")
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const xdrMutation = api.fan.trx.createUniAssetTrx.useMutation({
        onSuccess(data) {
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

                            addAsset.mutate({ ...data })
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
                    if (file.size > 2 * 1024 * 1024) {
                        toast.error("File size should be less than 2MB")
                        return
                    }
                    await uploadFile(file)
                }
            }
        }
    }

    const loading =
        xdrMutation.isLoading ?? addAsset.isLoading ?? submitLoading ?? requiredToken.isLoading

    const getMediaIcon = (type: MediaType) => {
        switch (type) {
            case MediaType.IMAGE:
                return <ImageIcon className="h-4 w-4" />
            case MediaType.MUSIC:
                return <Music className="h-4 w-4" />
            case MediaType.VIDEO:
                return <Video className="h-4 w-4" />
            case MediaType.THREE_D:
                return <Cube className="h-4 w-4" />
            default:
                return <ImageIcon className="h-4 w-4" />
        }
    }

    const canSubmit = isValid && !!ipfs && !errors.mediaUrl

    return (
        <div className="mx-auto max-w-6xl p-4 md:p-6">
            <Link
                href="/organization/store"
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" />
                Back to store
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Create Classic NFT</h1>
                <p className="text-sm text-muted-foreground">
                    Mint as a classic Stellar asset, distributed through your storage account.
                </p>
            </div>

            <form id="nft-form" onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Left column — Details + Pricing */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Item name</Label>
                                    <Input id="name" {...register("name")} placeholder="Enter a name for your item" />
                                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        {...register("description")}
                                        placeholder="Describe your NFT"
                                        className="min-h-24 resize-none"
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-destructive">{errors.description.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="code">Asset Code</Label>
                                    <Input id="code" {...register("code")} placeholder="Enter asset code (4-12 characters)" />
                                    {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="limit">Supply Limit</Label>
                                    <Input
                                        id="limit"
                                        type="number"
                                        {...register("limit", { valueAsNumber: true })}
                                        placeholder="Enter supply limit (default: 1)"
                                    />
                                    {errors.limit && <p className="text-sm text-destructive">{errors.limit.message}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        This determines how many copies of this Item can exist
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Pricing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="priceUSD" className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        Price in USD
                                    </Label>
                                    <Input
                                        id="priceUSD"
                                        type="number"
                                        {...register("priceUSD", { valueAsNumber: true })}
                                        placeholder="Enter price in USD"
                                    />
                                    {errors.priceUSD && <p className="text-sm text-destructive">{errors.priceUSD.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="price" className="flex items-center gap-2">
                                        <Coins className="h-4 w-4 text-muted-foreground" />
                                        Price in {PLATFORM_ASSET.code}
                                    </Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        {...register("price", { valueAsNumber: true })}
                                        placeholder={`Enter price in ${PLATFORM_ASSET.code}`}
                                    />
                                    {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                                </div>

                                <Separator className="my-4" />

                                <Alert variant={requiredTokenAmount > platformAssetBalance ? "destructive" : "default"}>
                                    <AlertDescription>
                                        {`You'll need ${requiredTokenAmount} ${PLATFORM_ASSET.code} in your wallet to create an NFT`}
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right column — Media, tier, thumbnail, NFT content */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                                <CardTitle className="text-base">Media</CardTitle>
                                {tiers.data && (
                                    <div className="w-40 shrink-0">
                                        <TiersOptions
                                            value={tier}
                                            handleTierChange={(value: string) => {
                                                setTier(value)
                                            }}
                                            tiers={tiers.data}
                                        />
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-sm font-medium">
                                        Thumbnail Image
                                        <span className="text-xs text-muted-foreground">
                                            (This will be your NFT image and item Thumbnail)
                                        </span>
                                    </Label>
                                    <AnimatePresence>
                                        {!coverUrl ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => document.getElementById("coverImg")?.click()}
                                                className="relative flex h-36 w-full flex-col items-center justify-center gap-2 border-dashed"
                                            >
                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">Upload Thumbnail</span>
                                                {uploading && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                                        <Loader2 className="h-6 w-6 animate-spin " />
                                                    </div>
                                                )}
                                            </Button>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="relative h-36 overflow-hidden rounded-md"
                                            >
                                                <Image fill alt="preview image" src={coverUrl ?? "/placeholder.svg"} className="object-cover" />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute right-1 top-1 h-6 w-6"
                                                    onClick={() => {
                                                        setCover(undefined)
                                                        setValue("coverImgUrl", "")
                                                        setCid(undefined)
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1">
                                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                                        <Check className="mr-1 h-3 w-3" /> Uploaded
                                                    </Badge>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <Input id="coverImg" type="file" accept=".jpg, .png" onChange={handleChange} className="hidden" />

                                    {errors.coverImgUrl && (
                                        <p className="text-sm text-destructive">{errors.coverImgUrl.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label className="mb-2 block text-sm font-medium">Media Type</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.values(MediaType).map((media, i) => {
                                            const isSelected = media === mediaType
                                            return (
                                                <Button
                                                    key={i}
                                                    type="button"
                                                    size="sm"
                                                    variant={isSelected ? "destructive" : "muted"}
                                                    onClick={() => handleMediaChange(media)}
                                                    className={cn(
                                                        "gap-1.5 text-xs",
                                                        isSelected ? "px-3 shadow-sm shadow-foreground" : "w-9 px-0 justify-center",
                                                    )}
                                                >
                                                    {getMediaIcon(media)}
                                                    {isSelected && <span>{media === MediaType.THREE_D ? "3D" : media}</span>}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Locked Content</Label>
                                    <div className="flex flex-col gap-2">
                                        <MediaDropzone
                                            endpoint={getEndpoint(mediaType)}
                                            label={`Drag & drop or click to upload ${mediaType !== "THREE_D" ? mediaType.toLowerCase() : "3D"} content`}
                                            onUploadComplete={(url) => {
                                                setMediaUrl(url)
                                                setValue("mediaUrl", url)
                                                void trigger("mediaUrl")
                                            }}
                                        />

                                        {mediaType === "THREE_D" && (
                                            <Alert variant="info">
                                                <AlertDescription>
                                                    <p className="text-center text-xs text-muted-foreground">
                                                        Only .obj files are accepted
                                                    </p>
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <AnimatePresence>
                                            {mediaUrl && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-2"
                                                >
                                                    <Card className="overflow-hidden">
                                                        <CardContent className="p-3">
                                                            <PlayableMedia mediaType={mediaType} mediaUrl={mediaUrl} />
                                                        </CardContent>
                                                    </Card>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {errors.mediaUrl && (
                                            <p className="text-sm text-destructive">{errors.mediaUrl.message}</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>

            <div className="mt-6 flex justify-end border-t pt-6">
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
                        <Button
                            variant="default"
                            size="lg"
                            disabled={loading || requiredTokenAmount > platformAssetBalance || !canSubmit}
                            className="flex items-center gap-1 shadow-sm shadow-foreground"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating NFT...
                                </>
                            ) : (
                                "Create NFT"
                            )}
                        </Button>
                    }
                />
            </div>
        </div>
    )
}

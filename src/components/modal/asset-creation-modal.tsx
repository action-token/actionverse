"use client"
import type React from "react"
import { useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, ImageIcon, Plus, AlertCircle, CheckCircle2, CheckCheck, Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { RadioGroupItem } from "~/components/shadcn/ui/radio-group"
import { cn } from "~/lib/utils"
import { RadioGroup } from "~/components/shadcn/ui/radio-group"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { ipfsHashToUrl } from "~/utils/ipfs"
import toast from "react-hot-toast"
import { api } from "~/utils/api"
import { useSession } from "next-auth/react"
import { clientsign, WalletType } from "package/connect_wallet"
import useNeedSign from "~/lib/hook"

// Asset validation schemas
const AssetNameSchema = z
    .string()
    .min(4, "Asset name must be at least 4 characters")
    .max(12, "Asset name must be less than 13 characters")
    .regex(/^[a-zA-Z]+$/, "Asset name can only contain letters (a-z, A-Z)")

const NewAssetSchema = z.object({
    assetType: z.literal("new"),
    assetName: AssetNameSchema,
    assetImage: z.string().url().optional(),
    assetImagePreview: z.string().optional(),
})

const CustomAssetSchema = z.object({
    assetType: z.literal("custom"),
    assetCode: AssetNameSchema,
    issuer: z.string().length(56, "Issuer must be exactly 56 characters"),
})

export type AssetData = z.infer<typeof NewAssetSchema> | z.infer<typeof CustomAssetSchema>

interface AssetCreationModalProps {
    isOpen: boolean
    onClose: () => void
    initialData?: Partial<AssetData>
}

export default function AssetCreationModal({ isOpen, onClose, initialData }: AssetCreationModalProps) {
    const session = useSession()
    const { needSign } = useNeedSign();

    const [isSubmitLoading, setSubmitLoading] = useState<boolean>(false)
    const [assetData, setAssetData] = useState<AssetData>({
        assetType: "new",
        assetName: "",
        assetImage: "",
        assetImagePreview: "",
        ...initialData,
    } as AssetData)

    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isTrusted, setIsTrusted] = useState(false)
    const [isTrusting, setIsTrusting] = useState(false)

    const assetCreation = api.fan.creator.createCreatorPageAsset.useMutation({
        onSuccess: () => {
            toast.success("Successfully added!")
            onClose();
        },
        onError: () => {
            toast.error("Error")
        }
    })

    const assetCreationXDR = api.fan.creator.creatorRequestXdr.useMutation(
        {
            onSuccess: (data) => {
                console.log("data......", data)
                const toastId = toast.loading(
                    <div className="flex items-center gap-2">

                        <span>Signing transaction...</span>
                    </div>,
                )
                if (data.xdr) {

                    clientsign({
                        presignedxdr: data.xdr,
                        pubkey: "admin",
                        walletType: WalletType.isAdmin,
                    })
                        .then((res) => {
                            if (res) {
                                assetCreation.mutate({
                                    ...assetData,
                                    escrow: data?.escrow
                                })
                            }

                            else {
                                toast.error("Transaction failed in Stellar Network. Please try again.")
                            }
                        })
                        .catch((e) => {
                            console.log(e)
                            toast.error("Error in signing transaction. Please try again.")
                        })
                        .finally(() => {
                            toast.dismiss(toastId)

                            setSubmitLoading(false)
                        })

                }
            }
        }
    )

    const CheckCustomAssetValidity = api.fan.creator.checkCustomAssetValidity.useMutation({
        onSuccess: (data) => {
            if (data) {
                setIsTrusted(true)
                toast.success("Asset validated successfully!")
            }
        },
        onError: (error) => {
            console.error("Error checking custom asset validity:", error)
            setIsTrusted(false)
            toast.error("Failed to check asset validity")
        },
    })

    // Validation function
    const validateField = (field: string, value: string) => {
        try {
            if (field === "assetName" || field === "assetCode") {
                AssetNameSchema.parse(value)
                return { valid: true, errors: [] }
            } else if (field === "issuer") {
                z.string().length(56).parse(value)
                return { valid: true, errors: [] }
            }
            return { valid: true, errors: [] }
        } catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    valid: false,
                    errors: error.errors.map((err) => err.message),
                }
            }
            return { valid: false, errors: ["Invalid input"] }
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target

        setAssetData((prev) => ({
            ...prev,
            [name]: value,
        }))

        // Validate the field
        const validation = validateField(name, value)
        setFormErrors((prev) => ({
            ...prev,
            [name]: validation.valid ? [] : validation.errors,
        }))

        // Reset trust status when asset code or issuer changes
        if ((name === "assetCode" || name === "issuer") && isTrusted) {
            setIsTrusted(false)
        }
    }

    const handleRadioChange = (value: "new" | "custom") => {
        setAssetData({
            assetType: value,
            ...(value === "new" ? { assetName: "", assetImage: "", assetImagePreview: "" } : { assetCode: "", issuer: "" }),
        } as AssetData)
        setFormErrors({})
        setIsTrusted(false)
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setIsUploading(true)
            setUploadProgress(10)
            try {
                const uploadFormData = new FormData()
                uploadFormData.append("file", file, file.name)

                const progressInterval = setInterval(() => {
                    setUploadProgress((prev) => Math.min(prev + 10, 90))
                }, 300)

                const res = await fetch("/api/file", {
                    method: "POST",
                    body: uploadFormData,
                })

                clearInterval(progressInterval)
                setUploadProgress(100)

                const ipfsHash = await res.text()
                const thumbnail = ipfsHashToUrl(ipfsHash)

                setAssetData((prev) => ({
                    ...prev,
                    assetImage: thumbnail,
                    assetImagePreview: thumbnail,
                }))

                setTimeout(() => {
                    setIsUploading(false)
                }, 500)
            } catch (error) {
                console.error("Upload failed:", error)
                toast.error("Upload failed. Please try again.")
                setIsUploading(false)
            }
        }
    }

    const checkCustomAssetValidity = () => {
        if (assetData.assetType === "custom") {
            setIsTrusting(true)
            CheckCustomAssetValidity.mutate({
                assetCode: assetData.assetCode,
                issuer: assetData.issuer,
            })
            setIsTrusting(false)
        }
    }

    const handleSave = () => {
        try {
            // Validate the entire form
            if (assetData.assetType === "new") {
                NewAssetSchema.parse(assetData)
                if (!assetData.assetImage) {
                    toast.error("Please upload an asset image")
                    return
                }
            } else {
                CustomAssetSchema.parse(assetData)
                if (!isTrusted) {
                    toast.error("Please validate the custom asset first")
                    return
                }
            }
            assetCreationXDR.mutate({
                creatorId: session.data?.user.id ?? "",
                ...assetData
            })


        } catch (error) {
            if (error instanceof z.ZodError) {
                const newErrors: Record<string, string[]> = {}
                error.errors.forEach((err) => {
                    const path = err.path[0] as string
                    if (!newErrors[path]) {
                        newErrors[path] = []
                    }
                    newErrors[path].push(err.message)
                })
                setFormErrors(newErrors)
                toast.error("Please fix the validation errors")
            }
        }
    }

    const isAssetNameValid =
        assetData.assetType === "new" &&
        assetData.assetName &&
        assetData.assetName.length >= 4 &&
        assetData.assetName.length <= 12 &&
        /^[a-zA-Z]+$/.test(assetData.assetName)
    const isAssetCodeValid =
        assetData.assetType === "custom" &&
        assetData.assetCode &&
        assetData.assetCode.length >= 4 &&
        assetData.assetCode.length <= 12 &&
        /^[a-zA-Z]+$/.test(assetData.assetCode)
    const isIssuerValid = assetData.assetType === "custom" && assetData.issuer && assetData.issuer.length === 56

    const canSave =
        assetData.assetType === "new"
            ? isAssetNameValid && assetData.assetImage && !isUploading
            : isAssetCodeValid && isIssuerValid && isTrusted

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Create Your Asset</DialogTitle>
                    <DialogDescription>Choose between creating a new asset or using a custom one.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <RadioGroup
                        value={assetData.assetType}
                        onValueChange={handleRadioChange}
                        className="grid gap-4 md:grid-cols-2"
                    >
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                "relative overflow-hidden rounded-xl border p-6 cursor-pointer transition-all duration-300",
                                assetData.assetType === "new"
                                    ? "border-primary bg-primary/5 shadow-md"
                                    : "hover:border-primary hover:bg-primary/5",
                            )}
                            onClick={() => handleRadioChange("new")}
                        >
                            <div className="absolute top-4 right-4">
                                <RadioGroupItem value="new" id="new-asset" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="rounded-full bg-primary/10 p-3 w-fit text-primary">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div>
                                    <Label htmlFor="new-asset" className="text-lg font-medium cursor-pointer">
                                        New Asset
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">Create a new asset with a name and image.</p>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                                "relative overflow-hidden rounded-xl border p-6 cursor-pointer transition-all duration-300",
                                assetData.assetType === "custom"
                                    ? "border-primary bg-primary/5 shadow-md"
                                    : "hover:border-primary hover:bg-primary/5",
                            )}
                            onClick={() => handleRadioChange("custom")}
                        >
                            <div className="absolute top-4 right-4">
                                <RadioGroupItem value="custom" id="custom-asset" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="rounded-full bg-primary/10 p-3 w-fit text-primary">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <Label htmlFor="custom-asset" className="text-lg font-medium cursor-pointer">
                                        Custom Asset
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">Use an existing asset code and asset issuer.</p>
                                </div>
                            </div>
                        </motion.div>
                    </RadioGroup>

                    <AnimatePresence mode="wait">
                        {assetData.assetType === "new" ? (
                            <motion.div
                                key="new-asset"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6 pt-4"
                            >
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-full md:w-1/2">
                                        <div className="flex justify-between">
                                            <Label htmlFor="assetName" className="text-base font-medium">
                                                Asset Name
                                            </Label>
                                            <span
                                                className={cn(
                                                    "text-xs",
                                                    assetData.assetName && assetData.assetName.length > 0 && !isAssetNameValid
                                                        ? "text-destructive"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {assetData.assetName?.length || 0}/4-12 characters
                                            </span>
                                        </div>
                                        <Input
                                            id="assetName"
                                            name="assetName"
                                            value={assetData.assetName || ""}
                                            onChange={handleInputChange}
                                            placeholder="Enter asset name"
                                            className={cn(
                                                "mt-1",
                                                assetData.assetName &&
                                                assetData.assetName.length > 0 &&
                                                !isAssetNameValid &&
                                                "border-destructive",
                                            )}
                                            maxLength={12}
                                        />
                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                className={cn(
                                                    "h-full",
                                                    isAssetNameValid
                                                        ? "bg-primary"
                                                        : assetData.assetName && assetData.assetName.length > 0
                                                            ? "bg-destructive"
                                                            : "bg-primary",
                                                )}
                                                initial={{ width: "0%" }}
                                                animate={{
                                                    width: assetData.assetName
                                                        ? assetData.assetName.length < 4
                                                            ? `${(assetData.assetName.length / 4) * 33}%`
                                                            : assetData.assetName.length > 12
                                                                ? "100%"
                                                                : `${33 + ((assetData.assetName.length - 4) / 8) * 67}%`
                                                        : "0%",
                                                }}
                                                transition={{ duration: 0.2 }}
                                            />
                                        </div>
                                        {formErrors.assetName && formErrors.assetName.length > 0 && (
                                            <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {formErrors.assetName[0]}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Choose a descriptive name for your asset (4-12 letters, a-z and A-Z only).
                                        </p>
                                    </div>
                                    <div className="w-full md:w-1/2">
                                        <Label htmlFor="asset-upload" className="block mb-2 text-base font-medium">
                                            Asset Image
                                        </Label>
                                        <div className="flex flex-col gap-4">
                                            {assetData.assetImagePreview ? (
                                                <motion.div
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ duration: 0.5 }}
                                                    className="relative h-40 w-full overflow-hidden rounded-lg border-2 border-primary shadow-md"
                                                >
                                                    <Image
                                                        src={assetData.assetImagePreview || "/placeholder.svg"}
                                                        alt="Asset preview"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                    {isUploading && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                                            <div className="w-3/4 bg-background rounded-full h-2 overflow-hidden">
                                                                <motion.div
                                                                    className="h-full bg-primary"
                                                                    initial={{ width: "0%" }}
                                                                    animate={{ width: `${uploadProgress}%` }}
                                                                    transition={{ duration: 0.1 }}
                                                                />
                                                            </div>
                                                            <p className="absolute text-white text-sm font-medium mt-8">{uploadProgress}%</p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    whileHover={{ scale: 1.02 }}
                                                    className="group relative flex h-40 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground bg-muted/50 transition-all duration-300 hover:border-primary hover:bg-primary/5"
                                                    onClick={() => document.getElementById("asset-upload")?.click()}
                                                >
                                                    <ImageIcon className="h-16 w-16 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        Click to upload
                                                    </div>
                                                </motion.div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="asset-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => document.getElementById("asset-upload")?.click()}
                                                    className="w-full"
                                                    disabled={isUploading}
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    {assetData.assetImage ? "Change Image" : "Upload Image"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-4 border border-border">
                                    <h3 className="font-medium">Asset Guidelines</h3>
                                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                            <span>Use high-quality images (at least 1000x1000 pixels)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                            <span>Ensure you have the rights to use the image</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                            <span>Choose descriptive names for better discoverability</span>
                                        </li>
                                    </ul>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="custom-asset"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6 pt-4"
                            >
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-full md:w-1/2">
                                        <div className="flex justify-between">
                                            <Label htmlFor="assetCode" className="text-base font-medium">
                                                Asset Name
                                            </Label>
                                            <span
                                                className={cn(
                                                    "text-xs",
                                                    assetData.assetCode && assetData.assetCode.length > 0 && !isAssetCodeValid
                                                        ? "text-destructive"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {assetData.assetCode?.length || 0}/4-12 characters
                                            </span>
                                        </div>
                                        <Input
                                            id="assetCode"
                                            name="assetCode"
                                            value={assetData.assetCode || ""}
                                            onChange={handleInputChange}
                                            placeholder="Enter asset name"
                                            className={cn(
                                                "mt-1",
                                                assetData.assetCode &&
                                                assetData.assetCode.length > 0 &&
                                                !isAssetCodeValid &&
                                                "border-destructive",
                                            )}
                                            maxLength={12}
                                        />
                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                className={cn(
                                                    "h-full",
                                                    isAssetCodeValid
                                                        ? "bg-primary"
                                                        : assetData.assetCode && assetData.assetCode.length > 0
                                                            ? "bg-destructive"
                                                            : "bg-primary",
                                                )}
                                                initial={{ width: "0%" }}
                                                animate={{
                                                    width: assetData.assetCode
                                                        ? assetData.assetCode.length < 4
                                                            ? `${(assetData.assetCode.length / 4) * 33}%`
                                                            : assetData.assetCode.length > 12
                                                                ? "100%"
                                                                : `${33 + ((assetData.assetCode.length - 4) / 8) * 67}%`
                                                        : "0%",
                                                }}
                                                transition={{ duration: 0.2 }}
                                            />
                                        </div>
                                        {formErrors.assetCode && formErrors.assetCode.length > 0 && (
                                            <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {formErrors.assetCode[0]}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Enter the asset name (4-12 letters, a-z and A-Z only).
                                        </p>
                                    </div>
                                    <div className="w-full md:w-1/2">
                                        <div className="flex justify-between">
                                            <Label htmlFor="issuer" className="text-base font-medium">
                                                Issuer
                                            </Label>
                                            <span
                                                className={cn(
                                                    "text-xs",
                                                    assetData.issuer && assetData.issuer.length > 0 && !isIssuerValid
                                                        ? "text-destructive"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {assetData.issuer?.length || 0}/56 characters
                                            </span>
                                        </div>
                                        <Input
                                            id="issuer"
                                            name="issuer"
                                            value={assetData.issuer || ""}
                                            onChange={handleInputChange}
                                            placeholder="Enter issuer"
                                            className={cn(
                                                "mt-1",
                                                assetData.issuer && assetData.issuer.length > 0 && !isIssuerValid && "border-destructive",
                                            )}
                                            maxLength={56}
                                        />
                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <motion.div
                                                className={cn(
                                                    "h-full",
                                                    isIssuerValid
                                                        ? "bg-green-500"
                                                        : assetData.issuer && assetData.issuer.length > 0
                                                            ? "bg-primary"
                                                            : "bg-primary",
                                                )}
                                                initial={{ width: "0%" }}
                                                animate={{ width: `${((assetData.issuer?.length || 0) / 56) * 100}%` }}
                                                transition={{ duration: 0.2 }}
                                            />
                                        </div>
                                        {formErrors.issuer && formErrors.issuer.length > 0 && (
                                            <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {formErrors.issuer[0]}
                                            </p>
                                        )}
                                        {isIssuerValid && (
                                            <p className="mt-1 text-xs text-green-500 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Valid issuer format
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Enter the issuer information for your asset (exactly 56 characters).
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col gap-3">
                                    <div className="rounded-lg bg-muted/30 p-4 border border-border">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-full bg-yellow-500/20 p-2 mt-1">
                                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium">Trust Required</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    You must trust this asset before continuing. This verifies the asset exists and is valid.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={checkCustomAssetValidity}
                                        disabled={!isAssetCodeValid || !isIssuerValid || isTrusting || isTrusted}
                                        className="w-full"
                                    >
                                        {isTrusting ? "Checking..." : "Check Validity"}
                                    </Button>
                                    {isTrusted && (
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <CheckCheck className="h-4 w-4" />
                                            <span>Asset trusted successfully! You can now proceed.</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    {
                        assetCreationXDR.isLoading || assetCreation.isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (<>
                            <Button onClick={handleSave} disabled={!canSave}>
                                Save Asset
                            </Button></>)
                    }
                </div>
            </DialogContent>
        </Dialog>
    )
}

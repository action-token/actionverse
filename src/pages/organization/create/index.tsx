"use client"
import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle2,
    Upload,
    User,
    FileText,
    ImageIcon,
    ArrowRight,
    ArrowLeft,
    CheckCheck,
    Sparkles,
    Plus,
    ChevronRight,
    AlertCircle,
    ClipboardCheck,
    PanelTop,
} from "lucide-react"
import { z } from "zod"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import { RadioGroupItem } from "~/components/shadcn/ui/radio-group"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { cn } from "~/lib/utils"
import { RadioGroup } from "~/components/shadcn/ui/radio-group"
import { Badge } from "~/components/shadcn/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { ipfsHashToUrl } from "~/utils/ipfs"
import { UploadS3Button } from "~/components/common/upload-button"
import toast from "react-hot-toast"
import { api } from "~/utils/api"
import { useRouter } from "next/navigation"

// Form validation schemas
const ProfileSchema = z.object({
    displayName: z.string().min(1, "Display name is required").max(99, "Display name must be less than 100 characters"),
    bio: z.string().optional(),
})

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

// Fix the CustomAssetSchema to use assetCode instead of assetName
const CustomAssetSchema = z.object({
    assetType: z.literal("custom"),
    assetCode: AssetNameSchema,
    issuer: z.string().length(56, "Issuer must be exactly 56 characters"),
})

const AssetSchema = z.discriminatedUnion("assetType", [NewAssetSchema, CustomAssetSchema])

// Fix the FormSchema to make fields required and fix the assetType type
export const RequestBrandCreateFormSchema = z
    .object({
        profileUrl: z.string().url().optional(),
        profileUrlPreview: z.string().optional(),
        coverUrl: z.string().url().optional().or(z.literal("")),
        coverImagePreview: z.string().optional(),
        displayName: z.string().min(1, "Display name is required").max(99, "Display name must be less than 100 characters"),
        bio: z.string().optional(),
        assetType: z.enum(["new", "custom"]),
        assetName: z.string().default(""),
        assetImage: z.string().url().optional(),
        assetImagePreview: z.string().optional(),
        assetCode: z.string().default(""),
        issuer: z.string().default(""),
    })
    .refine(
        (data) => {
            // If assetType is "new", assetImage is required
            if (data.assetType === "new") {
                return !!data.assetImage
            }
            // If assetType is "custom", assetCode and issuer are required
            return true
        },
        {
            message: "Asset image is required for new assets",
            path: ["assetImage"],
        },
    )

type FormData = z.infer<typeof RequestBrandCreateFormSchema>
type FormErrors = {
    [K in keyof FormData]?: string[]
}

export default function ArtistOnboarding() {
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState<FormData>({
        profileUrl: "",
        profileUrlPreview: "",
        coverUrl: "",
        coverImagePreview: "",
        displayName: "",
        bio: "",
        assetType: "new", // "new" or "custom"
        assetName: "", //new asset name
        assetImage: "", //new asset image
        assetImagePreview: "", //new asset image preview
        assetCode: "", //custom asset code
        issuer: "", //custom asset issuer
    })
    const [formErrors, setFormErrors] = useState<FormErrors>({})
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [showConfetti, setShowConfetti] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [activeImageTab, setActiveImageTab] = useState("profile")
    const router = useRouter()

    // In the state declarations at the top of the component, add a new state for tracking trust status
    const [isTrusted, setIsTrusted] = useState(false)
    const [isTrusting, setIsTrusting] = useState(false)

    const totalSteps = 4

    // Add this function to validate form fields
    const validateField = (field: keyof FormData, value: string) => {
        try {
            if (field === "assetName" || field === "assetCode") {
                AssetNameSchema.parse(value)
                return { valid: true, errors: [] }
            } else if (field === "issuer") {
                z.string().length(56).parse(value)
                return { valid: true, errors: [] }
            } else if (field === "displayName") {
                ProfileSchema.shape.displayName.parse(value)
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

    // Add these computed properties to replace the old validation states
    const isAssetNameValid = formData.assetName && formData.assetName.length > 0 && !formErrors.assetName?.length
    const isassetCodeValid = formData.assetCode && formData.assetCode.length > 0 && !formErrors.assetCode?.length
    const isIssuerValid = formData.issuer && formData.issuer.length > 0 && !formErrors.issuer?.length

    useEffect(() => {
        // Reset upload progress when not uploading
        if (!isUploading) {
            setUploadProgress(0)
        }
    }, [isUploading])

    // Add this effect to reset isTrusted when asset code or issuer changes
    useEffect(() => {
        if (isTrusted && (formData.assetCode || formData.issuer)) {
            setIsTrusted(false)
        }
    }, [formData.assetCode, formData.issuer])

    const RequestForBrandCreation = api.fan.creator.requestForBrandCreation.useMutation({
        onSuccess: (data) => {
            console.log("Brand creation request submitted:", data)
            toast.success("Brand creation request submitted successfully")
            setShowConfetti(true)
            setTimeout(() => {
                router.push("/organization/home")
            }, 2000)
        },
        onError: (error) => {
            console.error("Failed to submit brand creation request:", error)
            toast.error(`${error.data?.code}`)
        },
    })

    const CheckCustomAssetValidity = api.fan.creator.checkCustomAssetValidity.useMutation({
        onSuccess: (data) => {
            if (data) {
                setIsTrusted(true)
            }
        },
        onError: (error) => {
            console.error("Error checking custom asset validity:", error)
            setIsTrusted(false)
            toast.error("Failed to check asset validity")
        },
    })

    const checkCustomAssetValidity = ({
        assetCode,
        issuer,
    }: {
        assetCode: string
        issuer: string
    }) => {
        CheckCustomAssetValidity.mutate({
            assetCode,
            issuer,
        })
    }

    // Update the handleFileChange function to properly handle upload states
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: "assetImage") => {
        const file = e.target.files?.[0]
        if (file) {
            setIsUploading(true)
            setUploadProgress(10) // Start with some progress
            try {
                const uploadFormData = new FormData()
                uploadFormData.append("file", file, file.name)
                // Simulate progress
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

                setFormData((prevFormData) => ({
                    ...prevFormData,
                    assetImage: thumbnail,
                    assetImagePreview: thumbnail,
                }))

                // Short delay to show 100% before clearing
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        const fieldName = name as keyof FormData

        // Update form data
        setFormData({
            ...formData,
            [fieldName]: value,
        })

        // Validate the field
        const validation = validateField(fieldName, value)

        // Update errors state
        setFormErrors((prev) => ({
            ...prev,
            [fieldName]: validation.valid ? undefined : validation.errors,
        }))
    }

    // Fix the handleRadioChange function to properly type the value
    const handleRadioChange = (value: "new" | "custom") => {
        setFormData({
            ...formData,
            assetType: value,
        })
        // Reset trust status when switching asset types
        if (value === "new") {
            setIsTrusted(false)
        }
    }

    // Fix the handleNext function
    const handleNext = () => {
        if (currentStep < totalSteps) {
            // Validate current step before proceeding
            let isValid = false
            switch (currentStep) {
                case 1:
                    // Only require profile image, cover image is optional
                    isValid = !!formData.profileUrl && !isUploading
                    break
                case 2:
                    try {
                        ProfileSchema.parse({
                            displayName: formData.displayName,
                            bio: formData.bio,
                        })
                        isValid = true
                    } catch (error) {
                        if (error instanceof z.ZodError) {
                            const newErrors: FormErrors = {}
                            error.errors.forEach((err) => {
                                const path = err.path[0]
                                if (typeof path === "string") {
                                    if (!newErrors[path as keyof FormData]) {
                                        newErrors[path as keyof FormData] = []
                                    }
                                    newErrors[path as keyof FormData]?.push(err.message)
                                }
                            })
                            setFormErrors((prev) => ({ ...prev, ...newErrors }))
                        }
                        isValid = false
                    }
                    break
                case 3:
                    if (formData.assetType === "new") {
                        // For new asset, require valid name and image
                        const validName =
                            formData.assetName.length >= 4 &&
                            formData.assetName.length <= 12 &&
                            /^[a-zA-Z]+$/.test(formData.assetName)
                        isValid = validName && !!formData.assetImage && !isUploading
                    } else {
                        // For custom asset, require valid code, issuer, and trust operation
                        const validCode =
                            formData.assetCode.length >= 4 &&
                            formData.assetCode.length <= 12 &&
                            /^[a-zA-Z]+$/.test(formData.assetCode)
                        const validIssuer = formData.issuer.length === 56
                        isValid = validCode && validIssuer && isTrusted
                    }
                    break
                default:
                    isValid = true
            }

            if (isValid) {
                setCurrentStep(currentStep + 1)
            } else {
                // Show a toast message to inform the user what's missing
                if (currentStep === 3) {
                    if (formData.assetType === "new") {
                        if (!formData.assetName || formData.assetName.length < 4 || formData.assetName.length > 12) {
                            toast.error("Please enter a valid asset name (4-12 letters)")
                        } else if (!formData.assetImage) {
                            toast.error("Please upload an asset image")
                        }
                    } else {
                        if (!formData.assetCode || formData.assetCode.length < 4 || formData.assetCode.length > 12) {
                            toast.error("Please enter a valid asset code (4-12 letters)")
                        } else if (!formData.issuer || formData.issuer.length !== 56) {
                            toast.error("Please enter a valid issuer (exactly 56 characters)")
                        }
                    }
                }
            }
        } else {
            // Validate entire form before submission
            try {
                // Prepare the data based on asset type
                const submissionData = {
                    ...formData,
                    // Only include relevant fields based on asset type
                    ...(formData.assetType === "new"
                        ? { assetCode: undefined, issuer: undefined }
                        : { assetName: undefined, assetImage: undefined, assetImagePreview: undefined }),
                }
                RequestForBrandCreation.mutate(submissionData)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const newErrors: FormErrors = {}
                    error.errors.forEach((err) => {
                        const path = err.path[0]
                        if (typeof path === "string") {
                            if (!newErrors[path as keyof FormData]) {
                                newErrors[path as keyof FormData] = []
                            }
                            newErrors[path as keyof FormData]?.push(err.message)
                        }
                    })
                    setFormErrors((prev) => ({ ...prev, ...newErrors }))
                    console.error("Form validation failed:", error)
                }
            }
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    // Fix the isNextDisabled function
    const isNextDisabled = () => {
        switch (currentStep) {
            case 1:
                // Only require profile image, cover image is optional
                return !formData.profileUrl || isUploading
            case 2:
                try {
                    ProfileSchema.parse({
                        displayName: formData.displayName,
                        bio: formData.bio,
                    })
                    return false
                } catch (error) {
                    return true
                }
            case 3:
                if (formData.assetType === "new") {
                    // For new asset, require valid name and image
                    const validName =
                        formData.assetName.length >= 4 && formData.assetName.length <= 12 && /^[a-zA-Z]+$/.test(formData.assetName)
                    return !validName || !formData.assetImage || isUploading
                } else {
                    // For custom asset, require valid code, issuer, and trust operation
                    const validCode =
                        formData.assetCode.length >= 4 && formData.assetCode.length <= 12 && /^[a-zA-Z]+$/.test(formData.assetCode)
                    const validIssuer = formData.issuer.length === 56
                    return !validCode || !validIssuer || !isTrusted
                }
            default:
                return false
        }
    }

    // Animation variants
    const pageVariants = {
        initial: {
            opacity: 0,
            scale: 0.9,
        },
        animate: {
            opacity: 1,
            scale: 1,
            transition: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
            },
        },
        exit: {
            opacity: 0,
            scale: 0.9,
            transition: {
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
            },
        },
    }

    const stepIndicatorVariants = {
        inactive: { scale: 1, opacity: 0.5 },
        active: {
            scale: 1.1,
            opacity: 1,
            transition: { duration: 0.3 },
        },
        completed: {
            scale: 1,
            opacity: 1,
            transition: { duration: 0.3 },
        },
    }

    return (
        <div className="h-screen  overflow-auto">
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
                                <span className="font-bold">Organization Profile Created!</span>
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
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
                    {/* Left Sidebar - Steps */}
                    <div className="w-full lg:w-1/4 lg:sticky lg:top-8 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-primary/20">
                                <ImageIcon className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold">Organization Onboarding</h1>
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: totalSteps }).map((_, index) => (
                                <motion.div
                                    key={index}
                                    variants={stepIndicatorVariants}
                                    initial="inactive"
                                    animate={currentStep > index + 1 ? "completed" : currentStep === index + 1 ? "active" : "inactive"}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                                        currentStep === index + 1
                                            ? "bg-primary/10 border border-primary/20"
                                            : currentStep > index + 1
                                                ? "bg-primary/5"
                                                : "bg-background/80",
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                            currentStep > index + 1
                                                ? "bg-primary text-primary-foreground"
                                                : currentStep === index + 1
                                                    ? "border-2 border-primary text-primary"
                                                    : "border-2 border-muted-foreground text-muted-foreground",
                                        )}
                                    >
                                        {currentStep > index + 1 ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            <span className="text-sm">{index + 1}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span
                                            className={cn(
                                                "text-sm font-medium",
                                                currentStep >= index + 1 ? "text-foreground" : "text-muted-foreground",
                                            )}
                                        >
                                            {index === 0 && "Profile Pictures"}
                                            {index === 1 && "Organization Details"}
                                            {index === 2 && "Asset Creation"}
                                            {index === 3 && "Overview"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {index === 0 && "Upload your images"}
                                            {index === 1 && "Name and bio"}
                                            {index === 2 && "Create your assets"}
                                            {index === 3 && "Review and submit"}
                                        </span>
                                    </div>
                                    {currentStep === index + 1 && <ChevronRight className="ml-auto h-5 w-5 text-primary" />}
                                </motion.div>
                            ))}
                        </div>
                        <div className="hidden lg:block p-4 rounded-lg bg-muted/50 border border-border">
                            <h3 className="text-sm font-medium mb-2">Need help?</h3>
                            <p className="text-xs text-muted-foreground">
                                If you have any questions about the onboarding process, please contact our support team.
                            </p>
                            <Button variant="link" className="text-xs p-0 h-auto mt-2">
                                Contact Support
                            </Button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="w-full lg:w-3/4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="w-full"
                            >
                                <Card className="border-none shadow-lg overflow-hidden bg-background/80 backdrop-blur-sm">
                                    <CardContent className="p-0">
                                        {/* Step 1: Profile & Cover Picture Upload */}
                                        {currentStep === 1 && (
                                            <div className="p-6 md:p-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <h2 className="text-3xl font-bold">Upload Your Images</h2>
                                                        <p className="text-muted-foreground">
                                                            Choose high-quality images that represent you and your art. Profile picture is required,
                                                            cover image is optional.
                                                        </p>
                                                    </div>
                                                    <Tabs value={activeImageTab} onValueChange={setActiveImageTab} className="w-full">
                                                        <TabsList className="grid w-full grid-cols-2 mb-6">
                                                            <TabsTrigger value="profile" className="flex items-center gap-2">
                                                                <User className="h-4 w-4" />
                                                                Profile Picture <span className="text-destructive ml-1">*</span>
                                                            </TabsTrigger>
                                                            <TabsTrigger value="cover" className="flex items-center gap-2">
                                                                <PanelTop className="h-4 w-4" />
                                                                Cover Image (Optional)
                                                            </TabsTrigger>
                                                        </TabsList>
                                                        <TabsContent value="profile" className="mt-0">
                                                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                                                <div className="w-full md:w-1/2 flex flex-col items-center justify-center space-y-4">
                                                                    {formData.profileUrlPreview ? (
                                                                        <motion.div
                                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            transition={{ duration: 0.5 }}
                                                                            className="relative h-64 w-64 overflow-hidden rounded-2xl border-2 border-primary shadow-lg"
                                                                        >
                                                                            <Image
                                                                                src={formData.profileUrlPreview || "/placeholder.svg"}
                                                                                alt="Profile preview"
                                                                                fill
                                                                                className="object-cover"
                                                                            />
                                                                            {isUploading && activeImageTab === "profile" && (
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                                                                    <div className="w-3/4 bg-background rounded-full h-2 overflow-hidden">
                                                                                        <motion.div
                                                                                            className="h-full bg-primary"
                                                                                            initial={{ width: "0%" }}
                                                                                            animate={{ width: `${uploadProgress}%` }}
                                                                                            transition={{ duration: 0.1 }}
                                                                                        />
                                                                                    </div>
                                                                                    <p className="absolute text-white text-sm font-medium mt-8">
                                                                                        {uploadProgress}%
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    ) : (
                                                                        <motion.div
                                                                            whileHover={{ scale: 1.05 }}
                                                                            className="group relative flex h-64 w-64 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground bg-muted/50 transition-all duration-300 hover:border-primary hover:bg-primary/5"
                                                                            onClick={() => document.getElementById("profile-upload")?.click()}
                                                                        >
                                                                            <motion.div
                                                                                animate={{
                                                                                    scale: [1, 1.1, 1],
                                                                                    opacity: [0.7, 1, 0.7],
                                                                                }}
                                                                                transition={{
                                                                                    repeat: Number.POSITIVE_INFINITY,
                                                                                    duration: 2,
                                                                                    ease: "easeInOut",
                                                                                }}
                                                                            >
                                                                                <User className="h-20 w-20 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                                                                            </motion.div>
                                                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                                Click to upload
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                    <div className="w-full max-w-xs">
                                                                        <UploadS3Button
                                                                            id="profile-upload"
                                                                            variant="button"
                                                                            endpoint="imageUploader"
                                                                            className="w-full"
                                                                            label="Upload Profile Picture"
                                                                            onClientUploadComplete={(res) => {
                                                                                const data = res
                                                                                if (data?.url) {
                                                                                    setFormData((prevFormData) => ({
                                                                                        ...prevFormData,
                                                                                        profileUrl: data.url,
                                                                                        profileUrlPreview: data.url,
                                                                                    }))
                                                                                }
                                                                            }}
                                                                            onUploadError={(error: Error) => {
                                                                                toast.error(`ERROR! ${error.message}`)
                                                                                setIsUploading(false)
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="w-full md:w-1/2 space-y-4">
                                                                    <div className="rounded-lg border p-4 space-y-3">
                                                                        <h3 className="font-medium">Profile Picture Tips</h3>
                                                                        <ul className="space-y-2 text-sm text-muted-foreground">
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Use a high-resolution image (at least 500x500 pixels)</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Choose a well-lit photo with good contrast</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Select an image that represents your artistic style</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Avoid busy backgrounds that distract from you</span>
                                                                            </li>
                                                                        </ul>
                                                                    </div>
                                                                    <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="rounded-full bg-primary/20 p-2 mt-1">
                                                                                <Sparkles className="h-4 w-4 text-primary" />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="font-medium">Make a great first impression</h3>
                                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                                    Your profile picture is required and is the first thing collectors will see.
                                                                                    Choose an image that captures your unique artistic identity.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TabsContent>
                                                        <TabsContent value="cover" className="mt-0">
                                                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                                                <div className="w-full md:w-1/2 flex flex-col items-center justify-center space-y-4">
                                                                    {formData.coverImagePreview ? (
                                                                        <motion.div
                                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            transition={{ duration: 0.5 }}
                                                                            className="relative h-48 w-full overflow-hidden rounded-xl border-2 border-primary shadow-lg"
                                                                        >
                                                                            <Image
                                                                                src={formData.coverImagePreview || "/placeholder.svg"}
                                                                                alt="Cover preview"
                                                                                fill
                                                                                className="object-cover"
                                                                            />
                                                                            {isUploading && activeImageTab === "cover" && (
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                                                                    <div className="w-3/4 bg-background rounded-full h-2 overflow-hidden">
                                                                                        <motion.div
                                                                                            className="h-full bg-primary"
                                                                                            initial={{ width: "0%" }}
                                                                                            animate={{ width: `${uploadProgress}%` }}
                                                                                            transition={{ duration: 0.1 }}
                                                                                        />
                                                                                    </div>
                                                                                    <p className="absolute text-white text-sm font-medium mt-8">
                                                                                        {uploadProgress}%
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    ) : (
                                                                        <motion.div
                                                                            whileHover={{ scale: 1.02 }}
                                                                            className="group relative flex h-48 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground bg-muted/50 transition-all duration-300 hover:border-primary hover:bg-primary/5"
                                                                            onClick={() => document.getElementById("cover-upload")?.click()}
                                                                        >
                                                                            <motion.div
                                                                                animate={{
                                                                                    scale: [1, 1.1, 1],
                                                                                    opacity: [0.7, 1, 0.7],
                                                                                }}
                                                                                transition={{
                                                                                    repeat: Number.POSITIVE_INFINITY,
                                                                                    duration: 2,
                                                                                    ease: "easeInOut",
                                                                                }}
                                                                            >
                                                                                <PanelTop className="h-20 w-20 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                                                                            </motion.div>
                                                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                                Click to upload cover image
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                    <div className="w-full max-w-xs">
                                                                        <UploadS3Button
                                                                            variant="button"
                                                                            endpoint="imageUploader"
                                                                            className="w-full"
                                                                            onClientUploadComplete={(res) => {
                                                                                const data = res
                                                                                if (data?.url) {
                                                                                    setFormData((prevFormData) => ({
                                                                                        ...prevFormData,
                                                                                        coverUrl: data.url,
                                                                                        coverImagePreview: data.url,
                                                                                    }))
                                                                                }
                                                                            }}
                                                                            onUploadError={(error: Error) => {
                                                                                toast.error(`ERROR! ${error.message}`)
                                                                                setIsUploading(false)
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="w-full md:w-1/2 space-y-4">
                                                                    <div className="rounded-lg border p-4 space-y-3">
                                                                        <h3 className="font-medium">Cover Image Tips</h3>
                                                                        <ul className="space-y-2 text-sm text-muted-foreground">
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Use a high-resolution image (at least 1500x500 pixels)</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Choose a landscape orientation for best display</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Showcase your artwork or creative process</span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2">
                                                                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                                                                <span>Ensure important elements are centered</span>
                                                                            </li>
                                                                        </ul>
                                                                    </div>
                                                                    <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="rounded-full bg-primary/20 p-2 mt-1">
                                                                                <Sparkles className="h-4 w-4 text-primary" />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="font-medium">Create an immersive experience</h3>
                                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                                    Your cover image sets the tone for your organization page. Choose an image
                                                                                    that showcases your artistic style and creates a compelling visual experience.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TabsContent>
                                                    </Tabs>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2: Organization Name and Bio */}
                                        {currentStep === 2 && (
                                            <div className="p-6 md:p-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <h2 className="text-3xl font-bold">Organization Details</h2>
                                                        <p className="text-muted-foreground">
                                                            Tell us more about yourself and your artistic journey.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col md:flex-row gap-8">
                                                        <div className="w-full md:w-1/3 flex flex-col items-center">
                                                            {formData.profileUrlPreview && (
                                                                <motion.div
                                                                    initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
                                                                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                                                                    transition={{ duration: 0.5 }}
                                                                    className="relative h-48 w-48 overflow-hidden rounded-2xl border-2 border-primary shadow-lg"
                                                                >
                                                                    <Image
                                                                        src={formData.profileUrlPreview || "/placeholder.svg"}
                                                                        alt="Profile"
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                </motion.div>
                                                            )}
                                                            {formData.coverImagePreview && (
                                                                <motion.div
                                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                                    animate={{ scale: 1, opacity: 1 }}
                                                                    transition={{ duration: 0.5, delay: 0.2 }}
                                                                    className="relative h-24 w-full overflow-hidden rounded-lg border border-border shadow-md mt-4"
                                                                >
                                                                    <Image
                                                                        src={formData.coverImagePreview || "/placeholder.svg"}
                                                                        alt="Cover"
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                </motion.div>
                                                            )}
                                                            <div className="mt-4 text-center">
                                                                <p className="text-sm text-muted-foreground">This is how collectors will see you</p>
                                                                <Button
                                                                    variant="link"
                                                                    className="text-xs p-0 h-auto mt-1"
                                                                    onClick={() => setCurrentStep(1)}
                                                                >
                                                                    Change images
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="w-full md:w-2/3 space-y-6">
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <div className="flex justify-between">
                                                                        <Label htmlFor="displayName" className="text-base font-medium">
                                                                            Organization Name
                                                                        </Label>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formData.displayName.length}/99 characters
                                                                        </span>
                                                                    </div>
                                                                    <Input
                                                                        id="displayName"
                                                                        name="displayName"
                                                                        value={formData.displayName}
                                                                        onChange={handleInputChange}
                                                                        placeholder="Enter your organization name"
                                                                        required
                                                                        className="mt-1"
                                                                        maxLength={99}
                                                                    />
                                                                    {formErrors.displayName && formErrors.displayName.length > 0 && (
                                                                        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                                                                            <AlertCircle className="h-3 w-3" />
                                                                            {formErrors.displayName[0]}
                                                                        </p>
                                                                    )}
                                                                    <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                                                        <motion.div
                                                                            className="h-full bg-primary"
                                                                            initial={{ width: "0%" }}
                                                                            animate={{ width: `${(formData.displayName.length / 99) * 100}%` }}
                                                                            transition={{ duration: 0.2 }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="bio" className="text-base font-medium">
                                                                        Bio (Optional)
                                                                    </Label>
                                                                    <Textarea
                                                                        id="bio"
                                                                        name="bio"
                                                                        value={formData.bio}
                                                                        onChange={handleInputChange}
                                                                        placeholder="Tell us about yourself and your art..."
                                                                        rows={6}
                                                                        className="mt-1"
                                                                    />
                                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                                        A brief description of your artistic style, inspiration, and background.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/30 p-4 border border-border">
                                                                <h3 className="font-medium">Bio Writing Tips</h3>
                                                                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                                    <li className="flex items-start gap-2">
                                                                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                                        <span>Share your artistic journey and what inspires you</span>
                                                                    </li>
                                                                    <li className="flex items-start gap-2">
                                                                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                                        <span>Mention your preferred mediums and techniques</span>
                                                                    </li>
                                                                    <li className="flex items-start gap-2">
                                                                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                                        <span>Include any notable exhibitions or achievements</span>
                                                                    </li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3: Asset Creation */}
                                        {currentStep === 3 && (
                                            <div className="p-6 md:p-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <h2 className="text-3xl font-bold">Create Your Asset</h2>
                                                        <p className="text-muted-foreground">
                                                            Choose between creating a new asset or using a custom one.
                                                        </p>
                                                    </div>
                                                    <RadioGroup
                                                        value={formData.assetType}
                                                        onValueChange={handleRadioChange}
                                                        className="grid gap-4 md:grid-cols-2"
                                                    >
                                                        <motion.div
                                                            whileHover={{ scale: 1.02 }}
                                                            transition={{ duration: 0.2 }}
                                                            className={cn(
                                                                "relative overflow-hidden rounded-xl border p-6 cursor-pointer transition-all duration-300",
                                                                formData.assetType === "new"
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
                                                                    <p className="text-sm text-muted-foreground mt-1">
                                                                        Create a new asset with a name and image.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                        <motion.div
                                                            whileHover={{ scale: 1.02 }}
                                                            transition={{ duration: 0.2 }}
                                                            className={cn(
                                                                "relative overflow-hidden rounded-xl border p-6 cursor-pointer transition-all duration-300",
                                                                formData.assetType === "custom"
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
                                                                    <p className="text-sm text-muted-foreground mt-1">
                                                                        Use an existing asset code and asset issuer.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </RadioGroup>

                                                    <AnimatePresence mode="wait">
                                                        {formData.assetType === "new" ? (
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
                                                                                    formData.assetName.length > 0 && !isAssetNameValid
                                                                                        ? "text-destructive"
                                                                                        : "text-muted-foreground",
                                                                                )}
                                                                            >
                                                                                {formData.assetName.length}/4-12 characters
                                                                            </span>
                                                                        </div>
                                                                        <Input
                                                                            id="assetName"
                                                                            name="assetName"
                                                                            value={formData.assetName}
                                                                            onChange={handleInputChange}
                                                                            placeholder="Enter asset name"
                                                                            className={cn(
                                                                                "mt-1",
                                                                                formData.assetName.length > 0 && !isAssetNameValid && "border-destructive",
                                                                            )}
                                                                            maxLength={12}
                                                                        />
                                                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className={cn(
                                                                                    "h-full",
                                                                                    isAssetNameValid
                                                                                        ? "bg-primary"
                                                                                        : formData.assetName.length > 0
                                                                                            ? "bg-destructive"
                                                                                            : "bg-primary",
                                                                                )}
                                                                                initial={{ width: "0%" }}
                                                                                animate={{
                                                                                    width:
                                                                                        formData.assetName.length < 4
                                                                                            ? `${(formData.assetName.length / 4) * 33}%`
                                                                                            : formData.assetName.length > 12
                                                                                                ? "100%"
                                                                                                : `${33 + ((formData.assetName.length - 4) / 8) * 67}%`,
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
                                                                            {formData.assetImagePreview ? (
                                                                                <motion.div
                                                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                                                    animate={{ scale: 1, opacity: 1 }}
                                                                                    transition={{ duration: 0.5 }}
                                                                                    className="relative h-40 w-full overflow-hidden rounded-lg border-2 border-primary shadow-md"
                                                                                >
                                                                                    <Image
                                                                                        src={formData.assetImagePreview || "/placeholder.svg"}
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
                                                                                            <p className="absolute text-white text-sm font-medium mt-8">
                                                                                                {uploadProgress}%
                                                                                            </p>
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
                                                                                    onChange={(e) => handleFileChange(e, "assetImage")}
                                                                                />
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    onClick={() => document.getElementById("asset-upload")?.click()}
                                                                                    className="w-full"
                                                                                    disabled={isUploading}
                                                                                >
                                                                                    <Upload className="mr-2 h-4 w-4" />
                                                                                    {formData.assetImage ? "Change Image" : "Upload Image"}
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
                                                                                    formData.assetCode.length > 0 && !isassetCodeValid
                                                                                        ? "text-destructive"
                                                                                        : "text-muted-foreground",
                                                                                )}
                                                                            >
                                                                                {formData.assetCode.length}/4-12 characters
                                                                            </span>
                                                                        </div>
                                                                        <Input
                                                                            id="assetCode"
                                                                            name="assetCode"
                                                                            value={formData.assetCode}
                                                                            onChange={handleInputChange}
                                                                            placeholder="Enter asset name"
                                                                            className={cn(
                                                                                "mt-1",
                                                                                formData.assetCode.length > 0 && !isassetCodeValid && "border-destructive",
                                                                            )}
                                                                            maxLength={12}
                                                                        />
                                                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className={cn(
                                                                                    "h-full",
                                                                                    isassetCodeValid
                                                                                        ? "bg-primary"
                                                                                        : formData.assetCode.length > 0
                                                                                            ? "bg-destructive"
                                                                                            : "bg-primary",
                                                                                )}
                                                                                initial={{ width: "0%" }}
                                                                                animate={{
                                                                                    width:
                                                                                        formData.assetCode.length < 4
                                                                                            ? `${(formData.assetCode.length / 4) * 33}%`
                                                                                            : formData.assetCode.length > 12
                                                                                                ? "100%"
                                                                                                : `${33 + ((formData.assetCode.length - 4) / 8) * 67}%`,
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
                                                                                    formData.issuer.length > 0 && !isIssuerValid
                                                                                        ? "text-destructive"
                                                                                        : "text-muted-foreground",
                                                                                )}
                                                                            >
                                                                                {formData.issuer.length}/56 characters
                                                                            </span>
                                                                        </div>
                                                                        <Input
                                                                            id="issuer"
                                                                            name="issuer"
                                                                            value={formData.issuer}
                                                                            onChange={handleInputChange}
                                                                            placeholder="Enter issuer"
                                                                            className={cn(
                                                                                "mt-1",
                                                                                formData.issuer.length > 0 && !isIssuerValid && "border-destructive",
                                                                            )}
                                                                            maxLength={56}
                                                                        />
                                                                        <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                                                            <motion.div
                                                                                className={cn(
                                                                                    "h-full",
                                                                                    isIssuerValid
                                                                                        ? "bg-green-500"
                                                                                        : formData.issuer.length > 0
                                                                                            ? "bg-primary"
                                                                                            : "bg-primary",
                                                                                )}
                                                                                initial={{ width: "0%" }}
                                                                                animate={{ width: `${(formData.issuer.length / 56) * 100}%` }}
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
                                                                {/* Add Trust button after the issuer field */}
                                                                <div className="mt-6 flex flex-col gap-3">
                                                                    <div className="rounded-lg bg-muted/30 p-4 border border-border">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="rounded-full bg-yellow-500/20 p-2 mt-1">
                                                                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="font-medium">Trust Required</h3>
                                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                                    You must trust this asset before continuing. This verifies the asset exists
                                                                                    and is valid.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            checkCustomAssetValidity({
                                                                                assetCode: formData.assetCode,
                                                                                issuer: formData.issuer,
                                                                            })
                                                                        }}
                                                                        disabled={!isassetCodeValid || !isIssuerValid || isTrusting || isTrusted}
                                                                        className="w-full"
                                                                    >
                                                                        Check Validity
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
                                            </div>
                                        )}

                                        {/* Step 4: Overview */}
                                        {currentStep === 4 && (
                                            <div className="p-6 md:p-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <h2 className="text-3xl font-bold">Review Your Information</h2>
                                                        <p className="text-muted-foreground">
                                                            Please review all your information before completing the onboarding process.
                                                        </p>
                                                    </div>
                                                    <div className="grid gap-6 md:grid-cols-2">
                                                        {/* Organization Details Section */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.1 }}
                                                            className="rounded-xl border p-6 space-y-4"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="font-medium text-lg flex items-center gap-2">
                                                                    <User className="h-5 w-5 text-primary" />
                                                                    Organization Details
                                                                </h3>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => setCurrentStep(2)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                {formData.profileUrlPreview ? (
                                                                    <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary">
                                                                        <Image
                                                                            src={formData.profileUrlPreview || "/placeholder.svg"}
                                                                            alt="Profile"
                                                                            fill
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                                                        <User className="h-8 w-8 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <h4 className="font-medium">{formData.displayName || "Organization Name"}</h4>
                                                                    <Badge variant="outline" className="mt-1">
                                                                        Organization
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            {formData.coverImagePreview && (
                                                                <div className="mt-2">
                                                                    <h4 className="text-sm font-medium mb-1">Cover Image</h4>
                                                                    <div className="relative h-16 w-full overflow-hidden rounded-md border border-border">
                                                                        <Image
                                                                            src={formData.coverImagePreview || "/placeholder.svg"}
                                                                            alt="Cover"
                                                                            fill
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {formData.bio && (
                                                                <div>
                                                                    <h4 className="text-sm font-medium mb-1">Bio</h4>
                                                                    <p className="text-sm text-muted-foreground line-clamp-3">{formData.bio}</p>
                                                                </div>
                                                            )}
                                                        </motion.div>

                                                        {/* Asset Details Section */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.2 }}
                                                            className="rounded-xl border p-6 space-y-4"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="font-medium text-lg flex items-center gap-2">
                                                                    <FileText className="h-5 w-5 text-primary" />
                                                                    Asset Details
                                                                </h3>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => setCurrentStep(3)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </div>
                                                            <div>
                                                                <Badge className="mb-2">
                                                                    {formData.assetType === "new" ? "New Asset" : "Custom Asset"}
                                                                </Badge>
                                                                {formData.assetType === "new" ? (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-3">
                                                                            {formData.assetImagePreview ? (
                                                                                <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border">
                                                                                    <Image
                                                                                        src={formData.assetImagePreview || "/placeholder.svg"}
                                                                                        alt="Asset"
                                                                                        fill
                                                                                        className="object-cover"
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                                                                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <h4 className="font-medium">{formData.assetName || "Asset Name"}</h4>
                                                                                <p className="text-xs text-muted-foreground">New asset</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <h4 className="text-sm font-medium">Asset Name</h4>
                                                                            <p className="text-sm text-muted-foreground truncate">
                                                                                {formData.assetCode || "Not provided"}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-sm font-medium">Issuer</h4>
                                                                            <p className="text-sm text-muted-foreground truncate">
                                                                                {formData.issuer || "Not provided"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    </div>

                                                    <div className="rounded-lg bg-primary/10 p-6 border border-primary/20">
                                                        <div className="flex items-start gap-3">
                                                            <div className="rounded-full bg-primary/20 p-2 mt-1">
                                                                <ClipboardCheck className="h-5 w-5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium">Ready to Complete</h3>
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    By clicking Complete below, you{"'ll"} finalize your organization profile creation.
                                                                    You can always edit your profile details later from your dashboard.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Navigation Buttons */}
                                        <div className="flex items-center justify-between p-6 border-t border-border">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleBack}
                                                disabled={currentStep === 1 || RequestForBrandCreation.isLoading}
                                                className="gap-2 bg-transparent"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                                Back
                                            </Button>
                                            <div className="text-sm text-muted-foreground">
                                                Step {currentStep} of {totalSteps}
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={handleNext}
                                                disabled={isNextDisabled() || RequestForBrandCreation.isLoading}
                                                className="gap-2"
                                                variant={currentStep === totalSteps ? "default" : "default"}
                                            >
                                                {currentStep === totalSteps ? "Complete" : "Next"}
                                                {currentStep !== totalSteps && <ArrowRight className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}

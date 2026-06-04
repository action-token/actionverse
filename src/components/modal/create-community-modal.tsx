"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "~/utils/api"
import {
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Shield,
  Eye,
  PenLine,
  Loader2,
  Camera,
  ImageIcon,
  Search,
  Plus,
  Trash2,
  Coins,
  Keyboard,
} from "lucide-react"
import Image from "next/image"

import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { Switch } from "~/components/shadcn/ui/switch"
import { Badge } from "~/components/shadcn/ui/badge"
import toast from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { UploadS3Button } from "../common/upload-button"
import { useCommunityModalStore } from "../store/community-modal-store"

const TokenRequirementSchema = z.object({
  assetCode: z.string().min(1),
  assetIssuer: z.string().min(1),
  assetImage: z.string().nullable().optional(),
  requiredBalance: z.number().min(0).default(0),
})

type TokenRequirement = z.infer<typeof TokenRequirementSchema>

const CreateCommunitySchema = z
  .object({
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    description: z
      .string()
      .min(1, "Description is required")
      .refine((val) => val.trim().split(/\s+/).length <= 100, {
        message: "Description can't exceed 100 words",
      }),
    coverUrl: z.string().url("Cover photo is required"),
    profileUrl: z.string().url("Profile image is required"),
    memberListVisibility: z.enum(["EVERYONE", "MEMBERS_ONLY"]),
    postPermission: z.enum(["ALL_MEMBERS", "OWNER_ONLY"]),
    isTokenGated: z.boolean(),
    tokenGateLogic: z.enum(["AND", "OR"]),
  })
  .refine(
    (data) => {
      return true
    },
  )

type CreateCommunityForm = z.infer<typeof CreateCommunitySchema>

type FormStep = "details" | "settings" | "token" | "preview"

const STEPS: FormStep[] = ["details", "settings", "token", "preview"]
const STEP_LABELS: Record<FormStep, string> = {
  details: "Details",
  settings: "Settings",
  token: "Token Gate",
  preview: "Preview",
}

interface StellarAssetResult {
  assetCode: string
  assetIssuer: string
  assetImage: string | null
  name: string | null
  org: string | null
  rating: number
  trustlines: number
}

export function CreateCommunityModal() {
  const { isOpen, setIsOpen, editData } = useCommunityModalStore()
  const [currentStep, setCurrentStep] = useState<FormStep>("details")
  const [tokenRequirements, setTokenRequirements] = useState<TokenRequirement[]>([])
  const [assetSearch, setAssetSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [editingBalanceIndex, setEditingBalanceIndex] = useState<number | null>(null)
  const [addMode, setAddMode] = useState<"search" | "manual">("search")
  const [manualCode, setManualCode] = useState("")
  const [manualIssuer, setManualIssuer] = useState("")
  const [manualBalance, setManualBalance] = useState(0)
  const [manualVerified, setManualVerified] = useState(false)
  const utils = api.useUtils()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCommunityForm>({
    resolver: zodResolver(CreateCommunitySchema),
    defaultValues: {
      title: "",
      description: "",
      coverUrl: "",
      profileUrl: "",
      memberListVisibility: "EVERYONE",
      postPermission: "ALL_MEMBERS",
      isTokenGated: false,
      tokenGateLogic: "AND",
    },
  })

  const formValues = watch()

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(assetSearch)
    }, 400)
    return () => clearTimeout(timer)
  }, [assetSearch])

  const { data: searchResults, isLoading: isSearching } =
    api.community.community.searchStellarAssets.useQuery(
      { search: searchDebounced },
      { enabled: searchDebounced.length >= 1 && showSearchResults },
    )

  const verifyManualAsset = api.fan.creator.checkCustomAssetValidity.useMutation({
    onSuccess: (valid) => {
      if (valid) {
        setManualVerified(true)
        toast.success("Asset verified on Stellar network!")
      } else {
        setManualVerified(false)
        toast.error("Asset not found on Stellar network")
      }
    },
    onError: () => {
      setManualVerified(false)
      toast.error("Asset not found on Stellar network")
    },
  })

  const handleVerifyManual = () => {
    if (!manualCode.trim() || !manualIssuer.trim()) {
      toast.error("Please enter both asset code and issuer")
      return
    }
    verifyManualAsset.mutate({
      assetCode: manualCode.trim(),
      issuer: manualIssuer.trim().toUpperCase(),
    })
  }

  const createCommunity = api.community.community.create.useMutation({
    onSuccess: () => {
      toast.success("Community created!")
      void utils.community.community.getAll.invalidate()
      void utils.community.community.getMyCommunities.invalidate()
      handleClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const updateCommunity = api.community.community.update.useMutation({
    onSuccess: () => {
      toast.success("Community updated!")
      void utils.community.community.getById.invalidate()
      void utils.community.community.getAll.invalidate()
      handleClose()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const { data: existingCommunity } = api.community.community.getById.useQuery(
    { communityId: editData ?? 0 },
    { enabled: !!editData },
  )

  useEffect(() => {
    if (editData && existingCommunity) {
      setValue("title", existingCommunity.title)
      setValue("description", existingCommunity.description)
      setValue("coverUrl", existingCommunity.coverUrl)
      setValue("profileUrl", existingCommunity.profileUrl)
      setValue("memberListVisibility", existingCommunity.memberListVisibility)
      setValue("postPermission", existingCommunity.postPermission)
      setValue("isTokenGated", existingCommunity.isTokenGated)
      setValue("tokenGateLogic", (existingCommunity.tokenGateLogic as "AND" | "OR") ?? "AND")
      if (existingCommunity.tokenRequirements) {
        setTokenRequirements(
          existingCommunity.tokenRequirements.map((t) => ({
            assetCode: t.assetCode,
            assetIssuer: t.assetIssuer,
            assetImage: t.assetImage,
            requiredBalance: t.requiredBalance,
          })),
        )
      }
    }
  }, [editData, existingCommunity, setValue])

  const handleClose = () => {
    setIsOpen(false)
    setCurrentStep("details")
    setTokenRequirements([])
    setAssetSearch("")
    setShowSearchResults(false)
    setAddMode("search")
    setManualCode("")
    setManualIssuer("")
    setManualBalance(0)
    setManualVerified(false)
    reset()
  }

  const addTokenFromSearch = (asset: StellarAssetResult) => {
    const exists = tokenRequirements.some(
      (t) => t.assetCode === asset.assetCode && t.assetIssuer === asset.assetIssuer,
    )
    if (exists) {
      toast.error("This token is already added")
      return
    }
    setTokenRequirements((prev) => [
      ...prev,
      {
        assetCode: asset.assetCode,
        assetIssuer: asset.assetIssuer,
        assetImage: asset.assetImage,
        requiredBalance: 0,
      },
    ])
    setAssetSearch("")
    setShowSearchResults(false)
    setEditingBalanceIndex(tokenRequirements.length)
  }

  const addTokenManually = () => {
    if (!manualVerified) {
      toast.error("Please verify the asset on Stellar network first")
      return
    }
    const exists = tokenRequirements.some(
      (t) => t.assetCode === manualCode.trim() && t.assetIssuer === manualIssuer.trim() && t.assetIssuer.toUpperCase() === manualIssuer.trim().toUpperCase()
    )
    if (exists) {
      toast.error("This token is already added")
      return
    }
    setTokenRequirements((prev) => [
      ...prev,
      {
        assetCode: manualCode.trim(),
        assetIssuer: manualIssuer.trim(),
        assetImage: null,
        requiredBalance: manualBalance,
      },
    ])
    setManualCode("")
    setManualIssuer("")
    setManualBalance(0)
    setManualVerified(false)
  }

  const removeToken = (index: number) => {
    setTokenRequirements((prev) => prev.filter((_, i) => i !== index))
    if (editingBalanceIndex === index) setEditingBalanceIndex(null)
  }

  const updateTokenBalance = (index: number, balance: number) => {
    setTokenRequirements((prev) =>
      prev.map((t, i) => (i === index ? { ...t, requiredBalance: balance } : t)),
    )
  }

  const onSubmit = (data: CreateCommunityForm) => {
    if (data.isTokenGated && tokenRequirements.length === 0) {
      toast.error("Add at least one token requirement")
      return
    }

    const payload = {
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl,
      profileUrl: data.profileUrl,
      memberListVisibility: data.memberListVisibility,
      postPermission: data.postPermission,
      isTokenGated: data.isTokenGated,
      tokenGateLogic: data.isTokenGated ? data.tokenGateLogic : ("AND" as const),
      tokenRequirements: data.isTokenGated ? tokenRequirements : [],
    }

    if (editData) {
      updateCommunity.mutate({ communityId: editData, ...payload })
    } else {
      createCommunity.mutate(payload)
    }
  }

  const nextStep = () => {
    const idx = STEPS.indexOf(currentStep)
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]!)
  }

  const prevStep = () => {
    const idx = STEPS.indexOf(currentStep)
    if (idx > 0) setCurrentStep(STEPS[idx - 1]!)
  }

  const canProceed = () => {
    switch (currentStep) {
      case "details":
        return formValues.title && formValues.description && formValues.coverUrl && formValues.profileUrl
      case "settings":
        return true
      case "token":
        return !formValues.isTokenGated || tokenRequirements.length > 0
      case "preview":
        return true
      default:
        return false
    }
  }

  const stepIndex = STEPS.indexOf(currentStep)
  const isSubmitting = createCommunity.isLoading || updateCommunity.isLoading

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editData ? "Edit Community" : "Create Community"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {STEPS.map((step, i) => (
            <div key={step} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                <div
                  className={`h-1 w-full rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-muted"
                    }`}
                />
              </div>
              <span
                className={`text-[10px] font-medium ${i <= stepIndex
                  ? "text-primary"
                  : "text-muted-foreground"
                  }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-2">
          <AnimatePresence mode="wait">
            {currentStep === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {/* Cover photo upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cover Photo
                  </Label>
                  {formValues.coverUrl ? (
                    <div className="relative h-36 w-full overflow-hidden rounded-xl">
                      <Image
                        src={formValues.coverUrl}
                        alt="Cover"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setValue("coverUrl", "")}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 transition-colors hover:bg-black/80"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Upload cover photo
                      </span>
                      <div className="mt-1 w-auto">
                        <UploadS3Button
                          endpoint="coverUploader"
                          variant="button"
                          label="Choose File"
                          className="h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground shadow-none hover:bg-primary/90"
                          onClientUploadComplete={(file) =>
                            setValue("coverUrl", file.url)
                          }
                          onUploadError={(e) => toast.error(e.message)}
                        />
                      </div>
                    </div>
                  )}
                  {errors.coverUrl && (
                    <p className="text-xs text-destructive">
                      {errors.coverUrl.message}
                    </p>
                  )}
                </div>

                {/* Profile image upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Profile Image
                  </Label>
                  <div className="flex items-center gap-4">
                    {formValues.profileUrl ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-xl">
                        <Image
                          src={formValues.profileUrl}
                          alt="Profile"
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setValue("profileUrl", "")}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 transition-colors hover:bg-black/80"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <UploadS3Button
                      endpoint="profileUploader"
                      variant="button"
                      label="Upload Profile"
                      className="h-9 rounded-full bg-secondary px-4 text-xs text-secondary-foreground shadow-none hover:bg-secondary/80"
                      onClientUploadComplete={(file) =>
                        setValue("profileUrl", file.url)
                      }
                      onUploadError={(e) => toast.error(e.message)}
                    />
                  </div>
                  {errors.profileUrl && (
                    <p className="text-xs text-destructive">
                      {errors.profileUrl.message}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Title
                  </Label>
                  <Input
                    placeholder="Community name"
                    className="rounded-lg"
                    {...register("title")}
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Description
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      {formValues.description?.trim().split(/\s+/).filter(Boolean)
                        .length || 0}
                      /100 words
                    </span>
                  </div>
                  <Textarea
                    placeholder="What is this community about?"
                    rows={3}
                    className="resize-none rounded-lg"
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-xs text-destructive">
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <Label>Who can see the member list?</Label>
                  </div>
                  <Select
                    value={formValues.memberListVisibility}
                    onValueChange={(val) =>
                      setValue("memberListVisibility", val as "EVERYONE" | "MEMBERS_ONLY")
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EVERYONE">Everyone</SelectItem>
                      <SelectItem value="MEMBERS_ONLY">Members Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-muted-foreground" />
                    <Label>Who can post?</Label>
                  </div>
                  <Select
                    value={formValues.postPermission}
                    onValueChange={(val) =>
                      setValue("postPermission", val as "ALL_MEMBERS" | "OWNER_ONLY")
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_MEMBERS">All Members</SelectItem>
                      <SelectItem value="OWNER_ONLY">Owner Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            {currentStep === "token" && (
              <motion.div
                key="token"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <div>
                      <Label className="text-sm">Token Gating</Label>
                      <p className="text-xs text-muted-foreground">
                        Require Stellar tokens to join
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formValues.isTokenGated}
                    onCheckedChange={(checked) => {
                      setValue("isTokenGated", checked)
                      if (!checked) {
                        setTokenRequirements([])
                        setValue("tokenGateLogic", "AND")
                      }
                    }}
                  />
                </div>

                {formValues.isTokenGated && (
                  <div className="space-y-4">
                    {/* AND/OR Logic Selector */}
                    {tokenRequirements.length > 1 && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Join Requirement Logic
                        </Label>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setValue("tokenGateLogic", "AND")}
                            className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium transition-colors ${formValues.tokenGateLogic === "AND"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted"
                              }`}
                          >
                            <span className="block text-sm font-bold">AND</span>
                            <span className="mt-0.5 block text-[10px] opacity-80">
                              Must hold ALL tokens
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setValue("tokenGateLogic", "OR")}
                            className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium transition-colors ${formValues.tokenGateLogic === "OR"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted"
                              }`}
                          >
                            <span className="block text-sm font-bold">OR</span>
                            <span className="mt-0.5 block text-[10px] opacity-80">
                              Must hold ANY token
                            </span>
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {formValues.tokenGateLogic === "AND"
                            ? "Users must hold all listed tokens to join."
                            : "Users can join if they hold any one of the listed tokens."}
                        </p>
                      </div>
                    )}

                    {/* Token list */}
                    {tokenRequirements.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Required Tokens ({tokenRequirements.length})
                        </Label>
                        <div className="space-y-2">
                          {tokenRequirements.map((token, index) => (
                            <div
                              key={`${token.assetCode}-${token.assetIssuer}`}
                              className="rounded-lg border bg-card p-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                                  {token.assetImage ? (
                                    <Image
                                      src={token.assetImage}
                                      alt={token.assetCode}
                                      width={36}
                                      height={36}
                                      className="rounded-full object-cover"
                                    />
                                  ) : (
                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">{token.assetCode}</p>
                                    <button
                                      type="button"
                                      onClick={() => removeToken(index)}
                                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <p className="truncate text-[10px] text-muted-foreground font-mono">
                                    {token.assetIssuer}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      Min Balance:
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={token.requiredBalance}
                                      onChange={(e) =>
                                        updateTokenBalance(index, parseFloat(e.target.value) || 0)
                                      }
                                      className="h-7 w-28 rounded text-xs"
                                      placeholder="0"
                                    />
                                    {token.requiredBalance === 0 && (
                                      <span className="text-[10px] text-emerald-600">
                                        Trust only
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {index < tokenRequirements.length - 1 && tokenRequirements.length > 1 && (
                                <div className="mt-2 flex items-center justify-center">
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] font-bold"
                                  >
                                    {formValues.tokenGateLogic}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Token — Search or Manual */}
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAddMode("search")}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "search"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                            }`}
                        >
                          <Search className="h-3 w-3" />
                          Search
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMode("manual")}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "manual"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                            }`}
                        >
                          <Keyboard className="h-3 w-3" />
                          Manual
                        </button>
                      </div>

                      {addMode === "search" ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search by asset name (e.g. ACTION, USDC)"
                              className="rounded-lg pl-9"
                              value={assetSearch}
                              onChange={(e) => {
                                setAssetSearch(e.target.value)
                                setShowSearchResults(true)
                              }}
                              onFocus={() => {
                                if (assetSearch.length >= 1) setShowSearchResults(true)
                              }}
                            />
                          </div>

                          {showSearchResults && searchDebounced.length >= 1 && (
                            <div className="max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg">
                              {isSearching ? (
                                <div className="flex items-center justify-center gap-2 p-4">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-xs text-muted-foreground">
                                    Searching Stellar network...
                                  </span>
                                </div>
                              ) : searchResults && searchResults.length > 0 ? (
                                searchResults.map((asset: StellarAssetResult) => {
                                  const isAdded = tokenRequirements.some(
                                    (t) =>
                                      t.assetCode === asset.assetCode &&
                                      t.assetIssuer === asset.assetIssuer,
                                  )
                                  return (
                                    <button
                                      key={`${asset.assetCode}-${asset.assetIssuer}`}
                                      type="button"
                                      disabled={isAdded}
                                      onClick={() => addTokenFromSearch(asset)}
                                      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/50 disabled:opacity-50"
                                    >
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                                        {asset.assetImage ? (
                                          <Image
                                            src={asset.assetImage}
                                            alt={asset.assetCode}
                                            width={32}
                                            height={32}
                                            className="rounded-full object-cover"
                                          />
                                        ) : (
                                          <Coins className="h-4 w-4 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-semibold">
                                            {asset.assetCode}
                                          </span>
                                          {asset.name && (
                                            <span className="truncate text-[10px] text-muted-foreground">
                                              {asset.name}
                                            </span>
                                          )}
                                        </div>
                                        <p className="truncate text-[10px] text-muted-foreground font-mono">
                                          {asset.assetIssuer}
                                        </p>
                                        {asset.trustlines > 0 && (
                                          <p className="text-[9px] text-muted-foreground">
                                            {asset.trustlines.toLocaleString()} trustlines
                                          </p>
                                        )}
                                      </div>
                                      {isAdded ? (
                                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                                      ) : (
                                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      )}
                                    </button>
                                  )
                                })
                              ) : (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  No assets found for &quot;{searchDebounced}&quot;
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Asset Code</Label>
                            <Input
                              placeholder="e.g. ACTION"
                              className="rounded-lg"
                              value={manualCode}
                              onChange={(e) => {
                                setManualCode(e.target.value)
                                setManualVerified(false)
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Asset Issuer</Label>
                            <Input
                              placeholder="Stellar public key (56 characters)"
                              className="rounded-lg font-mono text-xs"
                              value={manualIssuer}
                              onChange={(e) => {
                                setManualIssuer(e.target.value)
                                setManualVerified(false)
                              }}
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 rounded-full"
                            onClick={handleVerifyManual}
                            disabled={!manualCode.trim() || !manualIssuer.trim() || verifyManualAsset.isLoading}
                          >
                            {verifyManualAsset.isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : manualVerified ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Shield className="h-3.5 w-3.5" />
                            )}
                            {manualVerified ? "Asset Verified" : "Verify on Stellar Network"}
                          </Button>

                          {manualVerified && (
                            <>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Minimum Balance</Label>
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="0 = trust only"
                                  className="rounded-lg"
                                  value={manualBalance || ""}
                                  onChange={(e) => setManualBalance(parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Set to 0 if joining only requires trusting the asset.
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="w-full gap-2 rounded-full"
                                onClick={addTokenManually}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Token
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Summary explanation */}
                    {tokenRequirements.length > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {tokenRequirements.length === 1 ? (
                            <>
                              Users must{" "}
                              {tokenRequirements[0]!.requiredBalance > 0
                                ? `hold at least ${tokenRequirements[0]!.requiredBalance} ${tokenRequirements[0]!.assetCode}`
                                : `have a trustline for ${tokenRequirements[0]!.assetCode}`}{" "}
                              to join.
                            </>
                          ) : (
                            <>
                              Users must hold{" "}
                              <span className="font-bold">
                                {formValues.tokenGateLogic === "AND" ? "ALL" : "ANY"}
                              </span>{" "}
                              of the {tokenRequirements.length} tokens listed above to join.
                              {tokenRequirements.some((t) => t.requiredBalance === 0) && (
                                <> Tokens with 0 balance only require a trustline.</>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="overflow-hidden rounded-xl border">
                  {formValues.coverUrl && (
                    <div className="relative h-28 w-full">
                      <Image
                        src={formValues.coverUrl}
                        alt="Cover"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  )}
                  <div className="relative px-4 pb-4">
                    {formValues.profileUrl && (
                      <div className="relative -mt-8 h-14 w-14 overflow-hidden rounded-xl border-[3px] border-background shadow-lg">
                        <Image
                          src={formValues.profileUrl}
                          alt="Profile"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h3 className="mt-2 text-base font-semibold">
                      {formValues.title || "Community Name"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formValues.description || "Description..."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Eye className="h-3 w-3" />
                        {formValues.memberListVisibility === "EVERYONE"
                          ? "Public list"
                          : "Members-only list"}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <PenLine className="h-3 w-3" />
                        {formValues.postPermission === "ALL_MEMBERS"
                          ? "All can post"
                          : "Owner-only"}
                      </Badge>
                      {formValues.isTokenGated && tokenRequirements.length > 0 && (
                        <Badge className="gap-1 border-0 bg-amber-500/90 text-[10px] text-white">
                          <Shield className="h-3 w-3" />
                          {formValues.tokenGateLogic === "AND"
                            ? "All tokens required"
                            : "Any token required"}
                        </Badge>
                      )}
                    </div>
                    {/* Token requirements preview */}
                    {formValues.isTokenGated && tokenRequirements.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {tokenRequirements.map((token) => (
                          <div
                            key={`${token.assetCode}-${token.assetIssuer}`}
                            className="flex items-center gap-2"
                          >
                            <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-muted">
                              {token.assetImage ? (
                                <Image
                                  src={token.assetImage}
                                  alt={token.assetCode}
                                  width={20}
                                  height={20}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <Coins className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <span className="text-[10px]">
                              {token.requiredBalance > 0
                                ? `${token.requiredBalance} ${token.assetCode}`
                                : `${token.assetCode} (trust only)`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-6 flex justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="gap-1.5 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep === "preview" ? (
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit(onSubmit)}
                className="gap-2 rounded-full px-6"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editData ? "Save Changes" : "Create Community"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="gap-1.5 rounded-full px-6"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

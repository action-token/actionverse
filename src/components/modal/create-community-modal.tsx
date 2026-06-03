"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
  Upload,
  Camera,
  ImageIcon,
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
    requiredBalance: z.number().min(0).optional(),
    requiredBalanceCode: z.string().optional(),
    requiredBalanceIssuer: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.isTokenGated) {
        return (
          data.requiredBalanceCode &&
          data.requiredBalanceIssuer &&
          data.requiredBalance &&
          data.requiredBalance > 0
        )
      }
      return true
    },
    {
      message: "Token gating requires asset code, issuer, and minimum balance",
      path: ["requiredBalance"],
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

export function CreateCommunityModal() {
  const { isOpen, setIsOpen, editData } = useCommunityModalStore()
  const [currentStep, setCurrentStep] = useState<FormStep>("details")
  const [isTokenValid, setIsTokenValid] = useState(false)
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
      requiredBalance: 0,
      requiredBalanceCode: "",
      requiredBalanceIssuer: "",
    },
  })

  const formValues = watch()

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

  // Load existing data for edit
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
      setValue("requiredBalance", existingCommunity.requiredBalance ?? 0)
      setValue("requiredBalanceCode", existingCommunity.requiredBalanceCode ?? "")
      setValue("requiredBalanceIssuer", existingCommunity.requiredBalanceIssuer ?? "")
      if (existingCommunity.isTokenGated) setIsTokenValid(true)
    }
  }, [editData, existingCommunity, setValue])

  const checkAssetValidity = api.fan.creator.checkCustomAssetValidity.useMutation({
    onSuccess: (valid) => {
      if (valid) {
        setIsTokenValid(true)
        toast.success("Token verified on Stellar network!")
      } else {
        setIsTokenValid(false)
        toast.error("Token not found on Stellar network")
      }
    },
    onError: () => {
      setIsTokenValid(false)
      toast.error("Token not found on Stellar network")
    },
  })

  const handleClose = () => {
    setIsOpen(false)
    setCurrentStep("details")
    setIsTokenValid(false)
    reset()
  }

  const validateToken = () => {
    const code = formValues.requiredBalanceCode
    const issuer = formValues.requiredBalanceIssuer
    if (!code || !issuer) {
      toast.error("Please enter both asset code and issuer")
      return
    }
    checkAssetValidity.mutate({ assetCode: code, issuer })
  }

  const onSubmit = (data: CreateCommunityForm) => {
    const payload = {
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl,
      profileUrl: data.profileUrl,
      memberListVisibility: data.memberListVisibility,
      postPermission: data.postPermission,
      isTokenGated: data.isTokenGated,
      requiredBalance: data.isTokenGated ? data.requiredBalance : undefined,
      requiredBalanceCode: data.isTokenGated
        ? data.requiredBalanceCode
        : undefined,
      requiredBalanceIssuer: data.isTokenGated
        ? data.requiredBalanceIssuer
        : undefined,
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
        return !formValues.isTokenGated || isTokenValid
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
                    <div className="relative">
                      <UploadS3Button
                        endpoint="coverUploader"
                        variant="hidden"
                        onClientUploadComplete={(file) =>
                          setValue("coverUrl", file.url)
                        }
                        onUploadError={(e) => toast.error(e.message)}
                        ref={undefined}
                      />
                      <label className="flex relative h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Upload cover photo
                        </span>
                        <UploadS3Button
                          endpoint="coverUploader"
                          variant="button"
                          label="Choose File"
                          className="mt-1 h-8 absolute bottom-2 left-1/2 transform -translate-x-1/2 rounded-full bg-primary px-4 text-xs text-primary-foreground shadow-none hover:bg-primary/90"
                          onClientUploadComplete={(file) =>
                            setValue("coverUrl", file.url)
                          }
                          onUploadError={(e) => toast.error(e.message)}
                        />
                      </label>
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
                        setIsTokenValid(false)
                        setValue("requiredBalanceCode", "")
                        setValue("requiredBalanceIssuer", "")
                        setValue("requiredBalance", 0)
                      }
                    }}
                  />
                </div>

                {formValues.isTokenGated && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Asset Code</Label>
                      <Input
                        placeholder="e.g. ACTION"
                        className="rounded-lg"
                        {...register("requiredBalanceCode")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Asset Issuer</Label>
                      <Input
                        placeholder="Stellar public key (56 characters)"
                        className="rounded-lg font-mono text-xs"
                        {...register("requiredBalanceIssuer")}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 rounded-full"
                      onClick={validateToken}
                      disabled={checkAssetValidity.isLoading}
                    >
                      {checkAssetValidity.isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isTokenValid ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Shield className="h-3.5 w-3.5" />
                      )}
                      {isTokenValid ? "Token Verified" : "Verify on Stellar Network"}
                    </Button>

                    {isTokenValid && (
                      <div className="space-y-2">
                        <Label className="text-xs">Minimum Balance Required</Label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="0"
                          className="rounded-lg"
                          {...register("requiredBalance", { valueAsNumber: true })}
                        />
                      </div>
                    )}
                    {errors.requiredBalance && (
                      <p className="text-xs text-destructive">
                        {errors.requiredBalance.message}
                      </p>
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
                      {formValues.isTokenGated && (
                        <Badge className="gap-1 border-0 bg-amber-500/90 text-[10px] text-white">
                          <Shield className="h-3 w-3" />
                          {formValues.requiredBalance}{" "}
                          {formValues.requiredBalanceCode}
                        </Badge>
                      )}
                    </div>
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
                type="submit"
                disabled={isSubmitting}
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

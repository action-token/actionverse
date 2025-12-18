"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Progress } from "~/components/shadcn/ui/progress"
import { ArrowLeft, Upload, Wand2, ImageIcon, X, Sparkles, RefreshCw, Check, Plus, AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"
import { useImageGeneration, type GeneratedImage } from "~/hooks/use-image-generation"

type CreationMode = "transform" | "generate"

const MAX_IMAGES = 3

interface CustomizeStepProps {
  onComplete: (data: {
    customPrompt: string
    overlayText: string
    referenceImage: string | null
    creationMode: CreationMode
    generatedImages: GeneratedImage[]
    selectedImage: string
  }) => void
  onBack: () => void
  category: string
  style: string
}

export function CustomizeStep({ onComplete, onBack, category, style }: CustomizeStepProps) {
  const [creationMode, setCreationMode] = useState<CreationMode>("generate")
  const [customPrompt, setCustomPrompt] = useState("")
  const [overlayText, setOverlayText] = useState("")
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const {
    isGenerating,
    progress,
    statusMessage,
    error: generateError,
    generateImage,
    clearError,
  } = useImageGeneration()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReferenceImage(reader.result as string)
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setImagePreview(null)
    setReferenceImage(null)
  }

  const isGenerateDisabled =
    isGenerating ||
    (creationMode === "transform" && !referenceImage) ||
    (creationMode === "generate" && !customPrompt.trim())

  const canGenerateMore = generatedImages.length < MAX_IMAGES

  const handleGenerate = useCallback(async () => {
    if (isGenerateDisabled || !canGenerateMore) return

    clearError()

    try {
      const newImage = await generateImage({
        category,
        style,
        customPrompt,
        overlayText,
        referenceImage: referenceImage, // We pass base64 string separately
        creationMode,
      })

      setGeneratedImages((prev) => [...prev, newImage])
      if (!selectedImage) {
        setSelectedImage(newImage.url)
      }
    } catch {
      // Error handled by hook
    }
  }, [
    isGenerateDisabled,
    canGenerateMore,
    clearError,
    generateImage,
    category,
    style,
    customPrompt,
    creationMode,
    selectedImage,
  ])

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  const handleContinue = () => {
    if (!selectedImage || generatedImages.length === 0) return

    onComplete({
      customPrompt,
      overlayText,
      referenceImage,
      creationMode,
      generatedImages,
      selectedImage,
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Wand2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Make it yours</h1>
        <p className="text-lg text-muted-foreground">Customize your card with AI</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Creation mode toggle */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setCreationMode("generate")}
            className={cn(
              "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all duration-300",
              creationMode === "generate"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                creationMode === "generate" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Wand2 className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">AI Generate</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create from scratch</p>
            </div>
          </button>

          <button
            onClick={() => setCreationMode("transform")}
            className={cn(
              "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all duration-300",
              creationMode === "transform"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                creationMode === "transform" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <ImageIcon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">Transform</h3>
              <p className="mt-1 text-sm text-muted-foreground">Style your photo</p>
            </div>
          </button>
        </div>

        {/* Image upload (for transform mode) */}
        {creationMode === "transform" && (
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Reference Image <span className="text-destructive">*</span>
            </Label>
            {imagePreview ? (
              <div className="relative aspect-video overflow-hidden rounded-xl border-2 border-border bg-muted">
                <img src={imagePreview || "/placeholder.svg"} alt="Reference" className="h-full w-full object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card transition-colors hover:border-primary/50 hover:bg-primary/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <span className="font-medium text-foreground">Click to upload</span>
                  <p className="mt-1 text-sm text-muted-foreground">PNG, JPG up to 10MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            )}
          </div>
        )}

        {/* Custom prompt */}
        <div className="space-y-3">
          <Label htmlFor="prompt" className="text-base font-medium">
            AI Instructions
            {creationMode === "generate" ? (
              <span className="ml-1 text-destructive">*</span>
            ) : (
              <span className="ml-1 text-sm font-normal text-muted-foreground">(Optional)</span>
            )}
          </Label>
          <Textarea
            id="prompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Add specific details like colors, mood, or elements you want to include..."
            rows={4}
            className="resize-none bg-card"
          />
        </div>

        {/* Overlay text */}
        <div className="space-y-3">
          <Label htmlFor="overlay" className="text-base font-medium">
            Card Text
            <span className="ml-1 text-sm font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <Input
            id="overlay"
            value={overlayText}
            onChange={(e) => setOverlayText(e.target.value)}
            placeholder="Happy Holidays, Congratulations, etc."
            className="bg-card"
          />
        </div>

        {generatedImages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Generated Images ({generatedImages.length}/{MAX_IMAGES})
              </Label>
            </div>

            {/* Image grid */}
            <div className="grid gap-4 grid-cols-3">
              {generatedImages.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectImage(image.url)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all duration-300",
                    selectedImage === image.url
                      ? "border-primary ring-4 ring-primary/20"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <img
                    src={image.url || "/placeholder.svg"}
                    alt={`Design ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center bg-primary/20 transition-opacity",
                      selectedImage === image.url ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-xs font-medium text-background">Design {index + 1}</p>
                  </div>
                </button>
              ))}

              {/* Placeholder slots for remaining images */}
              {canGenerateMore &&
                Array.from({ length: MAX_IMAGES - generatedImages.length }).map((_, index) => (
                  <button
                    key={`placeholder-${index}`}
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || isGenerateDisabled}
                    className="group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition-all hover:border-primary/50 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      {isGenerating && index === 0 ? (
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Sparkles className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">
                            Click to generate
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
            </div>

            {/* Generate 1 button below grid */}
            {canGenerateMore && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating || isGenerateDisabled}
                className="w-full gap-2 bg-transparent"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Generate 1
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Generation progress */}
        {isGenerating && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-foreground">{statusMessage || "Generating..."}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Error message */}
        {generateError && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{generateError}</p>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {generatedImages.length === 0 ? (
            // Show Generate button if no images yet
            <Button onClick={handleGenerate} disabled={isGenerateDisabled} size="lg" className="flex-1 gap-2">
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          ) : (
            // Show Next button once images are generated
            <Button onClick={handleContinue} disabled={!selectedImage} size="lg" className="flex-1">
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

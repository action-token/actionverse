"use client"

import { useCallback } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Progress } from "~/components/shadcn/ui/progress"
import { ArrowLeft, Sparkles, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"
import { useImageGeneration, type GeneratedImage } from "~/hooks/use-image-generation"

type Category = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY"
type CreationMode = "transform" | "generate"

interface GenerateStepProps {
  category: Category
  style: string
  customPrompt: string
  overlayText: string
  referenceImage: string | null
  creationMode: CreationMode
  onImageGenerated: (image: GeneratedImage) => void
  onBack: () => void
}

export function GenerateStep({
  category,
  style,
  customPrompt,
  overlayText,
  referenceImage,
  creationMode,
  onImageGenerated,
  onBack,
}: GenerateStepProps) {
  const { isGenerating, progress, statusMessage, error, generateImage, clearError } = useImageGeneration()

  const handleGenerate = useCallback(async () => {
    clearError()

    try {
      const image = await generateImage({
        category,
        style,
        customPrompt,
        referenceImage,
        creationMode,
      })

      onImageGenerated(image)
    } catch {
      // Error is already handled in the hook
    }
  }, [category, style, customPrompt, referenceImage, creationMode, generateImage, clearError, onImageGenerated])

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">AI Magic</h1>
        <p className="text-lg text-muted-foreground">Generate your unique card design</p>
      </div>

      {/* Generation info */}
      <div className="mx-auto max-w-md">
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium text-foreground mb-2">Generation Settings</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium">Category:</span> {category}
            </p>
            <p>
              <span className="font-medium">Style:</span> {style}
            </p>
            <p>
              <span className="font-medium">Mode:</span>{" "}
              {creationMode === "transform" ? "Transform Photo" : "AI Generate"}
            </p>
            {customPrompt && (
              <p>
                <span className="font-medium">Custom:</span> {customPrompt}
              </p>
            )}
            {creationMode === "transform" && referenceImage && (
              <p>
                <span className="font-medium">Reference:</span> {referenceImage.name}
              </p>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Generate button / Progress */}
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className={cn("h-8 w-8 text-primary", isGenerating && "animate-pulse")} />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            {isGenerating ? "Creating magic..." : "Ready to create"}
          </h3>
          <p className="mb-4 mt-2 text-muted-foreground">
            {isGenerating
              ? statusMessage || "This usually takes 10-30 seconds"
              : "Click to generate your first card design"}
          </p>

          {isGenerating && (
            <div className="w-full mb-4">
              <Progress value={progress} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="gap-2">
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Design
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

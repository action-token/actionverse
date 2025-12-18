"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Switch } from "~/components/shadcn/ui/switch"
import { Progress } from "~/components/shadcn/ui/progress"
import { ArrowLeft, Send, RotateCcw, Sparkles, RefreshCw, Check, Plus, AlertCircle } from "lucide-react"
import { useToast } from "~/hooks/use-toast"
import { cn } from "~/lib/utils"
import { useImageGeneration, type GeneratedImage } from "~/hooks/use-image-generation"
import { api } from "~/utils/api"
import { useRouter } from "next/navigation"

type Category = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY"
type CreationMode = "transform" | "generate"

interface FinalizeStepProps {
  images: GeneratedImage[]
  selectedImage: string
  onSelectImage: (imageUrl: string) => void
  onAddImage: (image: GeneratedImage) => void
  category: Category
  style: string
  customPrompt: string
  overlayText: string
  referenceImage: string | null
  creationMode: CreationMode
  onBack: () => void
}

const MAX_IMAGES = 3

export function FinalizeStep({
  images,
  selectedImage,
  onSelectImage,
  onAddImage,
  category,
  style,
  customPrompt,
  overlayText,
  referenceImage,
  creationMode,
  onBack,
}: FinalizeStepProps) {
  const { toast } = useToast()
  const {
    isGenerating,
    progress,
    statusMessage,
    error: generateError,
    generateImage,
    clearError,
  } = useImageGeneration()
  const router = useRouter()
  const [senderName, setSenderName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [message, setMessage] = useState("")
  const [arEnabled, setArEnabled] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canGenerateMore = images.length < MAX_IMAGES

  const handleGenerateMore = useCallback(async () => {
    if (isGenerating) return

    clearError()

    try {
      const newImage = await generateImage({
        category,
        style,
        customPrompt,
        referenceImage,
        creationMode,
      })

      onAddImage(newImage)
      toast({
        title: "New design generated!",
        description: `Design ${images.length + 1} of ${MAX_IMAGES} created.`,
      })
    } catch {
      toast({
        title: "Generation failed",
        description: generateError ?? "Failed to generate image",
        variant: "destructive",
      })
    }
  }, [
    isGenerating,
    clearError,
    generateImage,
    category,
    style,
    customPrompt,
    referenceImage,
    creationMode,
    onAddImage,
    images.length,
    toast,
    generateError,
  ])

  // Auto-generate first image when component mounts and no images exist
  useEffect(() => {
    if (images.length === 0 && !isGenerating && !generateError && canGenerateMore) {
      handleGenerateMore().catch(console.error)
    }
  }, [images.length, isGenerating, generateError, canGenerateMore, handleGenerateMore]) // Re-run if conditions change
  const createBeamMutation = api.beam.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Beam created!",
        description: "Your AI Art Beam is ready to share.",
      })
      router.push(`/beam/${data.id}`)
    },
    onError: (error) => {
      toast({
        title: "Failed to create Beam",
        description: error.message,
        variant: "destructive",
      })
    },
  })
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!senderName || !recipientName || !message) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {

      createBeamMutation.mutate({
        type: "AI",
        senderName,
        recipientName,
        message,
        contentUrl: selectedImage,
        customPrompt: customPrompt,
        arEnabled,
        isPublic,
      })


    } catch {
      toast({
        title: "Beam created!",
        description: "Your Card Beam is ready to share. (Preview mode)",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Final touches</h1>
        <p className="text-lg text-muted-foreground">Select your design and add your message</p>
      </div>



      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Preview card */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Preview</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsFlipped(!isFlipped)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Flip
              </Button>
            </div>

            <div
              className="mx-auto aspect-[3/4] max-w-xs cursor-pointer"
              style={{ perspective: "1000px" }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div
                className="relative h-full w-full transition-transform duration-700"
                style={{
                  transformStyle: "preserve-3d",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <img
                    src={selectedImage || "/placeholder.svg"}
                    alt="Card front"
                    className="h-full w-full object-cover"
                  />

                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-6 shadow-2xl"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="text-center">
                    <p className="text-base leading-relaxed text-foreground">
                      {message || "Your message will appear here..."}
                    </p>
                    <div className="mt-6 text-sm text-muted-foreground">
                      <p>From: {senderName || "Your Name"}</p>
                      <p>To: {recipientName || "Recipient"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">Click to flip</p>
            {/* Image grid section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Your Designs ({images.length}/{MAX_IMAGES})
                </Label>
                {canGenerateMore && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateMore}
                    disabled={isGenerating}
                    className="gap-2 bg-transparent"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Generate More
                      </>
                    )}
                  </Button>
                )}
              </div>

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

              {/* Image grid */}
              <div className="grid gap-4 grid-cols-3">
                {images.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelectImage(image.url)}
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

                {/* Placeholder slots */}
                {Array.from({ length: MAX_IMAGES - images.length }).map((_, index) => (
                  <button
                    key={`placeholder-${index}`}
                    type="button"
                    onClick={handleGenerateMore}
                    disabled={isGenerating}
                    className="group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition-all hover:border-primary/50 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      {isGenerating && index === 0 ? (
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Sparkles className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">Click to generate</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sender">From</Label>
                <Input
                  id="sender"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your name"
                  className="bg-card"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient">To</Label>
                <Input
                  id="recipient"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient's name"
                  className="bg-card"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your heartfelt message..."
                rows={5}
                className="resize-none bg-card"
                required
              />
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ar-enabled" className="text-base">
                    AR View
                  </Label>
                  <p className="text-sm text-muted-foreground">Enable augmented reality</p>
                </div>
                <Switch id="ar-enabled" checked={arEnabled} onCheckedChange={setArEnabled} />
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is-public" className="text-base">
                    Public
                  </Label>
                  <p className="text-sm text-muted-foreground">Show in gallery</p>
                </div>
                <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>

            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {isSubmitting ? "Publishing..." : "Publish Beam"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { StepIndicator } from "./step-indicator"
import { CategoryStep } from "./steps/category-step"
import { StyleStep } from "./steps/style-step"
import { CustomizeStep } from "./steps/customize-step"
import { FinalizeStep } from "./steps/finalize-step"
import type { GeneratedImage } from "~/hooks/use-image-generation"

type Step = "category" | "style" | "customize" | "finalize"
type Category = "CHRISTMAS" | "EVERYDAY" | "BIRTHDAY" | null
type CreationMode = "transform" | "generate"

export type { GeneratedImage }

interface VibeStudioProps {
  onBack: () => void
}

const steps: { id: Step; label: string }[] = [
  { id: "category", label: "Occasion" },
  { id: "style", label: "Style" },
  { id: "customize", label: "Customize" },
  { id: "finalize", label: "Finalize" },
]

export function VibeStudio({ onBack }: VibeStudioProps) {
  const [currentStep, setCurrentStep] = useState<Step>("category")
  const [category, setCategory] = useState<Category>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [creationMode, setCreationMode] = useState<CreationMode>("generate")
  const [customPrompt, setCustomPrompt] = useState("")
  const [overlayText, setOverlayText] = useState("")
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const handleCategorySelect = (cat: Category) => {
    setCategory(cat)
    setCurrentStep("style")
  }

  const handleStyleSelect = (selectedStyle: string) => {
    setStyle(selectedStyle)
    setCurrentStep("customize")
  }

  const handleCustomizeComplete = (data: {
    customPrompt: string
    overlayText: string
    referenceImage: string | null
    creationMode: CreationMode
    generatedImages: GeneratedImage[]
    selectedImage: string
  }) => {
    console.log("Customize complete data:", data.referenceImage)
    setCustomPrompt(data.customPrompt)
    setOverlayText(data.overlayText)
    setReferenceImage(data.referenceImage)
    setCreationMode(data.creationMode)
    setGeneratedImages(data.generatedImages)
    setSelectedImage(data.selectedImage)
    setCurrentStep("finalize")
  }

  const handleAddImage = (image: GeneratedImage) => {
    setGeneratedImages((prev) => [...prev, image])
    if (!selectedImage) {
      setSelectedImage(image.url)
    }
  }

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  const goBack = () => {
    const prevStep = steps[currentStepIndex - 1]
    if (prevStep) {
      setCurrentStep(prevStep.id)
    } else {
      onBack()
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header with step indicator */}
      <div className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <StepIndicator steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {currentStep === "category" && <CategoryStep onSelect={handleCategorySelect} onBack={onBack} />}
            {currentStep === "style" && category && (
              <StyleStep category={category} onSelect={handleStyleSelect} onBack={goBack} />
            )}
            {currentStep === "customize" && category && style && (
              <CustomizeStep onComplete={handleCustomizeComplete} onBack={goBack} category={category} style={style} />
            )}

            {currentStep === "finalize" && selectedImage && (
              <FinalizeStep
                images={generatedImages}
                selectedImage={selectedImage}
                onSelectImage={handleSelectImage}
                onAddImage={handleAddImage}
                category={category!}
                style={style!}
                customPrompt={customPrompt}
                overlayText={overlayText}
                referenceImage={referenceImage}
                creationMode={creationMode}
                onBack={goBack}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

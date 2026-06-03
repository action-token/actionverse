"use client"
import { Button } from "~/components/shadcn/ui/button"
import { ArrowLeft } from "lucide-react"
import { VibeStudio } from "~/components/beam/vibe-studio/vibe-studio"

interface CardBeamFormProps {
  onBack: () => void
}

export function CardBeamForm({ onBack }: CardBeamFormProps) {
  return (
    <div className=" p-6 m-2">
      <Button variant="destructive" onClick={onBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <h1 className="mb-2 text-4xl font-bold text-foreground text-center">Create Card Beam</h1>
      <p className="mb-8 text-lg text-muted-foreground text-center">Design your card with Vibe Studio</p>

      <VibeStudio onBack={onBack} />
    </div>
  )
}

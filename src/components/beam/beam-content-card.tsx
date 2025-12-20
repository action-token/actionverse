"use client"

import { useState } from "react"
import { RotateCcw, Sparkles } from "lucide-react"
import { Separator } from "~/components/shadcn/ui/separator"

interface BeamContentCardProps {
  type: string
  contentUrl: string | null
  overlayText: string | null
  message: string | null
  senderName: string
  recipientName: string
}

export function BeamContentCard({
  type,
  contentUrl,
  overlayText,
  message,
  senderName,
  recipientName,
}: BeamContentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  if (type === "VIDEO") {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-foreground/5">
        <video src={contentUrl ?? ""} controls className="h-full w-full" poster="/video-thumbnail.png" />
      </div>
    )
  }

  return (
    <div
      className="relative cursor-pointer group"
      style={{ perspective: "1400px" }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className="relative w-full transition-transform duration-700 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front Side - Image */}
        <div
          className="relative aspect-[1/1]  w-full overflow-hidden rounded-2xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <img
            src={contentUrl ?? "https://app.action-tokens.com/images/logo.png"}
            alt="Beam content"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          {overlayText && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent">
              <p className="px-8 text-center text-2xl font-bold text-background md:text-4xl drop-shadow-2xl leading-tight text-balance">
                {overlayText}
              </p>
            </div>
          )}
          {/* Flip Indicator */}
          <div className="absolute bottom-4 right-4 rounded-full bg-foreground/70 backdrop-blur-sm px-4 py-2 text-sm text-background flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <RotateCcw className="h-4 w-4" />
            Tap to reveal message
          </div>
        </div>

        {/* Back Side - Message */}
        <div
          className="absolute inset-0 flex aspect-[1/1] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-card to-secondary p-8 md:p-16 ring-1 ring-border"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="text-center max-w-2xl">
            <p className="mb-8 text-xl leading-relaxed text-foreground md:text-2xl font-light text-balance italic">
              {message ?? "No message provided."}
            </p>
            <Separator className="mx-auto my-8 w-24 bg-primary/30" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="text-muted-foreground">From</span>{" "}
                <span className="font-semibold text-foreground">{senderName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">To</span>{" "}
                <span className="font-semibold text-foreground">{recipientName}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

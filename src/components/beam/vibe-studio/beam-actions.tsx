"use client"

import { Button } from "@/components/ui/button"
import { Download, Share2, Copy, QrCode, Sparkles } from "lucide-react"

interface BeamActionsProps {
  onCopyLink: () => void
  onShare: () => void
  onDownload: () => void
  onShowQR: () => void
  onOpenAR?: () => void
  hasContent: boolean
  arEnabled: boolean
  contentType: string
}

export function BeamActions({
  onCopyLink,
  onShare,
  onDownload,
  onShowQR,
  onOpenAR,
  hasContent,
  arEnabled,
  contentType,
}: BeamActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="default" size="lg" className="gap-2 flex-1 min-w-[140px]" onClick={onShowQR}>
        <QrCode className="h-4 w-4" />
        Show QR Code
      </Button>

      <Button variant="outline" size="lg" className="gap-2 flex-1 min-w-[140px] bg-transparent" onClick={onShare}>
        <Share2 className="h-4 w-4" />
        Share
      </Button>

      <Button variant="outline" size="lg" className="gap-2 flex-1 min-w-[140px] bg-transparent" onClick={onCopyLink}>
        <Copy className="h-4 w-4" />
        Copy Link
      </Button>

      {hasContent && (
        <Button variant="outline" size="lg" className="gap-2 flex-1 min-w-[140px] bg-transparent" onClick={onDownload}>
          <Download className="h-4 w-4" />
          Download {contentType === "VIDEO" ? "Video" : "Image"}
        </Button>
      )}

      {arEnabled && onOpenAR && (
        <Button size="lg" className="gap-2 w-full bg-gradient-to-r from-primary to-accent" onClick={onOpenAR}>
          <Sparkles className="h-4 w-4" />
          Open in Augmented Reality
        </Button>
      )}
    </div>
  )
}

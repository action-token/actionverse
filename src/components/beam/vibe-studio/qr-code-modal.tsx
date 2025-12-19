"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Copy, Check } from "lucide-react"
import QRCode from "qrcode"

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  title?: string
}

export function QRCodeModal({ isOpen, onClose, url, title }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen && canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 280,
        margin: 2,
        color: {
          dark: "#0d9488",
          light: "#ffffff",
        },
      })
    }
  }, [isOpen, url])

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a")
      link.download = `beam-qr-${Date.now()}.png`
      link.href = canvasRef.current.toDataURL("image/png")
      link.click()
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Share this Beam</DialogTitle>
          <DialogDescription className="text-center">Scan this QR code or copy the link to share</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          <div className="rounded-2xl bg-card p-4 shadow-lg ring-1 ring-border">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>

          {title && <p className="text-sm text-muted-foreground text-center max-w-[250px] truncate">{title}</p>}

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { Download, Copy, Check } from "lucide-react"
import QRCode from "react-qr-code"

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  title?: string
}

export function QRCodeModal({ isOpen, onClose, url, title }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const handleDownload = () => {
    if (qrRef.current) {
      const svg = qrRef.current.querySelector("svg")
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          const link = document.createElement("a")
          link.download = `beam-qr-${Date.now()}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        }
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
      }
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
          <div ref={qrRef} className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-border">
            <QRCode value={url} size={240} fgColor="#0d9488" bgColor="#ffffff" level="M" />
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

"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { addrShort } from "~/utils/utils"
import { Button } from "~/components/shadcn/ui/button"
import toast from "react-hot-toast"

interface CopyToClipProps {
  text: string
  collapse?: number
}

function CopyToClip({ text, collapse }: CopyToClipProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      toast.success(`Copied ${addrShort(text, collapse)}`)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy text")
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-[#dbdd2c] border-2 p-2 hover:bg-[#dbdd2c]/10"
      onClick={handleCopy}
    >
      {isCopied ? <Check className="text-[#dbdd2c]" size={12} /> : <Copy size={12} />}
    </Button>
  )
}

export default CopyToClip


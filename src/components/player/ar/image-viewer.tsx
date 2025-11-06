"use client"

import { useState } from "react"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"

interface ImageViewerProps {
    src: string
    alt: string
    onClose?: () => void
}

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
    const [scale, setScale] = useState(1)
    const [rotation, setRotation] = useState(0)
    console.log("ImageViewer rendered with src:", src)
    const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3))
    const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5))
    const handleReset = () => {
        setScale(1)
        setRotation(0)
    }
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

    return (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-40">
            <div className="flex items-center justify-between w-full px-4 py-3 bg-black/90">
                <h3 className="text-white font-semibold">Image View</h3>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                        onClick={handleZoomIn}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                        onClick={handleZoomOut}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                        onClick={handleRotate}
                    >
                        ↻
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                        onClick={handleReset}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                    {onClose && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                            onClick={onClose}
                        >
                            ✕
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
                <img
                    src={src || "/placeholder.svg"}
                    alt={alt}
                    style={{
                        transform: `scale(${scale}) rotate(${rotation}deg)`,
                        transition: "transform 0.2s ease-in-out",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                    }}
                />
            </div>
        </div>
    )
}

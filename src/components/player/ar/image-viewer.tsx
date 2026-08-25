"use client"

import { useEffect } from "react"
import { useState } from "react"
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"

interface ImageViewerProps {
    src: string
    alt: string
    onClose?: () => void
}

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
    const [scale, setScale] = useState(1)
    const [rotation, setRotation] = useState(0)
    const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3))
    const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5))
    const handleReset = () => {
        setScale(1)
        setRotation(0)
    }
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

    // Escape closes the viewer too — the button alone is easy to miss on a
    // full-bleed overlay like this.
    useEffect(() => {
        if (!onClose) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [onClose])

    return (
        <div
            // z-50, not z-40: NFTVideoPlayer and the persistent bottom
            // player both use z-50 for the same "on top of everything"
            // fixed overlay — at z-40 something else in the app (between
            // 40 and 50) was rendering over this viewer's toolbar,
            // hiding every control including the close button while the
            // image itself still showed through underneath.
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50"
            // Clicking the backdrop (not the toolbar or the image itself)
            // closes it too, same as tapping outside any other overlay.
            onClick={onClose}
        >
            <div
                className="flex items-center justify-between w-full px-4 py-3 bg-black/90"
                onClick={(e) => e.stopPropagation()}
            >
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
                            className="gap-1.5 text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                            onClick={onClose}
                        >
                            <X className="w-4 h-4" />
                            Close
                        </Button>
                    )}
                </div>
            </div>
            <div
                className="flex-1 flex items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
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

"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ArrowRightIcon as ArrowsMaximize } from "lucide-react"
import { cn } from "~/lib/utils"

interface WidgetResizeHandleProps {
    onResizeStart: () => void
    onResize: (deltaX: number, deltaY: number) => void
    onResizeEnd: () => void
    className?: string
    position?: "bottom-right" | "right" | "bottom"
}

export default function WidgetResizeHandle({
    onResizeStart,
    onResize,
    onResizeEnd,
    className,
    position = "bottom-right",
}: WidgetResizeHandleProps) {
    const [isResizing, setIsResizing] = useState(false)
    const startPosRef = useRef({ x: 0, y: 0 })

    // Determine cursor style based on position
    const getCursorStyle = () => {
        switch (position) {
            case "right":
                return "cursor-ew-resize"
            case "bottom":
                return "cursor-ns-resize"
            case "bottom-right":
            default:
                return "cursor-se-resize"
        }
    }

    // Handle mouse down to start resize
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setIsResizing(true)
        startPosRef.current = { x: e.clientX, y: e.clientY }
        onResizeStart()

        // Add global event listeners
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    }

    // Handle mouse move during resize
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return

        const deltaX = e.clientX - startPosRef.current.x
        const deltaY = e.clientY - startPosRef.current.y

        onResize(deltaX, deltaY)

        // Update start position for next move
        startPosRef.current = { x: e.clientX, y: e.clientY }
    }

    // Handle mouse up to end resize
    const handleMouseUp = () => {
        setIsResizing(false)
        onResizeEnd()

        // Remove global event listeners
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
    }

    // Clean up event listeners on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [])

    return (
        <div
            className={cn(
                "absolute z-10 flex items-center justify-center",
                getCursorStyle(),
                position === "bottom-right" && "bottom-1 right-1 w-6 h-6",
                position === "right" && "right-1 top-1/2 -translate-y-1/2 w-6 h-12",
                position === "bottom" && "bottom-1 left-1/2 -translate-x-1/2 w-12 h-6",
                isResizing && "opacity-100",
                !isResizing && "opacity-70 hover:opacity-100",
                className,
            )}
            onMouseDown={handleMouseDown}
        >
            <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                <ArrowsMaximize className="h-3.5 w-3.5" />
            </div>
        </div>
    )
}

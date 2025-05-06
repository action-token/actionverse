"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { cn } from "~/lib/utils"

interface HorizontalScrollProps {
    children: React.ReactNode
    className?: string
    itemClassName?: string
    showControls?: boolean
    gap?: number
    slideBy?: number
    title?: string
    onNavigate?: (direction: "left" | "right") => void
    isLoadingMore?: boolean
}

export function HorizontalScroll({
    children,
    className,
    itemClassName,
    showControls = true,
    gap = 16,
    slideBy = 1,
    title,
    onNavigate,
    isLoadingMore = false,
}: HorizontalScrollProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(true) // Default to true to show right button initially
    const childrenArray = React.Children.toArray(children)

    const checkScrollability = () => {
        const el = scrollContainerRef.current
        if (!el) return

        // Check if we can scroll in either direction
        setCanScrollLeft(el.scrollLeft > 0)

        // Check if we can scroll right
        const hasMoreToScroll = el.scrollLeft < el.scrollWidth - el.clientWidth - 1 // -1 for rounding errors
        setCanScrollRight(hasMoreToScroll)
    }

    useEffect(() => {
        const el = scrollContainerRef.current
        if (!el) return

        // Force initial check after a small delay to ensure accurate measurements
        const timer = setTimeout(() => {
            checkScrollability()

            // If we have more than one item and the container has overflow, we can scroll right
            if (childrenArray.length > 1 && el.scrollWidth > el.clientWidth) {
                setCanScrollRight(true)
            }
        }, 100)

        // Set up event listeners
        el.addEventListener("scroll", checkScrollability)
        window.addEventListener("resize", checkScrollability)

        return () => {
            clearTimeout(timer)
            el.removeEventListener("scroll", checkScrollability)
            window.removeEventListener("resize", checkScrollability)
        }
    }, [childrenArray.length])

    const scroll = (direction: "left" | "right") => {
        const el = scrollContainerRef.current
        if (!el) return

        const itemWidth = el.firstElementChild?.clientWidth ?? 0
        const scrollAmount = (itemWidth + gap) * slideBy

        if (direction === "left") {
            el.scrollBy({ left: -scrollAmount, behavior: "smooth" })
        } else {
            el.scrollBy({ left: scrollAmount, behavior: "smooth" })
        }

        // Update scroll state after scrolling
        setTimeout(checkScrollability, 500) // Check after animation completes

        // Call the onNavigate callback if provided
        if (onNavigate) {
            onNavigate(direction)
        }
    }

    // If we have 1 or 0 items, don't show controls
    const shouldShowControls = showControls && childrenArray.length > 1

    return (
        <div className={cn("relative", className)}>
            {/* Top navigation controls */}
            {shouldShowControls && (
                <div className="mb-4 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full bg-white text-gray-700 shadow-md transition-opacity",
                            !canScrollLeft && "opacity-50 cursor-not-allowed",
                        )}
                        onClick={() => scroll("left")}
                        disabled={!canScrollLeft}
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full bg-white text-gray-700 shadow-md transition-opacity",
                            !canScrollRight && !isLoadingMore && "opacity-50 cursor-not-allowed",
                        )}
                        onClick={() => scroll("right")}
                        disabled={!canScrollRight && !isLoadingMore}
                        aria-label="Scroll right"
                    >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </div>
            )}

            {/* Side navigation controls (keeping these for mobile) */}
            {shouldShowControls && (
                <>
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "absolute -left-4 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-white text-gray-700 shadow-md transition-opacity md:hidden",
                            !canScrollLeft && "opacity-0 pointer-events-none",
                        )}
                        onClick={() => scroll("left")}
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "absolute -right-4 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-white text-gray-700 shadow-md transition-opacity md:hidden",
                            !canScrollRight && !isLoadingMore && "opacity-0 pointer-events-none",
                        )}
                        onClick={() => scroll("right")}
                        aria-label="Scroll right"
                    >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </>
            )}

            <div
                ref={scrollContainerRef}
                className={cn("flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x", itemClassName)}
                style={{ scrollbarWidth: "none" }}
                data-testid="scroll-container"
            >
                {children}
            </div>
        </div>
    )
}

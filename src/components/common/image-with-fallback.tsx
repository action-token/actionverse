"use client"

import { useState } from "react"
import Image from "next/image"
import { Skeleton } from "~/components/shadcn/ui/skeleton"

interface ImageWithFallbackProps {
    src: string
    alt: string
    fill?: boolean
    width?: number
    height?: number
    className?: string
    priority?: boolean
}

export function ImageWithFallback({
    src,
    alt,
    fill = false,
    width,
    height,
    className = "",
    priority = false,
}: ImageWithFallbackProps) {
    const [isLoading, setIsLoading] = useState(true)

    return (
        <div className={`relative ${fill ? "h-full w-full" : ""}`}>
            {isLoading && (
                <Skeleton
                    className={`${fill ? "absolute inset-0" : ""} ${className}`}
                    style={{ width: fill ? "100%" : width, height: fill ? "100%" : height }}
                />
            )}
            <Image
                src={src || "/placeholder.svg"}
                alt={alt}
                fill={fill}
                width={!fill ? width : undefined}
                height={!fill ? height : undefined}
                className={`${className} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
                priority={priority}
            />
        </div>
    )
}

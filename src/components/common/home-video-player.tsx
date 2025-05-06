"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useInView } from "react-intersection-observer"

interface VideoPlayerProps {
    src: string
    poster: string
    className?: string
}

export function HomeVideoPlayer({ src, poster, className = "" }: VideoPlayerProps) {
    const [isLoaded, setIsLoaded] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Only load video when it's in view
    const { ref, inView } = useInView({
        threshold: 0.1,
        triggerOnce: true,
    })

    useEffect(() => {
        if (inView && videoRef.current && !isLoaded) {
            // Set the src only when in view
            videoRef.current.src = src
            videoRef.current.load()
            setIsLoaded(true)
        }
    }, [inView, isLoaded, src])

    useEffect(() => {
        if (isLoaded && videoRef.current) {
            videoRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch((error) => console.error("Video playback failed:", error))
        }
    }, [isLoaded])

    return (
        <div ref={ref} className="relative h-full w-full">
            {/* Show poster image until video is loaded and playing */}
            {(!isLoaded || !isPlaying) && (
                <Image
                    src={poster || "/placeholder.svg"}
                    alt="Video poster"
                    fill
                    priority
                    className={`object-cover ${className}`}
                />
            )}

            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                poster={poster}
                className={`h-full w-full object-cover ${!isPlaying ? "opacity-0" : "opacity-100"} transition-opacity duration-500 ${className}`}
                preload="none"
            >
                {/* Source is set dynamically in useEffect */}
                <source type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Volume2,
    VolumeX,
    X,
    ArrowUp,
    Maximize,
    GripHorizontal,
} from "lucide-react"
import { cn } from "~/lib/utils"
import { motion } from "framer-motion"
import type { MediaItem } from "./mini-player-provider"

interface VideoMiniPlayerProps {
    media: MediaItem
    isPlaying: boolean
    progress: number
    duration: number
    isMuted: boolean
    volume: number
    onTogglePlay: () => void
    onPrev: () => void
    onNext: () => void
    onProgressChange: (value: number[]) => void
    onVolumeChange: (value: number[]) => void
    onToggleMute: () => void
    onClose: () => void
    onExpand: () => void
    onFullscreen: () => void
    videoRef: (element: HTMLVideoElement | null) => void
    onTimeUpdate?: (time: number) => void
    onDurationChange?: (duration: number) => void
}

export default function VideoMiniPlayer({
    media,
    isPlaying,
    progress,
    duration,
    isMuted,
    volume,
    onTogglePlay,
    onPrev,
    onNext,
    onProgressChange,
    onVolumeChange,
    onToggleMute,
    onClose,
    onExpand,
    onFullscreen,
    videoRef,
    onTimeUpdate,
    onDurationChange,
}: VideoMiniPlayerProps) {
    const [dragConstraints, setDragConstraints] = useState({ top: 0, bottom: 0, left: -300, right: 300 })
    const [isDragging, setIsDragging] = useState(false)

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`
    }

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (onTimeUpdate && !isDragging) {
            onTimeUpdate(e.currentTarget.currentTime)
        }
    }

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (onDurationChange) {
            onDurationChange(e.currentTarget.duration)
        }
    }

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            drag
            dragConstraints={dragConstraints}
            dragElastic={0.1}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md"
            style={{ width: "100%", maxWidth: "28rem" }}
        >
            <div className="relative overflow-hidden rounded-t-xl bg-black shadow-lg border border-white/20">
                {/* Drag handle */}
                <div
                    className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <GripHorizontal className="h-4 w-4 text-white/60" />
                </div>

                {/* Video preview */}
                <div className="relative aspect-video w-full">
                    <video
                        ref={videoRef}
                        src={media.url}
                        className="w-full h-full object-contain"
                        playsInline
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={onNext}
                        onClick={(e) => {
                            if (!isDragging) {
                                e.stopPropagation()
                                onTogglePlay()
                            }
                        }}
                    />

                    {/* Play/Pause overlay */}
                    <div
                        className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity",
                            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100",
                        )}
                        onClick={(e) => {
                            if (!isDragging) {
                                e.stopPropagation()
                                onTogglePlay()
                            }
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full w-16 h-16 bg-black/50"
                            disabled={isDragging}
                        >
                            <Play className="h-8 w-8" />
                        </Button>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <div className="flex items-center justify-between text-xs text-white mb-1">
                            <span>{formatTime((progress / 100) * duration)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>

                        <Slider
                            value={[progress]}
                            min={0}
                            max={100}
                            step={0.1}
                            onValueChange={onProgressChange}
                            className="w-full mb-2 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:hidden [&>span:first-child_span]:bg-white"
                            disabled={isDragging}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                                    onClick={onPrev}
                                    disabled={isDragging}
                                >
                                    <SkipBack className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                                    onClick={onTogglePlay}
                                    disabled={isDragging}
                                >
                                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                                    onClick={onNext}
                                    disabled={isDragging}
                                >
                                    <SkipForward className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                                    onClick={onToggleMute}
                                    disabled={isDragging}
                                >
                                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </Button>
                                <Slider
                                    value={[volume]}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    onValueChange={onVolumeChange}
                                    className="w-16 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:hidden [&>span:first-child_span]:bg-white"
                                    disabled={isDragging}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white hover:bg-white/10 rounded-full h-8 w-8"
                                    onClick={onFullscreen}
                                    disabled={isDragging}
                                >
                                    <Maximize className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Title bar */}
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-2 pt-6 flex items-center justify-between">
                        <div className="text-white text-sm font-medium truncate max-w-[70%]">{media.title ?? "Untitled Video"}</div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/10 rounded-full h-7 w-7"
                                onClick={onExpand}
                                disabled={isDragging}
                            >
                                <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/10 rounded-full h-7 w-7"
                                onClick={onClose}
                                disabled={isDragging}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}


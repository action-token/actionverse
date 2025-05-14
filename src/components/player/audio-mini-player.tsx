"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import { Play, Pause, SkipForward, SkipBack, Repeat, Shuffle, X, ArrowUp, GripHorizontal } from "lucide-react"
import { cn } from "~/lib/utils"
import { motion } from "framer-motion"
import type { MediaItem } from "./mini-player-provider"

interface AudioMiniPlayerProps {
    media: MediaItem
    isPlaying: boolean
    progress: number
    duration: number
    isMuted: boolean
    isShuffled: boolean
    isRepeating: boolean
    onTogglePlay: () => void
    onPrev: () => void
    onNext: () => void
    onProgressChange: (value: number[]) => void
    onToggleShuffle: () => void
    onToggleRepeat: () => void
    onClose: () => void
    onExpand: () => void
    audioElement?: HTMLAudioElement | null
}

export default function AudioMiniPlayer({
    media,
    isPlaying,
    progress,
    duration,
    isMuted,
    isShuffled,
    isRepeating,
    onTogglePlay,
    onPrev,
    onNext,
    onProgressChange,
    onToggleShuffle,
    onToggleRepeat,
    onClose,
    onExpand,
    audioElement,
}: AudioMiniPlayerProps) {
    const [dragConstraints, setDragConstraints] = useState({ top: 0, bottom: 0, left: -300, right: 300 })
    const [isDragging, setIsDragging] = useState(false)

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`
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
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-2xl"
            style={{ width: "100%", maxWidth: "32rem" }}
        >
            <div
                className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-blue-400 to-purple-500 backdrop-blur-lg shadow-lg border border-white/20"
                style={{
                    backgroundImage: `url(${media.thumbnail ?? "/images/action/logo.png"})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            >
                {/* Drag handle */}
                <div
                    className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <GripHorizontal className="h-4 w-4 text-white/60" />
                </div>

                {/* Blurred overlay */}
                <div className="absolute inset-0 backdrop-blur-xl bg-black/30" />

                {/* Content */}
                <div className="relative p-4 pt-6 text-white">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex-1 truncate text-center">
                            <h3 className="font-bold text-lg tracking-wide uppercase">{media.title ?? "Unknown Track"}</h3>
                            <p className="text-sm text-white/80 uppercase">{media.artist ?? "Unknown Artist"}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full -mr-2"
                            onClick={onClose}
                            disabled={isDragging}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Album art */}
                    <div className="flex justify-center mb-4">
                        <motion.div
                            animate={{ rotate: isPlaying ? 360 : 0 }}
                            transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                            className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/30"
                        >
                            <Image
                                src={media.thumbnail ?? "/images/logo.png"}
                                alt={media.title ?? "Album Art"}
                                width={96}
                                height={96}
                                className="object-cover flex items-center justify-center h-full w-full"
                            />
                        </motion.div>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-1">
                        <span>{formatTime((progress / 100) * duration)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <Slider
                        value={[progress]}
                        min={0}
                        max={100}
                        step={0.1}
                        onValueChange={onProgressChange}
                        className="w-full mb-3 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:hidden [&>span:first-child_span]:bg-white"
                        disabled={isDragging}
                    />

                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={onToggleShuffle}
                            disabled={isDragging}
                        >
                            <Shuffle className={cn("h-4 w-4", isShuffled ? "text-primary" : "text-white")} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={onPrev}
                            disabled={isDragging}
                        >
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full w-10 h-10 bg-white/20"
                            onClick={onTogglePlay}
                            disabled={isDragging}
                        >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={onNext}
                            disabled={isDragging}
                        >
                            <SkipForward className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={onToggleRepeat}
                            disabled={isDragging}
                        >
                            <Repeat className={cn("h-4 w-4", isRepeating ? "text-primary" : "text-white")} />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-white hover:bg-white/10 rounded-full p-1"
                        onClick={onExpand}
                        disabled={isDragging}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}


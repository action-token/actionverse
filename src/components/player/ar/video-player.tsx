"use client"

import { useState, useRef } from "react"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"

interface VideoPlayerProps {
    src: string
    title: string
    onClose?: () => void
}

export function VideoPlayer({ src, title, onClose }: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const videoRef = useRef<HTMLVideoElement>(null)

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
            } else {
                videoRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const handleMuteToggle = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const handleTimeChange = (value: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = value[0]
            setProgress(value[0])
        }
    }

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress(videoRef.current.currentTime)
        }
    }

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration)
        }
    }

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00"
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-40">
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden shadow-2xl">
                <div className="relative bg-black aspect-video flex items-center justify-center">
                    <video
                        ref={videoRef}
                        src={src}
                        className="w-full h-full"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        crossOrigin="anonymous"
                    />
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Button
                                size="lg"
                                className="rounded-full w-16 h-16 bg-blue-500 hover:bg-blue-600"
                                onClick={handlePlayPause}
                            >
                                <Play className="w-8 h-8 ml-1" fill="currentColor" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-3 bg-black/50">
                    <h3 className="text-white font-semibold">{title}</h3>

                    {/* Progress Bar */}
                    <Slider
                        value={[progress]}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleTimeChange}
                        className="w-full"
                    />

                    {/* Time Display */}
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                                onClick={handlePlayPause}
                            >
                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-white border-gray-600 hover:bg-gray-800 bg-transparent"
                                onClick={handleMuteToggle}
                            >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </Button>
                        </div>
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
            </div>
        </div>
    )
}

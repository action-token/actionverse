"use client"

import { useState, useRef } from "react"
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"

interface AudioPlayerProps {
    src: string
    title: string
    onClose?: () => void
}

export function AudioPlayer({ src, title, onClose }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const audioRef = useRef<HTMLAudioElement>(null)

    const handlePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    const handleMuteToggle = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const handleTimeChange = (value: number[]) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value[0]
            setProgress(value[0])
        }
    }

    const handleVolumeChange = (value: number[]) => {
        if (audioRef.current) {
            const vol = value[0]
            audioRef.current.volume = vol
            setVolume(vol)
        }
    }

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setProgress(audioRef.current.currentTime)
        }
    }

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration)
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
            <div className="w-full max-w-md bg-gradient-to-b from-purple-900/40 to-black border border-purple-700/30 rounded-lg shadow-2xl overflow-hidden">
                <audio
                    ref={audioRef}
                    src={src}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    crossOrigin="anonymous"
                />

                {/* Album Art Placeholder */}
                <div className="h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                    <Music className="w-24 h-24 text-white/40" />
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <h3 className="text-white font-semibold text-lg text-center">{title}</h3>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <Slider
                            value={[progress]}
                            max={duration || 100}
                            step={0.1}
                            onValueChange={handleTimeChange}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>{formatTime(progress)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Play Controls */}
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            size="lg"
                            className="rounded-full w-14 h-14 bg-purple-600 hover:bg-purple-700"
                            onClick={handlePlayPause}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6 ml-0.5" fill="currentColor" />
                            ) : (
                                <Play className="w-6 h-6 ml-1" fill="currentColor" />
                            )}
                        </Button>
                    </div>

                    {/* Volume and Mute */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-300 border-gray-600 hover:bg-gray-800 bg-transparent"
                            onClick={handleMuteToggle}
                        >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </Button>
                        <Slider value={[volume]} max={1} step={0.05} onValueChange={handleVolumeChange} className="flex-1" />
                    </div>

                    {/* Close Button */}
                    {onClose && (
                        <Button
                            variant="outline"
                            className="w-full text-gray-300 border-gray-600 hover:bg-gray-800 bg-transparent"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

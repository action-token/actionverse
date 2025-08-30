"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, X } from "lucide-react"

interface VideoPlayerProps {
    src: string
    title: string
    isOpen: boolean
    onClose: () => void
    isMinimized: boolean
    onToggleMinimize: () => void
    autoPlay?: boolean
}

export const NFTVideoPlayer = ({
    src,
    title,
    isOpen,
    onClose,
    isMinimized,
    onToggleMinimize,
    autoPlay = false,
}: VideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [isReadyToPlay, setIsReadyToPlay] = useState(false)

    const controlsTimeoutRef = useRef<NodeJS.Timeout>()

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        video.autoplay = false
        video.preload = "auto"

        const handleLoadedMetadata = () => {
            setDuration(video.duration)
        }

        const handleCanPlayThrough = () => {
            setIsLoading(false)
            setIsReadyToPlay(true)

            if (autoPlay && isOpen) {
                video.play().catch(console.error)
            }
        }

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime)
        }

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)

        const handleLoadStart = () => {
            setIsLoading(true)
            setIsReadyToPlay(false)
        }

        video.addEventListener("loadedmetadata", handleLoadedMetadata)
        video.addEventListener("canplaythrough", handleCanPlayThrough)
        video.addEventListener("timeupdate", handleTimeUpdate)
        video.addEventListener("play", handlePlay)
        video.addEventListener("pause", handlePause)
        video.addEventListener("loadstart", handleLoadStart)

        return () => {
            video.removeEventListener("loadedmetadata", handleLoadedMetadata)
            video.removeEventListener("canplaythrough", handleCanPlayThrough)
            video.removeEventListener("timeupdate", handleTimeUpdate)
            video.removeEventListener("play", handlePlay)
            video.removeEventListener("pause", handlePause)
            video.removeEventListener("loadstart", handleLoadStart)
        }
    }, [autoPlay, isOpen])

    useEffect(() => {
        if (isOpen) {
            setCurrentTime(0)
            setIsPlaying(false)
        }
    }, [isOpen])

    const togglePlay = () => {
        const video = videoRef.current
        if (!video) return

        if (isPlaying) {
            video.pause()
        } else {
            video.play()
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        const newTime = Number.parseFloat(e.target.value)
        video.currentTime = newTime
        setCurrentTime(newTime)
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        const newVolume = Number.parseFloat(e.target.value)
        video.volume = newVolume
        setVolume(newVolume)
        setIsMuted(newVolume === 0)
    }

    const toggleMute = () => {
        const video = videoRef.current
        if (!video) return

        if (isMuted) {
            video.volume = volume
            setIsMuted(false)
        } else {
            video.volume = 0
            setIsMuted(true)
        }
    }

    const skipForward = () => {
        const video = videoRef.current
        if (!video) return

        video.currentTime = Math.min(video.currentTime + 10, duration)
    }

    const skipBackward = () => {
        const video = videoRef.current
        if (!video) return

        video.currentTime = Math.max(video.currentTime - 10, 0)
    }

    const toggleFullscreen = () => {
        const video = videoRef.current
        if (!video) return

        if (!isFullscreen) {
            if (video.requestFullscreen) {
                video.requestFullscreen()
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
        setIsFullscreen(!isFullscreen)
    }

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    const handleMouseMove = () => {
        setShowControls(true)
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false)
            }
        }, 3000)
    }

    if (!isOpen) return null

    return (
        <div
            className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm transition-all duration-300 ${isMinimized ? "pointer-events-none" : ""
                }`}
        >
            <div
                className={`absolute transition-all duration-300 bg-black rounded-lg overflow-hidden shadow-2xl ${isMinimized ? "bottom-4 right-4 w-80 h-48 pointer-events-auto" : "inset-4 md:inset-8 lg:inset-16"
                    }`}
                onMouseMove={handleMouseMove}
            >
                <video ref={videoRef} src={src} className="w-full h-full object-contain" autoPlay={false} preload="auto" />

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                            <p className="text-white text-sm">Loading video...</p>
                        </div>
                    </div>
                )}

                <div
                    className={`absolute inset-0 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"
                        }`}
                >
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-semibold truncate">{title}</h3>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={onToggleMinimize} className="text-white hover:bg-white/20">
                                    {isMinimized ? <Maximize className="w-4 h-4" /> : <Minimize className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {!isPlaying && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Button
                                onClick={togglePlay}
                                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-6 transition-all duration-300 hover:scale-110"
                            >
                                <Play className="w-8 h-8 text-white fill-current" />
                            </Button>
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div className="mb-4">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <div className="flex justify-between text-xs text-white/70 mt-1">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={skipBackward} className="text-white hover:bg-white/20">
                                    <SkipBack className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={togglePlay} className="text-white hover:bg-white/20">
                                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={skipForward} className="text-white hover:bg-white/20">
                                    <SkipForward className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={toggleMute} className="text-white hover:bg-white/20">
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </Button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>

                                <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="text-white hover:bg-white/20">
                                    <Maximize className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #3b82f6;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #3b82f6;
        }
      `}</style>
        </div>
    )
}

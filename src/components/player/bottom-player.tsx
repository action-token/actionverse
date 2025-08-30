"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import { Card } from "~/components/shadcn/ui/card"
import { Progress } from "~/components/shadcn/ui/progress"
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Headphones,
    X,
    ChevronUp,
    ChevronDown,
    Music,
    Loader2,
} from "lucide-react"
import { useBottomPlayer } from "./context/bottom-player-context"
import { Waveform } from "./Waveform"


interface AudioState {
    loaded: boolean
    loading: boolean
    error: boolean
    canPlay: boolean
    duration: number
}

export function StemPlayer() {
    const { isPlayerVisible, currentSong, hidePlayer } = useBottomPlayer()
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [masterVolume, setMasterVolume] = useState(1)
    const [showTracks, setShowTracks] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [audioStates, setAudioStates] = useState<Record<string, AudioState>>({})
    const [isGlobalLoading, setIsGlobalLoading] = useState(false)
    const [autoplayEnabled, setAutoplayEnabled] = useState(true)
    // Main song mode state
    const [isMainSongMode, setIsMainSongMode] = useState(false)
    const mainAudioRef = useRef<HTMLAudioElement | null>(null)
    const [mainAudioLoaded, setMainAudioLoaded] = useState(false)
    // Track if autoplay has already happened for current song/tracks
    const [hasAutoplayed, setHasAutoplayed] = useState(false)

    // Stem mode refs
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
    const intervalRef = useRef<NodeJS.Timeout>()
    const syncTimeoutRef = useRef<NodeJS.Timeout>()
    const isSeekingRef = useRef(false)
    const lastSyncTimeRef = useRef(0)

    // Generate colors for tracks
    const getTrackColor = (index: number) => {
        const colors = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5A2B"]
        return colors[index % colors.length]
    }

    // Handle master volume changes for main song
    useEffect(() => {
        if (isMainSongMode && mainAudioRef.current) {
            mainAudioRef.current.volume = masterVolume
        }
    }, [masterVolume, isMainSongMode])

    // Initialize tracks or main song
    useEffect(() => {
        // Reset everything first
        setIsPlaying(false)
        setCurrentTime(0)
        setHasAutoplayed(false)

        // Clear intervals and timeouts
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }

        // Pause and cleanup all existing audio
        Object.values(audioRefs.current).forEach((audio) => {
            audio.pause()
            audio.currentTime = 0
        })
        if (mainAudioRef.current) {
            mainAudioRef.current.pause()
            mainAudioRef.current.currentTime = 0
        }

        isSeekingRef.current = false
        lastSyncTimeRef.current = 0

        // Check if we should use main song mode
        if (currentSong?.url && currentSong.url.trim() !== "") {
            console.log("Initializing main song mode")
            setIsMainSongMode(true)
            setIsGlobalLoading(true)

            // Initialize main audio
            const mainAudio = new Audio()
            mainAudio.crossOrigin = "anonymous"
            mainAudio.preload = "metadata"
            mainAudio.src = currentSong.url
            mainAudioRef.current = mainAudio

            const handleMainAudioReady = () => {
                console.log("Main audio loaded, duration:", mainAudio.duration)
                setDuration(mainAudio.duration || 180)
                setMainAudioLoaded(true)
                setIsGlobalLoading(false)
            }

            const handleMainAudioError = (e: Event) => {
                console.error("Error loading main audio:", e)
                setMainAudioLoaded(false)
                setIsGlobalLoading(false)
            }

            const handleMainAudioTimeUpdate = () => {
                if (!isSeekingRef.current) {
                    setCurrentTime(mainAudio.currentTime)
                }
            }

            const handleMainAudioEnded = () => {
                setIsPlaying(false)
                setCurrentTime(mainAudio.duration || 0)
            }

            mainAudio.addEventListener("canplaythrough", handleMainAudioReady)
            mainAudio.addEventListener("error", handleMainAudioError)
            mainAudio.addEventListener("timeupdate", handleMainAudioTimeUpdate)
            mainAudio.addEventListener("ended", handleMainAudioEnded)

            return () => {
                mainAudio.removeEventListener("canplaythrough", handleMainAudioReady)
                mainAudio.removeEventListener("error", handleMainAudioError)
                mainAudio.removeEventListener("timeupdate", handleMainAudioTimeUpdate)
                mainAudio.removeEventListener("ended", handleMainAudioEnded)
            }
        }
    }, [currentSong])

    useEffect(() => {
        if (isPlayerVisible && autoplayEnabled && !isPlaying && !hasAutoplayed) {
            // Auto-play for main song mode
            if (isMainSongMode && mainAudioLoaded && mainAudioRef.current) {
                console.log("Auto-playing main song")
                togglePlayPause()
                setHasAutoplayed(true)
            }

        }
    }, [isPlayerVisible, autoplayEnabled, isPlaying, isMainSongMode, mainAudioLoaded, isGlobalLoading, audioStates, hasAutoplayed])


    // Time progression for stem mode
    useEffect(() => {
        if (isMainSongMode) return // Main song handles its own time updates

        if (isPlaying && !isGlobalLoading && !isSeekingRef.current) {
            intervalRef.current = setInterval(() => {
                setCurrentTime((prevTime) => {
                    const newTime = prevTime + 0.1
                    if (newTime >= duration) {
                        setIsPlaying(false)
                        return duration
                    }
                    return newTime
                })
            }, 100)
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isPlaying, duration, isGlobalLoading, isMainSongMode])



    const togglePlayPause = () => {
        if (isGlobalLoading) return

        const newPlayingState = !isPlaying
        setIsPlaying(newPlayingState)

        if (isMainSongMode && mainAudioRef.current) {
            if (newPlayingState) {
                mainAudioRef.current.volume = masterVolume
                mainAudioRef.current.play().catch(console.error)
            } else {
                mainAudioRef.current.pause()
            }
        } else {
            // Stem mode - let the sync system handle play/pause
            if (!newPlayingState) {
                // Immediately pause all stems
                Object.values(audioRefs.current).forEach((audio) => {
                    audio.pause()
                })
            }
        }
    }

    const handleSeek = (time: number) => {
        const targetTime = Math.max(0, Math.min(time, duration))

        if (isMainSongMode && mainAudioRef.current) {
            isSeekingRef.current = true
            mainAudioRef.current.currentTime = targetTime
            setCurrentTime(targetTime)

            // Reset seeking flag after a short delay
            setTimeout(() => {
                isSeekingRef.current = false
            }, 100)
        }
    }

    const skipForward = () => {

        handleSeek(Math.min(currentTime + 10, duration))

    }

    const skipBackward = () => {

        handleSeek(Math.max(currentTime - 10, 0))

    }






    const handleClose = () => {
        setIsPlaying(false)

        // Clear all intervals and timeouts
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }

        // Clean up main audio
        if (mainAudioRef.current) {
            mainAudioRef.current.pause()
            mainAudioRef.current.src = ""
            mainAudioRef.current = null
        }

        // Clean up stem audio
        Object.values(audioRefs.current).forEach((audio) => {
            audio.pause()
            audio.src = ""
        })
        audioRefs.current = {}

        setIsMainSongMode(false)
        setMainAudioLoaded(false)
        hidePlayer()
    }

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }



    const activePlayingCount = Object.values(audioRefs.current).filter((audio) => !audio.paused).length

    if (!isPlayerVisible || !currentSong) {
        return null
    }

    return (
        <div className="fixed bottom-2 left-1/2 transform w-full md:w-1/3  -translate-x-1/2 z-50">
            <div className="flex flex-col items-center">




                {/* Main Player */}
                <Card className="border shadow-2xl rounded-2xl overflow-hidden w-full">
                    <div className="p-4">
                        {/* Song Info & Close Button */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Music className="w-5 h-5 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-sm truncate">{currentSong.title}</h3>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {currentSong.artist}
                                        {isGlobalLoading && <span className="ml-2">• Loading...</span>}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleClose} className="flex-shrink-0">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Waveform */}
                        <div className="mb-3">
                            <Waveform
                                duration={duration}
                                currentTime={currentTime}
                                height={32}
                                color="#8B5CF6"
                                backgroundColor="#E5E7EB"
                                progressColor="#10B981"
                                onSeek={handleSeek}
                                isPlaying={isPlaying && !isGlobalLoading}
                                className="rounded-md"
                            />
                        </div>

                        {/* Time Display */}
                        <div className="flex justify-between text-xs text-muted-foreground mb-3">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                            {/* Playback Controls */}
                            <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="sm" onClick={skipBackward} disabled={isGlobalLoading}>
                                    <SkipBack className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={togglePlayPause}
                                    size="sm"
                                    className="w-10 h-10 rounded-full"
                                    disabled={isGlobalLoading}
                                >
                                    {isGlobalLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : isPlaying ? (
                                        <Pause className="w-4 h-4" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={skipForward} disabled={isGlobalLoading}>
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            </div>



                            {/* Volume & Track Controls */}
                            <div className="flex items-center space-x-1">
                                <div className="relative">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onMouseEnter={() => setShowVolumeSlider(true)}
                                        onMouseLeave={() => {
                                            setTimeout(() => setShowVolumeSlider(false), 2000)
                                        }}
                                    >
                                        <Volume2 className="w-4 h-4" />
                                    </Button>
                                    <div
                                        className={`absolute bottom-full mb-2 left-0 transform -translate-x-1/2 bg-background border rounded-lg p-2 shadow-lg w-24 transition-all duration-200 ${showVolumeSlider
                                            ? "opacity-100 translate-y-0 pointer-events-auto"
                                            : "opacity-0 translate-y-2 pointer-events-none"
                                            }`}

                                    >
                                        <Slider
                                            value={[masterVolume]}
                                            onValueChange={(value) => setMasterVolume(value[0] ?? 1)}
                                            max={1}
                                            step={0.01}
                                            className="w-full"
                                        />
                                        <div className="text-xs text-center mt-1 text-muted-foreground">
                                            {Math.round(masterVolume * 100)}%
                                        </div>
                                    </div>
                                </div>

                                {!isMainSongMode && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowTracks(!showTracks)}
                                        disabled={isGlobalLoading}
                                        className="transition-transform duration-200 hover:scale-105"
                                    >
                                        <div className={`transition-transform duration-300 ${showTracks ? "rotate-180" : ""}`}>
                                            <ChevronUp className="w-4 h-4" />
                                        </div>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

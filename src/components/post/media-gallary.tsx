"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import {
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Volume2,
    VolumeX,
    Music,
    ImageIcon,
    Film,
    Maximize,
    Minimize,
    SkipForward,
    SkipBack,
    Repeat,
    Shuffle,
    Minimize2,
} from "lucide-react"
import { cn } from "~/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useMiniPlayer } from "~/components/player/mini-player-provider"
import type { MediaType } from "@prisma/client"
import { useMobile } from "~/hooks/use-mobile"

// Add fullscreen API types that aren't in the standard lib
interface FullscreenElement extends HTMLDivElement {
    webkitRequestFullscreen?: () => Promise<void>
    msRequestFullscreen?: () => Promise<void>
}

interface DocumentWithFullscreen extends Document {
    exitFullscreen: () => Promise<void>
    webkitExitFullscreen?: () => Promise<void>
    msExitFullscreen?: () => Promise<void>
}

interface MediaItem {
    id: number
    url: string
    type: MediaType
    title?: string | null
    artist?: string | null
    thumbnail?: string | null
}

interface MediaPlayerProps {
    media: MediaItem[]
    initialIndex?: number
    autoPlay?: boolean
    showThumbnails?: boolean
}

enum ActiveMediaEnum {
    ALL = "ALL",
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    MUSIC = "MUSIC",
}

export default function MediaPlayer({
    media,
    initialIndex = 0,
    autoPlay = false,
    showThumbnails = true,
}: MediaPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [activeMediaType, setActiveMediaType] = useState<ActiveMediaEnum>(ActiveMediaEnum.ALL)
    const {
        handleNext,
        handlePrev,
        togglePlay: miniPlayerTogglePlay,
        isPlaying,
        setIsPlaying,
        progress,
        duration,
        setProgress,
        setDuration,
        volume,
        setVolume,
        isMuted,
        toggleMute: miniPlayerToggleMute,
        setIsMuted,
        isShuffled,
        isRepeating,
        toggleShuffle,
        toggleRepeat,
        showMiniPlayer,
        hideMiniPlayer,
        isMiniPlayerActive,
    } = useMiniPlayer()

    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [localIsPlaying, setLocalIsPlaying] = useState(false)

    const playerRef = useRef<FullscreenElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isMobile = useMobile()

    // Filter media by selected type
    const filteredMedia = React.useMemo(() => {
        return activeMediaType === ActiveMediaEnum.ALL
            ? media
            : media.filter((item) => {
                // Fix for unsafe enum comparison - convert string to enum
                const itemTypeEnum = ActiveMediaEnum[item.type as keyof typeof ActiveMediaEnum]
                return activeMediaType === itemTypeEnum
            })
    }, [media, activeMediaType])

    // Get current media item
    const currentMedia = filteredMedia[currentIndex]

    const showControlsTemporarily = React.useCallback(() => {
        setShowControls(true)

        if (controlsTimerRef.current) {
            clearTimeout(controlsTimerRef.current)
        }

        controlsTimerRef.current = setTimeout(() => {
            if (localIsPlaying && currentMedia && (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC")) {
                setShowControls(false)
            }
        }, 3000)
    }, [localIsPlaying, currentMedia])

    // Sync local playing state with mini-player state
    useEffect(() => {
        if (isMiniPlayerActive) return
        setLocalIsPlaying(isPlaying)
    }, [isPlaying, isMiniPlayerActive])

    // Handle media element initialization and cleanup
    useEffect(() => {
        // Early return if no media
        if (!media || media.length === 0) return

        // Early return if no current media
        if (!currentMedia) return

        let isMounted = true // Add a flag to track component mount status
        const audioCurrent = audioRef.current
        const videoCurrent = videoRef.current

        const currentMediaType = currentMedia.type
        const shouldInitializeMedia = !isMiniPlayerActive && currentMedia
        const shouldAutoPlay = autoPlay && !localIsPlaying

        const initializeMedia = async () => {
            if (!shouldInitializeMedia) {
                return
            }

            // Initialize media elements
            if (currentMediaType === "MUSIC" && audioCurrent) {
                audioCurrent.volume = volume
                audioCurrent.muted = isMuted

                if (localIsPlaying) {
                    try {
                        await audioCurrent.play()
                    } catch (err) {
                        console.error("Error playing audio:", err)
                        if (isMounted) {
                            // Check if component is still mounted before setting state
                            setLocalIsPlaying(false)
                            setIsPlaying(false)
                        }
                    }
                }
            } else if (currentMediaType === "VIDEO" && videoCurrent) {
                videoCurrent.volume = volume
                videoCurrent.muted = isMuted

                if (localIsPlaying) {
                    try {
                        await videoCurrent.play()
                    } catch (err) {
                        console.error("Error playing video:", err)
                        if (isMounted) {
                            // Check if component is still mounted before setting state
                            setLocalIsPlaying(false)
                            setIsPlaying(false)
                        }
                    }
                }
            }

            // Auto-play if needed
            if (shouldAutoPlay) {
                setLocalIsPlaying(true)
                setIsPlaying(true)

                if (currentMediaType === "MUSIC" && audioCurrent) {
                    try {
                        await audioCurrent.play()
                    } catch (err) {
                        console.error("Auto-play failed:", err)
                        if (isMounted) {
                            // Check if component is still mounted before setting state
                            setLocalIsPlaying(false)
                            setIsPlaying(false)
                        }
                    }
                } else if (currentMediaType === "VIDEO" && videoCurrent) {
                    try {
                        await videoCurrent.play()
                    } catch (err) {
                        console.error("Auto-play failed:", err)
                        if (isMounted) {
                            // Check if component is still mounted before setting state
                            setLocalIsPlaying(false)
                            setIsPlaying(false)
                        }
                    }
                }
            }
        }

        void initializeMedia()

        return () => {
            isMounted = false // Set the flag to false when the component unmounts
            // Cleanup
            if (audioCurrent) {
                audioCurrent.pause()
            }
            if (videoCurrent) {
                videoCurrent.pause()
            }
        }
    }, [
        media,
        activeMediaType,
        currentIndex,
        isMiniPlayerActive,
        localIsPlaying,
        volume,
        isMuted,
        autoPlay,
        setIsPlaying,
        currentMedia,
    ])

    // Local toggle play function for the main player
    const togglePlay = React.useCallback(() => {
        if (!currentMedia || isMiniPlayerActive) return

        const newIsPlaying = !localIsPlaying
        setLocalIsPlaying(newIsPlaying)
        setIsPlaying(newIsPlaying)

        if (currentMedia.type === "MUSIC" && audioRef.current) {
            if (newIsPlaying) {
                void audioRef.current.play().catch((err) => {
                    console.error("Error playing audio:", err)
                    setLocalIsPlaying(false)
                    setIsPlaying(false)
                })
            } else {
                audioRef.current.pause()
            }
        } else if (currentMedia.type === "VIDEO" && videoRef.current) {
            if (newIsPlaying) {
                void videoRef.current.play().catch((err) => {
                    console.error("Error playing video:", err)
                    setLocalIsPlaying(false)
                    setIsPlaying(false)
                })
            } else {
                videoRef.current.pause()
            }
        }
    }, [currentMedia, isMiniPlayerActive, localIsPlaying, setIsPlaying])

    // Local toggle mute function for the main player
    const toggleMute = React.useCallback(() => {
        const newIsMuted = !isMuted
        setIsMuted(newIsMuted)

        if (currentMedia?.type === "MUSIC" && audioRef.current) {
            audioRef.current.muted = newIsMuted
        } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
            videoRef.current.muted = newIsMuted
        }

        miniPlayerToggleMute()
    }, [isMuted, setIsMuted, currentMedia, miniPlayerToggleMute])

    // Handle keyboard shortcuts
    useEffect(() => {
        // Early return if no media
        if (!media || media.length === 0) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                if (isMiniPlayerActive) {
                    miniPlayerTogglePlay()
                } else {
                    togglePlay()
                }
                e.preventDefault()
            } else if (e.code === "ArrowRight") {
                handleNext()
                e.preventDefault()
            } else if (e.code === "ArrowLeft") {
                handlePrev()
                e.preventDefault()
            } else if (e.code === "KeyM") {
                toggleMute()
                e.preventDefault()
            } else if (e.code === "KeyF") {
                toggleFullscreen()
                e.preventDefault()
            }
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            if (controlsTimerRef.current) {
                clearTimeout(controlsTimerRef.current)
            }
        }
    }, [media, isMiniPlayerActive, miniPlayerTogglePlay, handleNext, handlePrev, togglePlay, toggleMute])

    // Reset player state when media changes
    useEffect(() => {
        // Early return if no media
        if (!media || media.length === 0) return

        setProgress(0)
        showControlsTemporarily()
    }, [media, currentIndex, setProgress, showControlsTemporarily])

    // Handle track changes
    useEffect(() => {
        // Early return if no media
        if (!media || media.length === 0) return
        if (!currentMedia) return

        // Reset progress when changing tracks
        setProgress(0)

        // If a track just ended and we moved to the next one, we want to keep the play state as false
        // This prevents the need to click twice after a track ends
        if (!localIsPlaying) {
            return
        }

        // If we're actively changing tracks while playing, auto-play the new track
        if (currentMedia.type === "MUSIC" && audioRef.current) {
            void audioRef.current.play().catch((err) => {
                console.error("Error playing next audio track:", err)
                setLocalIsPlaying(false)
                setIsPlaying(false)
            })
        } else if (currentMedia.type === "VIDEO" && videoRef.current) {
            void videoRef.current.play().catch((err) => {
                console.error("Error playing next video track:", err)
                setLocalIsPlaying(false)
                setIsPlaying(false)
            })
        }
    }, [media, activeMediaType, currentIndex, localIsPlaying, setIsPlaying, setProgress, currentMedia])

    // Add this useEffect after the other useEffect hooks
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)

            // When entering or exiting fullscreen, ensure proper layout
            if (document.fullscreenElement && isMobile) {
                // Force layout recalculation for mobile fullscreen
                setTimeout(() => {
                    if (playerRef.current) {
                        playerRef.current.style.height = "100vh"
                        playerRef.current.style.display = "flex"
                        playerRef.current.style.flexDirection = "column"
                    }

                    if (videoRef.current) {
                        videoRef.current.style.objectFit = "contain"
                        videoRef.current.style.height = "100%"
                        videoRef.current.style.maxHeight = "100vh"
                    }

                    // Show controls briefly when entering fullscreen
                    showControlsTemporarily()
                }, 100)
            } else if (!document.fullscreenElement) {
                // Reset styles when exiting fullscreen
                setTimeout(() => {
                    if (playerRef.current) {
                        playerRef.current.style.height = ""
                        playerRef.current.style.display = ""
                        playerRef.current.style.flexDirection = ""
                    }

                    if (videoRef.current) {
                        videoRef.current.style.objectFit = ""
                        videoRef.current.style.height = ""
                        videoRef.current.style.maxHeight = ""
                    }

                    // Force a layout recalculation
                    if (playerRef.current) {
                        const currentDisplay = playerRef.current.style.display
                        playerRef.current.style.display = "none"
                        void playerRef.current.offsetHeight // Force reflow
                        playerRef.current.style.display = currentDisplay
                    }
                }, 100)
            }
        }

        document.addEventListener("fullscreenchange", handleFullscreenChange)
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
        document.addEventListener("mozfullscreenchange", handleFullscreenChange)
        document.addEventListener("MSFullscreenChange", handleFullscreenChange)

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange)
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
            document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
            document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
        }
    }, [isMobile, showControlsTemporarily])

    // Early return if no media
    if (!media || media.length === 0) return null

    // Count media types
    const imageCount = media.filter((item) => item.type === "IMAGE").length
    const videoCount = media.filter((item) => item.type === "VIDEO").length
    const audioCount = media.filter((item) => item.type === "MUSIC").length

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (playerRef.current) {
                try {
                    if (playerRef.current.requestFullscreen) {
                        void playerRef.current.requestFullscreen()
                    } else if (playerRef.current.webkitRequestFullscreen) {
                        void playerRef.current.webkitRequestFullscreen()
                    } else if (playerRef.current.msRequestFullscreen) {
                        void playerRef.current.msRequestFullscreen()
                    }
                    setIsFullscreen(true)
                } catch (err) {
                    console.error(`Error attempting to enable fullscreen: ${err instanceof Error ? err.message : String(err)}`)
                }
            }
        } else {
            try {
                if (document.exitFullscreen) {
                    void document.exitFullscreen()
                } else if ((document as DocumentWithFullscreen).webkitExitFullscreen) {
                    void (document as DocumentWithFullscreen).webkitExitFullscreen?.()
                } else if ((document as DocumentWithFullscreen).msExitFullscreen) {
                    void (document as DocumentWithFullscreen).msExitFullscreen?.()
                }
                setIsFullscreen(false)
            } catch (err) {
                console.error(`Error attempting to exit fullscreen: ${err instanceof Error ? err.message : String(err)}`)
            }
        }
    }

    const toggleMiniPlayer = () => {
        if (currentMedia && (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC")) {
            if (isMiniPlayerActive) {
                hideMiniPlayer()
            } else {
                showMiniPlayer(currentMedia)
            }
        }
    }

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0] ?? 1
        setVolume(newVolume)

        if (currentMedia?.type === "MUSIC" && audioRef.current) {
            audioRef.current.volume = newVolume
        } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
            videoRef.current.volume = newVolume
        }
    }

    const handleProgressChange = (value: number[]) => {
        const newProgress = value[0] ?? 0
        setProgress(newProgress)

        if (currentMedia?.type === "MUSIC" && audioRef.current && duration > 0) {
            audioRef.current.currentTime = (newProgress / 100) * duration
        } else if (currentMedia?.type === "VIDEO" && videoRef.current && duration > 0) {
            videoRef.current.currentTime = (newProgress / 100) * duration
        }
    }

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
        const mediaElement = e.currentTarget
        if (mediaElement && mediaElement.duration) {
            const newProgress = (mediaElement.currentTime / mediaElement.duration) * 100
            setProgress(newProgress)
        }
    }

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
        const mediaElement = e.currentTarget
        if (mediaElement) {
            setDuration(mediaElement.duration)
        }
    }

    const handleMediaEnded = () => {
        if (isRepeating) {
            if (currentMedia?.type === "MUSIC" && audioRef.current) {
                audioRef.current.currentTime = 0
                void audioRef.current.play().catch((err) => console.error("Error replaying audio:", err))
            } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
                videoRef.current.currentTime = 0
                void videoRef.current.play().catch((err) => console.error("Error replaying video:", err))
            }
        } else {
            // Set both local and global playing states to false when media ends
            setLocalIsPlaying(false)
            setIsPlaying(false)

            // Don't call handleNext() here, as it might be causing state conflicts
            // Instead, just move to the next track without auto-playing
            const nextIndex = (currentIndex + 1) % filteredMedia.length
            setCurrentIndex(nextIndex)
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`
    }

    return (
        <div
            ref={playerRef}
            className={cn(
                "relative overflow-hidden rounded-lg bg-black",
                isFullscreen ? "fixed inset-0 z-50 rounded-none flex flex-col h-screen" : "",
            )}
            onMouseMove={showControlsTemporarily}
            onClick={() => {
                if (currentMedia && (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") && !isMiniPlayerActive) {
                    togglePlay()
                }
            }}
        >
            {/* Media Type Filtering Tabs - only show if there's a mix of media types */}
            {(imageCount > 0 && (videoCount > 0 || audioCount > 0)) || (videoCount > 0 && videoCount > 0) ? (
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-2 ">
                    <Tabs
                        value={activeMediaType}
                        onValueChange={(value: string) => {
                            setActiveMediaType(value as ActiveMediaEnum)
                            setCurrentIndex(0)
                        }}
                        className="w-full"
                    >
                        <TabsList className="grid grid-cols-4 w-full bg-black/50 backdrop-blur-sm text-xs sm:text-sm">
                            <TabsTrigger
                                value={ActiveMediaEnum.ALL}
                                className="data-[state=active]:bg-white/20 data-[state=active]:text-white"
                            >
                                All ({media.length})
                            </TabsTrigger>
                            {imageCount > 0 && (
                                <TabsTrigger
                                    value={ActiveMediaEnum.IMAGE}
                                    className="flex items-center gap-0.5 sm:gap-1 data-[state=active]:bg-white/20 data-[state=active]:text-white"
                                >
                                    <ImageIcon className="w-3 h-3" /> <span className="hidden xs:inline">Images</span> ({imageCount})
                                </TabsTrigger>
                            )}
                            {videoCount > 0 && (
                                <TabsTrigger
                                    value={ActiveMediaEnum.VIDEO}
                                    className="flex items-center gap-0.5 sm:gap-1 data-[state=active]:bg-white/20 data-[state=active]:text-white"
                                >
                                    <Film className="w-3 h-3" /> <span className="hidden xs:inline">Videos</span> ({videoCount})
                                </TabsTrigger>
                            )}
                            {audioCount > 0 && (
                                <TabsTrigger
                                    value={ActiveMediaEnum.MUSIC}
                                    className="flex items-center gap-0.5 sm:gap-1 data-[state=active]:bg-white/20 data-[state=active]:text-white"
                                >
                                    <Music className="w-3 h-3" /> <span className="hidden xs:inline">Audio</span> ({audioCount})
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>
                </div>
            ) : null}

            {/* Main media display */}
            <div
                className={cn(
                    "relative  bg-black ",
                    isFullscreen
                        ? "flex-grow flex items-center justify-center"
                        : "aspect-video h-[500px] md:h-full md:w-full w-[90vw]",
                )}
            >
                <AnimatePresence mode="wait">
                    {currentMedia && (
                        <motion.div
                            key={currentMedia.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full"
                        >
                            {currentMedia.type === "IMAGE" && (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={currentMedia.url ?? "/placeholder.svg?height=720&width=1280"}
                                        alt={currentMedia.title ?? "Image"}
                                        fill
                                        className="object-contain"
                                        priority
                                    />
                                </div>
                            )}

                            {currentMedia.type === "VIDEO" && !isMiniPlayerActive && (
                                <video
                                    ref={videoRef}
                                    src={currentMedia.url}
                                    className={cn(
                                        "object-contain",
                                        isFullscreen && isMobile ? "w-full h-full max-h-screen" : "w-full h-full",
                                    )}
                                    playsInline
                                    loop={isRepeating}
                                    muted={isMuted}
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onEnded={handleMediaEnded}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        togglePlay()
                                    }}
                                />
                            )}

                            {currentMedia.type === "MUSIC" && !isMiniPlayerActive && (
                                <div
                                    className={cn(
                                        "w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-black p-8",
                                        isFullscreen ? "flex-grow" : "",
                                    )}
                                >
                                    <div className="relative w-40 h-40 sm:w-64 sm:h-64 mb-4 sm:mb-8">
                                        <motion.div
                                            animate={{ rotate: localIsPlaying ? 360 : 0 }}
                                            transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                            className="w-full h-full rounded-full overflow-hidden border-4 border-white/20"
                                        >
                                            <Image
                                                src={currentMedia.thumbnail ?? "/images/logo.png"}
                                                alt={currentMedia.title ?? "Album Art"}
                                                fill
                                                className="object-cover flex items-center justify-center h-full w-full"
                                            />
                                        </motion.div>
                                    </div>
                                    <div className="text-center text-white">
                                        <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
                                            {currentMedia.title ?? "Unknown Track"}
                                        </h3>
                                        <p className="text-base sm:text-lg text-white/70">{currentMedia.artist ?? "Unknown Artist"}</p>
                                    </div>
                                    <audio
                                        ref={audioRef}
                                        src={currentMedia.url}
                                        muted={isMuted}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onEnded={handleMediaEnded}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Mini-player active overlay */}
                            {isMiniPlayerActive && (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                                    <div className="text-white text-center p-6 rounded-lg bg-black/50 backdrop-blur-sm">
                                        <h3 className="text-xl font-bold mb-2">{currentMedia.title ?? "Now Playing"}</h3>
                                        <p className="mb-4">Playing in mini-player mode</p>
                                        <Button
                                            variant="outline"
                                            onClick={hideMiniPlayer}
                                            className="border-white text-white hover:bg-white/20"
                                        >
                                            Return to main player
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation arrows */}
                {filteredMedia.length > 1 && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white bg-black/30 hover:bg-black/50 rounded-full transition-opacity duration-300",
                                showControls ? "opacity-100" : "opacity-0",
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                handlePrev()
                            }}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white bg-black/30 hover:bg-black/50 rounded-full transition-opacity duration-300",
                                showControls ? "opacity-100" : "opacity-0",
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleNext()
                            }}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </>
                )}

                {/* Controls overlay */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 sm:p-4 transition-opacity duration-300",
                        showControls ? "opacity-100" : "opacity-0",
                        isFullscreen && isMobile ? "pb-6" : "",
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Progress bar */}
                    {currentMedia && (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") && !isMiniPlayerActive && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-xs text-white mb-1">
                                <span>{formatTime((progress / 100) * duration)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <Slider
                                value={[progress]}
                                min={0}
                                max={100}
                                step={0.1}
                                onValueChange={handleProgressChange}
                                className="w-full [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/30 [&_[role=slider]]:bg-white [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-white [&_[role=slider]:focus-visible]:ring-0 [&_[role=slider]:focus-visible]:ring-offset-0 [&_[role=slider]:focus-visible]:scale-105 [&_[role=slider]:focus-visible]:transition-transform"
                            />
                        </div>
                    )}

                    {/* Control buttons */}
                    <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1 sm:gap-2">
                            {currentMedia &&
                                (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") &&
                                !isMiniPlayerActive && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full"
                                            onClick={toggleShuffle}
                                        >
                                            <Shuffle className={cn("h-5 w-5", isShuffled ? "text-primary" : "text-white")} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full"
                                            onClick={handlePrev}
                                        >
                                            <SkipBack className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full w-10 h-10 sm:w-12 sm:h-12"
                                            onClick={togglePlay}
                                        >
                                            {localIsPlaying ? (
                                                <Pause className="h-5 w-5 sm:h-6 sm:w-6" />
                                            ) : (
                                                <Play className="h-5 w-5 sm:h-6 sm:w-6" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full"
                                            onClick={handleNext}
                                        >
                                            <SkipForward className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full"
                                            onClick={toggleRepeat}
                                        >
                                            <Repeat className={cn("h-5 w-5", isRepeating ? "text-primary" : "text-white")} />
                                        </Button>
                                    </>
                                )}
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* Mini player button - only for audio and video content */}
                            {currentMedia &&
                                (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") &&
                                !isMiniPlayerActive && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/10 rounded-full"
                                        onClick={toggleMiniPlayer}
                                        title="Mini Player"
                                    >
                                        <Minimize2 className="h-5 w-5" />
                                    </Button>
                                )}

                            {currentMedia &&
                                (currentMedia.type === "VIDEO" || currentMedia.type === "MUSIC") &&
                                !isMiniPlayerActive && (
                                    <div className="flex items-center gap-1 sm:gap-2 w-24 sm:w-32">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10 rounded-full"
                                            onClick={toggleMute}
                                        >
                                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                        </Button>
                                        <Slider
                                            value={[volume]}
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            onValueChange={handleVolumeChange}
                                            className="w-20 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-white [&_[role=slider]:focus-visible]:ring-0 [&_[role=slider]:focus-visible]:ring-offset-0 [&_[role=slider]:focus-visible]:scale-105 [&_[role=slider]:focus-visible]:transition-transform"
                                        />
                                    </div>
                                )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/10 rounded-full"
                                onClick={toggleFullscreen}
                            >
                                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thumbnails */}
            {showThumbnails && filteredMedia.length > 1 && (
                <div className={cn("bg-black p-1 sm:p-2 overflow-x-auto", isFullscreen ? "w-full" : "")}>
                    <div className="flex gap-1 sm:gap-2 justify-center">
                        {filteredMedia.map((item, index) => (
                            <motion.div
                                key={item.id}
                                whileHover={{ scale: 1.05 }}
                                className={cn(
                                    "relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 cursor-pointer rounded overflow-hidden border-2",
                                    index === currentIndex ? "border-primary" : "border-transparent",
                                )}
                                onClick={() => setCurrentIndex(index)}
                            >
                                {item.type === "IMAGE" && (
                                    <Image
                                        src={item.url ?? "/placeholder.svg?height=80&width=80"}
                                        alt={item.title ?? `Thumbnail ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />
                                )}
                                {item.type === "VIDEO" && (
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={item.thumbnail ?? "/video-thumbnail-placeholder.jpg"}
                                            alt={item.title ?? `Thumbnail ${index + 1}`}
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Film className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                )}
                                {item.type === "MUSIC" && (
                                    <div className="relative w-full h-full bg-gradient-to-br from-purple-900 to-black flex items-center justify-center">
                                        <Music className="w-8 h-8 text-white" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}


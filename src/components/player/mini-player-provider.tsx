"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useEffect } from "react"
import AudioMiniPlayer from "./audio-mini-player"
import VideoMiniPlayer from "./video-mini-player"
import type { MediaType } from "@prisma/client"

export interface MediaItem {
    id: number
    url: string
    type: MediaType
    title?: string | null
    artist?: string | null
    thumbnail?: string | null
}

interface MiniPlayerContextType {
    showMiniPlayer: (media: MediaItem) => void
    hideMiniPlayer: () => void
    isPlaying: boolean
    setIsPlaying: (isPlaying: boolean) => void
    togglePlay: () => void
    progress: number
    duration: number
    setProgress: (progress: number) => void
    setDuration: (duration: number) => void
    handlePrev: () => void
    handleNext: () => void
    currentMedia: MediaItem | null
    volume: number
    isMuted: boolean
    toggleMute: () => void
    setIsMuted: (isMuted: boolean) => void
    setVolume: (volume: number) => void
    isShuffled: boolean
    isRepeating: boolean
    toggleShuffle: () => void
    toggleRepeat: () => void
    isMiniPlayerActive: boolean
}

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null)

export const useMiniPlayer = () => {
    const context = useContext(MiniPlayerContext)
    if (!context) {
        throw new Error("useMiniPlayer must be used within a MiniPlayerProvider")
    }
    return context
}

export const MiniPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null)
    const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [volume, setVolume] = useState(1)
    const [isShuffled, setIsShuffled] = useState(false)
    const [isRepeating, setIsRepeating] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const showMiniPlayer = (media: MediaItem) => {
        if (media.type !== "MUSIC" && media.type !== "VIDEO") return

        // Clean up existing media before showing new one
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }

        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current = null
        }

        setCurrentMedia(media)
        setIsMiniPlayerActive(true)

        // Reset progress when showing a new media
        setProgress(0)
        setDuration(0)

        // Auto-play when showing mini-player
        setIsPlaying(true)
    }

    const hideMiniPlayer = () => {
        setIsMiniPlayerActive(false)
        setIsPlaying(false)

        if (audioRef.current) {
            audioRef.current.pause()
        }

        if (videoRef.current) {
            videoRef.current.pause()
        }

        // Clear current media after a short delay to allow for smooth animations
        setTimeout(() => {
            setCurrentMedia(null)
        }, 300)
    }

    const togglePlay = () => {
        if (!currentMedia) return

        const newIsPlaying = !isPlaying
        setIsPlaying(newIsPlaying)

        if (currentMedia.type === "MUSIC" && audioRef.current) {
            if (newIsPlaying) {
                audioRef.current.play().catch((err) => {
                    console.error("Error playing audio:", err)
                    setIsPlaying(false)
                })
            } else {
                audioRef.current.pause()
            }
        } else if (currentMedia.type === "VIDEO" && videoRef.current) {
            if (newIsPlaying) {
                videoRef.current.play().catch((err) => {
                    console.error("Error playing video:", err)
                    setIsPlaying(false)
                })
            } else {
                videoRef.current.pause()
            }
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

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0] ?? 1
        setVolume(newVolume)

        if (currentMedia?.type === "MUSIC" && audioRef.current) {
            audioRef.current.volume = newVolume
        } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
            videoRef.current.volume = newVolume
        }

        setIsMuted(newVolume === 0)
    }

    const toggleMute = () => {
        const newIsMuted = !isMuted
        setIsMuted(newIsMuted)

        if (currentMedia?.type === "MUSIC" && audioRef.current) {
            audioRef.current.muted = newIsMuted
        } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
            videoRef.current.muted = newIsMuted
        }
    }

    const handlePrev = () => {
        // This would be implemented by the parent component
        console.log("Previous track")
    }

    const handleNext = () => {
        // This would be implemented by the parent component
        console.log("Next track")
    }

    const toggleShuffle = () => {
        setIsShuffled(!isShuffled)
    }

    const toggleRepeat = () => {
        setIsRepeating(!isRepeating)
    }

    const handleTimeUpdate = (mediaElement: HTMLAudioElement | HTMLVideoElement) => {
        const newProgress = mediaElement.duration ? (mediaElement.currentTime / mediaElement.duration) * 100 : 0
        setProgress(newProgress)
    }

    const handleLoadedMetadata = (mediaElement: HTMLAudioElement | HTMLVideoElement) => {
        setDuration(mediaElement.duration)
    }

    const handleMediaEnded = () => {
        if (isRepeating) {
            if (currentMedia?.type === "MUSIC" && audioRef.current) {
                audioRef.current.currentTime = 0
                audioRef.current.play().catch((err) => console.error("Error replaying audio:", err))
            } else if (currentMedia?.type === "VIDEO" && videoRef.current) {
                videoRef.current.currentTime = 0
                videoRef.current.play().catch((err) => console.error("Error replaying video:", err))
            }
        } else {
            handleNext()
        }
    }

    const handleFullscreen = () => {
        if (videoRef.current) {
            if (!document.fullscreenElement) {
                videoRef.current.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable fullscreen: ${err}`)
                })
            } else {
                document.exitFullscreen()
            }
        }
    }

    // Create and cleanup audio element
    useEffect(() => {
        if (!currentMedia || currentMedia.type !== "MUSIC" || !isMiniPlayerActive) return

        const audio = new Audio(currentMedia.url)
        audio.volume = volume
        audio.muted = isMuted
        audioRef.current = audio

        const handleAudioTimeUpdate = () => handleTimeUpdate(audio)
        const handleAudioLoadedMetadata = () => handleLoadedMetadata(audio)
        const handleAudioMediaEnded = () => handleMediaEnded()

        audio.addEventListener("timeupdate", handleAudioTimeUpdate)
        audio.addEventListener("loadedmetadata", handleAudioLoadedMetadata)
        audio.addEventListener("ended", handleAudioMediaEnded)

        if (isPlaying) {
            audio.play().catch((err) => {
                console.error("Error playing audio:", err)
                setIsPlaying(false)
            })
        }

        return () => {
            audio.pause()
            audio.removeEventListener("timeupdate", handleAudioTimeUpdate)
            audio.removeEventListener("loadedmetadata", handleAudioLoadedMetadata)
            audio.removeEventListener("ended", handleAudioMediaEnded)
            audioRef.current = null
        }
    }, [currentMedia, isPlaying, volume, isMuted, isRepeating, isMiniPlayerActive])

    // Handle video reference
    const setVideoRef = (element: HTMLVideoElement | null) => {
        if (element && currentMedia?.type === "VIDEO" && isMiniPlayerActive) {
            videoRef.current = element
            element.volume = volume
            element.muted = isMuted

            if (isPlaying) {
                element.play().catch((err) => {
                    console.error("Error playing video:", err)
                    setIsPlaying(false)
                })
            }
        }
    }

    return (
        <MiniPlayerContext.Provider
            value={{
                showMiniPlayer,
                hideMiniPlayer,
                isPlaying,
                setIsPlaying,
                togglePlay,
                progress,
                duration,
                setProgress,
                setDuration,
                handlePrev,
                handleNext,
                currentMedia,
                volume,
                isMuted,
                toggleMute,
                setIsMuted,
                setVolume,
                isShuffled,
                isRepeating,
                toggleShuffle,
                toggleRepeat,
                isMiniPlayerActive,
            }}
        >
            {children}

            {isMiniPlayerActive && currentMedia && currentMedia.type === "MUSIC" && (
                <AudioMiniPlayer
                    media={currentMedia}
                    isPlaying={isPlaying}
                    progress={progress}
                    duration={duration}
                    isMuted={isMuted}
                    isShuffled={isShuffled}
                    isRepeating={isRepeating}
                    onTogglePlay={togglePlay}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onProgressChange={handleProgressChange}
                    onToggleShuffle={toggleShuffle}
                    onToggleRepeat={toggleRepeat}
                    onClose={hideMiniPlayer}
                    onExpand={() => setIsMiniPlayerActive(false)}
                    audioElement={audioRef.current}
                />
            )}

            {isMiniPlayerActive && currentMedia && currentMedia.type === "VIDEO" && (
                <VideoMiniPlayer
                    media={currentMedia}
                    isPlaying={isPlaying}
                    progress={progress}
                    duration={duration}
                    isMuted={isMuted}
                    volume={volume}
                    onTogglePlay={togglePlay}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onProgressChange={handleProgressChange}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={toggleMute}
                    onClose={hideMiniPlayer}
                    onExpand={() => setIsMiniPlayerActive(false)}
                    onFullscreen={handleFullscreen}
                    videoRef={setVideoRef}
                    onTimeUpdate={(time) => setProgress((time / duration) * 100)}
                    onDurationChange={setDuration}
                />
            )}
        </MiniPlayerContext.Provider>
    )
}


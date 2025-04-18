"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Slider } from "~/components/shadcn/ui/slider"
import { cn } from "~/lib/utils"
import { JsonValue } from "@prisma/client/runtime/library"
import { Theme } from "~/types/organization/dashboard"

interface MusicPlayerWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample tracks
const SAMPLE_TRACKS = [
    {
        id: "track-1",
        title: "Cosmic Dreams",
        artist: "Alex Rivera",
        duration: 217, // in seconds
        coverArt: "/placeholder.svg?height=300&width=300",
        audioSrc: "#", // In a real app, this would be a path to an audio file
    },
    {
        id: "track-2",
        title: "Digital Horizon",
        artist: "Alex Rivera",
        duration: 184,
        coverArt: "/placeholder.svg?height=300&width=300",
        audioSrc: "#",
    },
    {
        id: "track-3",
        title: "Neon Memories",
        artist: "Alex Rivera",
        duration: 243,
        coverArt: "/placeholder.svg?height=300&width=300",
        audioSrc: "#",
    },
]

export default function MusicPlayerWidget({ editMode, theme }: MusicPlayerWidgetProps) {
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [volume, setVolume] = useState(0.8)
    const [isMuted, setIsMuted] = useState(false)
    const [showPlaylist, setShowPlaylist] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const currentTrack = SAMPLE_TRACKS[currentTrackIndex]

    // Format time in MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    // Handle play/pause
    const togglePlayPause = () => {
        if (isPlaying) {
            audioRef.current?.pause()
        } else {
            audioRef.current?.play()
        }
        setIsPlaying(!isPlaying)
    }

    // Handle track change
    const changeTrack = (index: number) => {
        setCurrentTrackIndex(index)
        setCurrentTime(0)
        setIsPlaying(true)
        // In a real app, we would load the new track here
    }

    // Handle next track
    const nextTrack = () => {
        const nextIndex = (currentTrackIndex + 1) % SAMPLE_TRACKS.length
        changeTrack(nextIndex)
    }

    // Handle previous track
    const prevTrack = () => {
        const prevIndex = (currentTrackIndex - 1 + SAMPLE_TRACKS.length) % SAMPLE_TRACKS.length
        changeTrack(prevIndex)
    }

    // Handle seek
    const handleSeek = (value: number[]) => {
        setCurrentTime(value[0] ?? 0)
        if (audioRef.current) {
            audioRef.current.currentTime = value[0] ?? 0
        }
    }

    // Handle volume change
    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0]
        setVolume(newVolume ?? volume)
        if (audioRef.current) {
            audioRef.current.volume = newVolume ?? volume
        }
        if (newVolume === 0) {
            setIsMuted(true)
        } else {
            setIsMuted(false)
        }
    }

    // Toggle mute
    const toggleMute = () => {
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume
                setIsMuted(false)
            } else {
                audioRef.current.volume = 0
                setIsMuted(true)
            }
        }
    }

    // Simulate time progress
    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setCurrentTime((prevTime) => {
                    if (currentTrack && prevTime >= currentTrack.duration) {
                        nextTrack()
                        return 0
                    }
                    return prevTime + 1
                })
            }, 1000)
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isPlaying, currentTrackIndex])

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center mb-4">
                <h3 className="text-lg font-bold"
                // style={{ fontFamily: theme?.font?.heading || "inherit" }}
                >
                    Music Player
                </h3>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowPlaylist(!showPlaylist)}>
                    {showPlaylist ? "Hide Playlist" : "Show Playlist"}
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 flex-1">
                {/* Album Art and Controls */}
                <div className="flex flex-col items-center md:w-1/2">
                    <div className="relative aspect-square w-full max-w-[200px] mb-4 rounded-md overflow-hidden shadow-lg">
                        <Image
                            src={currentTrack?.coverArt ?? "/placeholder.svg"}
                            alt={`${currentTrack?.title} cover art`}
                            fill
                            className="object-cover"
                        />
                    </div>

                    <div className="w-full max-w-[200px]">
                        <div className="text-center mb-2">
                            <h4 className="font-bold truncate">{currentTrack?.title}</h4>
                            <p className="text-sm text-muted-foreground">{currentTrack?.artist}</p>
                        </div>

                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs">{formatTime(currentTime)}</span>
                            <Slider
                                value={[currentTime]}
                                max={currentTrack?.duration}
                                step={1}
                                onValueChange={handleSeek}
                                className="mx-2 flex-1"
                            />
                            <span className="text-xs">{formatTime(currentTrack?.duration ?? 0)}</span>
                        </div>

                        <div className="flex justify-center items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={prevTrack}>
                                <SkipBack className="h-5 w-5" />
                            </Button>
                            <Button variant="default" size="icon" className="h-10 w-10 rounded-full" onClick={togglePlayPause}>
                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={nextTrack}>
                                <SkipForward className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="flex items-center mt-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </Button>
                            <Slider
                                value={[isMuted ? 0 : volume]}
                                max={1}
                                step={0.01}
                                onValueChange={handleVolumeChange}
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Playlist */}
                {showPlaylist && (
                    <div className="md:w-1/2 overflow-auto">
                        <h4 className="font-medium mb-2">Playlist</h4>
                        <div className="space-y-2">
                            {SAMPLE_TRACKS.map((track, index) => (
                                <div
                                    key={track.id}
                                    className={cn(
                                        "flex items-center p-2 rounded-md cursor-pointer hover:bg-muted/50",
                                        currentTrackIndex === index && "bg-muted",
                                    )}
                                    onClick={() => changeTrack(index)}
                                >
                                    <div className="relative h-10 w-10 rounded overflow-hidden mr-3">
                                        <Image src={track.coverArt || "/placeholder.svg"} alt={track.title} fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{track.title}</p>
                                        <p className="text-xs text-muted-foreground">{track.artist}</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-2">{formatTime(track.duration)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden audio element for a real implementation */}
            <audio ref={audioRef} className="hidden" />
        </div>
    )
}

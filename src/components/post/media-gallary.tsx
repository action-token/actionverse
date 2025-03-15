"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTrigger } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { ChevronLeft, ChevronRight, X, Volume2, VolumeX, Music, ImageIcon, Film } from "lucide-react"
import { cn } from "~/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Media } from "@prisma/client"

interface MediaGalleryProps {
    media: Media[]
}
enum ActiveMediaEnum {
    ALL,
    IMAGE,
    MUSIC,
    VIDEO
}
export default function MediaGallery({ media }: MediaGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [activeMediaType, setActiveMediaType] = useState<ActiveMediaEnum>(ActiveMediaEnum.ALL)
    const [isMuted, setIsMuted] = useState(false)

    if (!media || media.length === 0) return null

    // Count media types
    const imageCount = media.filter((item) => item.type === "IMAGE").length
    const videoCount = media.filter((item) => item.type === "MUSIC").length
    const audioCount = media.filter((item) => item.type === "VIDEO").length

    // Filter media by selected type
    const filteredMedia = activeMediaType === ActiveMediaEnum.ALL ? media : media.filter((item) => {
        const mediaTypeEnum = ActiveMediaEnum[item.type.toUpperCase() as keyof typeof ActiveMediaEnum]
        return activeMediaType === mediaTypeEnum
    })

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? filteredMedia.length - 1 : prev - 1))
    }

    const handleNext = () => {
        setCurrentIndex((prev) => (prev === filteredMedia.length - 1 ? 0 : prev + 1))
    }

    const toggleMute = () => {
        setIsMuted(!isMuted)
    }

    // Show an appropriate layout based on number of items
    // Single media item
    if (media.length === 1) {
        return media[0] ? <SingleMediaItem item={media[0]} /> : null
    }

    // Two media items
    if (media.length === 2) {
        return (
            <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                {media.map((item, index) => (
                    <Dialog key={index}>
                        <DialogTrigger asChild>
                            <div className="relative cursor-pointer overflow-hidden">
                                <SingleMediaItem item={item} isInGrid />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl p-0 bg-black  [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                            <div className="relative">

                                <SingleMediaItem item={item} isFullscreen />
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        )
    }

    // 3-4 media items
    if (media.length <= 4) {
        return (
            <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                {media.map((item, index) => (
                    <Dialog key={index}>
                        <DialogTrigger asChild>
                            <div className="relative cursor-pointer overflow-hidden">
                                <SingleMediaItem item={item} isInGrid />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl p-0 bg-black  [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                            <div className="relative">

                                <SingleMediaItem item={item} isFullscreen />
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        )
    }

    // More than 4 items - more complex layout with filtering
    return (
        <div className="space-y-3">
            {/* Media Type Filtering Tabs - only show if there's a mix of media types */}
            {(imageCount > 0 && (videoCount > 0 || audioCount > 0)) || (videoCount > 0 && audioCount > 0) ? (
                <Tabs
                    value={activeMediaType.toString()}
                    onValueChange={(value: string) => {
                        setActiveMediaType(ActiveMediaEnum[value.toUpperCase() as keyof typeof ActiveMediaEnum])
                        setCurrentIndex(0)
                    }}
                    className="w-full"
                >
                    <TabsList className="grid grid-cols-4 w-full">
                        <TabsTrigger value="all">All ({media.length})</TabsTrigger>
                        {imageCount > 0 && (
                            <TabsTrigger value="image" className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Images ({imageCount})
                            </TabsTrigger>
                        )}
                        {videoCount > 0 && (
                            <TabsTrigger value="video" className="flex items-center gap-1">
                                <Film className="w-3 h-3" /> Videos ({videoCount})
                            </TabsTrigger>
                        )}
                        {audioCount > 0 && (
                            <TabsTrigger value="audio" className="flex items-center gap-1">
                                <Music className="w-3 h-3" /> Audio ({audioCount})
                            </TabsTrigger>
                        )}
                    </TabsList>
                </Tabs>
            ) : null}

            {/* Main media display */}
            <Dialog>
                <DialogTrigger asChild>
                    <div className="relative cursor-pointer rounded-lg overflow-hidden">
                        {filteredMedia[0] && <SingleMediaItem item={filteredMedia[0]} />}
                    </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 bg-black  [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                    <div className="relative">
                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white bg-black/50 hover:bg-black/70"
                                onClick={toggleMute}
                            >
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </Button>

                        </div>
                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white bg-black/50 hover:bg-black/70"
                                onClick={handlePrev}
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            {filteredMedia[currentIndex] && (
                                <SingleMediaItem item={filteredMedia[currentIndex]} isFullscreen muted={isMuted} />
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white bg-black/50 hover:bg-black/70"
                                onClick={handleNext}
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                            {filteredMedia.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "w-2 h-2 rounded-full cursor-pointer",
                                        idx === currentIndex ? "bg-white" : "bg-white/50",
                                    )}
                                    onClick={() => setCurrentIndex(idx)}
                                />
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Grid preview for remaining media */}
            <div
                className={cn(
                    "gap-1 rounded-lg overflow-hidden",
                    filteredMedia.length >= 6 ? "grid grid-cols-3" : "grid grid-cols-2",
                )}
            >
                {filteredMedia.slice(1, 7).map((item, index) => (
                    <Dialog key={index}>
                        <DialogTrigger asChild>
                            <div className="relative cursor-pointer overflow-hidden">
                                <SingleMediaItem item={item} isInGrid />
                                {index === 5 && filteredMedia.length > 7 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="text-white font-bold text-xl">+{filteredMedia.length - 7}</span>
                                    </div>
                                )}
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl p-0 bg-black  [&>button]:border [&>button]:border-black [&>button]:bg-white [&>button]:text-black">
                            <div className="relative">

                                <SingleMediaItem item={item} isFullscreen />
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        </div>
    )
}

interface SingleMediaItemProps {
    item: Media
    isInGrid?: boolean
    isFullscreen?: boolean
    muted?: boolean
}

function SingleMediaItem({ item, isInGrid = false, isFullscreen = false, muted = true }: SingleMediaItemProps) {
    const [isPlaying, setIsPlaying] = useState(false)

    const handlePlay = () => {
        setIsPlaying(true)
    }

    const handlePause = () => {
        setIsPlaying(false)
    }

    if (item.type === "IMAGE") {
        return (
            <div
                className={cn("relative overflow-hidden", isInGrid ? "h-40" : isFullscreen ? "h-[80vh]" : "h-80 rounded-lg")}
            >
                <Image src={item.url || "/placeholder.svg"} alt="Media content" fill className="object-cover" />
            </div>
        )
    }

    if (item.type === "VIDEO") {
        return (
            <div
                className={cn("relative overflow-hidden", isInGrid ? "h-40" : isFullscreen ? "h-[80vh]" : "h-80 rounded-lg")}
            >
                <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    controls={!isInGrid}
                    autoPlay={isFullscreen}
                    loop
                    muted={muted}
                    onPlay={handlePlay}
                    onPause={handlePause}
                />
                {isInGrid && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                            <Film className="h-6 w-6 " />
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (item.type === "MUSIC") {

        return (
            <div
                className={cn(
                    "relative bg-gray-100 dark:bg-gray-800 flex items-center justify-center",
                    isInGrid ? "h-40" : isFullscreen ? "h-[80vh]" : "h-20 rounded-lg",
                )}
            >
                <div className="p-4 w-full">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                            <Music className="h-6 w-6 " />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm truncate">{`Audio Track ${item.id}`}</p>
                            {!isInGrid && (
                                <audio src={item.url} className="w-full mt-2" controls autoPlay={isFullscreen} loop muted={muted} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null
}


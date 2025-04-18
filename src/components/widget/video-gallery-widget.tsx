"use client"

import { useState } from "react"
import Image from "next/image"
import { Play, X } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card } from "~/components/shadcn/ui/card"
import { Theme } from "~/types/organization/dashboard"

interface VideoGalleryWidgetProps {
    editMode?: boolean
    theme?: Theme
}

// Sample videos
const VIDEOS = [
    {
        id: "video-1",
        title: "Cosmic Dreams - Official Music Video",
        thumbnail: "/placeholder.svg?height=300&width=500",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Example embed URL
        duration: "4:32",
        date: "2025-03-15",
    },
    {
        id: "video-2",
        title: "Digital Horizon - Live at Cosmic Arena",
        thumbnail: "/placeholder.svg?height=300&width=500",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "5:18",
        date: "2025-02-28",
    },
    {
        id: "video-3",
        title: "Neon Memories - Behind the Scenes",
        thumbnail: "/placeholder.svg?height=300&width=500",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "8:45",
        date: "2025-01-20",
    },
    {
        id: "video-4",
        title: "Quantum Fragment - Lyric Video",
        thumbnail: "/placeholder.svg?height=300&width=500",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: "3:56",
        date: "2024-12-10",
    },
]

export default function VideoGalleryWidget({ editMode, theme }: VideoGalleryWidgetProps) {
    const [activeVideo, setActiveVideo] = useState<string | null>(null)

    const selectedVideo = VIDEOS.find((video) => video.id === activeVideo)

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ fontFamily: theme?.font?.heading ?? "inherit" }}>
                    Videos
                </h3>
                <Button size="sm" variant="outline" asChild>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                        View All
                    </a>
                </Button>
            </div>

            {activeVideo ? (
                <div className="flex-1 flex flex-col">
                    <div className="relative aspect-video w-full mb-3">
                        <iframe
                            src={selectedVideo?.embedUrl}
                            title={selectedVideo?.title}
                            className="absolute inset-0 w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        ></iframe>
                    </div>
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-medium">{selectedVideo?.title}</h4>
                            <p className="text-sm text-muted-foreground">
                                {new Date(selectedVideo?.date ?? "").toLocaleDateString()}
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setActiveVideo(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {VIDEOS.map((video) => (
                            <Card
                                key={video.id}
                                className="overflow-hidden cursor-pointer"
                                onClick={() => setActiveVideo(video.id)}
                                style={{
                                    borderRadius: theme?.style?.borderRadius ? `${theme.style.borderRadius}px` : undefined,
                                    borderWidth: theme?.style?.borderWidth ? `${theme.style.borderWidth}px` : undefined,
                                }}
                            >
                                <div className="relative aspect-video">
                                    <Image src={video.thumbnail ?? "/placeholder.svg"} alt={video.title} fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Button variant="default" size="icon" className="rounded-full h-12 w-12">
                                            <Play className="h-6 w-6" />
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                        {video.duration}
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="font-medium line-clamp-1">{video.title}</h4>
                                    <p className="text-xs text-muted-foreground">{new Date(video.date).toLocaleDateString()}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

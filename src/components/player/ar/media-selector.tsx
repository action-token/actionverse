"use client"

import { ImageIcon, Video, Music, Box } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { MediaType } from "@prisma/client"


interface Media {
    type: MediaType
    url: string
    title?: string
}

interface MediaSelectorProps {
    medias: Media[]
    currentType: MediaType
    onSelect: (type: MediaType) => void
    className?: string
}

export function MediaSelector({ medias, currentType, onSelect, className = "" }: MediaSelectorProps) {
    const getIcon = (type: MediaType) => {
        switch (type) {
            case "THREE_D":
                return <Box className="w-4 h-4" />
            case "IMAGE":
                return <ImageIcon className="w-4 h-4" />
            case "VIDEO":
                return <Video className="w-4 h-4" />
            case "MUSIC":
                return <Music className="w-4 h-4" />
        }
    }

    const getLabel = (type: MediaType) => {
        switch (type) {
            case "THREE_D":
                return "3D Model"
            case "IMAGE":
                return "Image"
            case "VIDEO":
                return "Video"
            case "MUSIC":
                return "Audio"
        }
    }

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {medias.map((media) => (
                <Button
                    key={media.type}
                    onClick={() => onSelect(media.type)}
                    variant={currentType === media.type ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center gap-2 ${currentType === media.type
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "text-gray-300 border-gray-600 hover:bg-gray-800"
                        }`}
                >
                    {getIcon(media.type)}
                    <span>{getLabel(media.type)}</span>
                    {media.title && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                            {media.title.slice(0, 3)}
                        </Badge>
                    )}
                </Button>
            ))}
        </div>
    )
}

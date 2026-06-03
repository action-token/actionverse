"use client"

import { useState } from "react"
import Image from "next/image"
import { MediaType } from "@prisma/client"
import { Play, Music, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "~/components/shadcn/ui/dialog"

interface MediaItem {
  id: number
  url: string
  type: MediaType
}

interface MediaGridProps {
  medias: MediaItem[]
}

export function MediaGrid({ medias }: MediaGridProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  if (medias.length === 0) return null

  const openViewer = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const renderMediaThumb = (media: MediaItem, className: string, index: number) => {
    if (media.type === MediaType.IMAGE) {
      return (
        <button
          key={media.id}
          onClick={() => openViewer(index)}
          className={`relative overflow-hidden ${className}`}
        >
          <Image
            src={media.url}
            alt=""
            fill
            className="object-cover transition-transform hover:scale-105"
          />
        </button>
      )
    }
    if (media.type === MediaType.VIDEO) {
      return (
        <button
          key={media.id}
          onClick={() => openViewer(index)}
          className={`relative flex items-center justify-center overflow-hidden bg-muted ${className}`}
        >
          <video src={media.url} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </button>
      )
    }
    return (
      <button
        key={media.id}
        onClick={() => openViewer(index)}
        className={`relative flex items-center justify-center overflow-hidden bg-muted ${className}`}
      >
        <Music className="h-8 w-8 text-muted-foreground" />
      </button>
    )
  }

  const gridLayout = () => {
    if (medias.length === 1) {
      return (
        <div className="grid grid-cols-1">
          {renderMediaThumb(medias[0]!, "aspect-video w-full rounded-lg", 0)}
        </div>
      )
    }
    if (medias.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1">
          {medias.map((m, i) =>
            renderMediaThumb(m, "aspect-square rounded-lg", i),
          )}
        </div>
      )
    }
    if (medias.length === 3) {
      return (
        <div className="grid grid-cols-2 gap-1">
          {renderMediaThumb(
            medias[0]!,
            "col-span-2 aspect-video rounded-t-lg",
            0,
          )}
          {medias.slice(1).map((m, i) =>
            renderMediaThumb(
              m,
              `aspect-square ${i === 0 ? "rounded-bl-lg" : "rounded-br-lg"}`,
              i + 1,
            ),
          )}
        </div>
      )
    }

    // 4+ items: 2x2 grid with "+N more" overlay
    return (
      <div className="grid grid-cols-2 gap-1">
        {medias.slice(0, 4).map((m, i) => (
          <div key={m.id} className="relative">
            {renderMediaThumb(
              m,
              `aspect-square ${i === 0
                ? "rounded-tl-lg"
                : i === 1
                  ? "rounded-tr-lg"
                  : i === 2
                    ? "rounded-bl-lg"
                    : "rounded-br-lg"
              }`,
              i,
            )}
            {i === 3 && medias.length > 4 && (
              <button
                onClick={() => openViewer(3)}
                className="absolute inset-0 flex items-center justify-center rounded-br-lg bg-black/50"
              >
                <span className="text-xl font-bold text-white">
                  +{medias.length - 4}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  const currentMedia = medias[viewerIndex]

  return (
    <>
      {gridLayout()}

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[90vh] max-w-[90vw] p-0" showCloseButton={false}>
          <button
            onClick={() => setViewerOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {currentMedia?.type === MediaType.IMAGE && (
            <div className="relative flex h-[80vh] items-center justify-center">
              <Image
                src={currentMedia.url}
                alt=""
                fill
                className="object-contain"
              />
            </div>
          )}
          {currentMedia?.type === MediaType.VIDEO && (
            <video
              src={currentMedia.url}
              controls
              autoPlay
              className="max-h-[80vh] w-full"
            />
          )}
          {currentMedia?.type === MediaType.MUSIC && (
            <div className="flex flex-col items-center gap-4 p-8">
              <Music className="h-16 w-16 text-muted-foreground" />
              <audio src={currentMedia.url} controls autoPlay className="w-full" />
            </div>
          )}

          {/* Navigation */}
          {medias.length > 1 && (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {medias.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setViewerIndex(i)}
                  className={`h-2 w-2 rounded-full ${i === viewerIndex ? "bg-white" : "bg-white/50"
                    }`}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

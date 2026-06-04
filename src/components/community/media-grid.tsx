"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { MediaType } from "@prisma/client"
import {
  Play,
  Pause,
  Music,
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  Image as ImageIcon,
  Film,
} from "lucide-react"
import { Dialog, DialogContent } from "~/components/shadcn/ui/dialog"
import { Slider } from "~/components/shadcn/ui/slider"
import { cn } from "~/lib/utils"

interface MediaItem {
  id: number
  url: string
  type: MediaType
}

interface MediaGridProps {
  medias: MediaItem[]
}

function formatTime(seconds: number) {
  if (!isFinite(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function GridThumbnail({
  media,
  className,
  onClick,
  overlay,
}: {
  media: MediaItem
  className?: string
  onClick: () => void
  overlay?: React.ReactNode
}) {
  if (media.type === MediaType.IMAGE) {
    return (
      <button
        onClick={onClick}
        className={cn("group relative overflow-hidden bg-muted", className)}
      >
        <Image
          src={media.url}
          alt=""
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {overlay}
      </button>
    )
  }

  if (media.type === MediaType.VIDEO) {
    return (
      <button
        onClick={onClick}
        className={cn("group relative overflow-hidden bg-black", className)}
      >
        <video
          src={media.url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <Play className="ml-0.5 h-4 w-4 text-black" />
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white">
            <Film className="h-2.5 w-2.5" />
          </span>
        </div>
        {overlay}
      </button>
    )
  }

  // MUSIC thumbnail
  return (
    <button
      onClick={onClick}
      className={cn("group relative overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/5" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
          <Music className="h-5 w-5 text-primary" />
        </div>
        <span className="text-[10px] font-medium text-primary/70">Audio</span>
      </div>
      {overlay}
    </button>
  )
}

function FullscreenViewer({
  medias,
  open,
  onOpenChange,
  index,
  onIndexChange,
}: {
  medias: MediaItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  index: number
  onIndexChange: (index: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioTime, setAudioTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)

  const current = medias[index]

  const goPrev = useCallback(() => {
    onIndexChange((index - 1 + medias.length) % medias.length)
  }, [index, medias.length, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % medias.length)
  }, [index, medias.length, onIndexChange])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      else if (e.key === "ArrowRight") goNext()
      else if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, goPrev, goNext, onOpenChange])

  useEffect(() => {
    setAudioPlaying(false)
    setAudioTime(0)
    setAudioDuration(0)
  }, [index])

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[95vh] max-w-[95vw] flex-col gap-0 border-0 bg-black/95 p-0"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-white/70">
            {index + 1} / {medias.length}
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {medias.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-2 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {current.type === MediaType.IMAGE && (
            <div className="relative h-full w-full">
              <Image
                src={current.url}
                alt=""
                fill
                className="object-contain"
                sizes="95vw"
              />
            </div>
          )}

          {current.type === MediaType.VIDEO && (
            <video
              ref={videoRef}
              key={current.id}
              src={current.url}
              controls
              autoPlay
              className="max-h-full max-w-full"
            />
          )}

          {current.type === MediaType.MUSIC && (
            <div className="flex w-full max-w-md flex-col items-center gap-6 px-6">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                <Music className="h-16 w-16 text-primary" />
              </div>
              <audio
                ref={audioRef}
                key={current.id}
                src={current.url}
                preload="metadata"
                onTimeUpdate={() => setAudioTime(audioRef.current?.currentTime ?? 0)}
                onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration ?? 0)}
                onEnded={() => setAudioPlaying(false)}
              />
              <div className="flex w-full flex-col gap-2">
                <Slider
                  value={[audioTime]}
                  max={audioDuration || 100}
                  step={0.1}
                  onValueChange={(val) => {
                    if (!audioRef.current || !val[0]) return
                    audioRef.current.currentTime = val[0]
                    setAudioTime(val[0])
                  }}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-white/50">
                  <span>{formatTime(audioTime)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!audioRef.current) return
                    audioRef.current.muted = !audioMuted
                    setAudioMuted(!audioMuted)
                  }}
                  className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {audioMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => {
                    if (!audioRef.current) return
                    if (audioPlaying) {
                      audioRef.current.pause()
                    } else {
                      void audioRef.current.play()
                    }
                    setAudioPlaying(!audioPlaying)
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                >
                  {audioPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="ml-1 h-6 w-6" />
                  )}
                </button>
                <div className="w-9" />
              </div>
            </div>
          )}
        </div>

        {medias.length > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
            {medias.map((m, i) => (
              <button
                key={m.id}
                onClick={() => onIndexChange(i)}
                className={cn(
                  "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                  i === index
                    ? "border-primary ring-1 ring-primary"
                    : "border-transparent opacity-50 hover:opacity-80",
                )}
              >
                {m.type === MediaType.IMAGE ? (
                  <Image src={m.url} alt="" fill className="object-cover" sizes="48px" />
                ) : m.type === MediaType.VIDEO ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Film className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function GalleryDialog({
  medias,
  open,
  onOpenChange,
  onItemClick,
}: {
  medias: MediaItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemClick: (index: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-sm font-semibold">
            All Media ({medias.length})
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {medias.map((media, index) => (
            <button
              key={media.id}
              onClick={() => onItemClick(index)}
              className="group relative aspect-square w-full overflow-hidden rounded-lg bg-muted"
            >
              {media.type === MediaType.IMAGE && (
                <Image
                  src={media.url}
                  alt=""
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="180px"
                />
              )}

              {media.type === MediaType.VIDEO && (
                <>
                  <video
                    src={media.url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                      <Play className="ml-0.5 h-3.5 w-3.5 text-black" />
                    </div>
                  </div>
                  <div className="absolute left-1.5 top-1.5">
                    <span className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-medium text-white">
                      <Film className="h-2 w-2" />
                    </span>
                  </div>
                </>
              )}

              {media.type === MediaType.MUSIC && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-primary/5" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                      <Music className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-[9px] font-medium text-primary/70">Audio</span>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function MediaGrid({ medias }: MediaGridProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)

  if (medias.length === 0) return null

  const openViewer = (index: number) => {
    setGalleryOpen(false)
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const count = medias.length
  const showOverflow = count > 5
  const gridItems = showOverflow ? medias.slice(0, 5) : medias
  const overflowCount = count - 4

  const renderItem = (media: MediaItem, index: number, className: string, isOverflow?: boolean) => {
    const overlay = isOverflow ? (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setGalleryOpen(true)
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      >
        <span className="text-lg font-bold text-white">+{overflowCount} more</span>
      </button>
    ) : undefined

    return (
      <GridThumbnail
        key={media.id}
        media={media}
        className={className}
        onClick={() => isOverflow ? setGalleryOpen(true) : openViewer(index)}
        overlay={overlay}
      />
    )
  }

  const renderGrid = () => {
    if (count === 1) {
      return renderItem(medias[0]!, 0, "aspect-video w-full rounded-xl")
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {renderItem(medias[0]!, 0, "aspect-[4/5] rounded-l-xl")}
          {renderItem(medias[1]!, 1, "aspect-[4/5] rounded-r-xl")}
        </div>
      )
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {renderItem(medias[0]!, 0, "row-span-2 aspect-auto h-full rounded-l-xl")}
          {renderItem(medias[1]!, 1, "aspect-square rounded-tr-xl")}
          {renderItem(medias[2]!, 2, "aspect-square rounded-br-xl")}
        </div>
      )
    }

    if (count === 4) {
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {renderItem(medias[0]!, 0, "aspect-square rounded-tl-xl")}
          {renderItem(medias[1]!, 1, "aspect-square rounded-tr-xl")}
          {renderItem(medias[2]!, 2, "aspect-square rounded-bl-xl")}
          {renderItem(medias[3]!, 3, "aspect-square rounded-br-xl")}
        </div>
      )
    }

    if (count === 5) {
      return (
        <div className="grid grid-cols-6 gap-1.5">
          {renderItem(medias[0]!, 0, "col-span-3 aspect-[4/3] rounded-tl-xl")}
          {renderItem(medias[1]!, 1, "col-span-3 aspect-[4/3] rounded-tr-xl")}
          {renderItem(medias[2]!, 2, "col-span-2 aspect-square rounded-bl-xl")}
          {renderItem(medias[3]!, 3, "col-span-2 aspect-square")}
          {renderItem(medias[4]!, 4, "col-span-2 aspect-square rounded-br-xl")}
        </div>
      )
    }

    // 6+ items: show 5, last one has overflow overlay
    return (
      <div className="grid grid-cols-6 gap-1.5">
        {renderItem(medias[0]!, 0, "col-span-3 aspect-[4/3] rounded-tl-xl")}
        {renderItem(medias[1]!, 1, "col-span-3 aspect-[4/3] rounded-tr-xl")}
        {renderItem(medias[2]!, 2, "col-span-2 aspect-square rounded-bl-xl")}
        {renderItem(medias[3]!, 3, "col-span-2 aspect-square")}
        {renderItem(medias[4]!, 4, "col-span-2 aspect-square rounded-br-xl", true)}
      </div>
    )
  }

  return (
    <>
      {renderGrid()}

      <FullscreenViewer
        medias={medias}
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open)
          if (!open) setGalleryOpen(false)
        }}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />

      <GalleryDialog
        medias={medias}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onItemClick={openViewer}
      />
    </>
  )
}

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

function InlineAudioPlayer({ media }: { media: MediaItem }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      void audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const seek = (val: number[]) => {
    if (!audioRef.current || !val[0]) return
    audioRef.current.currentTime = val[0]
    setCurrentTime(val[0])
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border bg-card p-3">
      <audio
        ref={audioRef}
        src={media.url}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={seek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  )
}

function InlineVideoPlayer({
  media,
  className,
  onOpenViewer,
}: {
  media: MediaItem
  className: string
  onOpenViewer: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
    } else {
      void videoRef.current.play()
    }
    setPlaying(!playing)
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.muted = !muted
    setMuted(!muted)
  }

  return (
    <div className={cn("group relative overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        src={media.url}
        className="h-full w-full object-cover"
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {/* Gradient overlay when not playing */}
      {!playing && (
        <div className="absolute inset-0 bg-black/30" />
      )}
      {/* Center play button */}
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!playing && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110">
            <Play className="ml-0.5 h-5 w-5 text-black" />
          </div>
        )}
      </button>
      {/* Bottom controls */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-2 transition-opacity",
        playing ? "opacity-0 group-hover:opacity-100" : "opacity-100",
      )}>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePlay}
            className="rounded-full p-1.5 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={toggleMute}
            className="rounded-full p-1.5 text-white hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (videoRef.current) videoRef.current.pause()
            onOpenViewer()
          }}
          className="rounded-full p-1.5 text-white hover:bg-white/20"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Type badge */}
      <div className="absolute left-2 top-2">
        <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          <Film className="h-2.5 w-2.5" /> Video
        </span>
      </div>
    </div>
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

  // Reset audio state when switching items
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
        {/* Top bar */}
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

        {/* Main content */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {/* Prev/Next arrows */}
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

        {/* Thumbnail strip */}
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

export function MediaGrid({ medias }: MediaGridProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  if (medias.length === 0) return null

  const images = medias.filter((m) => m.type === MediaType.IMAGE)
  const videos = medias.filter((m) => m.type === MediaType.VIDEO)
  const audios = medias.filter((m) => m.type === MediaType.MUSIC)
  const visualMedia = medias.filter((m) => m.type !== MediaType.MUSIC)

  const openViewer = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const renderImageThumb = (
    media: MediaItem,
    className: string,
    mediaIndex: number,
  ) => (
    <button
      key={media.id}
      onClick={() => openViewer(mediaIndex)}
      className={cn("group relative overflow-hidden", className)}
    >
      <Image
        src={media.url}
        alt=""
        fill
        className="object-cover transition-transform group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      <div className="absolute left-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          <ImageIcon className="h-2.5 w-2.5" />
        </span>
      </div>
    </button>
  )

  const renderVisualGrid = () => {
    if (visualMedia.length === 0) return null

    if (visualMedia.length === 1) {
      const m = visualMedia[0]!
      const idx = medias.indexOf(m)
      if (m.type === MediaType.VIDEO) {
        return (
          <InlineVideoPlayer
            media={m}
            className="aspect-video w-full rounded-xl"
            onOpenViewer={() => openViewer(idx)}
          />
        )
      }
      return renderImageThumb(m, "aspect-video w-full rounded-xl", idx)
    }

    if (visualMedia.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1">
          {visualMedia.map((m) => {
            const idx = medias.indexOf(m)
            if (m.type === MediaType.VIDEO) {
              return (
                <InlineVideoPlayer
                  key={m.id}
                  media={m}
                  className="aspect-square rounded-lg"
                  onOpenViewer={() => openViewer(idx)}
                />
              )
            }
            return renderImageThumb(m, "aspect-square rounded-lg", idx)
          })}
        </div>
      )
    }

    if (visualMedia.length === 3) {
      const first = visualMedia[0]!
      const firstIdx = medias.indexOf(first)
      return (
        <div className="grid grid-cols-2 gap-1">
          {first.type === MediaType.VIDEO ? (
            <InlineVideoPlayer
              key={first.id}
              media={first}
              className="col-span-2 aspect-video rounded-t-xl"
              onOpenViewer={() => openViewer(firstIdx)}
            />
          ) : (
            renderImageThumb(first, "col-span-2 aspect-video rounded-t-xl", firstIdx)
          )}
          {visualMedia.slice(1).map((m, i) => {
            const idx = medias.indexOf(m)
            const corner = i === 0 ? "rounded-bl-xl" : "rounded-br-xl"
            if (m.type === MediaType.VIDEO) {
              return (
                <InlineVideoPlayer
                  key={m.id}
                  media={m}
                  className={`aspect-square ${corner}`}
                  onOpenViewer={() => openViewer(idx)}
                />
              )
            }
            return renderImageThumb(m, `aspect-square ${corner}`, idx)
          })}
        </div>
      )
    }

    // 4+ visual items
    return (
      <div className="grid grid-cols-2 gap-1">
        {visualMedia.slice(0, 4).map((m, i) => {
          const idx = medias.indexOf(m)
          const corner =
            i === 0
              ? "rounded-tl-xl"
              : i === 1
                ? "rounded-tr-xl"
                : i === 2
                  ? "rounded-bl-xl"
                  : "rounded-br-xl"

          return (
            <div key={m.id} className="relative">
              {m.type === MediaType.VIDEO ? (
                <InlineVideoPlayer
                  media={m}
                  className={`aspect-square ${corner}`}
                  onOpenViewer={() => openViewer(idx)}
                />
              ) : (
                renderImageThumb(m, `aspect-square ${corner}`, idx)
              )}
              {i === 3 && visualMedia.length > 4 && (
                <button
                  onClick={() => openViewer(idx)}
                  className={`absolute inset-0 flex items-center justify-center bg-black/50 ${corner}`}
                >
                  <span className="text-xl font-bold text-white">
                    +{visualMedia.length - 4}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {renderVisualGrid()}
        {audios.map((m) => (
          <InlineAudioPlayer key={m.id} media={m} />
        ))}
      </div>

      <FullscreenViewer
        medias={medias}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </>
  )
}

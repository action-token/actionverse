"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { Button } from "~/components/shadcn/ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Maximize2,
  ImageIcon,
  Music,
  Video,
  FileText,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * ReportMediaViewer — renders a grid of media thumbnails and opens a full-screen
 * lightbox on click. Used as the **legacy fallback** for submissions whose
 * media[] rows pre-date the BountySubmissionCapture table.
 *
 * For NEW submissions (with captures[]), use SubmissionCapturesSection +
 * CaptureDetailDialog instead — they have the richer 3-layer validation
 * display and per-capture approve/reject UX.
 *
 * All colors come from globals.css tokens (no fixed white/black/opacity).
 */

interface MediaItem {
  id: number;
  url: string;
  type: string;
  fileName: string | null;
}

interface ReportMediaViewerProps {
  media: MediaItem[];
  className?: string;
}

export function ReportMediaViewer({ media, className }: ReportMediaViewerProps) {
  const [selected, setSelected] = useState<MediaItem | null>(null);

  if (!media.length) return null;

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex flex-wrap gap-2">
          {media.map((item) => (
            <MediaThumbnail
              key={item.id}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      </div>

      <MediaLightbox
        item={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function MediaThumbnail({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    IMAGE: ImageIcon,
    VIDEO: Video,
    MUSIC: Music,
    AUDIO: Music,
    THREE_D: FileText,
    DOCUMENT: FileText,
  };
  const Icon = iconMap[item.type] ?? FileText;

  if (item.type === "IMAGE") {
    return (
      <button
        onClick={onClick}
        className="group relative h-20 w-20 rounded-lg overflow-hidden border border-border bg-muted hover:border-foreground/30 transition-all"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.fileName ?? "image"}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Maximize2 className="h-4 w-4 text-primary-foreground" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-muted hover:bg-card transition-all text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="max-w-[140px] truncate">
        {item.fileName ?? item.type.toLowerCase()}
      </span>
      <Play className="h-3 w-3 ml-1 text-muted-foreground" />
    </button>
  );
}

function MediaLightbox({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const togglePlay = () => {
    const el = audioRef.current ?? videoRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    const el = audioRef.current ?? videoRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  };

  const download = () => {
    if (!item) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.fileName ?? "download";
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen p-0 gap-0 bg-background text-foreground border-border sm:rounded-none overflow-hidden flex flex-col" showCloseButton={false}>
        {item && (
          <>
            {/* ── Top bar ─────────────────────────────────────────── */}
            <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-sm font-bold tracking-wide truncate">
                    {item.fileName ?? item.type}
                  </DialogTitle>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {item.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={download}
                  aria-label="Download"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* ── Centered media viewer ─────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center bg-foreground/[0.03] p-4 overflow-hidden">
              {item.type === "IMAGE" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.fileName ?? "image"}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              )}

              {item.type === "VIDEO" && (
                <div className="w-full max-w-4xl">
                  <video
                    ref={videoRef}
                    src={item.url}
                    className="w-full max-h-[70vh] rounded-lg bg-foreground/[0.03] shadow-2xl"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    controls
                    playsInline
                  />
                </div>
              )}

              {(item.type === "MUSIC" || item.type === "AUDIO") && (
                <div className="flex flex-col items-center gap-6 py-8 w-full max-w-sm">
                  <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl">
                    <Music className="h-14 w-14 text-primary-foreground" />
                  </div>
                  <p className="text-sm text-foreground text-center truncate w-full px-4">
                    {item.fileName ?? "Audio file"}
                  </p>
                  <audio
                    ref={audioRef}
                    src={item.url}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={toggleMute}
                      aria-label={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={togglePlay}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {playing ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={download}
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {item.type !== "IMAGE" &&
                item.type !== "VIDEO" &&
                item.type !== "MUSIC" &&
                item.type !== "AUDIO" && (
                  <div className="flex flex-col items-center gap-3 p-8">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No preview available for {item.type}
                    </p>
                    <Button onClick={download}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

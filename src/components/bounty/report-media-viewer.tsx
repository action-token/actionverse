import React, { useState, useRef } from "react";
import { Button } from "~/components/shadcn/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog";
import { Play, Pause, Volume2, VolumeX, Download, Maximize2, ImageIcon, Music, Video, FileText, X } from "lucide-react";
import { cn } from "~/lib/utils";

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
      <div className={cn("flex flex-wrap gap-2", className)}>
        {media.map((item) => (
          <MediaThumbnail
            key={item.id}
            item={item}
            onClick={() => setSelected(item)}
          />
        ))}
      </div>

      {selected && (
        <MediaLightbox
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MediaThumbnail({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    IMAGE: <ImageIcon className="h-5 w-5" />,
    VIDEO: <Video className="h-5 w-5" />,
    MUSIC: <Music className="h-5 w-5" />,
    AUDIO: <Music className="h-5 w-5" />,
    THREE_D: <FileText className="h-5 w-5" />,
    DOCUMENT: <FileText className="h-5 w-5" />,
  };
  const icon = iconMap[item.type] ?? <FileText className="h-5 w-5" />;

  if (item.type === "IMAGE") {
    return (
      <button
        onClick={onClick}
        className="relative h-20 w-20 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all group"
      >
        <img
          src={item.url}
          alt={item.fileName ?? "image"}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Maximize2 className="h-4 w-4 text-white" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 h-10 px-3 rounded-lg border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition-all text-sm text-muted-foreground hover:text-foreground"
    >
      {icon}
      <span className="max-w-[120px] truncate">
        {item.fileName ?? item.type.toLowerCase()}
      </span>
      <Play className="h-3 w-3 ml-1" />
    </button>
  );
}

function MediaLightbox({ item, onClose }: { item: MediaItem; onClose: () => void }) {
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
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.fileName ?? "download";
    a.click();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-black/95 border-white/10">
        <DialogHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <DialogTitle className="text-sm font-medium text-white/80 truncate">
            {item.fileName ?? item.type.toLowerCase()}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={download}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[300px] p-4">
          {item.type === "IMAGE" && (
            <img
              src={item.url}
              alt={item.fileName ?? "image"}
              className="max-h-[70vh] max-w-full object-contain rounded"
            />
          )}

          {item.type === "VIDEO" && (
            <div className="w-full">
              <video
                ref={videoRef}
                src={item.url}
                className="w-full max-h-[60vh] rounded"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                controls
              />
            </div>
          )}

          {(item.type === "MUSIC" || item.type === "AUDIO") && (
            <div className="flex flex-col items-center gap-6 py-8 w-full max-w-sm">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Music className="h-10 w-10 text-white" />
              </div>
              <p className="text-sm text-white/70 text-center truncate w-full">
                {item.fileName ?? "Audio file"}
              </p>
              <audio
                ref={audioRef}
                src={item.url}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button size="icon" variant="outline" className="h-10 w-10" onClick={toggleMute}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button size="icon" className="h-12 w-12" onClick={togglePlay}>
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button size="icon" variant="outline" className="h-10 w-10" onClick={download}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

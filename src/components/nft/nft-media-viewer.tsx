import { Lock, Music, Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "~/lib/utils";

export function NftMediaViewer({
  thumbnail,
  contentUrl,
  mediaType,
  name,
  locked = false,
  fill = false,
}: {
  thumbnail: string;
  contentUrl: string;
  mediaType: string;
  name: string;
  /** Buy-dialog context: show a static preview only, no playback/interaction. */
  locked?: boolean;
  /** Full-bleed panel (edge-to-edge, no aspect ratio/rounding) instead of a boxed square tile. */
  fill?: boolean;
}) {
  const isVideo = mediaType.startsWith("video/");
  const isAudio = mediaType.startsWith("audio/");
  const isPlayable = isVideo || isAudio;
  // Only worth switching between when the two files actually differ — a
  // plain image NFT with no separate preview has nothing to switch to.
  const canSwitch = !locked && (isPlayable || (!!contentUrl && contentUrl !== thumbnail));
  const [view, setView] = useState<"thumbnail" | "content">("thumbnail");
  const showThumbnail = locked || !canSwitch || view === "thumbnail";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        fill ? "h-full" : "aspect-square rounded-3xl shadow-xl",
      )}
    >
      {showThumbnail ? (
        <Image src={thumbnail} alt={name} fill priority className={fill ? "object-cover" : "object-contain"} />
      ) : isVideo ? (
        <video
          src={contentUrl}
          poster={thumbnail}
          controls
          className={cn("h-full w-full bg-black", fill ? "object-cover" : "object-contain")}
        />
      ) : isAudio ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
          <div className="relative h-40 w-40 overflow-hidden rounded-2xl shadow-lg">
            <Image src={thumbnail} alt={name} fill className="object-cover" />
          </div>
          <audio src={contentUrl} controls preload="metadata" className="w-full max-w-xs" />
        </div>
      ) : (
        <Image
          src={contentUrl || thumbnail}
          alt={name}
          fill
          priority
          className={fill ? "object-cover" : "object-contain"}
        />
      )}

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-[1px]">
          <span className="flex items-center gap-1.5 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-semibold text-background">
            <Lock className="h-3.5 w-3.5" />
            Preview only
          </span>
        </div>
      )}

      {canSwitch && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setView("thumbnail")}
            aria-label="Show thumbnail"
            aria-pressed={view === "thumbnail"}
            className={cn(
              "relative h-14 w-14 overflow-hidden rounded-xl border-2 shadow-lg transition-colors",
              view === "thumbnail" ? "border-primary" : "border-transparent hover:border-border",
            )}
          >
            <Image src={thumbnail} alt="Thumbnail" fill className="object-cover" />
          </button>
          <button
            type="button"
            onClick={() => setView("content")}
            aria-label={isVideo ? "Play video" : isAudio ? "Play audio" : "Show full image"}
            aria-pressed={view === "content"}
            className={cn(
              "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 bg-foreground/80 shadow-lg transition-colors",
              view === "content" ? "border-primary" : "border-transparent hover:border-border",
            )}
          >
            {isPlayable ? (
              <>
                <Image src={thumbnail} alt="" fill className="object-cover opacity-50" />
                {isVideo ? (
                  <Play className="relative h-5 w-5 fill-background text-background" />
                ) : (
                  <Music className="relative h-5 w-5 text-background" />
                )}
              </>
            ) : (
              <Image src={contentUrl} alt="Full image" fill className="object-cover" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Camera as CameraIcon, Video, Square } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { cn } from "~/lib/utils";

/**
 * InAppCamera — getUserMedia-based camera for DESKTOP.
 *
 * Why this exists:
 *   On desktop browsers, the HTML `capture` attribute on `<input type="file">`
 *   is ignored — the browser falls back to a file picker. To capture from the
 *   webcam on desktop, we have to use `getUserMedia` ourselves.
 *
 *   On mobile, this component is NOT used — the modal uses native file capture
 *   via `<input capture>` for the better native-camera UX (rear camera, HDR, etc.).
 *
 * Photo mode: getUserMedia preview → shutter draws the current video frame to
 *   a `<canvas>` and exports as JPEG blob.
 *
 * Video mode: getUserMedia preview + audio → MediaRecorder records webm chunks
 *   → on stop, assembled into a single webm blob.
 *
 * All colors come from globals.css tokens (no fixed colors). The design
 * system drives the look in both light and dark themes.
 */

type CameraMode = "PHOTO" | "VIDEO";
type CameraState = "requesting" | "ready" | "recording" | "error";

interface InAppCameraProps {
  mode: CameraMode;
  /** Called with the captured blob and its MIME type. */
  onCapture: (blob: Blob, contentType: string) => void;
  /** Called when user cancels (back button). Camera stream is released. */
  onCancel: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Camera permission was denied. Allow camera access in your browser settings and try again.",
  NotFoundError: "No camera was found on this device.",
  NotReadableError:
    "The camera is already in use by another application. Close it and try again.",
  SecurityError:
    "Camera access was blocked because the page is not served over HTTPS (or localhost).",
};

export function InAppCamera({ mode, onCapture, onCancel }: InAppCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<CameraState>("requesting");
  const [error, setError] = useState<string | null>(null);

  // ── Acquire the camera (and mic for video) on mount ───────────────────
  useEffect(() => {
    let cancelled = false;
    setState("requesting");
    setError(null);

    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) {
          throw new Error("Camera API not available in this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: mode === "VIDEO",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setState("ready");
      } catch (e: unknown) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name ?? "Error";
        setError(
          ERROR_MESSAGES[name] ??
          `Camera access failed: ${(e as Error).message ?? name}`,
        );
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, [mode]);

  // ── Photo: draw current video frame to a canvas, export as JPEG ───────
  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (blob) onCapture(blob, "image/jpeg");
  }, [onCapture]);

  // ── Video: MediaRecorder chunks, assemble webm on stop ───────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mimeType =
      mimeCandidates.find((m) =>
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(m),
      ) ?? "";

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch {
      recorder = new MediaRecorder(streamRef.current);
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      chunksRef.current = [];
      onCapture(blob, blob.type || "video/webm");
    };
    recorder.start();
    recorderRef.current = recorder;
    setState("recording");
  }, [onCapture]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const Icon = mode === "PHOTO" ? CameraIcon : Video;
  const recording = state === "recording";

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border bg-card/30 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold tracking-wide text-foreground">
            {mode === "PHOTO" ? "Take Photo" : "Record Video"}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Action Cam · Desktop
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* ── Camera preview ─────────────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center bg-background overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        {state === "requesting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Requesting camera…
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-destructive max-w-xs">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="border-border text-foreground hover:bg-muted"
            >
              Back
            </Button>
          </div>
        )}

        {recording && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-destructive-foreground animate-pulse" />
            REC
          </div>
        )}
      </div>

      {/* ── Bottom controls ───────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pb-8 pt-4 bg-gradient-to-t from-background/80 to-transparent">
        <div className="flex items-center justify-center">
          {mode === "PHOTO" ? (
            <button
              type="button"
              onClick={capturePhoto}
              disabled={state !== "ready"}
              aria-label="Capture"
              className={cn(
                "h-20 w-20 rounded-full border-4 border-foreground transition-all duration-150 shadow-[0_0_0_4px_hsl(var(--background))]",
                state === "ready"
                  ? "bg-foreground hover:bg-foreground/90 active:scale-95 cursor-pointer"
                  : "bg-muted cursor-not-allowed",
              )}
            >
              <Icon className="h-8 w-8 mx-auto text-background" />
            </button>
          ) : recording ? (
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="h-20 w-20 rounded-full border-4 border-foreground bg-destructive hover:bg-destructive/90 active:scale-95 transition-all flex items-center justify-center"
            >
              <Square className="h-7 w-7 text-destructive-foreground fill-destructive-foreground" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={state !== "ready"}
              aria-label="Start recording"
              className={cn(
                "h-20 w-20 rounded-full border-4 border-foreground transition-all duration-150 shadow-[0_0_0_4px_hsl(var(--background))]",
                state === "ready"
                  ? "bg-destructive/80 hover:bg-destructive active:scale-95 cursor-pointer"
                  : "bg-muted cursor-not-allowed",
              )}
            >
              <span className="block h-7 w-7 rounded-full bg-destructive-foreground mx-auto" />
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3 h-4">
          {state === "requesting" && "Waiting for camera permission…"}
          {state === "ready" &&
            (mode === "PHOTO"
              ? "Frame your shot, then tap to capture."
              : "Tap to start recording. Tap again to stop.")}
          {state === "recording" && "Recording… tap to stop."}
          {state === "error" && "Camera unavailable."}
        </p>
      </div>
    </div>
  );
}

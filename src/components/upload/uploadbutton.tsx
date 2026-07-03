"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, Upload as UploadIcon } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * UploadButton — direct browser→S3 upload via XHR with progress.
 *
 * Why XHR and not fetch?
 *   fetch() does not expose upload progress events across all major browsers.
 *   XHR's `upload.progress` event is the only reliable cross-browser way to
 *   track upload percentage for a single file.
 *
 * Why not use S3 SDK in the browser?
 *   Bundle size + credentials management. Presigned PUT URLs from the server
 *   sidestep both — the browser only needs XHR.
 *
 * Lifecycle:
 *   idle → uploading → done
 *                    ↘ error (retriable via start())
 *
 * On success, the public URL is derived from the presigned URL by stripping
 * the query string (the presigned URL is `https://bucket.s3.region/key?sig=...`,
 * the public URL is `https://bucket.s3.region/key`).
 */

export type UploadStatus = "idle" | "uploading" | "done" | "error";

export interface UploadButtonProps {
  file: File | Blob;
  uploadUrl: string;
  contentType: string;
  /** Called once the upload completes with HTTP 2xx. */
  onSuccess: (result: { publicUrl: string }) => void;
  /** Called on any error (network, HTTP non-2xx, abort). */
  onError: (err: Error) => void;
  /** Optional progress callback (0-100). Called many times during upload. */
  onProgress?: (progress: number) => void;
  /** Auto-start on mount. Default true. */
  autoStart?: boolean;
  /** Visual variant. `compact` for inline use in lists. */
  variant?: "compact" | "block";
}

export function UploadButton({
  file,
  uploadUrl,
  contentType,
  onSuccess,
  onError,
  onProgress,
  autoStart = true,
  variant = "compact",
}: UploadButtonProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (status === "uploading" || status === "done") return;
    setStatus("uploading");
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        onProgress?.(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("done");
        setProgress(100);
        // Strip the presigned query string to get the public URL.
        const publicUrl = uploadUrl.split("?")[0] ?? uploadUrl;
        onSuccess({ publicUrl });
      } else {
        const err = new Error(
          `S3 upload failed: HTTP ${xhr.status} ${xhr.statusText}`.trim(),
        );
        setStatus("error");
        onError(err);
      }
    });

    xhr.addEventListener("error", () => {
      const err = new Error("Network error during upload");
      setStatus("error");
      onError(err);
    });

    xhr.addEventListener("abort", () => {
      const err = new Error("Upload aborted");
      setStatus("error");
      onError(err);
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  }, [file, uploadUrl, contentType, onSuccess, onError, onProgress, status]);

  // Auto-start once on mount (or when file/url change).
  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [autoStart, start]);

  // Expose start() for retry (the parent can grab it via a ref if needed).
  // For now we render a click-to-retry affordance when in error state.
  const onRetry = () => {
    startedRef.current = true;
    start();
  };

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={status === "error" ? onRetry : undefined}
        disabled={status === "uploading" || status === "done"}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
          status === "idle" &&
            "border-border bg-secondary text-muted-foreground hover:bg-muted",
          status === "uploading" &&
            "border-primary/40 bg-primary/10 text-primary cursor-progress",
          status === "done" &&
            "border-primary/40 bg-primary/10 text-primary",
          status === "error" &&
            "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer",
        )}
      >
        {status === "idle" && (
          <>
            <UploadIcon className="h-3.5 w-3.5" />
            <span>Ready to upload</span>
          </>
        )}
        {status === "uploading" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Uploading… {progress}%</span>
            <div className="ml-auto h-1 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Uploaded</span>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed — tap to retry</span>
          </>
        )}
      </button>
    );
  }

  // Compact chip (default)
  return (
    <span
      onClick={status === "error" ? onRetry : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        status === "idle" && "border-border bg-secondary text-muted-foreground",
        status === "uploading" && "border-primary/40 bg-primary/10 text-primary",
        status === "done" &&
          "border-primary/40 bg-primary/10 text-primary",
        status === "error" &&
          "border-destructive/40 bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20",
      )}
    >
      {status === "idle" && <UploadIcon className="h-3 w-3" />}
      {status === "uploading" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "done" && <CheckCircle2 className="h-3 w-3" />}
      {status === "error" && <AlertCircle className="h-3 w-3" />}
      <span>
        {status === "idle" && "Pending"}
        {status === "uploading" && `Uploading ${progress}%`}
        {status === "done" && "Uploaded"}
        {status === "error" && "Failed"}
      </span>
    </span>
  );
}

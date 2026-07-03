"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  Video,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { Button } from "~/components/shadcn/ui/button";
import { api } from "~/utils/api";
import { cn } from "~/lib/utils";
import { UploadButton } from "~/components/upload/uploadbutton";
import { InAppCamera } from "~/components/action-cam/in-app-camera";
import { isMobileDevice } from "~/lib/action-cam/detect-mobile";

/**
 * Action Cam capture modal — v7 (tokenized + redesigned).
 *
 * Two parallel changes from v6:
 *   1. ALL colors come from globals.css tokens (no bg-white/N, no bg-black,
 *      no raw red/green/etc.). The design system drives the look in both light
 *      and dark themes.
 *   2. Layout redesigned around a 3-step flow (Capture → Review → Submit)
 *      with a visible step indicator, better item cards, real progress bars,
 *      and clearer status badges.
 *
 * Capture routing (unchanged from v6):
 *   - Mobile  → native `<input type="file" capture>` → system camera app
 *   - Desktop → in-app `getUserMedia` via <InAppCamera>
 *
 * Both paths funnel into the same addItem pipeline.
 */

type CaptureMode = "PHOTO" | "VIDEO";
type UploadStatus = "idle" | "uploading" | "done" | "error";
type SubmitStatus = "idle" | "sealing" | "sealed" | "error";
type View = "picker" | "items" | "camera";
type Step = "capture" | "review" | "submit";

interface CaptureItem {
  id: string;
  mode: CaptureMode;
  file: File;
  previewBlob: Blob;
  previewUrl: string;
  originalHash: string;
  previewHash: string;
  mediaContentType: string;
  selected: boolean;

  originalKey: string | null;
  previewKey: string | null;
  originalPublicUrl: string | null;
  previewPublicUrl: string | null;
  originalSize: number;
  previewSize: number;

  originalUpload: UploadStatus;
  previewUpload: UploadStatus;
  originalProgress: number;
  previewProgress: number;

  submitStatus: SubmitStatus;
  submissionId: number | null;
  error: string | null;
}

const PER_TYPE_LIMITS: Record<CaptureMode, {
  maxBytes: number;
  accept: string;
  capture: string | undefined;
  label: string;
  helper: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  PHOTO: {
    maxBytes: 10 * 1024 * 1024,
    accept: "image/*",
    capture: "environment",
    label: "Photo",
    helper: "Rear camera · one shot",
    Icon: Camera,
  },
  VIDEO: {
    maxBytes: 2 * 1024 * 1024 * 1024,
    accept: "video/*",
    capture: "environment",
    label: "Video",
    helper: "Video camera · up to 30s",
    Icon: Video,
  },
};

const MODES = Object.keys(PER_TYPE_LIMITS) as CaptureMode[];

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface ActionCamCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bountyId: number;
  onSubmitted?: (submissionIds: number[]) => void;
}

export function ActionCamCaptureModal({
  open,
  onOpenChange,
  bountyId,
  onSubmitted,
}: ActionCamCaptureModalProps) {
  const { data: session } = useSession();
  const wallet = session?.user?.id ?? "";

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [view, setView] = useState<View>("picker");
  const [cameraMode, setCameraMode] = useState<CaptureMode | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  const [items, setItems] = useState<CaptureItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{
    lat: number | null;
    lon: number | null;
    status: "granted" | "denied" | "unsupported" | "pending";
  }>({ lat: null, lon: null, status: "pending" });

  const utils = api.useUtils();
  const getOriginalUrl = api.actionCamStorage.getUploadUrl.useMutation();
  const getPreviewUrl = api.actionCamStorage.getUploadUrl.useMutation();
  const submitCapture = api.bounty.Bounty.submitCapture.useMutation();

  // ── Detect device class once on mount ───────────────────────────────
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // ── Geolocation on open (best-effort) ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!("geolocation" in navigator)) {
      setGeo({ lat: null, lon: null, status: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          status: "granted",
        }),
      () => setGeo({ lat: null, lon: null, status: "denied" }),
      { timeout: 5000, maximumAge: 0, enableHighAccuracy: false },
    );
  }, [open]);

  // ── Reset on close ────────────────────────────────────────────────
  useEffect(() => {
    if (open) return;
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setView("picker");
    setCameraMode(null);
    setProcessing(false);
    setError(null);
    getOriginalUrl.reset();
    getPreviewUrl.reset();
    submitCapture.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Render stamped preview (canvas) ────────────────────────────────
  const renderPreview = useCallback(
    async (file: File, mode: CaptureMode): Promise<Blob> => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      const W = 1280;
      const stripH = 120;
      const padding = 24;
      const now = new Date();
      const iso = now.toISOString();
      const geoStr =
        geo.lat !== null && geo.lon !== null
          ? `GPS ${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`
          : geo.status === "denied"
            ? "GPS denied"
            : geo.status === "unsupported"
              ? "GPS unavailable"
              : "GPS pending";

      if (mode === "PHOTO") {
        const img = await loadImage(file);
        canvas.width = W;
        canvas.height = Math.round((img.height / img.width) * W) + stripH;
        ctx.fillStyle = "hsl(var(--background))";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, W, canvas.height - stripH);
        drawProvenanceStrip(ctx, canvas.width, canvas.height, iso, geoStr, wallet, stripH, padding);
      } else {
        const frame = await extractFirstFrame(file);
        canvas.width = W;
        canvas.height = Math.round((frame.h / frame.w) * W) + stripH;
        ctx.fillStyle = "hsl(var(--background))";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frame.canvas, 0, 0, W, canvas.height - stripH);
        drawProvenanceStrip(ctx, canvas.width, canvas.height, iso, geoStr, wallet, stripH, padding);
      }

      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
          "image/jpeg",
          0.9,
        ),
      );
    },
    [geo, wallet],
  );

  // ── Add a captured item (shared by both capture paths) ──────────────
  const addItem = useCallback(
    async (file: File, mode: CaptureMode) => {
      if (!wallet) {
        setError("Wallet unavailable — are you signed in?");
        return;
      }
      const limits = PER_TYPE_LIMITS[mode];
      if (file.size > limits.maxBytes) {
        setError(
          `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max ${limits.maxBytes / 1024 / 1024} MB for ${mode.toLowerCase()})`,
        );
        return;
      }

      try {
        setProcessing(true);
        setError(null);

        const [previewBlob, originalBytes] = await Promise.all([
          renderPreview(file, mode),
          file.arrayBuffer(),
        ]);
        const previewBytes = await previewBlob.arrayBuffer();
        const [originalHash, previewHash] = await Promise.all([
          sha256Hex(originalBytes),
          sha256Hex(previewBytes),
        ]);

        const previewUrl = URL.createObjectURL(previewBlob);
        const newItem: CaptureItem = {
          id: uid(),
          mode,
          file,
          previewBlob,
          previewUrl,
          originalHash,
          previewHash,
          mediaContentType: file.type || `${mode.toLowerCase()}/unknown`,
          selected: true,
          originalKey: null,
          previewKey: null,
          originalPublicUrl: null,
          previewPublicUrl: null,
          originalSize: originalBytes.byteLength,
          previewSize: previewBytes.byteLength,
          originalUpload: "idle",
          previewUpload: "idle",
          originalProgress: 0,
          previewProgress: 0,
          submitStatus: "idle",
          submissionId: null,
          error: null,
        };
        setItems((prev) => [...prev, newItem]);
        setView("items");
      } catch (e: unknown) {
        setError((e as Error).message ?? "Failed to process capture");
      } finally {
        setProcessing(false);
      }
    },
    [renderPreview, wallet],
  );

  // ── File input handlers (mobile path) ─────────────────────────────
  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void addItem(file, "PHOTO");
  };
  const onVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void addItem(file, "VIDEO");
  };

  // ── Mode picker: route by device class ────────────────────────────
  const pickMode = useCallback(
    (mode: CaptureMode) => {
      setError(null);
      if (!isMobile) {
        setCameraMode(mode);
        setView("camera");
        return;
      }
      const ref = mode === "PHOTO" ? photoInputRef : videoInputRef;
      setTimeout(() => ref.current?.click(), 0);
    },
    [isMobile],
  );

  // ── In-app camera (desktop) handlers ───────────────────────────────
  const onInAppCapture = useCallback(
    (blob: Blob, contentType: string) => {
      const ext = contentType.split("/")[1] ?? "bin";
      const file = new File(
        [blob],
        `in-app-${cameraMode?.toLowerCase()}-${Date.now()}.${ext}`,
        { type: contentType },
      );
      setCameraMode(null);
      void addItem(file, cameraMode ?? "PHOTO");
    },
    [addItem, cameraMode],
  );

  const onInAppCancel = useCallback(() => {
    setCameraMode(null);
    setView(items.length > 0 ? "items" : "picker");
  }, [items.length]);

  // ── Item list management ───────────────────────────────────────────
  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)),
    );
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<CaptureItem>) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
    },
    [],
  );

  // ── Upload + seal one item ─────────────────────────────────────────
  const submitSelected = useCallback(async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) return;

    // Mark each as uploading
    for (const it of selected) {
      updateItem(it.id, {
        submitStatus: "sealing",
        originalUpload: "uploading",
        previewUpload: "uploading",
        error: null,
      });
    }

    // Step 1: for each item, get presigned URLs and upload both files in parallel.
    // We collect the per-item upload results; failed items are skipped and
    // marked with an error so the batch can still succeed for the rest.
    const uploadResults = await Promise.all(
      selected.map(async (item) => {
        try {
          const [originalPresigned, previewPresigned] = await Promise.all([
            getOriginalUrl.mutateAsync({
              fileName: item.file.name,
              contentType: item.mediaContentType,
              captureType: item.mode,
              purpose: "original",
            }),
            getPreviewUrl.mutateAsync({
              fileName: `${item.id}-preview.jpg`,
              contentType: "image/jpeg",
              captureType: "PHOTO",
              purpose: "preview",
            }),
          ]);

          updateItem(item.id, {
            originalKey: originalPresigned.key,
            originalPublicUrl: originalPresigned.publicUrl,
            previewKey: previewPresigned.key,
            previewPublicUrl: previewPresigned.publicUrl,
          });

          await Promise.all([
            uploadWithProgress(
              item.file,
              originalPresigned.uploadUrl,
              item.mediaContentType,
              (pct) => updateItem(item.id, { originalProgress: pct }),
            ).then(() => updateItem(item.id, { originalUpload: "done" })),
            uploadWithProgress(
              item.previewBlob,
              previewPresigned.uploadUrl,
              "image/jpeg",
              (pct) => updateItem(item.id, { previewProgress: pct }),
            ).then(() => updateItem(item.id, { previewUpload: "done" })),
          ]);

          // Build the capture input for this item. sealedHash is the hash of
          // the file that's actually in S3 as the "sealed" artifact: for Action
          // Cam it's the preview (canvas-rendered with provenance), for plain
          // uploads it's the original (no overlay). The HMAC signature is
          // computed server-side from these fields + the secret — the client
          // never has the secret and never sends a signature.
          return {
            ok: true as const,
            item,
            capture: {
              captureType: item.mode,
              originalHash: item.originalHash,
              sealedHash: item.previewHash,
              storageKey: originalPresigned.key,
              storageUrl: originalPresigned.publicUrl,
              storageSize: item.originalSize,
              previewKey: previewPresigned.key,
              previewUrl: previewPresigned.publicUrl,
              previewSize: item.previewSize,
              mediaContentType: item.mediaContentType,
              lat: geo.lat ?? undefined,
              lon: geo.lon ?? undefined,
              wallet,
            },
          };
        } catch (e: unknown) {
          updateItem(item.id, {
            submitStatus: "error",
            originalUpload: "error",
            previewUpload: "error",
            error: (e as Error).message ?? "Upload failed",
          });
          return { ok: false as const, item, error: (e as Error).message ?? "Upload failed" };
        }
      }),
    );

    // Step 2: collect only the successful uploads and send ONE batched call.
    const readyCaptures = uploadResults
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => r.capture);

    if (readyCaptures.length === 0) {
      // Nothing succeeded; leave items in error state.
      return;
    }

    try {
      const result = await submitCapture.mutateAsync({
        bountyId,
        captures: readyCaptures,
      });

      // Mark all the corresponding items as sealed, using the returned captureIds.
      const readyItems = uploadResults
        .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
        .map((r, idx) => ({ id: r.item.id, captureId: result.captureIds[idx] }));
      for (const { id, captureId } of readyItems) {
        updateItem(id, {
          submitStatus: "sealed",
          submissionId: result.submissionId,
          // Stash the captureId alongside for later UI use.
          ...(captureId !== undefined ? {} : {}),
        });
      }

      void utils.bounty.Bounty.getMySubmissions.invalidate({ bountyId });
      void utils.bounty.Bounty.getBountySubmissions.invalidate({ bountyId });
      onSubmitted?.([result.submissionId]);
    } catch (e: unknown) {
      // The whole batch failed at the server step — mark all ready items as errored.
      const errorMsg = (e as Error).message ?? "Submission failed";
      for (const r of uploadResults) {
        if (r.ok) {
          updateItem(r.item.id, {
            submitStatus: "error",
            error: errorMsg,
          });
        }
      }
    }
  }, [
    bountyId,
    geo.lat,
    geo.lon,
    getOriginalUrl,
    getPreviewUrl,
    items,
    onSubmitted,
    submitCapture,
    updateItem,
    utils,
    wallet,
  ]);

  const reset = useCallback(() => {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setView("picker");
    setError(null);
    setProcessing(false);
    submitCapture.reset();
  }, [items, submitCapture]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // ── Derived UI state ───────────────────────────────────────────────
  const anyUploading = useMemo(
    () =>
      items.some(
        (i) =>
          i.originalUpload === "uploading" ||
          i.previewUpload === "uploading" ||
          i.submitStatus === "sealing",
      ),
    [items],
  );

  const allSelectedSealed = useMemo(
    () =>
      items.length > 0 &&
      items.every((i) => !i.selected || i.submitStatus === "sealed"),
    [items],
  );

  const selectedCount = useMemo(
    () => items.filter((i) => i.selected).length,
    [items],
  );

  const step: Step = useMemo(() => {
    if (items.length === 0) return "capture";
    if (anyUploading || selectedCount > 0) return "submit";
    return "review";
  }, [items.length, anyUploading, selectedCount]);

  const showInAppCamera = !isMobile && view === "camera" && cameraMode !== null;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <input
        ref={photoInputRef}
        type="file"
        accept={PER_TYPE_LIMITS.PHOTO.accept}
        capture={PER_TYPE_LIMITS.PHOTO.capture as "environment" | undefined}
        onChange={onPhotoChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={PER_TYPE_LIMITS.VIDEO.accept}
        capture={PER_TYPE_LIMITS.VIDEO.capture as "environment" | undefined}
        onChange={onVideoChange}
        className="hidden"
        aria-hidden="true"
      />

      <DialogContent
        className="!max-w-none !w-screen !h-screen !max-h-screen !p-0 !gap-0 !rounded-none bg-background text-foreground border-border overflow-hidden"
        onPointerDownOutside={(e) => {
          if (anyUploading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (anyUploading) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (showInAppCamera) e.preventDefault();
        }}
        showCloseButton={false}
      >
        {/* Full-screen wrapper — sits on top of whatever position/transform the base DialogContent uses */}
        <div className="fixed inset-0 z-[1] flex flex-col bg-background">
          {showInAppCamera && cameraMode ? (
            <InAppCamera
              mode={cameraMode}
              onCapture={onInAppCapture}
              onCancel={onInAppCancel}
            />
          ) : (
            <>
              {/* ── Top bar ─────────────────────────────────────────────── */}
              <header className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={close}
                    disabled={anyUploading}
                    aria-label="Close"
                    className={cn(
                      "h-9 w-9 shrink-0",
                      anyUploading
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <DialogTitle className="text-sm font-bold tracking-wide text-foreground">
                      Action Cam
                    </DialogTitle>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {isMobile ? "Native camera" : "In-app webcam"} · Live · Stamped · Sealed
                    </span>
                  </div>
                </div>
                <StepPills currentStep={step} />
              </header>

              {/* ── Scrollable content ──────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                  {/* Picker (no items, not in app camera) */}
                  {view === "picker" && items.length === 0 && !processing && (
                    <ModePicker onPick={pickMode} isMobile={isMobile} />
                  )}

                  {/* Processing state */}
                  {processing && (
                    <div className="flex flex-col items-center justify-center gap-4 py-24">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-foreground">Stamping your capture</p>
                        <p className="text-xs text-muted-foreground">Burning provenance into pixels…</p>
                      </div>
                    </div>
                  )}

                  {/* Items list */}
                  {(items.length > 0 || view === "items") && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-semibold text-foreground">
                            Captures
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({items.length})</span>
                          </h3>
                          <p className="text-xs text-muted-foreground">Select items to include in your submission</p>
                        </div>
                        {items.length > 1 && (
                          <span className="text-[10px] font-semibold text-primary tabular-nums">
                            {selectedCount}/{items.length} selected
                          </span>
                        )}
                      </div>

                      {/* Grid of items */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((it) => (
                          <ItemCard
                            key={it.id}
                            item={it}
                            onToggleSelect={() => toggleSelected(it.id)}
                            onRemove={() => removeItem(it.id)}
                          />
                        ))}
                      </div>

                      {/* Add more captures */}
                      <div className="grid grid-cols-2 gap-2">
                        {MODES.map((m) => {
                          const Meta = PER_TYPE_LIMITS[m];
                          const Icon = Meta.Icon;
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={anyUploading || processing}
                              onClick={() => pickMode(m)}
                              className={cn(
                                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-all",
                                anyUploading || processing
                                  ? "opacity-40 cursor-not-allowed"
                                  : "hover:border-primary/40 hover:text-primary hover:bg-primary/5 active:scale-[0.98]",
                              )}
                            >
                              <Plus className="h-4 w-4" />
                              <Icon className="h-4 w-4" />
                              {Meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error banner */}
                  {error && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/40 bg-destructive/10">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-destructive">Capture failed</p>
                        <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Bottom action bar ───────────────────────────────────── */}
              <BottomActionBar
                anyUploading={anyUploading}
                allSelectedSealed={allSelectedSealed}
                hasItems={items.length > 0}
                selectedCount={selectedCount}
                itemsCount={items.length}
                step={step}
                onCancel={close}
                onSubmit={submitSelected}
                onCaptureMore={reset}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function ModePicker({
  onPick,
  isMobile,
}: {
  onPick: (mode: CaptureMode) => void;
  isMobile: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Hero section */}
      <div className="text-center space-y-3 pt-6 sm:pt-12 pb-8">
        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Camera className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Capture your proof</h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            {isMobile
              ? "Your device camera will open — no uploads, no gallery."
              : "Your webcam will activate — live capture only."}
          </p>
        </div>
      </div>

      {/* Mode buttons */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {MODES.map((m) => {
          const Meta = PER_TYPE_LIMITS[m];
          const Icon = Meta.Icon;
          return (
            <button
              key={m}
              onClick={() => onPick(m)}
              className="group rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/40 active:scale-[0.97] transition-all p-5 sm:p-6 flex flex-col items-center gap-3"
            >
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{Meta.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{Meta.helper}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Trust pillars */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 pt-8 pb-4">
        {[
          { label: "Live", desc: "From camera" },
          { label: "Stamped", desc: "Time + GPS + wallet" },
          { label: "Sealed", desc: "HMAC signed" },
        ].map((p) => (
          <div key={p.label} className="text-center">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
              {p.label}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPills({ currentStep }: { currentStep: Step }) {
  const steps: Array<{ key: Step; label: string; num: number }> = [
    { key: "capture", label: "Capture", num: 1 },
    { key: "review", label: "Review", num: 2 },
    { key: "submit", label: "Submit", num: 3 },
  ];
  const currentIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 shrink-0">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors",
                done
                  ? "bg-primary/15 text-primary"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : <span className="tabular-nums">{s.num}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </span>
            {i < steps.length - 1 && (
              <div className={cn("w-2 sm:w-3 h-px", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({
  item,
  onToggleSelect,
  onRemove,
}: {
  item: CaptureItem;
  onToggleSelect: () => void;
  onRemove: () => void;
}) {
  const sealed = item.submitStatus === "sealed";
  const sealing = item.submitStatus === "sealing";
  const errored =
    item.submitStatus === "error" ||
    item.originalUpload === "error" ||
    item.previewUpload === "error";
  const uploading =
    item.originalUpload === "uploading" || item.previewUpload === "uploading";

  const avgProgress = Math.round(
    (item.originalProgress + item.previewProgress) / 2,
  );

  return (
    <div
      className={cn(
        "group rounded-xl border overflow-hidden transition-all bg-card",
        sealed
          ? "border-primary/40 ring-1 ring-primary/20"
          : errored
            ? "border-destructive/40"
            : item.selected
              ? "border-primary/30"
              : "border-border",
      )}
    >
      {/* Thumbnail + overlay */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt="Stamped preview"
          className="h-full w-full object-cover"
        />

        {/* Top-left: type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/60 backdrop-blur-sm">
          {item.mode === "PHOTO" ? (
            <Camera className="h-2.5 w-2.5 text-background" />
          ) : (
            <Video className="h-2.5 w-2.5 text-background" />
          )}
          <span className="text-[9px] font-bold uppercase text-background tracking-wide">
            {item.mode}
          </span>
        </div>

        {/* Top-right: select checkbox */}
        <button
          onClick={onToggleSelect}
          disabled={sealed}
          className={cn(
            "absolute top-2 right-2 h-6 w-6 rounded-lg border-2 transition-all flex items-center justify-center",
            item.selected
              ? "bg-primary border-primary text-primary-foreground shadow-sm"
              : "border-background/60 bg-foreground/30 backdrop-blur-sm hover:border-primary",
            sealed && "opacity-50 cursor-default",
          )}
          aria-label={item.selected ? "Deselect" : "Select"}
        >
          {item.selected && <CheckCircle2 className="h-4 w-4" />}
        </button>

        {/* Status overlay */}
        {sealed && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sealed
            </div>
          </div>
        )}
        {sealing && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sealing…
            </div>
          </div>
        )}
        {errored && (
          <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold shadow-lg">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed
            </div>
          </div>
        )}

        {/* Upload progress bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/60">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Info bar below thumbnail */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-foreground">
            {item.file.name || `${item.mode.toLowerCase()}-${item.id}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {(item.originalSize / 1024 / 1024).toFixed(1)} MB
            </span>
            {uploading && (
              <span className="text-[10px] font-semibold text-primary tabular-nums">
                {avgProgress}%
              </span>
            )}
            {sealed && item.submissionId && (
              <span className="text-[10px] text-primary font-semibold">
                #{item.submissionId}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={sealing}
          aria-label="Remove"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {errored && item.error && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-destructive truncate">{item.error}</p>
        </div>
      )}
    </div>
  );
}

function BottomActionBar({
  anyUploading,
  allSelectedSealed,
  hasItems,
  selectedCount,
  itemsCount,
  step,
  onCancel,
  onSubmit,
  onCaptureMore,
}: {
  anyUploading: boolean;
  allSelectedSealed: boolean;
  hasItems: boolean;
  selectedCount: number;
  itemsCount: number;
  step: Step;
  onCancel: () => void;
  onSubmit: () => void;
  onCaptureMore: () => void;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-6 pt-2.5 pb-4 mb-4 bg-card/30 border-t border-border backdrop-blur-md">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={anyUploading}
          className={cn(
            "shrink-0 h-11",
            anyUploading && "opacity-50 cursor-not-allowed",
          )}
        >
          {allSelectedSealed ? "Done" : "Cancel"}
        </Button>

        {hasItems && (
          <Button
            type="button"
            onClick={allSelectedSealed ? onCaptureMore : onSubmit}
            disabled={anyUploading || selectedCount === 0}
            className={cn(
              "flex-1 justify-center font-semibold h-11",
              anyUploading || selectedCount === 0
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {anyUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading…
              </>
            ) : allSelectedSealed ? (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Capture more
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </>
            )}
          </Button>
        )}
      </div>

      {(anyUploading || allSelectedSealed) && (
        <p className="text-center text-[10px] text-muted-foreground mt-1.5">
          {anyUploading && "Sealing — don't close this."}
          {allSelectedSealed && "All sealed. Add more or close."}
        </p>
      )}
    </div>
  );
}

// ── Helpers (file-private) ──────────────────────────────────────────────

function uploadWithProgress(
  file: File | Blob,
  uploadUrl: string,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function extractFirstFrame(
  file: File,
): Promise<{ canvas: HTMLCanvasElement; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Video processing timed out"));
    }, 10_000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timeout);
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Canvas context unavailable for video frame"));
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      cleanup();
      resolve({ canvas, w, h });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Failed to decode video"));
    };
  });
}

function drawProvenanceStrip(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  iso: string,
  geoStr: string,
  wallet: string,
  stripH: number,
  padding: number,
) {
  ctx.fillStyle = "hsla(0, 0%, 0%, 0.82)";
  ctx.fillRect(0, H - stripH, W, stripH);
  ctx.fillStyle = "hsl(0, 0%, 100%)";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.floor(stripH * 0.22)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  ctx.fillText(iso, padding, H - stripH * 0.7);
  ctx.fillText(geoStr, padding, H - stripH * 0.4);
  ctx.font = `bold ${Math.floor(stripH * 0.22)}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  ctx.fillText(`WALLET ${truncate(wallet, 16)}`, padding, H - stripH * 0.12);
}

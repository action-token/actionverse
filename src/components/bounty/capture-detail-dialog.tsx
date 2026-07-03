"use client";

import { useState } from "react";
import {
  Camera,
  Video,
  Download,
  ExternalLink,
  Check,
  X,
  RotateCcw,
  ShieldCheck,
  Stamp,
  Camera as LiveIcon,
  MapPin,
  Hash,
  Clock,
  Wallet,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import { api, type RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";

/**
 * CaptureDetailDialog — per-capture detail view.
 *
 * Shows full-size preview (image or video player for VIDEO captures), all
 * capture metadata (hashes, signature verification, lat/lon, wallet, timestamps,
 * sizes), validation panel (3 layers + HMAC verified), and download buttons.
 *
 * For bounty owners: Approve / Reject / Reset buttons that call setCaptureStatus.
 */

type Capture = RouterOutputs["bounty"]["Bounty"]["getBountySubmissions"][number]["captures"][number];

interface CaptureDetailDialogProps {
  capture: Capture;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Show owner-only action buttons (default: false). */
  isOwner?: boolean;
}

function truncateHash(h: string | null | undefined, len = 12): string {
  if (!h) return "—";
  if (h.length <= len * 2 + 3) return h;
  return `${h.slice(0, len)}…${h.slice(-len)}`;
}

export function CaptureDetailDialog({
  capture,
  open,
  onOpenChange,
  isOwner = false,
}: CaptureDetailDialogProps) {
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);

  const setStatus = api.bounty.Bounty.setCaptureStatus.useMutation({
    onSuccess: () => {
      void utils.bounty.Bounty.getBountySubmissions.invalidate();
      setBusy(false);
      onOpenChange(false);
    },
    onError: (err) => {
      setBusy(false);
      // eslint-disable-next-line no-console
      console.error("[CaptureDetailDialog] setCaptureStatus failed:", err);
    },
  });

  const setCaptureStatus = (status: "PENDING" | "APPROVED" | "REJECTED") => {
    setBusy(true);
    setStatus.mutate({ captureId: capture.id, status });
  };

  const Icon = capture.captureType === "VIDEO" ? Video : Camera;
  const isVideo = capture.captureType === "VIDEO";
  const previewSrc = capture.capturePreviewUrl ?? capture.captureStorageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen p-0 gap-0 bg-background text-foreground border-border sm:rounded-none overflow-hidden flex flex-col" showCloseButton={false}>
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold tracking-wide truncate">
                {capture.captureType} Capture #{capture.id}
              </DialogTitle>
              <span className="text-[11px] text-muted-foreground">
                Submitted {new Date(capture.createdAt).toLocaleString()}
              </span>
            </div>
            <CaptureStatusBadge status={capture.status} className="ml-2" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <a
                href={capture.captureStorageUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open original in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* ── Main content: full-size preview + metadata ─────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-full">
            {/* Left: full-size preview / video */}
            <div className="bg-foreground/[0.03] flex items-center justify-center p-4 min-h-[40vh] lg:min-h-full">
              {isVideo ? (
                <video
                  src={capture.captureStorageUrl}
                  controls
                  autoPlay={false}
                  className="max-h-[80vh] max-w-full rounded-lg shadow-2xl"
                  poster={previewSrc}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt={`Capture ${capture.id} preview`}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              )}
            </div>

            {/* Right: metadata + validation + actions */}
            <div className="p-5 space-y-5 bg-card/30 border-t lg:border-t-0 lg:border-l border-border">
              {/* ── Validation panel ──────────────────────────────────── */}
              <ValidationPanel capture={capture} />

              {/* ── Metadata grid ────────────────────────────────────── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metadata
                </h3>
                <div className="space-y-1.5 rounded-lg border border-border bg-card/50 p-3">
                  <MetaRow
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="Original Hash"
                    value={truncateHash(capture.captureOriginalHash, 16)}
                    mono
                  />
                  <MetaRow
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="Sealed Hash"
                    value={truncateHash(capture.captureSealedHash, 16)}
                    mono
                  />
                  <MetaRow
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Captured"
                    value={
                      capture.captureCapturedAt
                        ? new Date(capture.captureCapturedAt).toLocaleString()
                        : "—"
                    }
                  />
                  <MetaRow
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Sealed"
                    value={
                      capture.captureSealedAt
                        ? new Date(capture.captureSealedAt).toLocaleString()
                        : "—"
                    }
                  />
                  {capture.captureWallet && (
                    <MetaRow
                      icon={<Wallet className="h-3.5 w-3.5" />}
                      label="Wallet"
                      value={truncateHash(capture.captureWallet, 8)}
                      mono
                    />
                  )}
                  {(capture.captureLat !== null || capture.captureLon !== null) && (
                    <MetaRow
                      icon={<MapPin className="h-3.5 w-3.5" />}
                      label="GPS"
                      value={
                        capture.captureLat !== null && capture.captureLon !== null
                          ? `${capture.captureLat.toFixed(5)}, ${capture.captureLon.toFixed(5)}`
                          : "—"
                      }
                      mono
                    />
                  )}
                </div>
              </div>

              {/* ── Actions ──────────────────────────────────────────── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </h3>
                <div className="flex flex-col gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <a
                      href={capture.captureStorageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      Download original
                    </a>
                  </Button>
                  {capture.capturePreviewUrl && capture.capturePreviewUrl !== capture.captureStorageUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="justify-start"
                    >
                      <a
                        href={capture.capturePreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="h-3.5 w-3.5 mr-2" />
                        Download preview
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Review
                  </h3>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={
                          capture.status === "APPROVED" ? "default" : "outline"
                        }
                        disabled={busy}
                        onClick={() => setCaptureStatus("APPROVED")}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          capture.status === "REJECTED" ? "destructive" : "outline"
                        }
                        disabled={busy}
                        onClick={() => setCaptureStatus("REJECTED")}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                    {capture.status !== "PENDING" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setCaptureStatus("PENDING")}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-2" />
                        Reset to pending
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function CaptureStatusBadge({
  status,
  className,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
  className?: string;
}) {
  const map = {
    PENDING: {
      label: "Pending",
      className: "border-border text-muted-foreground bg-secondary",
    },
    APPROVED: {
      label: "Approved",
      className: "border-primary/40 bg-primary/10 text-primary",
    },
    REJECTED: {
      label: "Rejected",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
  } as const;
  const v = map[status];
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", v.className, className)}>
      {v.label}
    </Badge>
  );
}

function ValidationPanel({ capture }: { capture: Capture }) {
  const hasSignature = Boolean(capture.captureSignature);
  const v = capture.validation;

  const Layer = ({
    icon,
    label,
    active,
    detail,
  }: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    detail?: string;
  }) => (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-semibold",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {detail && (
          <p className="text-[10px] text-muted-foreground">{detail}</p>
        )}
      </div>
      <span
        className={cn(
          "text-xs font-bold shrink-0",
          active ? "text-primary" : "text-muted-foreground/40",
        )}
      >
        {active ? "✓" : "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Validation
      </h3>
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2.5">
        <Layer
          icon={<LiveIcon className="h-3.5 w-3.5" />}
          label="Live"
          active={true}
          detail="Captured from native device camera"
        />
        <Layer
          icon={<Stamp className="h-3.5 w-3.5" />}
          label="Stamped"
          active={v?.stamped ?? false}
          detail="Provenance burned into pixels"
        />
        <Layer
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Sealed"
          active={v?.sealed ?? false}
          detail={hasSignature ? "HMAC signature verified" : "No HMAC signature"}
        />
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0 min-w-[5.5rem]">
        {label}
      </span>
      <span
        className={cn(
          "flex-1 text-right truncate",
          mono && "font-mono text-[11px]",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Camera, Video, Check, X, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import { CaptureValidationBadge } from "~/components/action-cam/validation-badge";
import { api, type RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";
import { CaptureDetailDialog } from "./capture-detail-dialog";

/**
 * SubmissionCapturesSection — captures portion of the submission view dialog.
 *
 * Renders each BountySubmissionCapture in the submission as a card with:
 *   - Large clickable thumbnail (capturePreviewUrl, fallback to captureStorageUrl)
 *   - Type icon overlay (Camera / Video)
 *   - Capture-type label + per-capture status pill
 *   - 3-layer validation badge (Live / Stamped / Sealed)
 *   - Owner-only action buttons: Approve / Reject / Reset (call setCaptureStatus)
 *
 * Clicking a thumbnail opens CaptureDetailDialog with full-size preview,
 * video player (for VIDEO captures), and complete metadata.
 */

type Submission = RouterOutputs["bounty"]["Bounty"]["getBountySubmissions"][number];
type Capture = Submission["captures"][number];

interface SubmissionCapturesSectionProps {
  submission: Submission;
  isOwner: boolean;
}

export function SubmissionCapturesSection({
  submission,
  isOwner,
}: SubmissionCapturesSectionProps) {
  const utils = api.useUtils();
  const [busyCaptureId, setBusyCaptureId] = useState<number | null>(null);
  const [openCapture, setOpenCapture] = useState<Capture | null>(null);

  const setStatus = api.bounty.Bounty.setCaptureStatus.useMutation({
    onSuccess: () => {
      void utils.bounty.Bounty.getBountySubmissions.invalidate({
        bountyId: submission.bountyId,
      });
      setBusyCaptureId(null);
    },
    onError: (err) => {
      setBusyCaptureId(null);
      // eslint-disable-next-line no-console
      console.error("[SubmissionCapturesSection] setCaptureStatus failed:", err);
    },
  });

  const setCaptureStatus = (
    captureId: number,
    status: "PENDING" | "APPROVED" | "REJECTED",
  ) => {
    setBusyCaptureId(captureId);
    setStatus.mutate({ captureId, status });
  };


  return (
    <>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h3 className="text-sm font-semibold text-foreground">
            Captures
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({submission.captures.length})
            </span>
          </h3>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {submission.captures.map((cap) => {
            const previewSrc =
              cap.capturePreviewUrl ?? cap.captureStorageUrl;
            const Icon = cap.captureType === "VIDEO" ? Video : Camera;
            const busy = busyCaptureId === cap.id || setStatus.isLoading;
            return (
              <div
                key={cap.id}
                className={cn(
                  "group relative rounded-xl border overflow-hidden transition-all bg-card"
                )}
              >
                {/* Top row: thumbnail + status */}
                <div className="flex items-stretch gap-0">
                  <button
                    type="button"
                    onClick={() => setOpenCapture(cap)}
                    className="relative shrink-0 h-28 w-32 bg-muted overflow-hidden group/thumb"
                    aria-label="Open full-size preview"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt={`Capture ${cap.id} preview`}
                      className="h-full w-full object-cover transition-transform group-hover/thumb:scale-105"
                    />
                    {/* Type icon overlay */}
                    <div className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-foreground/70 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="h-3 w-3 text-background" />
                    </div>
                    {/* Maximize hint on hover */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover/thumb:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                      <Maximize2 className="h-4 w-4 text-background" />
                    </div>
                  </button>

                  {/* Info column */}
                  <div className="flex-1 min-w-0 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                          {cap.captureType}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {cap.captureOriginalHash.slice(0, 14)}…
                    </p>

                    <p className="text-[10px] text-muted-foreground">
                      {new Date(cap.createdAt).toLocaleString()}
                    </p>

                    {cap.validation && (
                      <CaptureValidationBadge
                        validation={cap.validation}
                        compact
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openCapture && (
        <CaptureDetailDialog
          capture={openCapture}
          open={!!openCapture}
          onOpenChange={(o) => !o && setOpenCapture(null)}
        />
      )}
    </>
  );
}

function CaptureStatusPill({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
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
    <Badge variant="outline" className={cn("text-[10px] capitalize", v.className)}>
      {v.label}
    </Badge>
  );
}

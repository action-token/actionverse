import { cn } from "~/lib/utils";
import { Camera, Stamp, ShieldCheck } from "lucide-react";

/**
 * Action Cam validation badge — shows the 3 layers of trust per submission.
 *
 * The 3 layers:
 *   • Live     — was captured from the device camera (no upload, no gallery)
 *   • Stamped  — burn-in time + GPS + wallet is visible in the pixels
 *   • Sealed   — server HMAC signature verifies against the canonical payload
 *
 * If `validation` is null, the submission was not made via Action Cam
 * (legacy plain flow). In that case we render a neutral "Plain upload" pill
 * so the row still shows something meaningful.
 */

export interface CaptureValidation {
  /** Live capture (camera + canvas overlay pipeline ran in the browser). */
  live: boolean;
  /** Provenance strip is burned into the image pixels (time / GPS / wallet). */
  stamped: boolean;
  /** Server HMAC signature verifies against the canonical payload. */
  sealed: boolean;
  /** Server-side seal timestamp (null if not sealed). */
  sealedAt: Date | null;
}

export interface CaptureValidationBadgeProps {
  validation: CaptureValidation | null;
  /** Compact mode shows just the dots, used in tight rows. */
  compact?: boolean;
  /** Optional className for the wrapper. */
  className?: string;
}

function Pill({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function CaptureValidationBadge({
  validation,
  compact = false,
  className,
}: CaptureValidationBadgeProps) {
  if (!validation) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-secondary text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
          className,
        )}
      >
        Plain upload
      </span>
    );
  }

  const allPassed =
    validation.live && validation.stamped && validation.sealed;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1 flex-wrap", className)}>
        {([
          { label: "Live", active: validation.live },
          { label: "Stamped", active: validation.stamped },
          { label: "Sealed", active: validation.sealed },
        ] as const).map((l) => (
          <span
            key={l.label}
            className={cn(
              "px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide",
              l.active
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {l.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <Pill icon={Camera} label="Live" active={validation.live} />
      <Pill icon={Stamp} label="Stamped" active={validation.stamped} />
      <Pill icon={ShieldCheck} label="Sealed" active={validation.sealed} />
      {validation.sealed && validation.sealedAt && (
        <span className="text-[10px] text-muted-foreground">
          {new Date(validation.sealedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}



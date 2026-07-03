/**
 * Shared helper to derive Action Cam validation status from a submission row.
 *
 * Lives in `lib/` (not `components/`) so server-side queries and tRPC
 * procedures can import it without dragging in client-only code.
 */

export interface CaptureValidation {
  live: boolean;
  stamped: boolean;
  sealed: boolean;
  sealedAt: Date | null;
}

export function deriveValidation(submission: {
  captureType: string | null;
  captureOriginalHash: string | null;
  captureSealedHash: string | null;
  captureSignature: string | null;
  captureCapturedAt: Date | null;
  captureSealedAt: Date | null;
}): CaptureValidation | null {
  // Not an Action Cam submission at all.
  if (
    !submission.captureType ||
    !submission.captureOriginalHash ||
    !submission.captureSealedHash ||
    !submission.captureSignature
  ) {
    return null;
  }

  // All three layers are present if the row was created via the live flow.
  // The HMAC verification itself happens server-side (see verifyCapture tRPC query);
  // here we just report what's stored. If the seal were tampered with later,
  // verifyCapture would still catch it because the stored signature wouldn't
  // re-verify against the canonical payload.
  return {
    live: true,
    stamped: Boolean(submission.captureCapturedAt),
    sealed: Boolean(submission.captureSealedAt),
    sealedAt: submission.captureSealedAt,
  };
}

/**
 * Shape of the submission row this helper needs.
 * Loose by design so any Prisma `BountySubmission` select satisfies it.
 */
export type SubmissionLike = Parameters<typeof deriveValidation>[0];

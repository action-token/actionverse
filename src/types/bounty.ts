import type { BountyStatus, BountySubmissionStatus, MediaType } from "@prisma/client";
import type { CaptureValidation } from "~/lib/action-cam/derive-validation";

export type { BountyStatus, BountySubmissionStatus };

export interface BountyCreator {
  id: string;
  name: string;
  profileUrl: string | null;
}

export interface BountyWinnerInfo {
  id: number;
  userId: string;
  prizeAmount: number;
  txHash: string | null;
  claimedAt: Date | null;
  selectedAt: Date;
  user: { id: string; name: string | null; image: string | null };
}

export interface BountyParticipantInfo {
  id: number;
  userId: string;
  joinedAt: Date;
  user: { id: string; name: string | null; image: string | null };
}

export interface BountySubmissionMediaInfo {
  id: number;
  url: string;
  type: MediaType;
  fileName: string | null;
}

/**
 * One capture inside a submission — one file (photo or video).
 * Every submission can have many captures (BountySubmissionInfo.captures).
 * Captures are the canonical place for action-cam fields now; the legacy
 * top-level fields on BountySubmissionInfo are kept for backwards compat
 * with rows created before this table existed.
 */
export interface BountySubmissionCaptureInfo {
  id: number;
  captureType: string;
  captureOriginalHash: string;
  captureSealedHash: string;
  captureStorageUrl: string;
  capturePreviewUrl: string | null;
  captureLat: number | null;
  captureLon: number | null;
  captureCapturedAt: Date | null;
  captureWallet: string | null;
  captureSignature: string | null;
  captureSealedAt: Date | null;
  status: BountySubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Derived 3-layer status. null if this capture is not Action Cam. */
  validation: CaptureValidation | null;
}

export interface BountySubmissionInfo {
  id: number;
  bountyId: number;
  userId: string;
  content: string;
  status: BountySubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  media: BountySubmissionMediaInfo[];
  user: { id: string; name: string | null; image: string | null };
  captures: BountySubmissionCaptureInfo[];
}

export interface BountyWithMeta {
  id: number;
  title: string;
  summary: string;
  description: string;
  prizeAmount: number;
  rewardNote: string | null;
  maxWinners: number;
  status: BountyStatus;
  txHash: string | null;
  instructions: string[];
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  creator: BountyCreator;
  _count: {
    participants: number;
    submissions: number;
    winners: number;
  };
}

export interface BountyActivity {
  id: string;
  type:
  | "join"
  | "submit"
  | "winner_selected"
  | "reward_claimed"
  | "status_change";
  bountyId: number;
  bountyTitle: string;
  userId?: string;
  userName?: string;
  userImage?: string | null;
  createdAt: Date;
  meta?: string;
}

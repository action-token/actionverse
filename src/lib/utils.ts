import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { MediaType } from "@prisma/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const BLANK_KEYWORD = "BLANK";

// Smart-contract NFTs store their raw upload MIME type (e.g. "image/png",
// "video/quicktime") on-chain and in the `Nft` table, unlike classic assets'
// `MediaType` enum column — normalize to the same enum everywhere both kinds
// of item share filtering, icons, or a card (store, my-collection, …).
export function mimeTypeToMediaType(mediaType?: string): MediaType {
  if (mediaType?.startsWith("image/")) return MediaType.IMAGE;
  if (mediaType?.startsWith("video/")) return MediaType.VIDEO;
  if (mediaType?.startsWith("audio/")) return MediaType.MUSIC;
  return MediaType.THREE_D;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I to avoid confusion

export function generateRedeemCode(): string {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("")
}
export function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function fmtShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Derive pin status from DB fields. */
export function derivePinStatus(
  endDate: string | null,
  remaining: number,
  limit: number,
): "active" | "expired" | "fully_claimed" | "collection_disabled" {
  if (limit === 0) return "collection_disabled";
  if (remaining === 0) return "fully_claimed";
  if (endDate && new Date(endDate) < new Date()) return "expired";
  return "active";
}

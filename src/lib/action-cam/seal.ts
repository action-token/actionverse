import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Action Cam seal: HMAC-SHA256 server-side signing of capture metadata.
 *
 * Why HMAC and not RSA/ECDSA:
 * - Symmetric. The server is both signer and verifier.
 * - No key distribution problem (secret stays in env, never leaves the server).
 * - Industry standard for "server proves this came from us" (JWT, signed cookies).
 *
 * Threat model:
 * - The HMAC secret never reaches the client or the browser.
 * - Anyone with the secret can forge seals, so rotation is required if leaked.
 * - Rotation invalidates existing seals (they were signed with the old secret).
 *
 * The signature covers a CANONICAL JSON payload so that:
 * - Key order doesn't change the signature.
 * - Client and server agree on byte layout byte-for-byte.
 *
 * Subtle gotcha: keys are sorted, but VALUES are not. If a value is itself
 * an object (none are right now), nested sort would be needed. The current
 * schema only has primitives + null.
 */

export const captureMetadataSchema = z.object({
  bountyId: z.number().int().positive(),
  userId: z.string().min(1),
  captureType: z.enum(["PHOTO", "VIDEO", "AUDIO"]),
  // sha256 of the raw media bytes as captured by the native camera/mic (before any overlay).
  // Lowercase hex, 64 chars.
  originalHash: z.string().regex(/^[a-f0-9]{64}$/, "originalHash must be lowercase sha256 hex"),
  // sha256 of the canvas-rendered PREVIEW image with provenance burned in.
  // For PHOTO captures this is the same as originalHash (the photo IS the preview).
  // For VIDEO captures this is the first frame with the overlay strip drawn on it.
  // For AUDIO captures this is a generated audio card with the overlay strip drawn on it.
  previewHash: z.string().regex(/^[a-f0-9]{64}$/, "previewHash must be lowercase sha256 hex"),
  // ISO 8601 timestamp from the SERVER at seal time (NOT from the client clock).
  capturedAt: z.string().datetime({ offset: true }),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  wallet: z.string().min(1),
});

export type CaptureMetadata = z.infer<typeof captureMetadataSchema>;

/**
 * Build the canonical byte payload that gets signed.
 * - Keys sorted alphabetically for deterministic output.
 * - No whitespace.
 * - Numbers preserved as-is (no string coercion).
 * - null preserved as null.
 */
export function buildCanonicalPayload(meta: CaptureMetadata): string {
  const sortedKeys = Object.keys(meta).sort();
  const ordered: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    ordered[key] = meta[key as keyof CaptureMetadata];
  }
  return JSON.stringify(ordered);
}

/**
 * Sign capture metadata. Returns lowercase hex HMAC-SHA256.
 * Caller is responsible for storing the signature alongside the metadata.
 */
export function signCapture(meta: CaptureMetadata, secret: string): string {
  const payload = buildCanonicalPayload(meta);
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a capture's signature. Uses timingSafeEqual to prevent timing attacks.
 *
 * Returns false (never throws) for:
 * - Empty / non-hex signature
 * - Wrong length
 * - Tampered metadata
 * - Wrong secret
 */
export function verifyCapture(
  meta: CaptureMetadata,
  signature: string,
  secret: string,
): boolean {
  if (!signature || typeof signature !== "string") return false;
  // HMAC-SHA256 hex = 64 chars. Anything else is malformed.
  if (signature.length !== 64) return false;
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;

  const expected = signCapture(meta, secret);
  // Both are 64-char lowercase hex now, safe to compare.
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

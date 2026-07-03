import { z } from "zod";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { s3Client } from "~/server/s3";
import { env } from "~/env";

/**
 * Action Cam storage router — presigned upload URLs for the live-capture flow.
 *
 * This router is SEPARATE from the generic `s3Router` (which serves the rest
 * of the app: profile pictures, marketplace media, etc.). Keeping action-cam
 * uploads in their own router means:
 *   - The generic `s3Router` API stays untouched and stable for other pages
 *   - We can evolve the capture-specific key layout / metadata without
 *     touching the general-purpose uploader
 *   - Permissions, rate limits, or per-route auth can differ without cross-
 *     contamination
 *
 * Why direct upload (not tRPC with base64)?
 *   - No 33% base64 bloat
 *   - No Next.js body-size limits
 *   - No server-side decode + re-upload (saves CPU + bandwidth)
 *   - Real-time upload progress via XHR (fetch doesn't expose upload progress)
 *
 * Public read access: the returned publicUrl is publicly readable. Bounty
 * proofs are public by design (the bounty owner reviews them). If you ever
 * want private access, swap the bucket policy to presigned GET URLs — same
 * keys, different access policy.
 *
 * Key layout:
 *   action-cam/{photo|video}/{userId}/{purpose=original|preview}/{nanoid}.{ext}
 */

export const actionCamStorageRouter = createTRPCRouter({
  /**
   * Get a presigned PUT URL for a file the client wants to upload.
   * The client XHR-PUTs the file directly to S3 with progress tracking.
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
        captureType: z.enum(["PHOTO", "VIDEO"]),
        purpose: z.enum(["original", "preview"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const ext = (
        input.fileName.split(".").pop()?.toLowerCase() ||
        (input.purpose === "preview"
          ? "jpg"
          : input.captureType === "PHOTO"
            ? "jpg"
            : "mp4")
      ).replace(/[^a-z0-9]/g, "");

      const id = randomBytes(12).toString("hex");
      const key = `action-cam/${input.captureType.toLowerCase()}/${userId}/${input.purpose}/${id}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: key,
        ContentType: input.contentType,
        Metadata: {
          "action-cam-user-id": userId,
          "action-cam-type": input.captureType,
          "action-cam-purpose": input.purpose,
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 600, // 10 minutes — generous for slow mobile uploads
      });

      const publicUrl = `https://${env.AWS_BUCKET_NAME}.s3.amazonaws.com/${key}`;

      return { uploadUrl, key, publicUrl };
    }),

  /**
   * HEAD-check an uploaded object. Used by submitCapture to confirm the
   * client actually uploaded the file before signing/persisting. Cheap (no
   * body transfer). Catches the "client lied about uploading" case.
   */
  verifyObjectExists: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1).max(500),
        expectedSize: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const res = await s3Client.send(
          new HeadObjectCommand({
            Bucket: env.AWS_BUCKET_NAME,
            Key: input.key,
          }),
        );
        const size = res.ContentLength ?? -1;
        const exists = size >= 0;
        const sizeMatches =
          input.expectedSize === undefined || size === input.expectedSize;
        return { exists, size, sizeMatches };
      } catch {
        return { exists: false, size: -1, sizeMatches: false };
      }
    }),
});

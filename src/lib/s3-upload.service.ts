import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { env } from "~/env";

export class S3UploadService {
  private static s3Client = new S3Client({
    region: env.AWS_BUCKET_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  /**
   * Upload a base64 image to S3 and return the public URL
   * @param base64Data - Base64 encoded image data (with or without data URI prefix)
   * @param mimeType - MIME type of the image (e.g., 'image/png', 'image/jpeg')
   * @returns Public URL of the uploaded image
   */
  static async uploadBase64Image(
    base64Data: string,
    mimeType: string = "image/png",
  ): Promise<string> {
    try {
      // Remove data URI prefix if present
      const base64String = base64Data.includes(",")
        ? base64Data.split(",")[1]
        : base64Data;

      // Convert base64 to buffer
      const buffer = Buffer.from(base64String, "base64");

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const extension = mimeType.split("/")[1] || "png";
      const filename = `generated-images/${timestamp}-${randomString}.${extension}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      return `https://${env.AWS_BUCKET_NAME}.s3.amazonaws.com/${filename}`;

    } catch (error) {
      console.error("Error uploading to S3:", error);
      throw new Error(
        `Failed to upload image to S3: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Upload multiple base64 images to S3 in parallel
   * @param images - Array of objects with base64 data and mimeType
   * @returns Array of public URLs
   */
  static async uploadMultipleImages(
    images: Array<{ base64: string; mimeType?: string }>,
  ): Promise<string[]> {
    const uploadPromises = images.map((img) =>
      this.uploadBase64Image(img.base64, img.mimeType),
    );
    return Promise.all(uploadPromises);
  }
}

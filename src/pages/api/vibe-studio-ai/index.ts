import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type {
  VideoModel,
  VideoSeconds,
  VideoSize,
} from "openai/resources/videos";
import { env } from "~/env";
import { qstash, generateJobId, createJob } from "~/lib/qstash"
import { getToken } from "next-auth/jwt";
import { BASE_URL } from "~/lib/common";



export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await getToken({ req });
  if (!token?.sub) {
    res.status(401).json({
      error: "User is not authenticated",
    });
    return;
  }

  if (req.method === "GET") {
    return res.status(200).json({
      message: "AI Generation API",
      endpoints: {
        POST: "Generate images or videos",
        status: "GET /api/generate/status/[jobId]",
      },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      prompt,
      overlayText,
      numberOfImages,

      referenceImage,


    } = req.body as {
      prompt: string;

      numberOfImages: number;
      overlayText?: string;
      referenceImage?: string;


    };
    // Generate a unique job ID
    const jobId = generateJobId()
    // Create job record in Redis
    await createJob(jobId, {
      status: "pending",
      message: "Job queued for processing",
    })

    await qstash.publishJSON({
      url: `${BASE_URL}/api/vibe-studio-ai/process`,
      body: {
        jobId,
        prompt,
        numberOfImages,
        referenceImage,
        overlayText,
        userId: token.sub,
      },
      retries: 1,
    })
    return res.json({
      jobId,
      status: "pending",
      message: "Generation job queued successfully",
    })

  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ error: "Failed to generate content" });
  }
}

import type { NextApiRequest, NextApiResponse } from "next"
import { getToken } from "next-auth/jwt";
import { getJob } from "~/lib/qstash"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const token = await getToken({ req });
  if (!token?.sub) {
    res.status(401).json({
      error: "User is not authenticated",
    });
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { jobId } = req.query

    if (!jobId || typeof jobId !== "string") {
      return res.status(400).json({ error: "Job ID is required" })
    }

    const job = await getJob(jobId)

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    return res.json(job)
  } catch (error) {
    console.error("Status check error:", error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get status",
    })
  }
}

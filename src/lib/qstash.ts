
import { Client } from "@upstash/qstash"
import { Redis } from "@upstash/redis"
import { env } from "~/env"

// Initialize QStash client for background jobs
export const qstash = new Client({
    token: env.QSTASH_TOKEN,
})

// Initialize Redis for job status storage
export const redis = new Redis({
    url: env.KV_REST_API_URL,
    token: env.KV_REST_API_TOKEN,
})

// Job status types
export type JobStatus = "pending" | "processing" | "completed" | "failed"

export interface JobData {
    jobId: string
    status: JobStatus
    progress?: number
    message?: string
    error?: string
    result?: {
        items: Array<{
            type: string
            url: string
        }>
    }
    createdAt: number
    updatedAt: number
}

// Helper to generate unique job IDs
export function generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Job status helpers
export async function createJob(jobId: string, initialData?: Partial<JobData>): Promise<JobData> {
    const job: JobData = {
        jobId,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...initialData,
    }
    await redis.set(`job:${jobId}`, JSON.stringify(job), { ex: 3600 }) // 1 hour TTL
    return job
}

export async function updateJob(jobId: string, updates: Partial<JobData>): Promise<JobData | null> {
    const existing = await getJob(jobId)
    if (!existing) return null

    const updated: JobData = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
    }
    await redis.set(`job:${jobId}`, JSON.stringify(updated), { ex: 3600 })
    return updated
}

export async function getJob(jobId: string): Promise<JobData | null> {
    const data = await redis.get(`job:${jobId}`)
    if (!data) return null
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof data === "string" ? JSON.parse(data) : data as JobData
}

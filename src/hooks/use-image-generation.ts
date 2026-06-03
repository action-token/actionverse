"use client"

import { useState, useCallback, useRef } from "react"

export interface GeneratedImage {
    url: string
    type: "image" | "video"
}

export interface GenerationParams {
    category: string
    overlayText?: string
    style: string
    customPrompt: string
    referenceImage: string | null
    creationMode: "transform" | "generate"
}

interface JobStatus {
    status: "pending" | "processing" | "completed" | "failed"
    message: string
    progress?: number
    result?: {
        items: Array<{ url: string; type: "image" | "video" }>
    }
}

interface UseImageGenerationReturn {
    isGenerating: boolean
    progress: number
    statusMessage: string
    error: string | null
    generateImage: (params: GenerationParams) => Promise<GeneratedImage>
    clearError: () => void
}


async function pollJobStatus(
    jobId: string,
    onProgress: (progress: number, message: string) => void,
    signal?: AbortSignal,
): Promise<JobStatus> {
    const POLL_INTERVAL = 2000 // 2 seconds
    const MAX_ATTEMPTS = 60 // 2 minutes max

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (signal?.aborted) {
            throw new Error("Generation cancelled")
        }

        const response = await fetch(`/api/vibe-studio-ai/status/${jobId}`)

        if (!response.ok) {
            throw new Error("Failed to check job status")
        }

        const job: JobStatus = await response.json() as JobStatus

        onProgress(job.progress ?? 0, job.message)

        if (job.status === "completed") {
            return job
        }

        if (job.status === "failed") {
            throw new Error(job.message || "Generation failed")
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }

    throw new Error("Generation timed out")
}

export function useImageGeneration(): UseImageGenerationReturn {
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState("")
    const [error, setError] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const clearError = useCallback(() => setError(null), [])

    const generateImage = useCallback(async (params: GenerationParams): Promise<GeneratedImage> => {
        const { category, overlayText, style, customPrompt, referenceImage, creationMode } = params
        console.log("Generating image with params:", params)
        // Cancel any existing generation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        setIsGenerating(true)
        setError(null)
        setProgress(0)
        setStatusMessage("Submitting job...")

        try {
            // Build the prompt
            const basePrompt = `A ${style} style ${category.toLowerCase()} greeting card design`
            const fullPrompt = customPrompt ? `${basePrompt}. ${customPrompt}` : basePrompt

            // Convert reference image to base64 if in transform mode

            const submitResponse = await fetch("/api/vibe-studio-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    numberOfImages: 1,
                    referenceImage,
                    category,
                    style,
                    creationMode,
                    overlayText
                }),
            })

            if (!submitResponse.ok) {

                throw new Error("Failed to submit generation job")
            }

            const { jobId } = await submitResponse.json() as { jobId: string }
            setProgress(10)
            setStatusMessage("Job queued, starting generation...")

            const completedJob = await pollJobStatus(
                jobId,
                (p, msg) => {
                    setProgress(p)
                    setStatusMessage(msg)
                },
                abortControllerRef.current.signal,
            )

            // Get the first generated image
            const generatedItem = completedJob.result?.items?.[0]
            if (!generatedItem?.url) {
                throw new Error("No image was generated")
            }

            return {
                url: generatedItem.url,
                type: generatedItem.type || "image",
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to generate image"
            setError(message)
            throw err
        } finally {
            setIsGenerating(false)
            setProgress(0)
            setStatusMessage("")
            abortControllerRef.current = null
        }
    }, [])

    return {
        isGenerating,
        progress,
        statusMessage,
        error,
        generateImage,
        clearError,
    }
}

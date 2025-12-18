import type { NextApiRequest, NextApiResponse } from "next"
import { verifySignature } from "@upstash/qstash/nextjs"
import { updateJob } from "~/lib/qstash"
import OpenAI from "openai"
import { GoogleGenAI, Part } from "@google/genai"
import { env } from "~/env"
import { S3UploadService } from "~/lib/s3-upload.service"

export const config = {
    api: {
        bodyParser: false,
    },
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GeneratedItemResult {
    url: string
    type: "image" | "video"
}

interface ProcessJobRequest {
    jobId: string
    prompt: string
    numberOfImages: number
    referenceImage?: string
    overlayText?: string
    userId: string
}

interface ProcessJobResult {
    success: boolean
    items: GeneratedItemResult[]
}

function extractBase64FromDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match?.[1] && match[2]) {
        return { mimeType: match[1], base64: match[2] }
    }
    return null
}

async function getRawBody(req: NextApiRequest): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks).toString("utf-8")
}

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null
const gemini = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null

// ============================================================================
// IMAGE GENERATION HANDLERS
// ============================================================================

async function generateGeminiImage(
    params: ProcessJobRequest,
): Promise<GeneratedItemResult[]> {
    const items: GeneratedItemResult[] = []
    const { numberOfImages, referenceImage, prompt, overlayText } = params
    const fullPrompt = overlayText
        ? `Create a variation based on this reference image. ${prompt}. Include this text overlay: "${overlayText}"`
        : `Create a variation based on this reference image. ${prompt}`
    if (!gemini) {
        throw new Error("Google API key not configured")
    }
    console.log("Full prompt for Gemini:", fullPrompt)
    console.log(`Generating ${numberOfImages} images with Gemini`)

    if (referenceImage) {
        const imageData = extractBase64FromDataUrl(referenceImage)
        if (!imageData) {
            throw new Error("Invalid reference image format")
        }

        console.log(`Using reference image (${imageData.mimeType})`)

        // Generate images with reference
        for (let i = 0; i < Math.min(numberOfImages, 10); i++) {
            try {
                const parts: Part[] = [
                    {
                        text: fullPrompt,
                    },
                    {
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.base64,
                        },
                    },
                ]

                const response = await gemini.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: parts,
                })

                // Extract generated image from response
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData?.data && part.inlineData?.mimeType) {
                            const awsURL = await S3UploadService.uploadBase64Image(
                                part.inlineData?.data,
                                part.inlineData?.mimeType ?? "image/png",
                            )
                            console.log("Generated image uploaded to S3:", awsURL)
                            items.push({ url: awsURL, type: "image" })
                            break
                        }
                    }
                }
            } catch (error) {
                console.error(`Gemini generation error (iteration ${i + 1}):`, error)
                // Continue to next iteration
            }
        }
    } else {
        // Generate without reference image
        console.log("Generating without reference image")

        for (let i = 0; i < Math.min(numberOfImages, 10); i++) {
            try {
                const response = await gemini.models.generateContent({
                    model: "gemini-2.5-flash-image",
                    contents: fullPrompt,
                })

                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData?.data && part.inlineData?.mimeType) {
                            const generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                            items.push({ url: generatedImageUrl, type: "image" })
                            break
                        }
                    }
                }
            } catch (error) {
                console.error(`Gemini generation error (iteration ${i + 1}):`, error)
            }
        }
    }

    return items
}

async function generateOpenAIImage(
    params: ProcessJobRequest,
): Promise<GeneratedItemResult[]> {
    const items: GeneratedItemResult[] = []
    const { numberOfImages, prompt } = params

    if (!openai) {
        throw new Error("OpenAI API key not configured")
    }

    console.log("Generating images with OpenAI DALL-E")
    const response = await openai.images.generate({
        model: "dall-e-2",
        prompt: prompt,
        n: Math.min(numberOfImages, 10),
        size: "512x512",
    })

    for (const img of response.data) {
        if (img.url) {
            items.push({ url: img.url, type: "image" })
        }
    }

    return items
}

// ============================================================================
// MAIN PROCESS JOB FUNCTION
// ============================================================================

async function processJob(body: ProcessJobRequest): Promise<ProcessJobResult> {
    const { jobId, referenceImage } = body

    await updateJob(jobId, {
        status: "processing",
        message: "Starting generation...",
        progress: 10,
    })

    let items: GeneratedItemResult[] = []

    try {
        // Use Gemini if available, otherwise use OpenAI
        // Gemini is preferred for reference images since it supports all formats
        if (gemini) {
            console.log("Using Gemini for image generation")
            items = await generateGeminiImage(body)
        } else if (openai) {
            console.log("Using OpenAI for image generation")
            items = await generateOpenAIImage(body)
        } else {
            throw new Error("No image generation API configured")
        }

        if (items.length === 0) {
            console.warn("No items generated")
            throw new Error("No images were generated")
        }

        await updateJob(jobId, {
            status: "completed",
            message: "Generation complete!",
            progress: 100,
            result: { items },
        })

        return { success: true, items }
    } catch (error) {
        console.error(`Generation error:`, error)

        await updateJob(jobId, {
            status: "failed",
            message: error instanceof Error ? error.message : "Generation failed",
            progress: 100,
            result: { items },
        })

        throw error
    }
}

// ============================================================================
// API HANDLER
// ============================================================================

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" })
        return
    }

    try {
        let body: ProcessJobRequest

        if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
            body = req.body as ProcessJobRequest
        } else {
            const rawBody = await getRawBody(req)
            body = JSON.parse(rawBody) as ProcessJobRequest
        }

        if (!body.jobId) {
            res.status(400).json({ error: "Missing jobId in request body" })
            return
        }

        await processJob(body)

        res.json({ success: true })
    } catch (error) {
        console.error("Process handler error:", error)
        res.status(500).json({
            error: error instanceof Error ? error.message : "Processing failed",
        })
    }
}

export default process.env.NODE_ENV === "development" ? handler : verifySignature(handler)
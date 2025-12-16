import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type")
        res.status(200).end()
        return
    }

    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" })
        return
    }

    const { url: imageUrl } = req.query

    if (!imageUrl || typeof imageUrl !== "string") {
        res.status(400).json({ error: "Missing url parameter" })
        return
    }

    try {
        const response = await fetch(imageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        })

        if (!response.ok) {
            res.status(response.status).json({ error: `Failed to fetch video: ${response.statusText}` })
            return
        }

        const buffer = await response.arrayBuffer()
        const contentType = response.headers.get("content-type") ?? "image/jpeg"

        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
        res.setHeader("Content-Type", contentType)
        res.setHeader("Content-Length", buffer.byteLength.toString())
        res.setHeader("Cache-Control", "public, max-age=3600")

        res.status(200).end(Buffer.from(buffer))
    } catch (error) {
        console.error("Video proxy error:", error)
        res.status(500).json({ error: "Failed to proxy video" })
    }
}

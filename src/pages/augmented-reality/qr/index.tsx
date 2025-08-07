"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import jsQR from "jsqr"
import { Button } from "~/components/shadcn/ui/button"
import { ArrowLeft, CameraOff, QrCode } from 'lucide-react'
import { motion } from "framer-motion"

export default function QRScannerPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const router = useRouter()
    const [scanning, setScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const animationFrameId = useRef<number | null>(null)
    const [isVideoReady, setIsVideoReady] = useState(false)

    const stopScanner = useCallback(() => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current)
            animationFrameId.current = null
        }
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop()
            })
            setStream(null)
        }
        setScanning(false)
        setIsVideoReady(false)
    }, [stream])

    const tick = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !scanning) {
            return
        }

        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current
            const video = videoRef.current
            const ctx = canvas.getContext("2d")

            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                canvas.height = video.videoHeight
                canvas.width = video.videoWidth
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                })

                if (code) {
                    console.log("QR Code detected:", code.data)

                    // Stop scanning immediately to prevent multiple detections
                    stopScanner()

                    // Attempt to parse JSON data
                    try {
                        const parsedData = JSON.parse(code.data) as { id: string };
                        if (parsedData && typeof parsedData === 'object' && parsedData.id) {
                            router.push(`/augmented-reality/qr/${parsedData.id}`)
                            return
                        }
                    } catch (e) {
                        // Not JSON, treat as plain text
                    }

                    // Treat as direct ID string
                    if (code.data) {
                        router.push(`/augmented-reality/qr/${encodeURIComponent(code.data)}`)
                        return
                    }
                }
            }
        }

        if (scanning) {
            animationFrameId.current = requestAnimationFrame(tick)
        }
    }, [scanning, stopScanner, router])

    const startScanner = useCallback(async () => {
        setError(null)
        setIsVideoReady(false)

        try {
            // Stop any existing stream first
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }

            // Request camera access with better constraints
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            }

            const newStream = await navigator.mediaDevices.getUserMedia(constraints)
            setStream(newStream)

            if (videoRef.current) {
                videoRef.current.srcObject = newStream
                videoRef.current.setAttribute("playsinline", "true")
                videoRef.current.setAttribute("muted", "true")

                // Wait for video to be ready
                await new Promise<void>((resolve, reject) => {
                    if (!videoRef.current) {
                        reject(new Error("Video element not available"))
                        return
                    }

                    const video = videoRef.current

                    const onLoadedMetadata = () => {
                        video.removeEventListener("loadedmetadata", onLoadedMetadata)
                        video.removeEventListener("error", onError)
                        setIsVideoReady(true)
                        resolve()
                    }

                    const onError = (e: Event) => {
                        video.removeEventListener("loadedmetadata", onLoadedMetadata)
                        video.removeEventListener("error", onError)
                        reject(new Error("Video failed to load"))
                    }

                    video.addEventListener("loadedmetadata", onLoadedMetadata)
                    video.addEventListener("error", onError)
                })

                await videoRef.current.play()
                setScanning(true)

                // Start the scanning loop
                tick()
            }
        } catch (err) {
            console.error("Error accessing camera:", err)
            let errorMessage = "Failed to access camera. "

            if (err instanceof Error) {
                if (err.name === "NotAllowedError") {
                    errorMessage += "Please allow camera permissions and try again."
                } else if (err.name === "NotFoundError") {
                    errorMessage += "No camera found on this device."
                } else if (err.name === "NotReadableError") {
                    errorMessage += "Camera is already in use by another application."
                } else {
                    errorMessage += err.message
                }
            } else {
                errorMessage += "Please ensure permissions are granted and no other app is using the camera."
            }

            setError(errorMessage)
            setScanning(false)
            setIsVideoReady(false)
        }
    }, [stream, tick])

    // Start scanner on mount
    useEffect(() => {
        startScanner()

        // Cleanup on unmount
        return () => {
            stopScanner()
        }
    }, []) // Remove startScanner and stopScanner from dependencies to avoid infinite loop

    // Handle tick animation
    useEffect(() => {
        if (scanning && isVideoReady) {
            animationFrameId.current = requestAnimationFrame(tick)
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [scanning, isVideoReady, tick])

    return (
        <div className="relative flex h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-slate-950 mx-auto">
            {/* Back Button */}
            <Button
                className="absolute left-4 top-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={() => router.back()}
            >
                <ArrowLeft className="h-6 w-6" />
                <span className="ml-2">Back</span>
            </Button>

            <h1 className="absolute top-20 z-50 text-2xl font-bold text-white">
                Scan QR Code
            </h1>

            <div className="relative w-full h-full flex items-center justify-center">
                {error ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center p-4 bg-red-600/90 text-white rounded-lg shadow-lg mx-4 z-20"
                    >
                        <CameraOff className="w-16 h-16 mx-auto mb-4" />
                        <p className="font-semibold text-lg mb-2">Camera Error</p>
                        <p className="text-sm mb-4">{error}</p>
                        <Button
                            onClick={startScanner}
                            variant="outline"
                            className="bg-white text-red-700 hover:bg-slate-100"
                        >
                            Try Again
                        </Button>
                    </motion.div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover z-0"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanning overlay */}
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="w-64 h-64 border-4 border-white border-dashed rounded-lg animate-pulse">
                                <QrCode className="w-full h-full text-white/50 p-8" />
                            </div>
                        </div>

                        {/* Loading state */}
                        {!isVideoReady && !error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center z-30"
                            >
                                <div className="text-white text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                                    <p>Initializing camera...</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Manual start button if needed */}
                        {!scanning && !error && isVideoReady && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute bottom-32 z-20"
                            >
                                <Button
                                    onClick={startScanner}
                                    className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-6 py-3 rounded-full shadow-lg"
                                >
                                    Start Scanner
                                </Button>
                            </motion.div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

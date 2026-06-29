"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "~/components/shadcn/ui/button"
import { ArrowLeft, CameraOff, CheckCircle2, XCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "~/utils/api"
import toast from "react-hot-toast"

const SCANNER_ID = "qr-scanner"

type ScanStatus = "idle" | "processing" | "success" | "error"

export default function QRScannerPage() {
    const router = useRouter()
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
    const [statusMessage, setStatusMessage] = useState<string>("")

    const scannerRef = useRef<InstanceType<typeof Html5Qrcode> | null>(null)
    const scanStatusRef = useRef<ScanStatus>("idle")

    // Keep ref in sync so the scanner callback (stale closure) can read latest value
    useEffect(() => {
        scanStatusRef.current = scanStatus
    }, [scanStatus])

    const consumePin = api.game.consumePin.useMutation({
        onSuccess: (data, variables) => {
            if (data.success) {
                setScanStatus("success")
                setStatusMessage("Pin consumed successfully!")
                toast.success("Pin consumed!")
                return setTimeout(() => {
                    router.replace(`/action/collections/${variables.postId ? `post/${variables.postId}` : `${variables.pinId}`}`)
                }, 2500)
            } else {
                setScanStatus("error")
                setStatusMessage("Pin could not be consumed.")
                toast.error("Pin could not be consumed.")
                return setTimeout(() => {
                    router.replace(`/action/collections`)
                }, 2500)

            }
            setTimeout(() => setScanStatus("idle"), 2500)
        },
        onError: (err) => {
            console.error("Error consuming pin:", err)
            setScanStatus("error")
            setStatusMessage(err.message ?? "Failed to consume pin. Please try again.")
            toast.error("Failed to consume pin.")
            setTimeout(() => setScanStatus("idle"), 2500)
        },
    })

    const consumePinRef = useRef(consumePin)
    useEffect(() => {
        consumePinRef.current = consumePin
    }, [consumePin])

    const stopScanner = async () => {
        const scanner = scannerRef.current
        if (!scanner) return
        scannerRef.current = null
        try {
            await scanner.stop()
        } catch {
            // ignore — scanner may already be stopped
        }
        try {
            scanner.clear()
        } catch {
            // ignore
        }
    }

    const startScanner = async () => {
        setCameraError(null)
        setScanStatus("idle")
        scanStatusRef.current = "idle"

        await stopScanner()
        await new Promise((r) => setTimeout(r, 100))

        try {
            const scannerElement = document.getElementById(SCANNER_ID)
            console.log("[Scanner] DOM element found:", !!scannerElement)

            if (!scannerElement) {
                throw new Error("Scanner container not found in DOM")
            }

            const scanner = new Html5Qrcode(SCANNER_ID)
            scannerRef.current = scanner

            console.log("[Scanner] Starting scanner...")
            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 60,
                    aspectRatio: 1.0,
                    disableFlip: false,
                },
                (decodedText) => {
                    console.log("[Scanner] QR code detected:", decodedText)
                    if (scanStatusRef.current !== "idle") return
                    try {
                        const url = new URL(decodedText)
                        if (url.pathname === "/action/qr" && url.searchParams.has("pinId")) {
                            const pinId = url.searchParams.get("pinId")
                            if (pinId) {
                                scanStatusRef.current = "processing"
                                setScanStatus("processing")
                                setStatusMessage("Processing QR code…")
                                consumePinRef.current.mutate({ pinId: pinId })
                            }
                        }
                        else if (url.pathname === "/action/qr" && url.searchParams.has("postId")) {
                            const postId = url.searchParams.get("postId")
                            if (postId) {
                                scanStatusRef.current = "processing"
                                setScanStatus("processing")
                                setStatusMessage("Processing QR code…")
                                consumePinRef.current.mutate({ postId: postId })
                            }
                        }

                        else {
                            toast("QR code not recognised — wrong format.")
                        }
                    } catch {
                        toast("Not a valid QR code.")
                    }
                },
                (errorMessage) => {
                    console.log("[Scanner] Scan error:", errorMessage)
                }
            )
            console.log("[Scanner] Scanner started successfully")
        } catch (err) {
            console.error("[Scanner] Error:", err)
            scannerRef.current = null

            let errorMessage = "Failed to access camera. "
            if (err instanceof Error) {
                if (err.message.includes("NotAllowedError") || err.message.includes("Permission")) {
                    errorMessage += "Please allow camera permissions and try again."
                } else if (err.message.includes("NotFoundError")) {
                    errorMessage += "No camera found on this device."
                } else if (err.message.includes("NotReadableError")) {
                    errorMessage += "Camera is already in use by another application."
                } else {
                    errorMessage += err.message
                }
            }
            setCameraError(errorMessage)
        }
    }

    useEffect(() => {
        startScanner()
        return () => { void stopScanner() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const isProcessing = scanStatus === "processing"
    const isSuccess = scanStatus === "success"
    const isError = scanStatus === "error"

    return (
        <div className="relative flex h-screen w-full flex-col items-center justify-center bg-black overflow-hidden">
            {/* Back Button */}
            <Button
                className="absolute left-4 top-4 z-50 bg-black/50 text-white border-none hover:bg-black/70"
                onClick={async () => {
                    await stopScanner()
                    router.replace("/action/home")
                }}
            >
                <ArrowLeft className="h-5 w-5" />
                <span className="ml-2">Back</span>
            </Button>

            <h1 className="absolute top-16 z-50 text-xl font-bold text-white tracking-wide">
                Scan QR Code
            </h1>

            {/* Camera error state */}
            {cameraError ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-6 bg-red-600/90 text-white rounded-2xl shadow-xl mx-6 z-20"
                >
                    <CameraOff className="w-14 h-14 mx-auto mb-3" />
                    <p className="font-semibold text-lg mb-1">Camera Error</p>
                    <p className="text-sm mb-5 opacity-90">{cameraError}</p>
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
                    {/* Scanner viewport — must always be in DOM for Html5Qrcode to attach to */}
                    <div className="relative flex items-center justify-center w-full max-w-sm aspect-square overflow-hidden">
                        <div id={SCANNER_ID} className="w-full h-full overflow-hidden" />

                        {/* Corner frame overlay */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="relative w-64 h-64">
                                {[
                                    "top-0 left-0 border-t-4 border-l-4 rounded-tl-lg",
                                    "top-0 right-0 border-t-4 border-r-4 rounded-tr-lg",
                                    "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg",
                                    "bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg",
                                ].map((cls, i) => (
                                    <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
                                ))}

                                {/* Scanning line animation */}
                                {scanStatus === "idle" && (
                                    <motion.div
                                        className="absolute left-1 right-1 h-0.5 bg-white/70 rounded-full"
                                        animate={{ top: ["10%", "90%", "10%"] }}
                                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <p className="mt-6 text-white/60 text-sm">
                        Point your camera at a QR code
                    </p>

                    {/* Status overlay */}
                    <AnimatePresence>
                        {(isProcessing || isSuccess || isError) && (
                            <motion.div
                                key={scanStatus}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute inset-0 bg-black/70 flex items-center justify-center z-30"
                            >
                                <div className="text-white text-center px-8 py-8 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl min-w-[220px]">
                                    {isProcessing && (
                                        <>
                                            <div className="animate-spin rounded-full h-14 w-14 border-2 border-white/30 border-t-white mx-auto mb-4" />
                                            <p className="text-lg font-semibold">Processing…</p>
                                            <p className="text-sm text-white/60 mt-1">Please hold still</p>
                                        </>
                                    )}
                                    {isSuccess && (
                                        <>
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-3" />
                                            </motion.div>
                                            <p className="text-lg font-semibold text-green-300">Success!</p>
                                            <p className="text-sm text-white/60 mt-1">{statusMessage}</p>
                                        </>
                                    )}
                                    {isError && (
                                        <>
                                            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-3" />
                                            <p className="text-lg font-semibold text-red-300">Failed</p>
                                            <p className="text-sm text-white/60 mt-1">{statusMessage}</p>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    )
}
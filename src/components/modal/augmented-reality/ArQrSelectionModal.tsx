"use client"
import { useState } from "react"
import { useRouter } from "next/router"
import { Dialog, DialogContent } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { QrCode, ScanLine, X } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"

export default function ArQrSelectionModal() {
    const { isOpen, onClose, type } = useModal()
    const router = useRouter()
    const [loadingForAR, setLoadingForAR] = useState(false)
    const [loadingForQR, setLoadingForQR] = useState(false)

    const isModalOpen = isOpen && type === "ArQrSelection"

    const handleGoToAR = () => {
        setLoadingForAR(true)
        setTimeout(() => {
            onClose()
            router.push("/augmented-reality/ar")
            setLoadingForAR(false)
        }, 3000) // Delay to simulate preparation
    }

    const handleGoToQR = () => {
        setLoadingForQR(true)
        setTimeout(() => {
            onClose()
            router.push("/augmented-reality/qr")
            setLoadingForQR(false)
        }, 3000) // Delay to simulate preparation
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 bg-transparent border-0 shadow-none">
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                            onClick={onClose}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", duration: 0.5 }}
                                className="bg-card rounded-3xl w-[85vw] max-w-md p-6 shadow-2xl border border-border"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-foreground">Choose Experience</h2>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onClose}
                                        className="p-1 h-8 w-8 rounded-full hover:bg-muted text-foreground"
                                    >
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>

                                {/* Options Container */}
                                <div className="space-y-4">
                                    {/* AR Option */}
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Button
                                            onClick={handleGoToAR}
                                            disabled={loadingForAR || loadingForQR}
                                            className="w-full h-auto p-5 bg-secondary hover:bg-secondary/80 border-2 border-transparent hover:border-primary/50 rounded-2xl transition-all duration-300 text-secondary-foreground"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                {/* Icon Container */}
                                                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <ScanLine className="h-12 w-12 text-primary" />
                                                </div>

                                                {/* Title */}
                                                <h3 className="text-xl font-bold text-foreground">Go to AR</h3>

                                                {/* Description */}
                                                <p className="text-sm text-muted-foreground text-center leading-5">
                                                    {loadingForAR
                                                        ? "Preparing AR experience..."
                                                        : "Explore AR pins and collect rewards"
                                                    }
                                                </p>

                                                {/* Loading indicator */}
                                                {loadingForAR && (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                                                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </Button>
                                    </motion.div>

                                    {/* QR Option */}
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Button
                                            onClick={handleGoToQR}
                                            disabled={loadingForAR || loadingForQR}
                                            className="w-full h-auto p-5 bg-secondary hover:bg-secondary/80 border-2 border-transparent hover:border-accent/50 rounded-2xl transition-all duration-300 text-secondary-foreground"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                {/* Icon Container */}
                                                <div className="w-20 h-20 rounded-full bg-accent/30 flex items-center justify-center">
                                                    <QrCode className="h-12 w-12 text-accent-foreground" />
                                                </div>

                                                {/* Title */}
                                                <h3 className="text-xl font-bold text-foreground">Go to QR</h3>

                                                {/* Description */}
                                                <p className="text-sm text-muted-foreground text-center leading-5">
                                                    {loadingForQR
                                                        ? "Preparing QR experience..."
                                                        : "Scan QR codes to collect pins and unlock rewards"
                                                    }
                                                </p>

                                                {/* Loading indicator */}
                                                {loadingForQR && (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-2 h-2 bg-accent-foreground rounded-full animate-bounce"></div>
                                                        <div className="w-2 h-2 bg-accent-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                        <div className="w-2 h-2 bg-accent-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </Button>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}

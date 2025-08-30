"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { QrCode, ScanLine, X, Sparkles, Zap } from 'lucide-react'
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
        }, 2000)
    }

    const handleGoToQR = () => {
        setLoadingForQR(true)
        setTimeout(() => {
            onClose()
            router.push("/augmented-reality/qr")
            setLoadingForQR(false)
        }, 2000)
    }

    const LoadingDots = ({ color = "primary" }: { color?: string }) => (
        <div className="flex items-center space-x-1">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-full ${color === "primary" ? "bg-primary" : "bg-accent-foreground"
                        }`}
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1,
                    }}
                />
            ))}
        </div>
    )

    return (
        <Dialog open={isModalOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 bg-transparent border-0 shadow-none">
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                            onClick={onClose}
                        >
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                                transition={{
                                    type: "spring",
                                    duration: 0.4,
                                    bounce: 0.3
                                }}
                                className="bg-background rounded-3xl w-[90vw] max-w-md p-8 shadow-2xl border border-border/50 backdrop-blur-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center space-x-3">

                                        <h2 className="text-2xl font-bold text-foreground">Choose Experience</h2>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onClose}
                                        className="p-2 h-9 w-9 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Close modal</span>
                                    </Button>
                                </div>

                                {/* Options Container */}
                                <div className="space-y-4 ">
                                    {/* AR Option */}
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}

                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <Button
                                            onClick={handleGoToAR}
                                            disabled={loadingForAR || loadingForQR}
                                            className="w-full h-auto p-6 bg-secondary"
                                        >
                                            <div className="flex flex-col items-center space-y-4 ">
                                                {/* Icon Container */}
                                                <motion.div
                                                    className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg group-hover:shadow-primary/25 transition-shadow duration-300"
                                                    animate={loadingForAR ? { rotate: 360 } : {}}
                                                    transition={{ duration: 2, repeat: loadingForAR ? Infinity : 0, ease: "linear" }}
                                                >
                                                    <ScanLine className="h-10 w-10 text-primary-foreground" />
                                                </motion.div>

                                                {/* Title */}
                                                <h3 className="text-xl font-bold text-foreground">Augmented Reality</h3>

                                                {/* Description */}
                                                <p className="text-sm text-muted-foreground text-center  max-w-xs line-clamp-6">
                                                    {loadingForAR
                                                        ? "Initializing AR camera and sensors..."
                                                        : "Explore the world through AR pins."}
                                                </p>

                                                {/* Loading indicator */}
                                                <AnimatePresence>
                                                    {loadingForAR && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                        >
                                                            <LoadingDots color="primary" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </Button>
                                    </motion.div>

                                    {/* QR Option */}
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <Button
                                            onClick={handleGoToQR}
                                            disabled={loadingForAR || loadingForQR}
                                            className="w-full h-auto p-6 bg-secondary"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                {/* Icon Container */}
                                                <motion.div
                                                    className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg group-hover:shadow-accent/25 transition-shadow duration-300"
                                                    animate={loadingForQR ? { scale: [1, 1.1, 1] } : {}}
                                                    transition={{ duration: 1, repeat: loadingForQR ? Infinity : 0 }}
                                                >
                                                    <QrCode className="h-10 w-10 text-accent-foreground" />
                                                </motion.div>

                                                {/* Title */}
                                                <h3 className="text-xl font-bold text-foreground">QR Scanner</h3>

                                                {/* Description */}
                                                <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
                                                    {loadingForQR
                                                        ? "Preparing camera for QR scanning..."
                                                        : "Scan QR codes around you."}
                                                </p>

                                                {/* Loading indicator */}
                                                <AnimatePresence>
                                                    {loadingForQR && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                        >
                                                            <LoadingDots color="accent" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </Button>
                                    </motion.div>
                                </div>

                                {/* Footer hint */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-6 text-center"
                                >
                                    <p className="text-xs text-muted-foreground flex items-center justify-center space-x-1">
                                        <Zap className="h-3 w-3" />
                                        <span>Both experiences offer unique rewards</span>
                                    </p>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}

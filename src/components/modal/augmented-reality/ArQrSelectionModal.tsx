"use client"

import { useRouter } from "next/router"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Button } from "~/components/shadcn/ui/button"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { QrCode, ScanLine } from 'lucide-react'

export default function ArQrSelectionModal() {
    const { isOpen, onClose, type } = useModal()
    const router = useRouter()

    const isModalOpen = isOpen && type === "ArQrSelection"

    const handleGoToAR = () => {
        onClose()
        router.push("/augmented-reality/ar")
    }

    const handleGoToQR = () => {
        onClose()
        router.push("/augmented-reality/qr")
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-6">
                <DialogHeader className="text-center">
                    <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                        Choose Your Experience
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 dark:text-slate-400">
                        How would you like to interact with the augmented reality world?
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Button
                        onClick={handleGoToAR}
                        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300"
                    >
                        <ScanLine className="mr-3 h-6 w-6" /> Go to AR
                    </Button>
                    <Button
                        onClick={handleGoToQR}
                        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300"
                    >
                        <QrCode className="mr-3 h-6 w-6" /> Go to QR
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

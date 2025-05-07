"use client"

import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { LockKeyhole, LogIn } from "lucide-react"
import { useLoginRequiredModalStore } from "../store/login-required-modal-store"
import { ConnectWalletButton } from "package/connect_wallet"

export default function LoginRequiredModal() {
    const { setIsOpen, isOpen } = useLoginRequiredModalStore()
    console.log("LoginRequiredModal isOpen", isOpen)

    const handleClose = () => {
        setIsOpen(false)

    }


    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="p-0 overflow-hidden rounded-lg w-full">
                <div className="bg-secondary p-6 flex flex-col items-center">
                    <div className="bg-primary p-4 rounded-full mb-4">
                        <LockKeyhole className="h-8 w-8  text-secondary" />
                    </div>
                    <DialogHeader className="text-center">
                        <DialogTitle className="text-2xl font-bold ">Login Required</DialogTitle>
                        <DialogDescription className=" mt-2">
                            This content is only available to logged-in users
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6 flex flex-col items-center justify-center">
                    <div className="space-y-2 text-center">
                        <p className="text-gray-700">Please sign in to your account to access this premium content.</p>
                        <p className="text-sm text-gray-500">Already have an account? Click the button below to log in.</p>
                    </div>

                    <div className="flex flex-col gap-3 items-center justify-center">
                        <ConnectWalletButton />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}


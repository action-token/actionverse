"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import toast from "react-hot-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { Button } from "~/components/shadcn/ui/button"
import { clientsign } from "package/connect_wallet"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { Location, LocationConsumer, LocationGroup } from "@prisma/client"

interface ClaimPinModalProps {
    isOpen: boolean
    onClose: () => void
    location: Location & {
        locationGroup: LocationGroup | null
    }
    locationConsumer: LocationConsumer
}

const ClaimPinModal = ({ isOpen, onClose, location, locationConsumer }: ClaimPinModalProps) => {
    const session = useSession()
    const { needSign } = useNeedSign()
    const [paymentSuccesfull, setpaymetSucess] = useState(false)
    const [loading, setLoading] = useState(false)
    const utils = api.useUtils()

    const handleClose = () => {
        setXdr("")
        setpaymetSucess(false)
        xdrMutation.reset()
        claimPin.reset()
        onClose()
    }
    const [xdr, setXdr] = useState<string>()

    const xdrMutation = api.maps.trx.getClaimXDR.useMutation({
        onSuccess: (data, Variable) => {
            console.log("data", data)
            if (data) setXdr(data)
            return
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    const claimPin = api.maps.pin.claimAPin.useMutation({
        onSuccess: () => {
            setpaymetSucess(true)
            toast.success("Claimed Successfully")
        },
        onError: (error) => {
            toast.error(error.message)
        },
    })

    async function handleXDR() {
        if (location) {
            xdrMutation.mutate({
                signWith: needSign(),
                locationId: location.id,
            })
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg border-0 bg-card p-0 shadow-2xl overflow-hidden">
                <div className="relative bg-gradient-to-br from-primary/10 via-accent/5 to-transparent px-6 pt-8 pb-6">
                    <DialogHeader>
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center justify-center gap-2"
                        >
                            <Sparkles className="h-6 w-6 text-primary" />
                            <DialogTitle className="text-2xl font-bold text-center text-foreground">Claim Your Pin</DialogTitle>
                        </motion.div>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-8">
                    <AnimatePresence mode="wait">
                        {!xdr ? (
                            <motion.div
                                key="initial"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="rounded-xl bg-secondary/50 p-6 text-center">
                                    <p className="text-sm text-muted-foreground mb-4">
                                        You{"'"}re about to claim this pin. Click proceed to continue with the transaction.
                                    </p>
                                    <Button
                                        disabled={xdrMutation.isSuccess}
                                        className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                                        onClick={() => handleXDR()}
                                    >
                                        {xdrMutation.isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Proceed to Claim
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center border border-primary/20">
                                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold mb-2 text-foreground">Ready to Confirm</h3>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        Please confirm the transaction in your wallet to complete the claim.
                                    </p>
                                    <Button
                                        variant="default"
                                        size="lg"
                                        className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                                        onClick={() => {
                                            setLoading(true)
                                            clientsign({
                                                presignedxdr: xdr,
                                                pubkey: session.data?.user.id,
                                                walletType: session.data?.user.walletType,
                                                test: clientSelect(),
                                            })
                                                .then(async (res) => {
                                                    if (res && locationConsumer?.id) {
                                                        await claimPin.mutateAsync({
                                                            id: locationConsumer?.id,
                                                        })
                                                        try {
                                                            await utils.maps.pin.getAUserConsumedPin.invalidate()
                                                        } catch (e) {
                                                            console.log(e)
                                                        }
                                                    }
                                                })
                                                .catch((e) => console.log(e))
                                                .finally(() => {
                                                    setLoading(false)
                                                    handleClose()
                                                })
                                        }}
                                        disabled={paymentSuccesfull || loading || claimPin.isLoading}
                                    >
                                        {loading || claimPin.isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Confirming...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Confirm Claim
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default ClaimPinModal

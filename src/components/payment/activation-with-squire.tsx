'use client'

import { useState } from 'react'
import { Lock, CheckCircle, Check } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { env } from '~/env'
import { CreditCard, PaymentForm } from "react-square-web-payments-sdk";
import toast from 'react-hot-toast'
import { api } from '~/utils/api'
import { submitSignedXDRToServer4User } from 'package/connect_wallet/src/lib/stellar/trx/payment_fb_g'

interface PayForActivationFormProps {
    isOpen?: boolean
    selectedPlatforms: Array<{ id: string; name: string; issuer: string }>
    onClose?: () => void
    xdr: string
}

export function PayForActivation({ isOpen, selectedPlatforms, onClose, xdr }: PayForActivationFormProps) {
    const [isProcessing, setIsProcessing] = useState(false)
    const [cardNumber, setCardNumber] = useState('')
    const [expiryDate, setExpiryDate] = useState('')
    const [cvv, setCvv] = useState('')
    const [dialogOpen, setDialogOpen] = useState(isOpen)
    const ActivateAccountCardPayment = api.marketplace.pay.activateAccount.useMutation({
        onSuccess: (data) => {
            if (data) {

                const tostId = toast.loading("Submitting transaction");
                console.log("Activation Payment XDR: ", xdr)
                submitSignedXDRToServer4User(xdr)
                    .then((data) => {
                        if (data) {
                            toast.success("Payment Successful");
                        }
                    })
                    .catch((e) => {
                        console.error("Error submitting XDR: ", e);
                        toast.error("Payment failed");
                    })
                    .finally(() => {
                        toast.dismiss(tostId);
                    });
            }
            else {
                toast.error("Payment failed. Please try again.");
            }
        },

        onError: (error) => {
            toast.error("Failed to activate account.")
        }
    })




    const handleOpenChange = (open: boolean) => {
        setDialogOpen(open)
        if (!open && onClose) {
            onClose()
        }
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="bg-gradient-to-br from-[hsl(var(--card))] via-[hsl(var(--card))] to-[hsl(var(--muted))] border border-[hsl(var(--border))] shadow-2xl max-w-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-transparent to-[hsl(var(--primary)/0.05)] pointer-events-none rounded-lg" />

                <div className="relative">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <Lock className="w-5 h-5 text-[hsl(var(--primary))]" />
                            <DialogTitle className="text-2xl font-bold text-[hsl(var(--foreground))]" >Complete Your Purchase</DialogTitle>
                        </div>
                        <DialogDescription className="text-[hsl(var(--muted-foreground))]" >
                            Securely pay using your credit or debit card
                        </DialogDescription>
                    </DialogHeader>

                    {/* Content */}
                    <div className="space-y-6 mt-6">
                        {/* Order Summary */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
                                Order Summary
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Tokens */}
                                <div className="p-4 bg-[hsl(var(--muted))] border border-[hsl(var(--muted)/0.4)] rounded-xl">
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">Selected Platforms</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedPlatforms.map((platform) => (
                                            <span
                                                key={platform.id}
                                                className="px-3 py-1.5 bg-[hsl(var(--primary)/0.2)] border border-[hsl(var(--primary)/0.3)] rounded-full text-xs font-semibold text-[hsl(var(--primary))]"
                                            >
                                                {platform.name}
                                            </span>
                                        ))}
                                    </div>

                                </div>

                                {/* Price */}
                                <div className="p-4 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] rounded-xl">
                                    <p className="text-xs text-[hsl(var(--primary))] mb-3 uppercase tracking-wider">What You Get</p>
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-[hsl(var(--primary))]">Full platform access</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-[hsl(var(--primary))]">Trading capabilities</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-[hsl(var(--primary))]">Premium features</span>
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-[hsl(var(--border))] to-transparent" />
                        <PaymentForm
                            applicationId={env.NEXT_PUBLIC_SQUARE_APP_ID}
                            cardTokenizeResponseReceived={(token, verifiedBuyer) => {


                                ActivateAccountCardPayment.mutate({
                                    token: token.token,
                                });
                            }}
                            locationId={env.NEXT_PUBLIC_SQUARE_LOCATION}
                            createPaymentRequest={() => ({
                                countryCode: "US",
                                currencyCode: "USD",
                                total: {
                                    amount: `${0.01}`,
                                    label: `Account Activation`,
                                },
                            })}
                        >
                            <CreditCard
                                style={{
                                    ".message-text": {
                                        color: "green",
                                    },
                                    ".message-icon": {
                                        color: "green",
                                    },
                                }}
                            />

                        </PaymentForm>
                        {/* Payment Details */}
                        {/* <PaymentForm
                            applicationId={env.NEXT_PUBLIC_SQUARE_APP_ID}
                            cardTokenizeResponseReceived={(token, verifiedBuyer) => {

                                ActivateAccountCardPayment.mutate({
                                    token: token.token,

                                });
                            }}

                            locationId={env.NEXT_PUBLIC_SQUARE_LOCATION}
                            createPaymentRequest={() => ({
                                countryCode: "US",
                                currencyCode: "USD",
                                total: {
                                    amount: `${.01}`,
                                    label: `Account Activation`,
                                },
                            })}
                        >
                            <CreditCard />
                        </PaymentForm> */}

                        {/* Security Notice */}
                        <div className="p-3 bg-[hsl(var(--muted))] border border-[hsl(var(--muted))] rounded-lg flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-[hsl(var(--muted-foreground))]" >
                                Your payment information is securely processed. We never store your card details.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 mt-6">
                        <Button
                            variant="outline"
                            className="flex-1 bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted))] border-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] font-semibold"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>

                    </div>
                </div>
            </DialogContent>
        </Dialog >
    )
}

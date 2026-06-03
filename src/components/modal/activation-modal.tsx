'use client'

import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { PayForActivation } from '../payment/activation-with-squire'
import Image from 'next/image'
import { env } from '~/env'
import { addrShort } from '~/utils/utils'
import { api } from '~/utils/api'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { WalletType } from '~/types/wallet/wallet-types'
import { isRechargeAbleClient } from '~/utils/recharge/is-rechargeable-client'

const PLATFORMS = [
    { id: 'action', name: 'ACTION', icon: '/asset/action.ico', issuer: "GABHBO4IAEAKYODTIQC5G43MPD55BREA4P3MAXAMZKLEVQNF3S7PZFDU" },
    { id: 'bandcoin', name: 'BANDCOIN', icon: '/asset/bandcoin.ico', issuer: "GCMEPWXKQ4JCBE4NRRFTPAOP22N3NXUHTHJQSWRSKRD7APA6C7T4ESLG" },
    { id: 'wadzzo', name: 'Wadzzo', icon: '/asset/wadzzo.ico', issuer: "GDEL52F3VNFTARVKRL5NYME54NMLGMRO7MU2ILDEGO2LBAUKKKBQYMV3" },
    { id: 'beam', name: 'BEAM', icon: '/asset/beam.ico', issuer: "GDEILZUKOHS2GY4OAVBIMCSNSOEKO7GQPQRRKUHGSH7OZA7L7NNGR7K2" },
]

export function ActivationModal({
    dialogOpen,
    setDialogOpen,
}: {
    dialogOpen: boolean
    setDialogOpen: (open: boolean) => void
}) {
    const session = useSession()
    const walletType = session.data?.user.walletType ?? WalletType.none;
    const isFBorGoogle = isRechargeAbleClient(walletType);

    const [selectedPlatforms, setSelectedPlatforms] = useState<Array<{ id: string; name: string; issuer: string }>>([PLATFORMS[0]!])
    const [isLoading, setIsLoading] = useState(false)
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [xdr, setXdr] = useState<string>('')

    const handlePlatformSelect = (platform: typeof PLATFORMS[0]) => {
        if (platform.id === 'action') return

        setSelectedPlatforms((prev) => {
            const isSelected = prev.some(p => p.id === platform.id)
            if (isSelected) {
                return prev.filter((p) => p.id !== platform.id)
            } else {
                return [...prev, platform]
            }
        })
    }

    const fixedPriceUSD = 2
    const ActivationXDR = api.auth.trx.activeAccountXDR.useMutation({
        onSuccess: (data) => {
            if (data) {
                toast.success("XDR generated successfully")
                setXdr(data)
                setShowPaymentForm(true)
            }
        },
        onError: (error) => {
            toast.error("Failed to generate XDR.")
        }
    })
    const handleContinue = async () => {
        await ActivationXDR.mutateAsync({ selectedPlatforms })
    }

    if (!isFBorGoogle) {
        return (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-2xl max-w-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-transparent to-[hsl(var(--primary)/0.05)] pointer-events-none rounded-lg" />
                    <div className="relative">
                        <DialogHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <DialogTitle className="text-4xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] bg-clip-text text-transparent">
                                        Activation Required
                                    </DialogTitle>
                                    <DialogDescription className="text-[hsl(var(--muted-foreground))]">
                                        This feature is only available for Google and Apple users.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="mt-6 mb-4 flex flex-col items-center justify-center gap-4">
                            <Lock className="w-16 h-16 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-center text-[hsl(var(--muted-foreground))]">
                                To use this feature, please sign in with Google or Apple.
                                Please fund your wallet to proceed.
                            </p>
                        </div>
                        <div className="flex justify-end mt-8">
                            <Button
                                onClick={() => setDialogOpen(false)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (showPaymentForm) {
        return <PayForActivation
            isOpen={showPaymentForm}
            xdr={xdr}
            selectedPlatforms={selectedPlatforms} onClose={() => setShowPaymentForm(false)} />
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} >
            <DialogContent className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-2xl max-w-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-transparent to-[hsl(var(--primary)/0.05)] pointer-events-none rounded-lg" />

                <div className="relative">
                    {/* Header */}
                    <DialogHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-4xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] bg-clip-text text-transparent">
                                    Active Your Account
                                </DialogTitle>
                                <DialogDescription className="text-[hsl(var(--muted-foreground))]">
                                    Select your platforms and complete payment
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Content */}
                    <div className="space-y-8 mt-6">
                        {/* Two Column Grid */}
                        <div className="grid grid-cols-2 gap-8">
                            {/* Platforms Section */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest px-1">
                                    Select Platforms
                                </h3>

                                {/* ACTION - Always Selected */}
                                <button
                                    disabled
                                    className="w-full group relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                                    <div className="relative p-4 bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--primary)/0.3)] rounded-xl flex items-center justify-between cursor-not-allowed hover:bg-[hsl(var(--muted)/0.7)] transition-all">
                                        <div className='flex items-center justify-center'>
                                            <Image
                                                src="/asset/action.ico"
                                                alt="Actionverse Logo"
                                                width={32}
                                                height={32}
                                                className="inline-block mr-3 rounded-sm"
                                            />
                                            <div className="text-left">

                                                <p className="font-bold text-[hsl(var(--foreground))] text-xs">ACTION</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{addrShort("GABHBO4IAEAKYODTIQC5G43MPD55BREA4P3MAXAMZKLEVQNF3S7PZFDU", 7)}</p>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] flex items-center justify-center">
                                            <Check className="w-3 h-3 text-[hsl(var(--muted))] font-bold" />
                                        </div>
                                    </div>
                                </button>

                                {/* Other Platforms */}
                                <div className="space-y-2">
                                    {PLATFORMS.filter(p => p.id !== 'action').map((platform) => {
                                        const isSelected = selectedPlatforms.some(p => p.id === platform.id)
                                        return (
                                            <button
                                                key={platform.id}
                                                onClick={() => handlePlatformSelect(platform)}
                                                className="w-full group relative"
                                            >
                                                <div className={`absolute inset-0 rounded-lg blur transition duration-500 ${isSelected
                                                    ? 'bg-gradient-to-r from-[hsl(var(--primary)/0.4)] to-[hsl(var(--primary)/0.4)] opacity-100'
                                                    : 'bg-gradient-to-r from-[hsl(var(--muted))] to-[hsl(var(--muted))] opacity-0 group-hover:opacity-100'
                                                    }`} />
                                                <div className={`relative p-4 rounded-lg flex items-center justify-between transition-all border ${isSelected
                                                    ? 'bg-[hsl(var(--muted)/0.8)] border-[hsl(var(--primary)/0.4)]'
                                                    : 'bg-[hsl(var(--muted)/0.4)] border-[hsl(var(--muted)/0.4)] group-hover:border-[hsl(var(--muted)/0.6)]'
                                                    }`}>
                                                    <div className="flex items-center gap-3">
                                                        <Image
                                                            src={platform.icon}
                                                            alt={`${platform.name} Logo`}
                                                            width={32}
                                                            height={32}
                                                            className="inline-block rounded-sm"
                                                        />
                                                        <div className="text-left">
                                                            <p className="font-semibold text-[hsl(var(--foreground))] text-xs">{platform.name}</p>
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{addrShort(platform.issuer, 7)}</p>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-[hsl(var(--muted))] font-bold" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Price Breakdown Section */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest px-1">
                                    Price Breakdown
                                </h3>

                                {/* Price Cards */}
                                <div className="space-y-3">
                                    {/* USD Card */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--muted))] to-[hsl(var(--muted))] rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                                        <div className="relative p-5 bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--muted)/0.4)] rounded-xl group-hover:border-[hsl(var(--muted)/0.6)] transition-all">
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] font-semibold mb-2 uppercase tracking-wider">You Pay</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-bold text-[hsl(var(--foreground))]">${fixedPriceUSD}</span>
                                                <span className="text-sm text-[hsl(var(--muted-foreground))]" >USD</span>
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">Fixed price • No hidden fees</p>
                                        </div>
                                    </div>

                                    {/* XLM Card */}
                                    <div className="group relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary)/0.3)] to-[hsl(var(--primary)/0.3)] rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                                        <div className="relative p-5 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] rounded-xl hover:border-[hsl(var(--primary)/0.5)] transition-all">
                                            <p className="text-xs text-[hsl(var(--primary))] font-semibold mb-3 uppercase tracking-wider">Activation Benefits</p>
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
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--muted)/0.1)] to-[hsl(var(--muted)/0.1)] rounded-xl blur" />
                            <div className="relative p-4 bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--muted)/0.5)] rounded-xl flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--muted))] to-[hsl(var(--muted))] flex items-center justify-center text-lg border border-[hsl(var(--muted)/0.5)]">
                                    💳
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]" >Secure Payment</p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]" >Bank-level encryption</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 mt-8">
                        <Button
                            variant="outline"
                            className='flex-1'
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className='flex-1  '
                            onClick={handleContinue}
                            disabled={ActivationXDR.isLoading}
                        >
                            {ActivationXDR.isLoading ? 'Processing...' : 'Continue to Payment'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    )
}

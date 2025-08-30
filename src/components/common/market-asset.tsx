"use client"

import { useSession } from "next-auth/react"
import { LockKeyhole } from "lucide-react"
import { useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { ConnectWalletButton } from "package/connect_wallet"
import type { MarketAssetType } from "~/lib/state/augmented-reality/use-modal-store"
import { useBuyModalStore } from "../store/buy-modal-store"
import AssetView from "./asset"
import { useLoginRequiredModalStore } from "../store/login-required-modal-store"
import { useRouter } from "next/navigation"

function MarketAssetComponent({ item }: { item: MarketAssetType }) {
    const { asset } = item
    const router = useRouter()

    const { setIsOpen, setData } = useBuyModalStore()
    const session = useSession()
    const { isOpen: isLoginModalOpen, setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore()

    const handleBuyAsset = () => {
        if (session.status === "unauthenticated") {
            console.log("User not logged in, opening login modal")
            setLoginModalOpen(true)
        } else {
            setData(item)
            setIsOpen(true)
        }
    }
    const handleViewAsset = () => {
        if (session.status === "unauthenticated") {
            console.log("User not logged in, opening login modal")
            setLoginModalOpen(true)
        } else {

            // Navigate to single asset page instead of opening buy modal
            router.push(`/market-asset/${item.id}`)

        }
    }
    return (
        <div className="cursor-pointer">
            <AssetView
                code={asset.name}
                thumbnail={asset.thumbnail}
                creatorId={asset.creatorId}
                price={item.price}
                priceInUSD={item.priceUSD}
                mediaType={asset.mediaType}
                onBuy={handleBuyAsset}
                onView={handleViewAsset}
            />

        </div>
    )
}

export default MarketAssetComponent


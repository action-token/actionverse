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

function MarketAssetComponent({ item }: { item: MarketAssetType }) {
    const { asset } = item
    const { setIsOpen, setData } = useBuyModalStore()
    const session = useSession()
    const { isOpen: isLoginModalOpen, setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore()
    const handleAssetClick = () => {
        if (session.status === "unauthenticated") {
            console.log("User not logged in, opening login modal")
            setLoginModalOpen(true)
        } else {
            setIsOpen(true)
            setData(item)
        }
    }

    return (
        <div onClick={handleAssetClick}>
            <AssetView code={asset.name} thumbnail={asset.thumbnail} creatorId={asset.creatorId} price={item.price} />


        </div>
    )
}

export default MarketAssetComponent


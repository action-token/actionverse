"use client"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { api } from "~/utils/api"
import { Button } from "../shadcn/ui/button"
import PaymentProcessItem from "../payment/payment-process"
import type { MarketAssetType } from "~/types/market/market-asset-type"
import { Dialog, DialogContent } from "../shadcn/ui/dialog"
import { useBuyModalStore } from "../store/buy-modal-store"
import { Badge } from "../shadcn/ui/badge"
import { Package, ShoppingCart } from "lucide-react"
import React, { useEffect } from "react"
import { BASE_URL } from "~/lib/common"
import { useSession } from "next-auth/react"
import { ConnectWalletButton } from "package/connect_wallet"

interface InfoBoxProps {
  title?: string
  description?: string
  brandName?: string
  marketAsset?: MarketAssetType
  position?: { left: number; top: number }
  compact?: boolean
}

export default function ArCard({
  title = "Item",
  marketAsset: data,
  description = "No description available",
  brandName = "Unknown Brand",
  position = { left: 0, top: 0 },
}: InfoBoxProps) {
  const session = useSession()
  const { setIsOpen, isOpen } = useBuyModalStore()
  const [canBuyUser, setCanBuyUser] = React.useState<boolean>(false)
  const [copy, setCopy] = React.useState<number | null>(null)
  useEffect(() => {
    const fetchCanUserBuy = async () => {
      if (!data?.id) return
      try {
        const response = await fetch(new URL("api/game/qr/can-user-buy", BASE_URL).toString(), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ qrId: data?.id }),
        })
        if (!response.ok) {
          throw new Error("Failed to fetch QR item")
        }
        console.log("Response received for QR item fetch")
        const res = (await response.json()) as boolean
        setCanBuyUser(res)
      } catch (err) {
        console.error("Error fetching QR item:", err)
      }
    }
    const fetchAvailableCopy = async () => {
      if (!data?.id) return
      try {
        const response = await fetch(new URL("api/game/qr/get-available-copy", BASE_URL).toString(), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ qrId: data?.id }),
        })
        if (!response.ok) {
          throw new Error("Failed to fetch QR item")
        }
        console.log("Response received for QR item fetch")
        const res = (await response.json()) as number
        setCopy(res)
      } catch (err) {
        console.error("Error fetching QR item:", err)
      }
    }
    void fetchAvailableCopy()
    void fetchCanUserBuy()
  }, [data?.id])
  const handleClose = () => {
    setIsOpen(false)
  }
  console.log("marketAsset in ArCard:", data);
  return (
    <>
      {data && data.id ? (
        <div className="absolute bottom-32 md:bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4 md:max-w-md">
          <div className="w-full max-w-xs bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-lg shadow-xl overflow-hidden border border-slate-800">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100 truncate">{brandName}</p>
              <h3 className="text-sm font-bold mt-0.5 text-white truncate">{title}</h3>
            </div>
            <div className="px-3 py-2 space-y-2">
              <p className="text-xs text-slate-300 line-clamp-1">
                {description.length > 100 ? description.slice(0, 100) + "..." : description}
              </p>
              <div className="bg-slate-800/50 rounded px-2 py-1.5 space-y-1 border border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">USD</span>
                  <span className="text-sm font-bold text-cyan-400">${data?.priceUSD}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">TOKENS</span>
                  <span className="text-sm font-bold text-blue-400">{data?.price} {PLATFORM_ASSET.code}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300">Available:</span>
                <Badge className="bg-cyan-600 text-white border-cyan-500 text-xs py-0 px-2 h-5">{copy}</Badge>
              </div>
            </div>
            {
              session.status === "authenticated" && canBuyUser && copy && copy > 0 ? (
                canBuyUser && copy && copy > 0 && (
                  <div className="px-3 py-2 border-t border-slate-800">
                    <Button
                      onClick={() => setIsOpen(true)}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-1.5 text-sm rounded transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      Buy
                    </Button>
                  </div>
                )
              )
                : session.status === "unauthenticated" && (
                  <div className="px-3 py-2 border-t border-slate-800 text-center w-full flex items-center justify-center">
                    <ConnectWalletButton />
                  </div>

                )
            }
          </div>
        </div>

      ) : (
        <div
          className="w-full max-w-xs md:max-w-sm overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-transform hover:shadow-2xl hover:scale-105"
          style={{
            position: "absolute",
            left: `${position.left}px`,
            right: "auto",
            bottom: `${200}px`,
          }}
        >
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {brandName}
            </p>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
            <Badge className="inline-block bg-cyan-100 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
              {brandName}
            </Badge>
          </div>
        </div>
      )
      }

      {
        data && (
          <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-white dark:bg-slate-900 p-0 max-w-md w-full max-h-[90vh] overflow-auto">
              <PaymentProcessItem
                marketItemId={data?.id}
                priceUSD={data?.priceUSD}
                item={data?.asset}
                price={data?.price}
                placerId={data?.placerId}
                setClose={handleClose}
                type={data?.type}
              />
            </DialogContent>
          </Dialog>
        )
      }
    </>
  )
}

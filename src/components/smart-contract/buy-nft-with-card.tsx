import { Loader2, Lock } from "lucide-react"
import { CreditCard, PaymentForm } from "react-square-web-payments-sdk"
import toast from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import { env } from "~/env"
import { api } from "~/utils/api"

interface CardCheckoutDialogProps {
  open: boolean
  onClose: () => void
  quantity: number
  /** Pre-formatted total (e.g. "$10.10") — the caller already knows the
   *  right currency/quantity math, this dialog only handles the charge. */
  totalLabel: string
  isCharging: boolean
  onTokenized: (sourceId: string) => void
}

/** Shared Square card-entry UI for both checkout dialogs below — the only
 *  thing that differs between a primary and a resale card purchase is which
 *  mutation the tokenized card gets handed to. */
function CardCheckoutDialog({ open, onClose, quantity, totalLabel, isCharging, onTokenized }: CardCheckoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isCharging && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay with card</DialogTitle>
          <DialogDescription>
            Charging {totalLabel} for {quantity} cop{quantity === 1 ? "y" : "ies"}. Your card is
            processed securely by Square — we never see or store your card details.
          </DialogDescription>
        </DialogHeader>

        {isCharging ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Completing your purchase…
          </div>
        ) : (
          <PaymentForm
            applicationId={env.NEXT_PUBLIC_SQUARE_APP_ID}
            locationId={env.NEXT_PUBLIC_SQUARE_LOCATION}
            cardTokenizeResponseReceived={(token) =>
              void (async () => {
                if (!token.token) {
                  toast.error("Could not read card details — try again")
                  return
                }
                onTokenized(token.token)
              })()
            }
          >
            <CreditCard />
          </PaymentForm>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Secured by Square
        </p>
      </DialogContent>
    </Dialog>
  )
}

interface BuyNftWithCardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  nftId: string
  quantity: number
  totalLabel: string
}

/**
 * The USD/card checkout for a fresh primary-sale copy — opened from
 * `PrimaryBuyCard`'s "usd" tab (custodial accounts only; see
 * `useIsCustodialWallet`). Charges via Square, then `nft.buyEditionWithCard`
 * does everything else server-side: funding the buyer's on-chain balance,
 * building/signing/submitting the purchase, and confirming it — no XDR or
 * wallet interaction ever reaches this component.
 */
export function BuyNftWithCard({ open, onClose, onSuccess, nftId, quantity, totalLabel }: BuyNftWithCardProps) {
  const utils = api.useContext()
  const buyWithCard = api.nft.buyEditionWithCard.useMutation({
    onSuccess: async () => {
      toast.success(quantity > 1 ? `${quantity} copies purchased!` : "Purchase complete!")
      await Promise.all([
        utils.nft.byId.invalidate({ id: nftId }),
        utils.nft.onChainInsights.invalidate({ id: nftId }),
        utils.nft.list.invalidate(),
        utils.nft.myOwned.invalidate(),
      ])
      onSuccess()
      onClose()
    },
    onError: (e) => toast.error(e.message || "Purchase failed"),
  })

  return (
    <CardCheckoutDialog
      open={open}
      onClose={onClose}
      quantity={quantity}
      totalLabel={totalLabel}
      isCharging={buyWithCard.isLoading}
      onTokenized={(sourceId) => buyWithCard.mutate({ nftId, quantity, sourceId })}
    />
  )
}

interface BuyResaleWithCardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tokenIds: string[]
  totalLabel: string
}

/**
 * The USD/card checkout for a pooled resale purchase — same shape and same
 * custodial-only gate as `BuyNftWithCard`, pointed at `buyBatchWithCard`
 * instead. `totalLabel` comes from `nft.resaleUsdQuote`'s live conversion
 * (a reseller's price is their own live number, not a stored sticker price).
 */
export function BuyResaleWithCard({ open, onClose, onSuccess, tokenIds, totalLabel }: BuyResaleWithCardProps) {
  const utils = api.useContext()
  const buyWithCard = api.nft.buyBatchWithCard.useMutation({
    onSuccess: async () => {
      toast.success(tokenIds.length > 1 ? `${tokenIds.length} copies purchased!` : "Purchase complete!")
      await Promise.all([utils.nft.list.invalidate(), utils.nft.myOwned.invalidate()])
      onSuccess()
      onClose()
    },
    onError: (e) => toast.error(e.message || "Purchase failed"),
  })

  return (
    <CardCheckoutDialog
      open={open}
      onClose={onClose}
      quantity={tokenIds.length}
      totalLabel={totalLabel}
      isCharging={buyWithCard.isLoading}
      onTokenized={(sourceId) => buyWithCard.mutate({ tokenIds, sourceId })}
    />
  )
}

import { priceRowLabel, priceTokenLabel } from "~/components/nft/nft-card"

/**
 * Plain, read-only recap of an edition's price grid (one row per currency
 * it's offered in) — the "Price Grid" tab alongside `UnlockLocationsPreview`
 * on the buy/manage pages. Distinct from `PrimaryBuyCard`'s own breakdown,
 * which layers quantity/fees on top of this for the actual purchase.
 */
export function NftPriceGrid({ prices }: { prices: { paymentToken: string; price: number }[] }) {
    if (prices.length === 0) {
        return <p className="text-sm text-muted-foreground">This item has no price set yet.</p>
    }

    return (
        <div className="space-y-2 rounded-xl bg-muted p-4">
            {prices.map((p) => (
                <div key={p.paymentToken} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {priceRowLabel(p.paymentToken)}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                        {p.price} {priceTokenLabel(p.paymentToken)}
                    </span>
                </div>
            ))}
        </div>
    )
}

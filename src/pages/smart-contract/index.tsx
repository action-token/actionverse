import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Sparkles } from "lucide-react"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { priceTokenLabel } from "~/components/nft/nft-card"
import { api } from "~/utils/api"

/**
 * Browse page for gated "VIP ticket" NFTs only — separate from the general
 * marketplace grid, since these have unlock rules/locked reward content
 * worth calling out up front. See VIP_TICKET_UNLOCK_PLAN.md.
 */
export default function SmartContractTicketsPage() {
  const { data, isLoading } = api.nft.listGated.useQuery({})

  return (
    <>
      <Head>
        <title>Smart Contract Tickets — Actionverse</title>
      </Head>
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-8 space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Sparkles className="h-6 w-6 text-primary" />
            Smart Contract Tickets
          </h1>
          <p className="text-muted-foreground">
            VIP tickets with a locked reward — collect every required location with your own copy to unlock it.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No gated tickets are on sale right now.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => {
              const remaining = item.supply - item.mintedCount
              const cheapest = item.prices.slice().sort((a, b) => a.price - b.price)[0]
              return (
                <Link key={item.id} href={`/smart-contract/${item.id}`}>
                  <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="relative aspect-square bg-muted">
                      <Image src={item.thumbnail} alt={item.name} fill className="object-cover" />
                      <Badge className="absolute left-3 top-3 gap-1 bg-black/70 text-white">
                        <Sparkles className="h-3 w-3" />
                        VIP Ticket
                      </Badge>
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.requiredLocations} location{item.requiredLocations === 1 ? "" : "s"} to unlock
                        {item.lockedMediaCount > 0 &&
                          ` • ${item.lockedMediaCount} reward item${item.lockedMediaCount === 1 ? "" : "s"}`}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          {remaining > 0 ? `${remaining} of ${item.supply} left` : "Sold out"}
                        </span>
                        {cheapest && (
                          <span className="text-sm font-bold text-foreground">
                            {cheapest.price} {priceTokenLabel(cheapest.paymentToken)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

"use client"

import Image from "next/image"
import { useRouter } from "next/router"
import { Trophy, Users, Award, MapPin, Compass } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { useSession } from "next-auth/react"
import { api } from "~/utils/api"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { extractBountyIds } from "~/utils/bounty-link-detector"

interface BountyPreview {
  id: number
  title: string
  description: string
  imageUrls: string[]
  priceInUSD: number
  priceInBand: number
  requiredBalance: number
  requiredBalanceCode: string | null
  requiredBalanceIssuer: string | null
  currentWinnerCount: number
  totalWinner: number
  bountyType: string
  status: string
  creatorId: string
  _count: { participants: number }
}

function BountyEmbedCard({ bounty }: { bounty: BountyPreview }) {
  const router = useRouter()
  const { data: session } = useSession()
  const { getAssetBalance, platformAssetBalance } = useUserStellarAcc()

  const spotsLeft = bounty.totalWinner - bounty.currentWinnerCount
  const isFull = spotsLeft <= 0

  const getBalance = () => {
    if (bounty.requiredBalanceCode && bounty.requiredBalanceIssuer) {
      return Number(
        getAssetBalance({
          code: bounty.requiredBalanceCode,
          issuer: bounty.requiredBalanceIssuer,
        }) ?? 0,
      )
    }
    return platformAssetBalance
  }

  const isEligible = () => {
    if (!session?.user) return false
    if (isFull) return false
    return getBalance() >= bounty.requiredBalance
  }

  const getRewardText = () => {
    if (bounty.priceInUSD > 0) return `$${bounty.priceInUSD.toFixed(2)} USDC`
    if (bounty.priceInBand > 0) return `${bounty.priceInBand.toFixed(2)} ${PLATFORM_ASSET.code.toUpperCase()}`
    return "Free"
  }

  const getTypeIcon = () => {
    if (bounty.bountyType === "LOCATION_BASED") return <MapPin className="h-3 w-3" />
    if (bounty.bountyType === "SCAVENGER_HUNT") return <Compass className="h-3 w-3" />
    return <Trophy className="h-3 w-3" />
  }

  const getIneligibleReason = () => {
    if (!session?.user) return "Sign in to join"
    if (isFull) return "No spots left"
    const tokenName = bounty.requiredBalanceCode?.toUpperCase() ?? PLATFORM_ASSET.code.toUpperCase()
    return `Need ${bounty.requiredBalance} ${tokenName}`
  }

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => router.push(`/bounty/${bounty.id}`)}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-36 w-full shrink-0 sm:h-auto sm:w-40">
          <Image
            src={bounty.imageUrls[0] ?? "/images/logo.png"}
            alt={bounty.title}
            fill
            className="object-cover"
          />
          <div className="absolute left-2 top-2">
            <Badge variant="secondary" className="gap-1 bg-background/80 text-[10px] backdrop-blur-sm">
              {getTypeIcon()}
              {bounty.bountyType === "LOCATION_BASED"
                ? "Location"
                : bounty.bountyType === "SCAVENGER_HUNT"
                  ? "Scavenger"
                  : "General"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between p-3">
          <div>
            <h4 className="line-clamp-1 text-sm font-semibold">{bounty.title}</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Award className="h-3 w-3" />
                {getRewardText()}
              </Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {bounty._count.participants} joined
              </span>
              <span className="text-[11px] text-muted-foreground">
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              className={`h-7 rounded-full px-4 text-xs ${isEligible() ? "" : "opacity-90"}`}
              variant={isEligible() ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation()
                void router.push(`/bounty/${bounty.id}`)
              }}
            >
              {isEligible() ? "Join Bounty" : "View Bounty"}
            </Button>
            <span className={`text-[10px] ${isEligible() ? "text-emerald-600" : "text-muted-foreground"}`}>
              {isEligible() ? "Eligible" : getIneligibleReason()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BountyLinkEmbed({ bountyId }: { bountyId: number }) {
  const { data: bounty, isLoading } = api.bounty.Bounty.getBountyPreview.useQuery(
    { bountyId },
    { staleTime: 60_000 },
  )
  if (isLoading) return <Skeleton className="mt-3 h-24 w-full rounded-xl" />
  if (!bounty) return null
  return <BountyEmbedCard bounty={bounty} />
}

export function BountyLinksFromContent({ content }: { content: string }) {
  const ids = extractBountyIds(content)
  if (ids.length === 0) return null
  return (
    <>
      {ids.map((id) => (
        <BountyLinkEmbed key={id} bountyId={id} />
      ))}
    </>
  )
}

export { BountyEmbedCard }

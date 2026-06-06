"use client"

import Image from "next/image"
import { useRouter } from "next/router"
import {
  Trophy,
  Users,
  Award,
  MapPin,
  Compass,
  Clock,
  Calendar,
  Zap,
  ChevronRight,
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { useSession } from "next-auth/react"
import { api } from "~/utils/api"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { extractBountyIds } from "~/utils/bounty-link-detector"
import { formatDistanceToNow } from "date-fns"
import { cn } from "~/lib/utils"
import { Preview } from "../common/quill-preview"

interface BountyPreview {
  id: number
  title: string
  description: string
  imageUrls: string[]
  priceInUSD: number
  priceInBand: number
  priceInXLM: number | null
  requiredBalance: number
  requiredBalanceCode: string | null
  requiredBalanceIssuer: string | null
  currentWinnerCount: number
  totalWinner: number
  bountyType: string
  status: string
  creatorId: string
  createdAt: Date
  endDate: Date | null
  latitude: number | null
  longitude: number | null
  payNow: boolean
  creator: {
    name: string
    profileUrl: string | null
  } | null
  _count: { participants: number }
}

function BountyEmbedCard({ bounty }: { bounty: BountyPreview }) {
  const router = useRouter()
  const { data: session } = useSession()

  const spotsLeft = bounty.totalWinner - bounty.currentWinnerCount
  const isFull = spotsLeft <= 0
  const isEnded = bounty.endDate ? new Date(bounty.endDate) < new Date() : false




  const getRewardText = () => {
    if (bounty.priceInUSD > 0) return `$${bounty.priceInUSD.toFixed(2)} USDC`
    if (bounty.priceInBand > 0) return `${bounty.priceInBand.toFixed(2)} ${PLATFORM_ASSET.code.toUpperCase()}`
    if (bounty.priceInXLM && bounty.priceInXLM > 0) return `${bounty.priceInXLM.toFixed(2)} XLM`
    return "Free"
  }

  const getTypeIcon = () => {
    if (bounty.bountyType === "LOCATION_BASED") return <MapPin className="h-3 w-3" />
    if (bounty.bountyType === "SCAVENGER_HUNT") return <Compass className="h-3 w-3" />
    return <Trophy className="h-3 w-3" />
  }

  const getTypeLabel = () => {
    if (bounty.bountyType === "LOCATION_BASED") return "Location"
    if (bounty.bountyType === "SCAVENGER_HUNT") return "Scavenger Hunt"
    return "General"
  }


  return (
    <div
      className="group mt-3 overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-md cursor-pointer"
      onClick={() => router.push(`/bounty/${bounty.id}`)}
    >
      {/* Image section */}
      <div className="relative h-44 w-full overflow-hidden">
        <Image
          src={bounty.imageUrls[0] ?? "/images/logo.png"}
          alt={bounty.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top badges row */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1 bg-background/85 text-[10px] backdrop-blur-sm font-medium"
          >
            {getTypeIcon()}
            {getTypeLabel()}
          </Badge>

        </div>

        {/* Reward badge */}
        <div className="absolute right-3 top-3">
          <Badge
            className="gap-1 border-0 text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: "hsl(var(--greditnet))" }}
          >
            <Award className="h-3 w-3" />
            {getRewardText()}
          </Badge>
        </div>

        {/* Bottom overlay: title + creator */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h4 className="line-clamp-1 text-sm font-bold text-white drop-shadow">
            {bounty.title}
          </h4>
          <div className="mt-1.5 flex items-center gap-2">
            <Avatar className="h-5 w-5 border border-white/30">
              <AvatarImage src={bounty.creator?.profileUrl ?? undefined} />
              <AvatarFallback className="text-[8px] bg-white/20 text-white">
                {bounty.creator?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-medium text-white/90">
              {bounty.creator?.name ?? "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-2 p-3">
        {/* Description */}
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
          <Preview value={bounty.description} />
        </p>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {bounty._count.participants} joined
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` : <span className="text-destructive">Full</span>}
          </span>
          {bounty.endDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isEnded ? (
                <span className="text-destructive">Ended</span>
              ) : (
                `Ends ${formatDistanceToNow(new Date(bounty.endDate), { addSuffix: true })}`
              )}
            </span>
          )}
          {bounty.bountyType === "LOCATION_BASED" && bounty.latitude != null && bounty.longitude != null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location-based
            </span>
          )}

        </div>

        {/* Required balance hint */}
        {bounty.requiredBalance > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            Requires {bounty.requiredBalance} {bounty.requiredBalanceCode?.toUpperCase() ?? PLATFORM_ASSET.code.toUpperCase()} balance
          </div>
        )}

        {/* CTA row */}
        <div className="mt-1 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 flex-1 gap-1 rounded-full text-xs font-medium"

            onClick={(e) => {
              e.stopPropagation()
              void router.push(`/bounty/${bounty.id}`)
            }}
          >

            <>
              Join Bounty
              <ChevronRight className="h-3 w-3" />
            </>

          </Button>
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
  if (isLoading) return <Skeleton className="mt-3 h-56 w-full rounded-xl" />
  if (!bounty) return null
  return <BountyEmbedCard bounty={bounty as BountyPreview} />
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

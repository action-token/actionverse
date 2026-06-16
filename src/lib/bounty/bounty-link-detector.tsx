import { api } from "~/utils/api"
import { CheckCircle2, ArrowRight, Users, FileText, Trophy, Crown } from "lucide-react"
import { useRouter } from "next/router"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { BountyStatus } from "@prisma/client"
import { cn } from "~/lib/utils"

const BOUNTY_PATH_RE = /\/bounty\/(\d+)/g

export function extractBountyIds(content: string): number[] {
  const ids: number[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(BOUNTY_PATH_RE.source, "g")
  while ((match = re.exec(content)) !== null) {
    const id = Number(match[1])
    if (!isNaN(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

const statusLabel: Record<BountyStatus, { text: string; dot: string }> = {
  RUNNING: { text: "Live", dot: "bg-green-400" },
  PAUSED: { text: "Paused", dot: "bg-yellow-400" },
  COMPLETED: { text: "Ended", dot: "bg-gray-400" },
}

function BountyEmbed({ bountyId }: { bountyId: number }) {
  const router = useRouter()
  const { data: bounty, isLoading } = api.bounty.Bounty.getBounty.useQuery(
    { bountyId },
    { staleTime: 60_000 },
  )

  if (isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-card px-4 py-4 animate-pulse space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-secondary" />
          <div className="h-3.5 w-28 rounded bg-secondary" />
        </div>
        <div className="h-4 w-3/4 rounded bg-secondary" />
        <div className="flex gap-4">
          <div className="h-3 w-20 rounded bg-secondary" />
          <div className="h-3 w-20 rounded bg-secondary" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-secondary" />
          <div className="h-3 w-24 rounded bg-secondary" />
        </div>
      </div>
    )
  }

  if (!bounty) return null

  const status = statusLabel[bounty.status]
  const maxW = bounty.maxWinners
  const perWinner = bounty.prizeAmount / maxW

  return (
    <div
      onClick={() => void router.push(`/bounty/${bountyId}`)}
      className={cn(
        "mt-3 rounded-xl border border-border bg-card cursor-pointer group",
        "transition-all duration-200 hover:border-primary/30 hover:shadow-[0_4px_20px_hsl(var(--background)/0.5)]",
        "overflow-hidden",
      )}
    >
      {/* Prize accent bar */}
      <div
        className={cn(
          "h-[3px]",
          bounty.prizeAmount >= 10000
            ? "bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"
            : bounty.prizeAmount >= 1000
            ? "bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400"
            : "bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400",
        )}
      />

      <div className="px-4 py-3 space-y-2.5">
        {/* Prize + status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-primary font-bold text-[14px]">
              {bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
            </span>
            {maxW > 1 && (
              <span className="text-muted-foreground text-xs">
                ({perWinner.toLocaleString()} × {maxW})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", status.dot)} />
            <span className="text-[11px] text-muted-foreground font-medium">{status.text}</span>
          </div>
        </div>

        {/* Title */}
        <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {bounty.title}
        </p>

        {/* Summary */}
        {bounty.summary && (
          <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
            {bounty.summary}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {bounty._count.participants} joined
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {bounty._count.submissions} submitted
          </span>
          {bounty._count.winners > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Crown className="h-3 w-3" />
              {bounty._count.winners} winner{bounty._count.winners > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Creator + CTA */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={bounty.creator.profileUrl ?? ""} />
              <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
                {bounty.creator.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate">
              {bounty.creator.name}
            </span>
          </div>
          <div className="flex items-center gap-1 text-primary text-[12px] font-semibold shrink-0">
            View bounty
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform duration-150" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function BountyLinkDetector({ content }: { content: string }) {
  const ids = extractBountyIds(content)
  if (ids.length === 0) return null
  return (
    <div className="space-y-2">
      {ids.map((id) => (
        <BountyEmbed key={id} bountyId={id} />
      ))}
    </div>
  )
}

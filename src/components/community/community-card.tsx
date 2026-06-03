"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { Shield, Users, MessageSquare, User, Loader2, Lock, Crown } from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { api } from "~/utils/api"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import toast from "react-hot-toast"

interface CommunityCardProps {
  community: {
    id: number
    title: string
    description: string
    coverUrl: string
    profileUrl: string
    isTokenGated: boolean
    requiredBalance: number | null
    requiredBalanceCode: string | null
    requiredBalanceIssuer: string | null
    isOwner: boolean
    isMember: boolean
    owner: {
      id: string
      name: string | null
      image: string | null
    }
    _count: {
      members: number
      posts: number
    }
    members: Array<{
      user: {
        id: string
        name: string | null
        image: string | null
      }
    }>
  }
}

function MemberAvatarStack({
  members,
  totalCount,
}: {
  members: CommunityCardProps["community"]["members"]
  totalCount: number
}) {
  const displayMembers = members.slice(0, 3)
  const remaining = totalCount - displayMembers.length

  if (totalCount === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {displayMembers.map((member) => (
          <Avatar
            key={member.user.id}
            className="h-6 w-6 ring-2 ring-black/20"
          >
            <AvatarImage src={member.user.image ?? undefined} />
            <AvatarFallback className="bg-white/20 text-[8px] font-bold text-white">
              {member.user.name?.charAt(0)?.toUpperCase() ?? (
                <User className="h-2.5 w-2.5" />
              )}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {remaining > 0 && (
        <span className="text-[11px] font-medium text-white/80">
          +{remaining}
        </span>
      )}
    </div>
  )
}

export function CommunityCard({ community }: CommunityCardProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const utils = api.useUtils()
  const { getAssetBalance } = useUserStellarAcc()

  const join = api.community.member.join.useMutation({
    onSuccess: () => {
      toast.success("Joined!")
      void utils.community.community.getAll.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const canJoinTokenGated = () => {
    if (!community.isTokenGated) return true
    if (!community.requiredBalanceCode || !community.requiredBalanceIssuer) return true
    const balance = getAssetBalance({
      code: community.requiredBalanceCode,
      issuer: community.requiredBalanceIssuer,
    })
    return Number(balance) >= (community.requiredBalance ?? 0)
  }

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.user) {
      toast.error("Please sign in to join")
      return
    }

    if (community.isTokenGated && !canJoinTokenGated()) {
      toast.error(
        `You need ${community.requiredBalance} ${community.requiredBalanceCode} to join`,
      )
      return
    }

    join.mutate({ communityId: community.id })
  }

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void router.push(`/community/${community.id}`)
  }

  const isMemberOrOwner = community.isMember || community.isOwner
  const isPubnet = process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"
  const stellarExpertBase = `https://stellar.expert/explorer/${isPubnet ? "public" : "testnet"}`
  const isLocked = community.isTokenGated && !canJoinTokenGated()

  return (
    <Link href={`/community/${community.id}`}>
      <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50 transition-all duration-300 hover:shadow-xl hover:ring-border">

        {/* Cover image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            src={community.coverUrl}
            alt={community.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

          {/* Top-left: Owner avatar + name + badges */}
          <div className="absolute left-3 top-3 flex items-start gap-2.5">
            <Avatar className="h-10 w-10 ring-2 ring-white/30 shadow-lg">
              <AvatarImage src={community.owner.image ?? undefined} />
              <AvatarFallback className="bg-white/20 text-xs font-bold text-white">
                {community.owner.name?.charAt(0)?.toUpperCase() ?? (
                  <User className="h-4 w-4 text-white" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-[13px] font-bold text-white leading-tight drop-shadow-sm">
                {community.owner.name ?? "Anonymous"}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {community.isTokenGated && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1.5 py-[1px] text-[9px] font-bold text-white">
                    <Shield className="h-2 w-2" />
                    Gated
                  </span>
                )}
                {community.isOwner && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/90 px-1.5 py-[1px] text-[9px] font-bold text-white">
                    <Crown className="h-2 w-2" />
                    Owner
                  </span>
                )}
                {community.isMember && !community.isOwner && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/90 px-1.5 py-[1px] text-[9px] font-bold text-white">
                    Member
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top-right: Post + Member counts stacked */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              <MessageSquare className="h-2.5 w-2.5" />
              {community._count.posts}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              <Users className="h-2.5 w-2.5" />
              {community._count.members}
            </span>
          </div>

          {/* Bottom overlay: member avatars */}
          <div className="absolute bottom-3 left-3">
            <MemberAvatarStack
              members={community.members}
              totalCount={community._count.members}
            />
          </div>
        </div>

        {/* Bottom section */}
        <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
          {/* Community profile + title */}
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-border/50">
              <Image
                src={community.profileUrl}
                alt={community.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-bold leading-snug">
                {community.title}
              </h3>
            </div>
          </div>

          {/* Description - 2 lines max */}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {community.description}
          </p>

          {/* Token gate info */}
          {!isMemberOrOwner && community.isTokenGated && community.requiredBalanceCode && (
            <div className="mt-2.5">
              {canJoinTokenGated() ? (
                <p className="text-[10px] font-medium text-emerald-600">
                  You have enough {community.requiredBalanceCode} to join
                </p>
              ) : (
                <a
                  href={`${stellarExpertBase}/asset/${community.requiredBalanceCode}-${community.requiredBalanceIssuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:underline"
                >
                  <Lock className="h-2.5 w-2.5" />
                  Requires {community.requiredBalance} {community.requiredBalanceCode}
                </a>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-auto flex items-center gap-2 pt-3">
            {isMemberOrOwner ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 rounded-xl text-xs font-semibold"
                onClick={handleView}
              >
                View Community
              </Button>
            ) : isLocked ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 flex-1 rounded-xl text-xs font-semibold"
                disabled
              >
                <Lock className="mr-1.5 h-3 w-3" />
                Locked
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-9 flex-1 rounded-xl text-xs font-semibold"
                onClick={handleJoin}
                disabled={join.isLoading}
              >
                {join.isLoading && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Join Community
              </Button>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { Shield, Users, MessageSquare, User, Eye, Loader2, Lock } from "lucide-react"
import { useSession } from "next-auth/react"

import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
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

  if (totalCount === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>No members yet</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {displayMembers.map((member, i) => (
          <Avatar
            key={member.user.id}
            className="h-6 w-6 ring-2 ring-card"
          >
            <AvatarImage src={member.user.image ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-violet-400/30 to-blue-400/30 text-[9px] font-semibold">
              {member.user.name?.charAt(0)?.toUpperCase() ?? (
                <User className="h-2.5 w-2.5" />
              )}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {remaining > 0 ? (
        <span className="text-[11px] text-muted-foreground">
          +{remaining} more
        </span>
      ) : null}
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

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (community.isMember || community.isOwner) {
      void router.push(`/community/${community.id}`)
      return
    }

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

  const isPubnet = process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"
  const stellarExpertBase = `https://stellar.expert/explorer/${isPubnet ? "public" : "testnet"}`

  const isMemberOrOwner = community.isMember || community.isOwner

  return (
    <Link href={`/community/${community.id}`}>
      <Card className="group h-full cursor-pointer overflow-hidden border-0 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
        {/* Cover */}
        <div className="relative h-28 w-full overflow-hidden">
          <Image
            src={community.coverUrl}
            alt={community.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Token gate badge top-right */}
          {community.isTokenGated && (
            <Badge className="absolute right-2 top-2 gap-1 border-0 bg-amber-500/90 text-[10px] text-white shadow-sm">
              <Shield className="h-2.5 w-2.5" />
              Gated
            </Badge>
          )}
        </div>

        <CardContent className="relative px-4 pb-4 pt-0">
          {/* Profile image - offset from cover */}
          <div className="flex items-start gap-3 -mt-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-card shadow-md">
              <Image
                src={community.profileUrl}
                alt={community.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 pt-6">
              <h3 className="truncate text-sm font-semibold leading-tight">
                {community.title}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                by {community.owner.name ?? "Anonymous"}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {community.description}
          </p>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {community._count.members}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {community._count.posts}
            </span>
          </div>

          {/* Members + Action */}
          <div className="mt-3 flex items-center justify-between">
            <MemberAvatarStack
              members={community.members}
              totalCount={community._count.members}
            />

            <Button
              size="sm"
              variant={isMemberOrOwner ? "outline" : "default"}
              className="h-7 shrink-0 rounded-full px-3 text-[11px] font-medium"
              onClick={handleAction}
              disabled={join.isLoading}
            >
              {join.isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isMemberOrOwner ? (
                <>
                  <Eye className="mr-1 h-3 w-3" />
                  View
                </>
              ) : community.isTokenGated && !canJoinTokenGated() ? (
                <>
                  <Lock className="mr-1 h-3 w-3" />
                  Locked
                </>
              ) : (
                "Join"
              )}
            </Button>
          </div>

          {/* Token requirement info for non-members */}
          {!isMemberOrOwner && community.isTokenGated && community.requiredBalanceCode && (
            <div className="mt-2">
              {canJoinTokenGated() ? (
                <p className="text-[10px] text-green-600">
                  You have enough {community.requiredBalanceCode} to join
                </p>
              ) : (
                <a
                  href={`${stellarExpertBase}/asset/${community.requiredBalanceCode}-${community.requiredBalanceIssuer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[10px] text-amber-600 hover:underline"
                >
                  <Shield className="h-2.5 w-2.5" />
                  Need {community.requiredBalance} {community.requiredBalanceCode} — View token
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

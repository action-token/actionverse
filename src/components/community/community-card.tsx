"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { Shield, Users, MessageSquare, User, Loader2, Lock, Crown, Coins, Check } from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { api } from "~/utils/api"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import toast from "react-hot-toast"

interface TokenRequirement {
  id: number
  assetCode: string
  assetIssuer: string
  assetImage: string | null
  requiredBalance: number
}

interface CommunityCardProps {
  community: {
    id: number
    title: string
    description: string
    coverUrl: string
    profileUrl: string
    isTokenGated: boolean
    tokenGateLogic: string
    tokenRequirements: TokenRequirement[]
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
  const { getAssetBalance, hasTrust } = useUserStellarAcc()

  const join = api.community.member.join.useMutation({
    onSuccess: () => {
      toast.success("Joined!")
      void utils.community.community.getAll.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const checkTokenRequirement = (req: TokenRequirement) => {
    if (req.requiredBalance === 0) {
      return hasTrust(req.assetCode, req.assetIssuer) ?? false
    }
    const balance = getAssetBalance({
      code: req.assetCode,
      issuer: req.assetIssuer,
    })
    return Number(balance) >= req.requiredBalance
  }

  const canJoinTokenGated = () => {
    if (!community.isTokenGated) return true
    if (community.tokenRequirements.length === 0) return true

    const results = community.tokenRequirements.map(checkTokenRequirement)

    if (community.tokenGateLogic === "AND") {
      return results.every(Boolean)
    }
    return results.some(Boolean)
  }

  const getWalletBalances = () => {
    return community.tokenRequirements.map((req) => ({
      assetCode: req.assetCode,
      assetIssuer: req.assetIssuer,
      balance: Number(getAssetBalance({ code: req.assetCode, issuer: req.assetIssuer }) ?? 0),
    }))
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
        community.tokenGateLogic === "AND"
          ? "You need all required tokens to join"
          : "You need at least one of the required tokens to join",
      )
      return
    }

    join.mutate({
      communityId: community.id,
      walletBalances: community.isTokenGated ? getWalletBalances() : undefined,
    })
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

  const displayTokens = community.tokenRequirements.slice(0, 5)
  const extraTokenCount = community.tokenRequirements.length - 5

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

          {/* Bottom-left: member avatars */}
          <div className="absolute bottom-3 left-3">
            <MemberAvatarStack
              members={community.members}
              totalCount={community._count.members}
            />
          </div>

          {/* Bottom-right: Token requirements panel on cover */}
          {!isMemberOrOwner && community.isTokenGated && community.tokenRequirements.length > 0 && (
            <div className="absolute bottom-2 right-2 max-w-[60%] rounded-lg bg-black/60 p-2 backdrop-blur-sm">
              <p className="text-[9px] font-medium text-white/80 mb-1">
                {community.tokenGateLogic === "AND"
                  ? "All tokens required to join"
                  : "Any one token required to join"}
              </p>
              <div className="space-y-0.5">
                {displayTokens.map((req) => {
                  const passes = checkTokenRequirement(req)
                  return (
                    <a
                      key={req.id}
                      href={`${stellarExpertBase}/asset/${req.assetCode}-${req.assetIssuer}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 rounded-md transition-colors hover:bg-white/10"
                    >
                      <div className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${passes ? "bg-emerald-500" : "border border-white/40"}`}>
                        {passes && <Check className="h-2 w-2 text-white" />}
                      </div>
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
                        {req.assetImage ? (
                          <Image
                            src={req.assetImage}
                            alt={req.assetCode}
                            width={16}
                            height={16}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <Coins className="h-2.5 w-2.5 text-white/70" />
                        )}
                      </div>
                      <span className={`truncate text-[10px] ${passes ? "text-emerald-400 font-medium" : "text-white/90"}`}>
                        {req.requiredBalance > 0
                          ? `${req.requiredBalance} ${req.assetCode}`
                          : `${req.assetCode} (trust)`}
                      </span>
                    </a>
                  )
                })}
                {extraTokenCount > 0 && (
                  <p className="text-[9px] text-white/60 pl-[18px]">
                    +{extraTokenCount} more token{extraTokenCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )}
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

"use client"

import { api } from "~/utils/api"
import {
  Crown,
  Users,
  UserPlus,
  Bell,
  LogOut,
  Loader2,
  Shield,
  ExternalLink,
  Lock,
  Coins,
  Check,
} from "lucide-react"
import Image from "next/image"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"

import { Switch } from "~/components/shadcn/ui/switch"
import { Label } from "~/components/shadcn/ui/label"
import toast from "react-hot-toast"
import { useSession } from "next-auth/react"
import { useCommunityMemberDialogStore } from "../store/community-member-dialog-store"
import { useCommunityInviteModalStore } from "../store/community-invite-modal-store"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"

interface TokenRequirement {
  id: number
  assetCode: string
  assetIssuer: string
  assetImage: string | null
  requiredBalance: number
}

interface CommunityDetailSidebarProps {
  communityId: number
  community: {
    ownerId: string
    isTokenGated: boolean
    tokenGateLogic: string
    tokenRequirements: TokenRequirement[]
    owner: {
      id: string
      name: string | null
      image: string | null
    }
    members: Array<{
      user: {
        id: string
        name: string | null
        image: string | null
      }
    }>
    _count: { members: number }
    memberListLocked: boolean
    isMember: boolean
    isOwner: boolean
  }
}

export function CommunityDetailSidebar({
  communityId,
  community,
}: CommunityDetailSidebarProps) {
  const { data: session } = useSession()
  const utils = api.useUtils()
  const memberDialog = useCommunityMemberDialogStore()
  const inviteModal = useCommunityInviteModalStore()
  const { getAssetBalance, hasTrust } = useUserStellarAcc()

  const join = api.community.member.join.useMutation({
    onSuccess: () => {
      toast.success("Joined community!")
      void utils.community.community.getById.invalidate()
      void utils.community.community.getMyCommunities.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const leave = api.community.member.leave.useMutation({
    onSuccess: () => {
      toast.success("Left community")
      void utils.community.community.getById.invalidate()
      void utils.community.community.getMyCommunities.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const { data: notifPrefs } =
    api.community.member.getNotificationPreferences.useQuery(
      { communityId },
      { enabled: community.isMember },
    )

  const updatePrefs =
    api.community.member.updateNotificationPreferences.useMutation({
      onSuccess: () => {
        void utils.community.member.getNotificationPreferences.invalidate()
      },
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

  const handleJoin = () => {
    join.mutate({
      communityId,
      walletBalances: community.isTokenGated ? getWalletBalances() : undefined,
    })
  }

  const isPubnet = process.env.NEXT_PUBLIC_STELLAR_PUBNET === "true"
  const stellarExpertBase = `https://stellar.expert/explorer/${isPubnet ? "public" : "testnet"}`

  return (
    <div className="space-y-4">
      {/* Owner card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4 text-amber-500" />
            Community Owner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={community.owner.image ?? undefined} />
              <AvatarFallback>
                {community.owner.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">
              {community.owner.name ?? "Anonymous"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Members ({community._count.members})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {community.memberListLocked ? (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Member list is visible to members only
              </p>
            </div>
          ) : (
            <>
              {community.members.slice(0, 5).map((member) => (
                <div key={member.user.id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {member.user.name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">
                    {member.user.name ?? "Anonymous"}
                  </span>
                </div>
              ))}
              {community._count.members > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    memberDialog.setCommunityId(communityId)
                    memberDialog.setIsOpen(true)
                  }}
                >
                  View all {community._count.members} members
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Join / Actions */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          {session?.user && !community.isMember && (
            <div className="space-y-3">
              {/* Token requirements */}
              {community.isTokenGated && community.tokenRequirements.length > 0 && (() => {
                const metCount = community.tokenRequirements.filter(checkTokenRequirement).length
                const total = community.tokenRequirements.length
                const isAny = community.tokenGateLogic === "OR"
                const allMet = canJoinTokenGated()

                return (
                  <div className="space-y-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-amber-500" />
                        <p className="text-[11px] font-medium">
                          Token Requirements
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold ${allMet ? "text-emerald-600" : "text-amber-600"}`}>
                        {metCount}/{total} met
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${allMet ? "bg-emerald-500" : metCount > 0 ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                        style={{ width: `${total > 0 ? (metCount / total) * 100 : 0}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      {isAny
                        ? "You need at least one of these tokens to join"
                        : "You need all of these tokens to join"}
                    </p>

                    {/* Token list */}
                    <div className="space-y-1">
                      {community.tokenRequirements.map((req) => {
                        const passes = checkTokenRequirement(req)
                        return (
                          <a
                            key={req.id}
                            href={`${stellarExpertBase}/asset/${req.assetCode}-${req.assetIssuer}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-amber-500/10"
                          >
                            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${passes ? "bg-emerald-500" : "border border-muted-foreground/40"}`}>
                              {passes && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                              {req.assetImage ? (
                                <Image
                                  src={req.assetImage}
                                  alt={req.assetCode}
                                  width={24}
                                  height={24}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <Coins className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-medium ${passes ? "text-foreground" : "text-muted-foreground"}`}>
                                {req.requiredBalance > 0
                                  ? `${req.requiredBalance} ${req.assetCode}`
                                  : `${req.assetCode} (trust only)`}
                              </p>
                            </div>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <Button
                className="w-full gap-2 rounded-full"
                onClick={handleJoin}
                disabled={join.isLoading || !canJoinTokenGated()}
              >
                {join.isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Join Community
              </Button>
              {community.isTokenGated && !canJoinTokenGated() && (
                <p className="text-center text-[10px] text-muted-foreground">
                  {community.tokenGateLogic === "OR"
                    ? "You need at least one of the required tokens to join"
                    : "You need all required tokens to join"}
                </p>
              )}
            </div>
          )}

          {community.isMember && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-full"
                onClick={() => {
                  inviteModal.setCommunityId(communityId)
                  inviteModal.setIsOpen(true)
                }}
              >
                <UserPlus className="h-4 w-4" />
                Invite Friends
              </Button>

              {!community.isOwner && (
                <Button
                  variant="ghost"
                  className="w-full gap-2 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => leave.mutate({ communityId })}
                  disabled={leave.isLoading}
                >
                  <LogOut className="h-4 w-4" />
                  Leave Community
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification preferences */}
      {community.isMember && notifPrefs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                { key: "newPosts", label: "New posts" },
                { key: "newComments", label: "Comments" },
                { key: "newMembers", label: "New members" },
                { key: "reactions", label: "Reactions" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-xs">{label}</Label>
                <Switch
                  checked={notifPrefs[key]}
                  onCheckedChange={(checked) =>
                    updatePrefs.mutate({
                      communityId,
                      [key]: checked,
                    })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

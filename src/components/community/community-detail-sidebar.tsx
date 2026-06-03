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
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Button } from "~/components/shadcn/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Badge } from "~/components/shadcn/ui/badge"
import { Switch } from "~/components/shadcn/ui/switch"
import { Label } from "~/components/shadcn/ui/label"
import toast from "react-hot-toast"
import { useSession } from "next-auth/react"
import { useCommunityMemberDialogStore } from "../store/community-member-dialog-store"
import { useCommunityInviteModalStore } from "../store/community-invite-modal-store"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"

interface CommunityDetailSidebarProps {
  communityId: number
  community: {
    ownerId: string
    isTokenGated: boolean
    requiredBalance: number | null
    requiredBalanceCode: string | null
    requiredBalanceIssuer: string | null
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
  const { getAssetBalance } = useUserStellarAcc()

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

  const canJoinTokenGated = () => {
    if (!community.isTokenGated) return true
    if (!community.requiredBalanceCode || !community.requiredBalanceIssuer) return true
    const balance = getAssetBalance({
      code: community.requiredBalanceCode,
      issuer: community.requiredBalanceIssuer,
    })
    return Number(balance) >= (community.requiredBalance ?? 0)
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
              {community.isTokenGated &&
                community.requiredBalanceCode &&
                community.requiredBalanceIssuer && (
                  <a
                    href={`${stellarExpertBase}/asset/${community.requiredBalanceCode}-${community.requiredBalanceIssuer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
                  >
                    <Shield className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">
                        {community.requiredBalance} {community.requiredBalanceCode} required
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Click to view token on Stellar
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                )}

              <Button
                className="w-full gap-2 rounded-full"
                onClick={() => join.mutate({ communityId })}
                disabled={join.isLoading || !canJoinTokenGated()}
              >
                {join.isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Join Community
              </Button>
              {community.isTokenGated && !canJoinTokenGated() && (
                <p className="text-center text-[10px] text-muted-foreground">
                  Insufficient token balance to join
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

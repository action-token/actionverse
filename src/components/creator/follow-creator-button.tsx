"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Heart, Loader2, Crown, X } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { api } from "~/utils/api"
import { clientsign } from "package/connect_wallet"
import { clientSelect } from "~/lib/stellar/fan/utils"
import useNeedSign from "~/lib/hook"
import toast from "react-hot-toast"
import { toast as sonner } from "sonner"

interface FollowAndMembershipButtonProps {
  creatorId: string
  className?: string
  creatorName: string
  hasPageAsset: boolean
}

export default function FollowAndMembershipButton({
  creatorId,
  className = "",
  creatorName,
  hasPageAsset,
}: FollowAndMembershipButtonProps) {
  const session = useSession()
  const { needSign } = useNeedSign()
  const [isFollowing, setIsFollowing] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [wasMember, setWasMember] = useState(false)
  const [showMembershipDialog, setShowMembershipDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRejoinDialog, setShowRejoinDialog] = useState(false)

  const followStatusQuery = api.fan.creator.checkCurrentUserFollowsCreator.useQuery(
    { creatorId: creatorId },
    {
      enabled: !!session.data?.user.id && !!creatorId,
      onSuccess: (data) => {
        console.log("Follow status data:", data)
        setIsFollowing(data.isFollowing)
      },
    },
  )

  const memberStatusQuery = api.fan.creator.checkCurrentUserMemberCreator.useQuery(
    { creatorId: creatorId },
    {
      enabled: !!session.data?.user.id && !!creatorId,
      onSuccess: (data) => {
        setIsMember(data.isMemeber)
        if (!data.isMemeber && data.wasMember) {
          setWasMember(true)
        }
      },
    },
  )

  const followCreator = api.fan.member.followCreator.useMutation({
    onSuccess: () => {
      toast.success("Creator Followed")
      setShowMembershipDialog(false)
      followStatusQuery.refetch()
    },
    onError: (e) => toast.error("Failed to follow creator"),
  })

  const membership = api.fan.member.becomeMember.useMutation({
    onSuccess: () => {
      toast.success("Membership activated!")
      setShowMembershipDialog(false)
      setShowRejoinDialog(false)
      memberStatusQuery.refetch()
    },
    onError: (e) => toast.error("Failed to activate membership"),
  })

  const removeFollow = api.fan.member.unFollowCreator.useMutation({
    onSuccess: () => {
      toast.success("Creator Unfollowed")
      setIsFollowing(false)
      followStatusQuery.refetch()
    },
    onError: (e) => toast.error("Failed to unfollow creator"),
  })

  const removeMembership = api.fan.member.removeFromMember.useMutation({
    onSuccess: () => {
      toast.success("Membership cancelled")
      setIsMember(false)
      setWasMember(true)
      setShowCancelDialog(false)
      memberStatusQuery.refetch()
    },
    onError: (e) => toast.error("Failed to cancel membership"),
  })

  const membershipXDR = api.fan.trx.followCreatorTRX.useMutation({
    onSuccess: async (xdr, variables) => {
      if (xdr) {
        if (xdr === true) {
          toast.success("User already has trust in page asset")
          membership.mutate({ creatorId: variables.creatorId })
        } else {
          try {
            const res = await clientsign({
              presignedxdr: xdr,
              pubkey: session.data?.user.id,
              walletType: session.data?.user.walletType,
              test: clientSelect(),
            })

            if (res) {
              membership.mutate({ creatorId: variables.creatorId })
            } else {
              toast.error("Transaction failed while signing.")
            }
          } catch (error: unknown) {
            console.error("Error in test transaction", error)

            const err = error as {
              message?: string
              details?: string
              errorCode?: string
            }

            sonner.error(
              typeof err?.message === "string"
                ? err.message
                : "Transaction Failed",
              {
                description: `Error Code : ${err?.errorCode ?? "unknown"}`,
                duration: 8000,
              }
            )
          }
        }
      } else {
        toast.error("Failed to create follow transaction")
      }
    },
    onError: (e) => toast.error("Failed to create follow transaction"),
  })

  const handleMembershipPurchase = () => {
    membershipXDR.mutate({
      creatorId: creatorId,
      signWith: needSign(),
    })
  }

  const handleCancelMembershipClick = () => {
    setShowCancelDialog(true)
  }

  const handleConfirmCancel = () => {
    removeMembership.mutate({ creatorId: creatorId })
  }

  const handleRemoveFollowClick = () => {
    removeFollow.mutate({ creatorId: creatorId })
  }

  const handleFollowClick = () => {
    followCreator.mutate({ creatorId: creatorId })
  }

  const handleRejoinClick = () => {
    setShowRejoinDialog(true)
  }

  const isLoading = membershipXDR.isLoading || membership.isLoading || removeMembership.isLoading

  if (session.data?.user.id === creatorId || !session.data?.user.id) {
    return null
  }

  return (
    <>
      <div className={`flex items-center gap-3 relative ${className}`}>
        {isFollowing ? (
          <Button
            onClick={handleRemoveFollowClick}
            variant="outline"
            className="relative pr-8 bg-transparent"
            disabled={isLoading}
            title="Unfollow"
          >
            {removeFollow.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Heart className="h-4 w-4 text-red-500 fill-red-500 mr-2" />
                Following
                <span className="ml-2 absolute top-0 right-0 rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">
                  Free
                </span>
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="default"
            className="relative pr-8 bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
            title="Follow"
            onClick={handleFollowClick}
          >
            {followCreator.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Heart className="h-4 w-4 mr-2" />
                Follow
                <span className="ml-2 absolute top-0 right-0 rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">
                  Free
                </span>
              </>
            )}
          </Button>
        )}

        {
          hasPageAsset && (

            isMember ? (
              <Button
                onClick={handleCancelMembershipClick}
                variant="outline"
                size="default"
                className="gap-2 font-medium bg-transparent"
              >
                <Crown className="h-4 w-4" />
                Member
              </Button>
            ) : wasMember ? (
              <Button onClick={handleRejoinClick} variant="secondary" size="default" className="gap-2 font-medium">
                <Crown className="h-4 w-4" />
                Rejoin
              </Button>
            ) : (
              <Button
                onClick={() => setShowMembershipDialog(true)}
                variant="default"
                size="default"
                className="gap-2 font-medium bg-orange-500 hover:bg-orange-600"
              >
                <Crown className="h-4 w-4" />
                Become a Member
              </Button>
            )
          )
        }
      </div>

      <Dialog open={showMembershipDialog} onOpenChange={setShowMembershipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-orange-500" />
              <DialogTitle>Become a Member</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Join as a member and unlock exclusive access to <b>{creatorName}</b>
              {"'"}s content and community.
            </p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <div className="text-xs text-muted-foreground">It{"'"}d cost you</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-600 dark:text-amber-500">0.5</span>
                <span className="text-sm font-medium text-muted-foreground">XLM</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">One-time</div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">What you{"'"}ll get:</div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Access to member-only content</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Member badge on your profile</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Join the exclusive community</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Upgrade to premium tiers later</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="w-full bg-transparent" onClick={() => setShowMembershipDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={membershipXDR.isLoading || membership.isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={handleMembershipPurchase}
            >
              {membershipXDR.isLoading || membership.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm & Pay"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              <DialogTitle>Cancel Membership</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel your membership? You{"'"}ll lose access to member-only content.
            </p>

            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-600 dark:text-red-400">
                You can rejoin anytime for free if you change your mind.
              </p>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="w-full bg-transparent" onClick={() => setShowCancelDialog(false)}>
              Keep Membership
            </Button>
            <Button
              disabled={removeMembership.isLoading}
              variant="destructive"
              className="w-full"
              onClick={handleConfirmCancel}
            >
              {removeMembership.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Membership"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejoinDialog} onOpenChange={setShowRejoinDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-orange-500" />
              <DialogTitle>Rejoin Membership</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Rejoin as a member and regain access to exclusive content and community.
            </p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <div className="text-xs text-muted-foreground">It{"'"}d cost you</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">Free</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Rejoin benefit</div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">What you{"'"}ll get:</div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Access to member-only content</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Member badge on your profile</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Join the exclusive community</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5">
                    <svg viewBox="0 0 12 12" fill="none" className="text-white">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-foreground">Upgrade to premium tiers later</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="w-full bg-transparent" onClick={() => setShowRejoinDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={membershipXDR.isLoading || membership.isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={handleMembershipPurchase}
            >
              {membershipXDR.isLoading || membership.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Rejoin Free"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

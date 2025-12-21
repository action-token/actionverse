"use client"

import { useRouter } from "next/navigation"
import { Button } from "~/components/shadcn/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/shadcn/ui/dialog"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { useBounty } from "~/lib/state/augmented-reality/useBounty"
import { MapPin, Navigation, Trophy, Award, Target } from "lucide-react"
import { useLocation } from "~/hooks/use-location"
import { BountyTypeIndicator } from "~/components/bounty/bounty-type-indicator"
import { isWithinRadius } from "~/utils/location"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { api } from "~/utils/api"
import { toast } from "~/hooks/use-toast"

const JoinBountyModal = () => {
  const { isOpen, onClose, type, data } = useModal()
  const isModalOpen = isOpen && type === "JoinBounty"
  const router = useRouter()
  const { setData } = useBounty()

  const { location, loading: locationLoading, requestLocation } = useLocation()

  const utils = api.useUtils()

  const { getAssetBalance, setBalance } = useUserStellarAcc()

  const handleClose = () => {
    onClose()
  }

  const joinMutation = api.bounty.Bounty.joinBounty.useMutation({
    onSuccess: async (data, variables) => {
      await utils.bounty.Bounty.getAllBounties.invalidate()
      onClose()
      router.push(`/actions/actions/${variables.BountyId}`)
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join bounty",
        variant: "destructive",
      })
    },
  })

  const handleJoin = (bountyId: number) => {
    joinMutation.mutate({ BountyId: bountyId })
  }

  const { bounty } = data

  if (!bounty) {
    return (
      <Dialog open={isModalOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Join Bounty?</DialogTitle>
          </DialogHeader>
          <p className="text-center text-destructive text-sm">Bounty not found or has been removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Check location requirements
  const canJoinLocationBased = () => {
    if (bounty.bountyType !== "LOCATION_BASED") return true

    if (!location || !bounty.latitude || !bounty.longitude) return false

    return isWithinRadius(
      location.latitude,
      location.longitude,
      bounty.latitude,
      bounty.longitude,
      bounty.radius ?? 200,
    )
  }

  const balance = getAssetBalance({
    code: bounty.requiredBalanceCode,
    issuer: bounty.requiredBalanceIssuer,
  })
  const hasRequiredBalance = bounty.requiredBalance <= Number(balance)
  const canJoin = hasRequiredBalance && canJoinLocationBased()
  const radiusKm = ((bounty.radius ?? 500) / 1000).toFixed(2)

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4 rounded-2xl">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0 pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                Join Bounty
                <div className="text-xs font-normal text-muted-foreground mt-0.5">
                  <BountyTypeIndicator bountyType={bounty.bountyType} />
                </div>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 px-0">
            <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-4 border-2 border-primary/20">
              <p className="font-bold text-base mb-2">{bounty?.title}</p>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <Award className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entry Requirement</p>
                  <p className="text-sm font-bold">
                    {bounty.requiredBalance} {bounty.requiredBalanceCode}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${hasRequiredBalance
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hasRequiredBalance ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                  <Award className={`h-4 w-4 ${hasRequiredBalance ? "text-emerald-600" : "text-red-600"}`} />
                </div>
                <span className="text-sm font-semibold">Balance Check</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${hasRequiredBalance ? "bg-emerald-500" : "bg-red-500"} animate-pulse`}
                ></div>
                <span
                  className={`text-sm font-bold ${hasRequiredBalance ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                    }`}
                >
                  {hasRequiredBalance ? "Sufficient" : "Insufficient"}
                </span>
              </div>
            </div>

            {!hasRequiredBalance && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className="p-1 rounded bg-red-500/20 mt-0.5">
                  <Trophy className="h-3.5 w-3.5 text-red-600" />
                </div>
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                  You have{" "}
                  <span className="font-bold">
                    {balance} {bounty.requiredBalanceCode}
                  </span>{" "}
                  but need{" "}
                  <span className="font-bold">
                    {bounty.requiredBalance} {bounty.requiredBalanceCode}
                  </span>{" "}
                  to join.
                </p>
              </div>
            )}

            {bounty.bountyType === "LOCATION_BASED" && (
              <div className="space-y-3">
                <div
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${location && canJoinLocationBased()
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold">Location Check</span>
                  </div>
                  {!location ? (
                    <Button
                      size="sm"
                      onClick={requestLocation}
                      disabled={locationLoading}
                      className="h-8 text-xs rounded-lg font-semibold shadow-sm"
                    >
                      <Navigation className="h-3 w-3 mr-1.5" />
                      {locationLoading ? "Getting..." : "Enable"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${canJoinLocationBased() ? "bg-emerald-500" : "bg-red-500"} animate-pulse`}
                      ></div>
                      <span
                        className={`text-sm font-bold ${canJoinLocationBased()
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                          }`}
                      >
                        {canJoinLocationBased() ? "Within Range" : "Too Far"}
                      </span>
                    </div>
                  )}
                </div>

                {location && !canJoinLocationBased() && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <div className="p-1 rounded bg-red-500/20 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                      You must be within <span className="font-bold">{radiusKm} km</span> of the bounty location to
                      join.
                    </p>
                  </div>
                )}
              </div>
            )}

            {bounty.bountyType === "SCAVENGER_HUNT" && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-2 border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Scavenger Hunt</span>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                  Complete <span className="font-bold">{bounty.ActionLocation?.length ?? 0} steps</span> to win this
                  bounty and earn the reward!
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-3 px-0 pb-0">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 rounded-xl font-semibold border-2 hover:bg-muted bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleJoin(Number(bounty.id))}
              disabled={!canJoin || joinMutation.isLoading}
              className="flex-1 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {joinMutation.isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-4 w-4" />
                  Join Now
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  )
}

export default JoinBountyModal

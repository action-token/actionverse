"use client"
import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpDown, Users, Trophy, Clock, Star, Zap } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { useBounty } from "~/lib/state/augmented-reality/useBounty"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import type { Bounty } from "~/types/game/bounty"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import toast from "react-hot-toast"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { getAllBounties } from "~/lib/augmented-reality/get-all-bounties"
import { getUserPlatformAsset } from "~/lib/augmented-reality/get-user-platformAsset"
import { Walkthrough } from "~/components/common/walkthrough"
import { Preview } from "~/components/common/quill-preview"

type ButtonLayout = {
  x: number
  y: number
  width: number
  height: number
}

export default function BountyScreen() {
  const [selectedFilter, setSelectedFilter] = useState("All")
  const { setData } = useBounty()
  const { onOpen } = useModal()
  const router = useRouter()
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const joinButtonRef = useRef<HTMLButtonElement>(null)

  const { data: walkthroughData } = useWalkThrough()

  const { data: bountyData, isLoading } = useQuery({
    queryKey: ["bounties"],
    queryFn: getAllBounties,
  })

  const { data: balanceData } = useQuery({
    queryKey: ["balance"],
    queryFn: getUserPlatformAsset,
  })

  const bountyList = bountyData?.allBounty ?? []

  const dummyBounties: Bounty[] = [
    {
      title: "Bounty 1",
      description: "This is a bounty description",
      priceInUSD: 100,
      priceInBand: 100,
      status: "APPROVED",
      isJoined: false,
      _count: {
        participants: 10,
        BountyWinner: 1,
      },
      currentWinnerCount: 1,
      imageUrls: ["https://app.action-tokens.com/images/action/logo.png"],
      totalWinner: 4,
      BountyWinner: [],
      creator: {
        name: "Creator 1",
        profileUrl: "https://app.action-tokens.com/images/action/logo.png",
      },
      id: "1",
      creatorId: "0x1234567890",
      requiredBalance: 100,
      isOwner: false,
    },
  ]

  useEffect(() => {
    const updateButtonLayouts = () => {
      const filterButton = filterButtonRef.current
      const joinButton = joinButtonRef.current

      if (filterButton && joinButton) {
        const filterRect = filterButton.getBoundingClientRect()
        const joinRect = joinButton.getBoundingClientRect()

        setButtonLayouts([
          {
            x: filterRect.left,
            y: filterRect.top,
            width: filterRect.width,
            height: filterRect.height,
          },
          {
            x: joinRect.left,
            y: joinRect.top,
            width: joinRect.width,
            height: joinRect.height,
          },
        ])
      }
    }

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateButtonLayouts)
    })

    observer.observe(document.body)
    updateButtonLayouts()

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (walkthroughData?.showWalkThrough) {
      setShowWalkthrough(true)
    }
  }, [walkthroughData])

  const filteredBounties = React.useMemo(() => {
    return bountyList.filter((bounty: Bounty) => {
      if (selectedFilter === "Joined") return bounty.isJoined
      if (selectedFilter === "Not Joined") return !bounty.isJoined && !bounty.isOwner
      return true
    })
  }, [selectedFilter, bountyList])

  const handleBountyAction = (bounty: Bounty) => {
    if (bounty.isJoined || bounty.isOwner) {
      setData({ item: bounty })
      router.push(`/augmented-reality/actions/${bounty.id}`)
    } else if (bounty.totalWinner === bounty.currentWinnerCount) {
      toast.error("Bounty is already finished")
    } else {
      onOpen("JoinBounty", { bounty: bounty, balance: balanceData })
    }
  }

  const getStatusColor = (status: Bounty["status"]) => {
    switch (status) {
      case "APPROVED":
        return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
      case "PENDING":
        return "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
      case "REJECTED":
        return "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25"
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-lg shadow-gray-500/25"
    }
  }

  const steps = [
    {
      target: buttonLayouts[0],
      title: "Filter Bounty",
      content: "User can filter bounty between Joined and Not Joined Bounty List.",
    },
    {
      target: buttonLayouts[1],
      title: "View/Join Bounty",
      content:
        "Clicking 'Join Bounty' lets users view details and join. If already joined, they can view details only.",
    },
  ]

  return (
    <div className="min-h-screen ">
      {/* Modern Header with Glassmorphism */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-white/20 shadow-lg shadow-black/5">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Bounties
                </h1>
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  {filteredBounties.length} active challenges
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={filterButtonRef}
                  variant="outline"
                  className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-lg shadow-black/5 transition-all duration-200"
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {selectedFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="backdrop-blur-xl bg-white/90 dark:bg-slate-800/90 border-white/20"
              >
                {["All", "Joined", "Not Joined"].map((filter) => (
                  <DropdownMenuItem key={filter} onClick={() => setSelectedFilter(filter)}>
                    {filter}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-8 md:grid-cols-1">
            {showWalkthrough ? (
              dummyBounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  onAction={handleBountyAction}
                  getStatusColor={getStatusColor}
                  joinButtonRef={joinButtonRef}
                />
              ))
            ) : isLoading ? (
              Array.from({ length: 6 }).map((_, index) => <BountyCardSkeleton key={`skeleton-${index}`} />)
            ) : filteredBounties.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20">
                <div className="text-center">
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 mb-6 inline-block">
                    <Star className="h-12 w-12 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No bounties found</h3>
                  <p className="text-slate-600 dark:text-slate-400 max-w-md">
                    Try adjusting your filter to discover more exciting challenges.
                  </p>
                </div>
              </div>
            ) : (
              filteredBounties.map((bounty: Bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  onAction={handleBountyAction}
                  getStatusColor={getStatusColor}
                  joinButtonRef={joinButtonRef}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

interface BountyCardProps {
  bounty: Bounty
  onAction: (bounty: Bounty) => void
  getStatusColor: (status: Bounty["status"]) => string
  joinButtonRef?: React.RefObject<HTMLButtonElement>
}

function BountyCard({ bounty, onAction, getStatusColor, joinButtonRef }: BountyCardProps) {
  const isFinished = bounty.totalWinner === bounty.currentWinnerCount

  return (
    <div className="group relative">
      {/* Card with Glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-xl shadow-black/10 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-2">
        {/* Image with Overlay */}
        <div className="relative h-56 overflow-hidden">
          <Image
            src={bounty.imageUrls[0] ?? "https://app.action-tokens.com/images/action/logo.png"}
            alt={bounty.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <Badge className={`${getStatusColor(bounty.status)} border-0 px-3 py-1 font-semibold`}>
              {bounty.status}
            </Badge>
          </div>

          {/* Prize Highlight */}
          <div className="absolute bottom-4 left-4">
            <div className="flex items-center space-x-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-slate-900 dark:text-white">${bounty.priceInUSD}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{bounty.title}</h3>

            {/* Stats Row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 text-slate-600 dark:text-slate-400">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{bounty._count.participants}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">
                    {isFinished ? "Finished" : `${bounty.totalWinner - bounty.currentWinnerCount} left`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-50/80 dark:bg-slate-700/50 rounded-2xl p-4 max-h-20 overflow-y-auto">
            <Preview value={bounty.description} />
          </div>

          {/* Prize Info */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Prize</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {bounty.priceInBand} {PLATFORM_ASSET.code}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-violet-500" />
          </div>

          {/* Action Button */}
          <Button
            ref={bounty.isJoined ? undefined : joinButtonRef}
            className={`w-full h-12 rounded-2xl font-semibold transition-all duration-200 ${bounty.isJoined || bounty.isOwner
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300"
              : isFinished
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40"
              }`}
            disabled={bounty.status === "REJECTED" || isFinished}
            onClick={() => onAction(bounty)}
          >
            {bounty.isJoined || bounty.isOwner ? "View Details" : isFinished ? "Bounty Finished" : "Join Bounty"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function BountyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-xl">
      <Skeleton className="h-56 w-full" />
      <div className="p-6 space-y-4">
        <div>
          <Skeleton className="h-6 w-3/4 mb-2" />
          <div className="flex items-center space-x-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  )
}

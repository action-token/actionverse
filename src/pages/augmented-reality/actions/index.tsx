"use client"
import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpDown, Users, Trophy, Clock, Star, Zap, Filter, Search, Grid3X3, List, ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent } from "~/components/shadcn/ui/card"
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
import { motion, AnimatePresence } from "framer-motion"
import { BountyTypeIndicator } from "~/components/bounty/bounty-type-indicator"
import { ScavengerProgress } from "~/components/bounty/scavenger-progress"
import { useLocation } from "~/hooks/use-location"
import { isWithinRadius } from "~/utils/location"

type ButtonLayout = {
  x: number
  y: number
  width: number
  height: number
}

type ViewMode = 'grid' | 'list'

export default function BountyScreen() {
  const [selectedFilter, setSelectedFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showHeader, setShowHeader] = useState(true)
  const { setData } = useBounty()
  const { onOpen } = useModal()
  const router = useRouter()
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const joinButtonRef = useRef<HTMLButtonElement>(null)

  // Add location hook
  const { location, loading: locationLoading, requestLocation } = useLocation()

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
      title: "Digital Collectible 1",
      description: "<p>This is a digital collectible description</p>",
      priceInUSD: 100,
      priceInBand: 100,
      status: "APPROVED",
      isJoined: false,
      currentWinnerCount: 1,
      _count: {
        participants: 10,
        BountyWinner: 1,
      },
      imageUrls: ["https://app.action-tokens.com/images/action/logo.png"],
      totalWinner: 5,
      BountyWinner: [],
      creator: {
        name: "Creator 1",
        profileUrl: "https://app.action-tokens.com/images/action/logo.png",
      },
      id: "1",
      creatorId: "0x1234567890",
      requiredBalance: 100,
      isOwner: false,
      currentStep: 0,
      ActionLocation: [],
      bountyType: "GENERAL",
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 200,
    },
    {
      title: "Location Based Bounty",
      description: "<p>This is a location based bounty description</p>",
      priceInUSD: 100,
      priceInBand: 100,
      status: "APPROVED",
      isJoined: false,
      currentWinnerCount: 1,
      _count: {
        participants: 10,
        BountyWinner: 1,
      },
      imageUrls: ["https://app.action-tokens.com/images/action/logo.png"],
      totalWinner: 5,
      BountyWinner: [],
      creator: {
        name: "Creator 1",
        profileUrl: "https://app.action-tokens.com/images/action/logo.png",
      },
      id: "2",
      creatorId: "0x1234567890",
      requiredBalance: 100,
      isOwner: false,
      currentStep: 0,
      ActionLocation: [],
      bountyType: "LOCATION_BASED",
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 200,
    },
    {
      title: "Scavenger Hunt Bounty",
      description: "<p>This is a scavenger hunt bounty description</p>",
      priceInUSD: 100,
      priceInBand: 100,
      status: "APPROVED",
      isJoined: true,
      currentWinnerCount: 1,
      _count: {
        participants: 10,
        BountyWinner: 1,
      },
      imageUrls: ["https://app.action-tokens.com/images/action/logo.png"],
      totalWinner: 5,
      BountyWinner: [],
      creator: {
        name: "Creator 1",
        profileUrl: "https://app.action-tokens.com/images/action/logo.png",
      },
      id: "3",
      creatorId: "0x1234567890",
      requiredBalance: 100,
      isOwner: false,
      currentStep: 1,
      ActionLocation: [],
      bountyType: "SCAVENGER_HUNT",
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 200,
    }
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
    return bountyList
      .filter((bounty: Bounty) => {
        const matchesSearch = bounty.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          bounty.description.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesFilter = (() => {
          if (selectedFilter === "Joined") return bounty.isJoined
          if (selectedFilter === "Not Joined") return !bounty.isJoined && !bounty.isOwner
          return true
        })()

        return matchesSearch && matchesFilter
      })
  }, [selectedFilter, searchQuery, bountyList])

  const handleBountyAction = (bounty: Bounty) => {
    if (bounty.isJoined || bounty.isOwner) {
      setData({ item: bounty })
      router.push(`/augmented-reality/actions/${bounty.id}`)
    } else if (bounty.totalWinner === bounty.currentWinnerCount) {
      toast.error("Bounty is already finished")
    } else {
      // Check location requirements for location-based bounties
      if (bounty.bountyType === "LOCATION_BASED") {
        if (!location) {
          toast.error("Location access required for this bounty")
          requestLocation()
          return
        }

        if (bounty.latitude && bounty.longitude) {
          const withinRange = isWithinRadius(
            location.latitude,
            location.longitude,
            bounty.latitude,
            bounty.longitude,
            bounty.radius ?? 500
          )
          console.log("Location check:", withinRange)
          if (!withinRange) {
            console.log("Location not within radius:", {
              userLat: location.latitude,
              userLon: location.longitude,
              bountyLat: bounty.latitude,
              bountyLon: bounty.longitude,
              radius: bounty.radius ?? 500
            })
            toast.error("You must be within 500 meters of the bounty location")
            return
          }
        }
      }

      onOpen("JoinBounty", { bounty: bounty, balance: balanceData, userLocation: location })
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
    <div className="min-h-screen pb-32">
      {/* Header Toggle Button */}
      {!showHeader && (
        <motion.div
          className="fixed top-4 right-4 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            onClick={() => setShowHeader(true)}
            className="w-12 h-12 rounded-full "
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </motion.div>
      )}


      {/* Compact Header */}
      <AnimatePresence>
        {showHeader && (
          <motion.div
            className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-white/20 shadow-lg shadow-black/5"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      Actions
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      {filteredBounties.length} active challenges
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'grid' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 w-8 p-0 rounded-lg"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8 w-8 p-0 rounded-lg"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setShowHeader(false)}
                    className="h-9 w-9 p-0 rounded-lg"

                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search bounties..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      ref={filterButtonRef}
                      variant="outline"
                      size="sm"
                      className="h-9 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-white/20 hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-lg shadow-black/5 transition-all duration-200 rounded-xl"
                    >
                      <Filter className="mr-2 h-4 w-4" />
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                className="grid gap-6 md:grid-cols-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {showWalkthrough ? (
                  dummyBounties.map((bounty) => (
                    <BountyCard
                      key={bounty.id}
                      bounty={bounty}
                      onAction={handleBountyAction}
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
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No action found</h3>
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
                      joinButtonRef={joinButtonRef}
                    />
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {showWalkthrough ? (
                  dummyBounties.map((bounty) => (
                    <BountyListItem
                      key={bounty.id}
                      bounty={bounty}
                      onAction={handleBountyAction}
                      joinButtonRef={joinButtonRef}
                    />
                  ))
                ) : isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => <BountyListSkeleton key={`skeleton-${index}`} />)
                ) : filteredBounties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="text-center">
                      <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 mb-6 inline-block">
                        <Star className="h-12 w-12 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No actions found</h3>
                      <p className="text-slate-600 dark:text-slate-400 max-w-md">
                        Try adjusting your filter to discover more exciting challenges.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredBounties.map((bounty: Bounty) => (
                    <BountyListItem
                      key={bounty.id}
                      bounty={bounty}
                      onAction={handleBountyAction}
                      joinButtonRef={joinButtonRef}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

interface BountyCardProps {
  bounty: Bounty
  onAction: (bounty: Bounty) => void
  joinButtonRef?: React.RefObject<HTMLButtonElement>
}

function BountyCard({ bounty, onAction, joinButtonRef }: BountyCardProps) {
  const isFinished = bounty.totalWinner === bounty.currentWinnerCount

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-xl shadow-black/10 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20">
        <div className="relative h-48 overflow-hidden">
          <Image
            src={bounty.imageUrls[0] ?? "https://app.action-tokens.com/images/action/logo.png"}
            alt={bounty.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Status and Type Badges */}
          <div className="absolute top-4 right-4 space-y-2">

            <BountyTypeIndicator bountyType={bounty.bountyType} />
          </div>

          {/* Location indicator for location-based bounties */}
          {bounty.bountyType === "LOCATION_BASED" && (
            <div className="absolute top-4 left-4">
              <div className="flex items-center space-x-1 bg-green-500/90 backdrop-blur-sm rounded-full px-3 py-1">
                <MapPin className="h-3 w-3 text-white" />
                <span className="text-xs text-white font-medium">Location Required</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4">
            <div className="flex items-center space-x-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-slate-900 dark:text-white">${bounty.priceInUSD}</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{bounty.title}</h3>

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

          {/* Scavenger Hunt Progress */}
          {bounty.bountyType === "SCAVENGER_HUNT" && bounty.isJoined && (
            <ScavengerProgress
              currentStep={bounty.currentStep ?? 0}
              totalSteps={bounty.ActionLocation?.length ?? 0}
            />
          )}

          <div className="bg-slate-50/80 dark:bg-slate-700/50 rounded-2xl p-4 max-h-20 overflow-y-auto">
            <Preview value={bounty.description} />
          </div>

          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Prize</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {bounty.priceInBand} {PLATFORM_ASSET.code}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-violet-500" />
          </div>

          <Button
            ref={bounty.isJoined ? undefined : joinButtonRef}
            className={`w-full h-12 rounded-2xl font-semibold transition-all duration-200 ${bounty.isJoined ?? bounty.isOwner
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
    </motion.div>
  )
}

function BountyListItem({ bounty, onAction, joinButtonRef }: BountyCardProps) {
  const isFinished = bounty.totalWinner === bounty.currentWinnerCount

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Card className="overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-lg">
        <CardContent className="p-0">
          <div className="flex">
            <div className="w-32 h-24 relative">
              <Image
                src={bounty.imageUrls[0] ?? "https://app.action-tokens.com/images/action/logo.png"}
                alt={bounty.title}
                fill
                className="object-cover"
              />
            </div>

            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate mb-1">
                    {bounty.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">

                    <BountyTypeIndicator bountyType={bounty.bountyType} className="text-xs px-2 py-0.5" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      ${bounty.priceInUSD}
                    </span>
                  </div>

                  {/* Scavenger Hunt Progress in List View */}
                  {bounty.bountyType === "SCAVENGER_HUNT" && bounty.isJoined && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Progress:</span>
                        <span className="font-medium">{bounty.currentStep ?? 0}/{bounty.ActionLocation?.length ?? 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  ref={bounty.isJoined ? undefined : joinButtonRef}
                  size="sm"
                  className={`ml-2 rounded-xl ${bounty.isJoined || bounty.isOwner
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : isFinished
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
                    }`}
                  disabled={bounty.status === "REJECTED" || isFinished}
                  onClick={() => onAction(bounty)}
                >
                  {bounty.isJoined || bounty.isOwner ? "View" : isFinished ? "Finished" : "Join"}
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{bounty._count.participants}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  <span>{bounty.priceInBand} {PLATFORM_ASSET.code}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{isFinished ? "Finished" : `${bounty.totalWinner - bounty.currentWinnerCount} left`}</span>
                </div>
                {bounty.bountyType === "LOCATION_BASED" && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>Location</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function BountyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-xl">
      <Skeleton className="h-48 w-full" />
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

function BountyListSkeleton() {
  return (
    <Card className="overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/20 shadow-lg">
      <CardContent className="p-0">
        <div className="flex">
          <Skeleton className="w-32 h-24" />
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-3/4 mb-1" />
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-8 w-16 ml-2" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

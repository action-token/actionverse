"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Users,
  Trophy,
  Star,
  Filter,
  Search,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  MapPin,
  Award,
  Target,
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/shadcn/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { Badge } from "~/components/shadcn/ui/badge"
import { Progress } from "~/components/shadcn/ui/progress"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { useBounty } from "~/lib/state/augmented-reality/useBounty"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"
import { Preview } from "~/components/common/quill-preview"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "~/hooks/use-location"
import { api } from "~/utils/api"
import type { BountyTypes } from "~/types/bounty/bounty-type"
import { addrShort } from "~/utils/utils"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { Walkthrough } from "~/components/common/walkthrough"
import { useSession } from "next-auth/react"

export enum filterEnum {
  ALL = "ALL",
  NOT_JOINED = "NOT_JOINED",
  JOINED = "JOINED",
}

export enum BountyTypeFilter {
  ALL = "ALL",
  GENERAL = "GENERAL",
  LOCATION_BASED = "LOCATION_BASED",
  SCAVENGER_HUNT = "SCAVENGER_HUNT",
}

export enum sortOptionEnum {
  DATE_DESC = "DATE_DESC",
  DATE_ASC = "DATE_ASC",
  PRIZE_DESC = "PRIZE_DESC",
  PRIZE_ASC = "PRIZE_ASC",
}

type ViewMode = "grid" | "list"
type ButtonLayout = {
  x: number
  y: number
  width: number
  height: number
}

export default function BountyScreen() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOption, setSortOption] = useState<sortOptionEnum>(sortOptionEnum.DATE_DESC)
  const [filter, setFilter] = useState<filterEnum>(filterEnum.ALL)
  const [typeFilter, setTypeFilter] = useState<BountyTypeFilter>(BountyTypeFilter.ALL)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [showHeader, setShowHeader] = useState(true)
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
  const [showWalkthrough, setShowWalkthrough] = useState(false)

  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const joinButtonRef = useRef<HTMLButtonElement>(null)
  const session = useSession()
  const { setData } = useBounty()
  const { onOpen } = useModal()
  const router = useRouter()
  const { location } = useLocation()
  const { getAssetBalance, setBalance } = useUserStellarAcc()
  const { data: walkthroughData } = useWalkThrough()

  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const bal = api.wallate.acc.getAccountBalance.useQuery(undefined, {
    onSuccess: (data) => {
      const { balances } = data;
      setBalance(balances);

    },

    enabled: session.data?.user?.id !== undefined,
  });
  const getAllBounty = api.bounty.Bounty.getAllBounties.useInfiniteQuery(
    {
      limit: 10,
      search: debouncedSearchTerm,
      sortBy: sortOption,
      filter: filter,
      bountyType: typeFilter !== BountyTypeFilter.ALL ? typeFilter : undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const bountyList = getAllBounty.data?.pages.flatMap((page) => page.bounties) ?? []

  const handleBountyAction = (bounty: BountyTypes) => {
    if (bounty.isJoined || bounty.isOwner) {
      setData({ item: bounty })
      router.push(`/actions/actions/${bounty.id}`)
    } else {
      onOpen("JoinBounty", { bounty: bounty })
    }
  }

  // Map filter for dropdown display
  const getFilterLabel = (f: filterEnum) => {
    switch (f) {
      case filterEnum.ALL:
        return "All"
      case filterEnum.JOINED:
        return "Joined"
      case filterEnum.NOT_JOINED:
        return "Not Joined"
    }
  }

  const dummyBounties: BountyTypes[] = [
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
      id: 1,
      creatorId: "0x1234567890",
      requiredBalance: 100,
      requiredBalanceCode: "BAND",
      requiredBalanceIssuer: "BAND_ISSUER",
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
      id: 2,
      creatorId: "0x1234567890",
      requiredBalance: 100,
      requiredBalanceCode: "BAND",
      requiredBalanceIssuer: "BAND_ISSUER",
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
      id: 3,
      creatorId: "0x1234567890",
      requiredBalance: 100,
      requiredBalanceCode: "BAND",
      requiredBalanceIssuer: "BAND_ISSUER",
      isOwner: false,
      currentStep: 1,
      ActionLocation: [{}, {}, {}],
      bountyType: "SCAVENGER_HUNT",
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 200,
    },
  ]

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

  return (
    <div className="min-h-screen pb-20">
      {/* Header Toggle Button */}
      {!showHeader && (
        <motion.div
          className="fixed top-4 right-4 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button onClick={() => setShowHeader(true)} size="icon" className="rounded-full shadow-lg">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {/* Compact Header - Mobile Optimized */}
      <AnimatePresence>
        {showHeader && (
          <motion.div
            className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b shadow-sm"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold">Actions</h1>
                    <p className="text-xs text-muted-foreground">{bountyList.length} active</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 rounded-lg"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 rounded-lg"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setShowHeader(false)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search bounties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 rounded-xl"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button ref={filterButtonRef} variant="outline" size="sm" className="h-9 rounded-xl bg-transparent">
                      <Filter className="mr-1 h-4 w-4" />
                      {getFilterLabel(filter)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.values(filterEnum).map((f) => (
                      <DropdownMenuItem key={f} onClick={() => setFilter(f)}>
                        {getFilterLabel(f)}
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
      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          {viewMode === "grid" ? (
            <motion.div
              key="grid"
              className="grid gap-4 sm:grid-cols-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {getAllBounty.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <BountyCardSkeleton key={index} />)
              ) : bountyList.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16">
                  <div className="text-center">
                    <div className="p-6 rounded-3xl bg-muted/50 mb-4 inline-block">
                      <Star className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No bounties found</h3>
                    <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
                  </div>
                </div>
              ) : (
                bountyList.map((bounty) => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    onAction={handleBountyAction}
                    location={location}
                    getAssetBalance={getAssetBalance}
                    buttonRef={joinButtonRef}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              className="space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {getAllBounty.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <BountyListSkeleton key={index} />)
              ) : bountyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="text-center">
                    <div className="p-6 rounded-3xl bg-muted/50 mb-4 inline-block">
                      <Star className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No bounties found</h3>
                    <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
                  </div>
                </div>
              ) : (
                bountyList.map((bounty) => (
                  <BountyListItem
                    key={bounty.id}
                    bounty={bounty}
                    onAction={handleBountyAction}
                    location={location}
                    getAssetBalance={getAssetBalance}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load More Button - Mobile Optimized */}
        {getAllBounty.hasNextPage && (
          <div className="flex justify-center mt-6">
            <Button
              className="w-full max-w-md rounded-xl"
              onClick={() => void getAllBounty.fetchNextPage()}
              disabled={getAllBounty.isFetchingNextPage}
            >
              {getAllBounty.isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

interface BountyCardProps {
  bounty: BountyTypes
  onAction: (bounty: BountyTypes) => void
  location: { latitude: number; longitude: number } | null
  getAssetBalance: (asset: { code: string; issuer: string }) => string
  buttonRef?: React.RefObject<HTMLButtonElement>
}

function BountyCard({ bounty, onAction, location, getAssetBalance, buttonRef }: BountyCardProps) {
  const totalSteps = bounty.ActionLocation?.length ?? 0
  const isFinished = bounty.currentWinnerCount >= bounty.totalWinner

  const balance = getAssetBalance({
    code: bounty.requiredBalanceCode,
    issuer: bounty.requiredBalanceIssuer,
  })
  const hasRequiredBalance = bounty.requiredBalance <= Number(balance)

  const getBountyTypeIcon = (type: string) => {
    switch (type) {
      case "LOCATION_BASED":
        return <MapPin className="h-3 w-3" />
      case "SCAVENGER_HUNT":
        return <Target className="h-3 w-3" />
      default:
        return <Trophy className="h-3 w-3" />
    }
  }

  return (
    <Card
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
      onClick={() => onAction(bounty)}
    >
      <CardHeader className="relative p-0">
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={bounty.imageUrls[0] ?? "/images/logo.png"}
            alt={bounty.title}
            width={400}
            height={192}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium px-2.5 py-1">
              <div className="flex items-center gap-1.5">
                {getBountyTypeIcon(bounty.bountyType)}
                <span className="capitalize">{bounty.bountyType.toLowerCase().replace("_", " ")}</span>
              </div>
            </Badge>
          </div>

          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-xs font-bold px-3 py-1 shadow-lg">
              {bounty.priceInUSD > 0 ? "USDC" : bounty.priceInBand > 0 ? PLATFORM_ASSET.code.toUpperCase() : "Free"}
            </Badge>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-4">
            <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-lg">{bounty.title}</h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant={isFinished ? "destructive" : "default"} className="text-xs px-2.5 py-1">
            {isFinished ? "Completed" : "Active"}
          </Badge>
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-3 py-1.5 rounded-full">
            <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
              {bounty.priceInBand > 0
                ? `${bounty.priceInBand.toFixed(2)} ${PLATFORM_ASSET.code.toUpperCase()}`
                : bounty.priceInUSD > 0
                  ? `$${bounty.priceInUSD.toFixed(2)}`
                  : "Free"}
            </span>
          </div>
        </div>

        <div className="h-10 overflow-hidden text-xs text-muted-foreground leading-relaxed">
          <Preview value={bounty.description} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">{bounty._count.participants}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium">{bounty.totalWinner - bounty.currentWinnerCount} spots left</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-full">
            <span className="text-xs font-medium text-muted-foreground">{addrShort(bounty.creatorId, 4)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t bg-gradient-to-br from-muted/30 to-muted/10 p-4">
        <div className="flex flex-col gap-3 w-full">
          <Button
            ref={buttonRef}
            variant="default"
            size="sm"
            className="w-full rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => onAction(bounty)}
          >
            {bounty.isJoined || bounty.isOwner ? (
              <>
                <Target className="mr-2 h-4 w-4" />
                View Details
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                Join Bounty
              </>
            )}
          </Button>

          {bounty.bountyType === "SCAVENGER_HUNT" && bounty.isJoined && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  Step {bounty.currentStep ?? 0} of {totalSteps}
                </span>
                <span className="text-primary font-bold">
                  {Math.round(((bounty.currentStep ?? 0) / Math.max(totalSteps, 1)) * 100)}%
                </span>
              </div>
              <Progress
                className="h-2 bg-muted"
                value={Math.round(((bounty.currentStep ?? 0) / Math.max(totalSteps, 1)) * 100)}
              />
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

function BountyListItem({ bounty, onAction, location, getAssetBalance }: BountyCardProps) {
  const isFinished = bounty.currentWinnerCount >= bounty.totalWinner

  const balance = getAssetBalance({
    code: bounty.requiredBalanceCode,
    issuer: bounty.requiredBalanceIssuer,
  })
  const hasRequiredBalance = bounty.requiredBalance <= Number(balance)

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={() => onAction(bounty)}>
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          <div className="w-20 h-20 relative flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={bounty.imageUrls[0] ?? "/images/logo.png"} alt={bounty.title} fill className="object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-sm truncate">{bounty.title}</h3>
              <Badge variant={isFinished ? "destructive" : "outline"} className="text-xs ml-2 flex-shrink-0">
                {isFinished ? "Done" : "Active"}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">
                {bounty.priceInBand > 0
                  ? `${bounty.priceInBand.toFixed(1)} ${PLATFORM_ASSET.code.toUpperCase()}`
                  : bounty.priceInUSD > 0
                    ? `$${bounty.priceInUSD.toFixed(2)}`
                    : "Free"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{bounty._count.participants}</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>{bounty.totalWinner - bounty.currentWinnerCount} left</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BountyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-3 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </Card>
  )
}

function BountyListSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          <Skeleton className="w-20 h-20 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

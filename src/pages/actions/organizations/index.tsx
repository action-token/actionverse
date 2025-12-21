"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2,
  Search,
  Users,
  Heart,
  Globe,
  Building2,
  Filter,
  Grid3X3,
  List,
  ChevronUp,
  ChevronDown,
  Crown,
  X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Switch } from "~/components/shadcn/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Badge } from "~/components/shadcn/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { api } from "~/utils/api"
import { useBrandFollowMode } from "~/lib/state/augmented-reality/useBrandFollowMode"
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"
import { useWalkThrough } from "~/hooks/useWalkthrough"

type ButtonLayout = {
  x: number
  y: number
  width: number
  height: number
}

type ViewMode = "grid" | "list"
type SortOption = "name" | "followers" | "recent"
type FilterOption = "all" | "following" | "not-following"

interface Creator {
  isFollowed: boolean;
  isCurrentUser: boolean;
  wasMember?: boolean;
  isMember?: boolean;
  name: string;
  id: string;
  _count: {
    temporalFollows: number;
  };
  profileUrl: string | null;
}
export default function CreatorPage() {
  const session = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("available")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortBy, setSortBy] = useState<SortOption>("name")
  const [filterBy, setFilterBy] = useState<FilterOption>("all")
  const [showHeader, setShowHeader] = useState(true)
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null)
  const [unfollowLoadingId, setUnfollowLoadingId] = useState<string | null>(null)
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])

  const [memberLoadingId, setMemberLoadingId] = useState<string | null>(null)

  const [showBecomeMemberDialog, setShowBecomeMemberDialog] = useState(false)
  const [showCancelMemberDialog, setShowCancelMemberDialog] = useState(false)
  const [showRejoinMemberDialog, setShowRejoinMemberDialog] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<Creator | null>(null)

  const queryClient = useQueryClient()
  const accountActionData = useAccountAction()
  const { needSign } = useNeedSign()
  const { data: walkthroughData } = useWalkThrough()
  const { setData: setBrandFollowMode, data: brandFollowMode } = useBrandFollowMode()

  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const searchButtonRef = useRef<HTMLDivElement>(null)
  const brandListButtonRef = useRef<HTMLDivElement>(null)
  const followButtonRef = useRef<HTMLButtonElement>(null)

  const steps = [
    {
      target: buttonLayouts[0],
      title: "Follow Mode",
      content: "In Follow Mode, see pins for followed orgs only. Switch to General Mode to view all org pins.",
    },
    {
      target: buttonLayouts[1],
      title: "Search for Organizations",
      content:
        "Use the search bar to look for any org on the platform by typing in the org name in the search bar, then pressing the search icon",
    },
    {
      target: buttonLayouts[2],
      title: "Organization Lists",
      content:
        "Click on 'Available Organizations' to view all organizations, or 'Followed Organizations' to see the ones you've followed.",
    },
    {
      target: buttonLayouts[3],
      title: "Follow Organizations",
      content:
        "To follow an Organization, press the follow button next to the organization name. To unfollow an org, press the unfollow button next to the org name.",
    },
  ]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error, isLoading, refetch } =
    api.fan.creator.getAllCreators.useInfiniteQuery(
      { limit: 5 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    )

  const toggleBrandMode = (checked: boolean) => {
    setBrandFollowMode(checked)
  }

  const followCreator = api.fan.member.followCreator.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Creator Followed")
      setFollowLoadingId(null)
      // Refetch brands to update UI
      refetch()
    },
    onError: (e) => {
      toast.error("Failed to follow creator")
      setFollowLoadingId(null)
    },
  })

  const membership = api.fan.member.becomeMember.useMutation({
    onSuccess: () => {
      toast.success("Membership activated!")
      setShowBecomeMemberDialog(false)
      setShowRejoinMemberDialog(false)
      setMemberLoadingId(null)
      refetch()
    },
    onError: (e) => {
      toast.error("Failed to activate membership")
      setMemberLoadingId(null)
    },
  })

  const removeFollow = api.fan.member.unFollowCreator.useMutation({
    onSuccess: () => {
      toast.success("Creator Unfollowed")
      setUnfollowLoadingId(null)
      refetch()
    },
    onError: (e) => {
      toast.error("Failed to unfollow creator")
      setUnfollowLoadingId(null)
    },
  })

  const removeMembership = api.fan.member.removeFromMember.useMutation({
    onSuccess: () => {
      toast.success("Membership cancelled")
      setShowCancelMemberDialog(false)
      setMemberLoadingId(null)
      refetch()
    },
    onError: (e) => {
      toast.error("Failed to cancel membership")
      setMemberLoadingId(null)
    },
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
              setMemberLoadingId(null)
            }
          } catch (e) {
            toast.error("Transaction failed while signing.")
            setMemberLoadingId(null)
          }
        }
      } else {
        toast.error("Failed to create follow transaction")
        setMemberLoadingId(null)
      }
    },
    onError: (e) => {
      toast.error("Failed to create follow transaction")
      setMemberLoadingId(null)
    },
  })

  const handleBecomeMember = () => {
    if (!selectedBrand?.id) return
    setMemberLoadingId(selectedBrand.id)
    membershipXDR.mutate({
      creatorId: selectedBrand.id,
      signWith: needSign(),
    })
  }

  const handleCancelMembership = () => {
    if (!selectedBrand?.id) return
    setMemberLoadingId(selectedBrand.id)
    removeMembership.mutate({ creatorId: selectedBrand.id })
  }

  const handleRejoinMembership = () => {
    if (!selectedBrand?.id) return
    setMemberLoadingId(selectedBrand.id)
    membership.mutate({ creatorId: selectedBrand.id })
  }

  const handleFollowClick = (brand: Creator) => {
    if (brand.isFollowed) {
      setUnfollowLoadingId(brand.id)
      removeFollow.mutate({ creatorId: brand.id })
    } else {
      setFollowLoadingId(brand.id)
      followCreator.mutate({ creatorId: brand.id })
    }
  }

  const handleMembershipClick = (brand: Creator) => {
    setSelectedBrand(brand)

    // Check if user is already a member or was a member
    if (brand.isMember) {
      setShowCancelMemberDialog(true)
    } else if (brand.wasMember) {
      setShowRejoinMemberDialog(true)
    } else {
      setShowBecomeMemberDialog(true)
    }
  }

  const getMembershipButtonProps = (brand: Creator) => {
    const isLoading = memberLoadingId === brand.id
    console.log("brand membership status", brand);
    if (brand.isMember) {
      return {
        variant: "outline" as const,
        className: "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300",
        children: isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Crown className="h-3 w-3 mr-1" />
            Member
          </>
        ),
        disabled: isLoading,
      }
    } else if (brand.wasMember) {
      return {
        variant: "outline" as const,
        className: "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400",
        children: isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Crown className="h-3 w-3 mr-1" />
            Rejoin
          </>
        ),
        disabled: isLoading,
      }
    } else {
      return {
        variant: "default" as const,
        className:
          "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white",
        children: isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Crown className="h-3 w-3 mr-1" />
            Join
          </>
        ),
        disabled: isLoading,
      }
    }
  }

  useLayoutEffect(() => {
    const updateButtonLayouts = () => {
      const filterButton = modeButtonRef.current
      const searchButton = searchButtonRef.current
      const brandListButton = brandListButtonRef.current
      const followButton = followButtonRef.current

      if (filterButton && searchButton && brandListButton && followButton) {
        const filterRect = filterButton.getBoundingClientRect()
        const searchRect = searchButton.getBoundingClientRect()
        const brandListRect = brandListButton.getBoundingClientRect()
        const followRect = followButton.getBoundingClientRect()

        setButtonLayouts([
          {
            x: filterRect.left,
            y: filterRect.top,
            width: filterRect.width,
            height: filterRect.height,
          },
          {
            x: searchRect.left,
            y: searchRect.top,
            width: searchRect.width,
            height: searchRect.height,
          },
          {
            x: brandListRect.left,
            y: brandListRect.top,
            width: brandListRect.width,
            height: brandListRect.height,
          },
          {
            x: followRect.left,
            y: followRect.top,
            width: followRect.width,
            height: followRect.height,
          },
        ])
      }
    }

    const observer = new MutationObserver(() => {
      updateButtonLayouts()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    updateButtonLayouts()

    return () => {
      observer.disconnect()
    }
  }, [])

  const checkFirstTimeSignIn = async () => {
    if (walkthroughData?.showWalkThrough) {
      setShowWalkthrough(true)
    } else {
      setShowWalkthrough(false)
    }
  }

  useEffect(() => {
    checkFirstTimeSignIn()
  }, [walkthroughData])

  useEffect(() => {
    queryClient
      .refetchQueries({
        queryKey: ["MapsAllPins", accountActionData.data.brandMode],
      })
      .catch((e) => console.log(e))
  }, [accountActionData.data.brandMode])

  const allBrands = data?.pages.flatMap((page) => page.creators) ?? []

  const filteredBrands = allBrands
    .filter((brand) => {
      // Search filter
      const matchesSearch = brand.name?.toLowerCase().includes(searchQuery.toLowerCase())

      // Tab filter (available vs followed)
      const matchesTab = activeTab === "available" ? !brand.isFollowed : brand.isFollowed

      // Additional filter option
      let matchesFilter = true
      if (filterBy === "following") {
        matchesFilter = brand.isFollowed
      } else if (filterBy === "not-following") {
        matchesFilter = !brand.isFollowed
      }

      return matchesSearch && matchesTab && matchesFilter
    })
    .sort((a, b) => {
      // Sorting logic
      if (sortBy === "name") {
        return (a.name ?? "").localeCompare(b.name ?? "")
      } else if (sortBy === "followers") {
        return (b._count?.temporalFollows ?? 0) - (a._count?.temporalFollows ?? 0)
      } else if (sortBy === "recent") {
        return 0 // Keep original order
      }
      return 0
    })
    .map((creator) => ({
      id: creator.id,
      name: creator.name ?? "",
      profileUrl: creator.profileUrl ?? "",
      temporalFollows: creator._count?.temporalFollows ?? 0,
      isFollowed: creator.isFollowed ?? false,
      isCurrentUser: creator.isCurrentUser ?? false,
      _count: {
        temporalFollows: creator._count?.temporalFollows ?? 0,
      },
      isMember: creator.isMember ?? false,
      wasMember: creator.wasMember ?? false,
    }))

  if (isLoading) return <Loading />
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Error loading organizations</p>
      </div>
    )

  return (
    <div className="min-h-screen">
      {/* Header Toggle Button */}
      {!showHeader && (
        <motion.div
          className="fixed top-4 right-4 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button onClick={() => setShowHeader(true)} className="w-12 h-12 rounded-full ">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {/* Compact Header */}
      <AnimatePresence>
        {showHeader && (
          <motion.div
            className="sticky top-0 z-40 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Organizations</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      {filteredBrands?.length ?? 0} organizations available
                    </p>
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
                  <span
                    className={`text-xs px-2 ${!brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}
                  >
                    General
                  </span>
                  <Switch
                    ref={modeButtonRef}
                    checked={brandFollowMode}
                    onCheckedChange={toggleBrandMode}
                    className="data-[state=checked]:bg-orange-500"
                  />
                  <span
                    className={`text-xs px-2 ${brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}
                  >
                    Follow
                  </span>
                </div>
              </div>

              {/* Search and Controls */}
              <div className="flex items-center gap-2 mb-3">
                <div ref={searchButtonRef} className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="search"
                    placeholder="Search organizations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-9 w-9 p-0 rounded-lg"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-9 w-9 p-0 rounded-lg"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setShowHeader(false)} className="h-9 w-9 p-0 rounded-lg">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs and Filters */}
              <div className="flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList
                    ref={brandListButtonRef}
                    className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 h-8"
                  >
                    <TabsTrigger
                      value="available"
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs px-3"
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      Available
                    </TabsTrigger>
                    <TabsTrigger
                      value="followed"
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs px-3"
                    >
                      <Heart className="h-3 w-3 mr-1" />
                      Followed
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                    <SelectTrigger className="h-8 w-24 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="followers">Followers</SelectItem>
                      <SelectItem value="recent">Recent</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
                    <SelectTrigger className="h-8 w-20 text-xs rounded-lg">
                      <Filter className="h-3 w-3" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="following">Following</SelectItem>
                      <SelectItem value="not-following">Not Following</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand List */}
      <div className="px-2 py-6 pb-32">
        <AnimatePresence mode="wait">
          {viewMode === "grid" ? (
            <motion.div
              key="grid"
              className="grid grid-cols-2 gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {filteredBrands?.length ? (
                filteredBrands.map((brand: Creator, index) => {
                  const membershipProps = getMembershipButtonProps(brand)

                  return (
                    <motion.div
                      key={brand.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card className="bg-white  dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                        <CardContent className="p-0">
                          <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 relative">
                            <Image
                              height={200}
                              width={200}
                              src={brand.profileUrl ?? "/placeholder.svg"}
                              alt={brand.name}
                              className="w-full h-full object-cover"
                            />

                            {brand.isFollowed && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                                <Heart className="h-3 w-3 text-white fill-current" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-2 truncate">
                              {brand.name}
                            </h3>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Users className="w-3 h-3" />
                                <span>{brand._count.temporalFollows ?? 0}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                ref={index === 0 ? followButtonRef : null}
                                size="sm"
                                variant={brand.isFollowed ? "outline" : "default"}
                                onClick={() => handleFollowClick(brand)}
                                disabled={followLoadingId === brand.id || unfollowLoadingId === brand.id || session.data?.user.id === brand.id}
                                className={`flex-1 h-7 px-2 text-xs rounded-lg font-medium transition-all duration-200 relative ${brand.isFollowed
                                  ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                  }`}
                              >
                                {brand.isFollowed && (
                                  <Badge className="absolute -top-2 -right-1 bg-green-500 text-white text-[8px] px-1 py-0 font-semibold h-4">
                                    Free
                                  </Badge>
                                )}
                                {followLoadingId === brand.id || unfollowLoadingId === brand.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : brand.isFollowed ? (
                                  <>
                                    <Heart className="h-3 w-3  fill-current" />
                                    Following
                                  </>
                                ) : (
                                  <>
                                    <Heart className="h-3 w-3 mr-1" />
                                    Follow
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={membershipProps.variant}
                                onClick={() => handleMembershipClick(brand)}
                                disabled={membershipProps.disabled || session.data?.user.id === brand.id}
                                className={`flex-1 h-7 px-2 text-xs rounded-lg font-medium transition-all duration-200 ${membershipProps.className}`}
                              >
                                {membershipProps.children}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })
              ) : (
                <div className="col-span-2 text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No organizations found</p>
                </div>
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
              {filteredBrands?.length ? (
                filteredBrands.map((brand: Creator, index) => {
                  const membershipProps = getMembershipButtonProps(brand)

                  return (
                    <motion.div
                      key={brand.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.05 * index }}
                    >
                      <Card className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl overflow-hidden">
                                <Image
                                  height={64}
                                  width={64}
                                  src={brand.profileUrl ?? "/placeholder.svg"}
                                  alt={brand.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {brand.isFollowed && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                                  <Heart className="h-2.5 w-2.5 text-white fill-current" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                                {brand.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1 text-sm text-slate-500">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{brand._count.temporalFollows ?? 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                ref={index === 0 ? followButtonRef : null}
                                variant={brand.isFollowed ? "outline" : "default"}
                                size="sm"
                                onClick={() => handleFollowClick(brand)}
                                disabled={followLoadingId === brand.id || unfollowLoadingId === brand.id}
                                className={`rounded-lg font-medium transition-all duration-200 relative ${brand.isFollowed
                                  ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                  }`}
                              >
                                {brand.isFollowed && (
                                  <Badge className="absolute -top-2 -right-1 bg-green-500 text-white text-[8px] px-1 py-0 font-semibold h-4">
                                    Free
                                  </Badge>
                                )}
                                {followLoadingId === brand.id || unfollowLoadingId === brand.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : brand.isFollowed ? (
                                  <>
                                    <Heart className="h-4 w-4 mr-1 fill-current" />
                                    Following
                                  </>
                                ) : (
                                  <>
                                    <Heart className="h-4 w-4 mr-1" />
                                    Follow
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={membershipProps.variant}
                                onClick={() => handleMembershipClick(brand)}
                                disabled={membershipProps.disabled}
                                className={`rounded-lg font-medium transition-all duration-200 ${membershipProps.className}`}
                              >
                                {membershipProps.children}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })
              ) : (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No organizations found</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Become a Member Dialog */}
      <Dialog open={showBecomeMemberDialog} onOpenChange={setShowBecomeMemberDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <DialogTitle className="text-xl">Become a Member</DialogTitle>
            </div>
            <DialogDescription>
              Join as a member and unlock exclusive access to <b>{selectedBrand?.name ?? "Unknow"}</b>
              {"'s"} content and community.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-orange-200 dark:border-orange-800 rounded-xl p-4 bg-orange-50 dark:bg-orange-900/10">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">It{"'"}d cost you</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-orange-600 dark:text-orange-400">0.5</span>
              <span className="text-lg text-slate-600 dark:text-slate-400">XLM</span>
              <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">One-time</span>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">What you{"'"}ll get:</p>
            <div className="space-y-2">
              {[
                "Access to member-only content",
                "Member badge on your profile",
                "Join the exclusive community",
                "Upgrade to premium tiers later",
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowBecomeMemberDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleBecomeMember}
              disabled={memberLoadingId === selectedBrand?.id}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Membership Dialog */}
      <Dialog open={showCancelMemberDialog} onOpenChange={setShowCancelMemberDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-xl text-red-600 dark:text-red-400">Cancel Membership</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to cancel your membership? You{"''"}ll lose access to member-only content.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-red-200 dark:border-red-800 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              You can rejoin anytime for free if you change your mind.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowCancelMemberDialog(false)} className="flex-1">
              Keep Membership
            </Button>
            <Button

              onClick={handleCancelMembership} variant="destructive" className="flex-1">
              Cancel Membership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejoin Membership Dialog */}
      <Dialog open={showRejoinMemberDialog} onOpenChange={setShowRejoinMemberDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <DialogTitle className="text-xl">Rejoin Membership</DialogTitle>
            </div>
            <DialogDescription>
              Rejoin as a member and regain access to exclusive content and community.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-green-200 dark:border-green-800 rounded-xl p-4 bg-green-50 dark:bg-green-900/10">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">It{"'"}d cost you</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-green-600 dark:text-green-400">Free</span>
              <span className="ml-auto">
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Rejoin benefit
                </Badge>
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">What you{"'"}ll get:</p>
            <div className="space-y-2">
              {[
                "Access to member-only content",
                "Member badge on your profile",
                "Join the exclusive community",
                "Upgrade to premium tiers later",
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowRejoinMemberDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              disabled={memberLoadingId === selectedBrand?.id}
              onClick={handleRejoinMembership}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Rejoin Free
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

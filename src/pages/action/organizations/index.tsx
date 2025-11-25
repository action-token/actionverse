"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Search, Users, Heart, Globe, Star, TrendingUp, Award, Building2, Filter, Grid3X3, List, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Switch } from "~/components/shadcn/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Badge } from "~/components/shadcn/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import type { Brand } from "~/types/game/brand"
import { api } from "~/utils/api"
import { useBrandFollowMode } from "~/lib/state/augmented-reality/useBrandFollowMode"
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction"
import { getAllBrands, UnFollowBrand } from "~/lib/augmented-reality"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"
import { useWalkThrough } from "~/hooks/useWalkthrough"

type ButtonLayout = {
  x: number
  y: number
  width: number
  height: number
}

type ViewMode = 'grid' | 'list'
type SortOption = 'name' | 'followers' | 'recent'
type FilterOption = 'all' | 'following' | 'not-following'

export default function CreatorPage() {
  const session = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("available")
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [showHeader, setShowHeader] = useState(true)
  const [brands, setBrands] = useState<Brand[]>([])
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null)
  const [unfollowLoadingId, setUnfollowLoadingId] = useState<string | null>(null)
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [signLoading, setSingLoading] = useState(false)
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])

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
      content: "Use the search bar to look for any org on the platform by typing in the org name in the search bar, then pressing the search icon",
    },
    {
      target: buttonLayouts[2],
      title: "Organization Lists",
      content: "Click on 'Available Organizations' to view all organizations, or 'Followed Organizations' to see the ones you've followed.",
    },
    {
      target: buttonLayouts[3],
      title: "Follow Organizations",
      content: "To follow an Organization, press the follow button next to the organization name. To unfollow an org, press the unfollow button next to the org name.",
    },
  ]

  const { data: accountActionData, setData: setAccountActionData } = useAccountAction()

  const toggleBrandMode = () => {
    setBrandFollowMode(!brandFollowMode)
  }

  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["AllBrands"],
    queryFn: getAllBrands,
  })

  const follow = api.fan.member.followCreator.useMutation({
    onSuccess: () => toast.success("Followed"),
  })

  const followXDR = api.fan.trx.followCreatorTRX.useMutation({
    onSuccess: async (xdr, variables) => {
      if (xdr) {
        if (xdr === true) {
          toast.success("User already has trust in page asset")
          follow.mutate({ creatorId: variables.creatorId })
        } else {
          setSingLoading(true)
          try {
            const res = await clientsign({
              presignedxdr: xdr,
              pubkey: session.data?.user.id,
              walletType: session.data?.user.walletType,
              test: clientSelect(),
            })
            if (res) {
              follow.mutate({ creatorId: variables.creatorId })
            } else toast.error("Transaction failed while signing.")
          } catch (e) {
            toast.error("Transaction failed while signing.")
            console.error(e)
          } finally {
            setSingLoading(false)
          }
        }
      } else {
        toast.error("Can't get xdr")
      }
      setFollowLoadingId(null)
    },
    onError: (e) => {
      toast.error(e.message)
      setFollowLoadingId(null)
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: async ({ brand_id }: { brand_id: string }) => {
      setUnfollowLoadingId(brand_id)
      return await UnFollowBrand({ brand_id })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["AllBrands"],
      })
      setUnfollowLoadingId(null)
    },
    onError: (error) => {
      console.error("Error unfollowing brand:", error)
      setUnfollowLoadingId(null)
    },
  })

  const toggleFollow = (brandId: string, isAlreadyFollowed?: boolean) => {
    if (isAlreadyFollowed) {
      setUnfollowLoadingId(brandId)
      unfollowMutation.mutate({ brand_id: brandId })
    } else {
      setFollowLoadingId(brandId)
      followXDR.mutate({
        creatorId: brandId,
        signWith: needSign(),
      })
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
    if (data) {
      setBrands(data.users)
    }
  }, [data])

  useEffect(() => {
    queryClient
      .refetchQueries({
        queryKey: ["MapsAllPins", accountActionData.brandMode],
      })
      .catch((e) => console.log(e))
  }, [accountActionData.brandMode])

  const filteredBrands = brands?.filter((brand) => {
    const matchesSearch = brand.first_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = (() => {
      switch (filterBy) {
        case 'following':
          return brand.followed_by_current_user
        case 'not-following':
          return !brand.followed_by_current_user
        default:
          return true
      }
    })()

    const matchesTab = (() => {
      if (activeTab === "followed") {
        return brand.followed_by_current_user
      }
      return true
    })()

    return matchesSearch && matchesFilter && matchesTab
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.first_name.localeCompare(b.first_name)
      case 'followers':
        return (b.follower_count ?? 0) - (a.follower_count ?? 0)
      case 'recent':
      default:
        return b.id.localeCompare(a.id)
    }
  })

  if (isLoading) return <Loading />
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-red-500">Error loading organizations</p>
    </div>
  )

  return (
    <div className="min-h-screen0">
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
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                      Organizations
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      {filteredBrands?.length || 0} organizations available
                    </p>
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
                  <span className={`text-xs px-2 ${!brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}>
                    General
                  </span>
                  <Switch
                    ref={modeButtonRef}
                    checked={brandFollowMode}
                    onCheckedChange={toggleBrandMode}
                    className="data-[state=checked]:bg-orange-500"
                  />
                  <span className={`text-xs px-2 ${brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}>
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
                    variant={viewMode === 'grid' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-9 w-9 p-0 rounded-lg"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-9 w-9 p-0 rounded-lg"
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

              {/* Tabs and Filters */}
              <div className="flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList ref={brandListButtonRef} className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 h-8">
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
      <div className="px-6 py-6 pb-32">
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {filteredBrands?.length ? (
                filteredBrands.map((brand: Brand, index) => (
                  <motion.div
                    key={brand.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 * index }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 relative">
                          <Image
                            height={200}
                            width={200}
                            src={brand.logo || "/placeholder.svg"}
                            alt={brand.first_name}
                            className="w-full h-full object-cover"
                          />
                          {brand.followed_by_current_user && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                              <Heart className="h-3 w-3 text-white fill-current" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-2 truncate">
                            {brand.first_name}
                          </h3>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Users className="w-3 h-3" />
                              <span>{brand.follower_count ?? 0}</span>
                            </div>
                            <Button
                              ref={index === 0 ? followButtonRef : null}
                              size="sm"
                              variant={brand.followed_by_current_user ? "outline" : "default"}
                              onClick={() => toggleFollow(brand.id, brand.followed_by_current_user)}
                              disabled={followLoadingId === brand.id || unfollowLoadingId === brand.id}
                              className={`h-7 px-3 text-xs rounded-lg font-medium transition-all duration-200 ${brand.followed_by_current_user
                                ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-sm"
                                }`}
                            >
                              {followLoadingId === brand.id || unfollowLoadingId === brand.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : brand.followed_by_current_user ? (
                                <>
                                  <Heart className="h-3 w-3 mr-1 fill-current" />
                                  Unfollow
                                </>
                              ) : (
                                <>
                                  <Heart className="h-3 w-3 mr-1" />
                                  Follow
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-2 text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-medium mb-2 text-slate-900 dark:text-white">No Organizations found</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {searchQuery ? "Try adjusting your search terms" : "No organizations available at the moment"}
                  </p>
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
                filteredBrands.map((brand: Brand, index) => (
                  <motion.div
                    key={brand.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 * index }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Card className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-sm">
                                <Image
                                  height={48}
                                  width={48}
                                  src={brand.logo || "/placeholder.svg"}
                                  alt={brand.first_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {brand.followed_by_current_user && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                                  <Heart className="h-2 w-2 text-white fill-current" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                {brand.first_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs px-2 py-0">
                                  Brand
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Users className="w-3 h-3" />
                                  <span>{brand.follower_count ?? 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            ref={index === 0 ? followButtonRef : null}
                            variant={brand.followed_by_current_user ? "outline" : "default"}
                            size="sm"
                            onClick={() => toggleFollow(brand.id, brand.followed_by_current_user)}
                            disabled={followLoadingId === brand.id || unfollowLoadingId === brand.id}
                            className={`rounded-lg font-medium transition-all duration-200 ${brand.followed_by_current_user
                              ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                              : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg"
                              }`}
                          >
                            {followLoadingId === brand.id || unfollowLoadingId === brand.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : brand.followed_by_current_user ? (
                              <>
                                <Heart className="h-4 w-4 mr-1 fill-current" />
                                Unfollow
                              </>
                            ) : (
                              <>
                                <Heart className="h-4 w-4 mr-1" />
                                Follow
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-medium mb-2 text-slate-900 dark:text-white">No organizations found</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {searchQuery ? "Try adjusting your search terms" : "No organizations available at the moment"}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

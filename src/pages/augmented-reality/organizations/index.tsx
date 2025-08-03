"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Loader2, Search, Users, Heart, Globe } from "lucide-react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { clientsign } from "package/connect_wallet"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Input } from "~/components/shadcn/ui/input"
import { Switch } from "~/components/shadcn/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
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

export default function CreatorPage() {
  const session = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("available")
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
      content: "In Follow Mode, see pins for followed brands only. Switch to General Mode to view all brand pins.",
    },
    {
      target: buttonLayouts[1],
      title: "Search for Brands",
      content:
        "Use the search bar to look for any brand on the platform by typing in the brand name in the search bar, then pressing the search icon",
    },
    {
      target: buttonLayouts[2],
      title: "Brand Lists",
      content: "Click on 'Available Brands' to view all brands, or 'Followed Brands' to see the ones you've followed.",
    },
    {
      target: buttonLayouts[3],
      title: "Follow Brands",
      content:
        "To follow a brand, press the follow button next to the brand name. To unfollow a brand, press the unfollow button next to the brand name.",
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
    if (walkthroughData.showWalkThrough) {
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
    if (activeTab === "followed") {
      return matchesSearch && brand.followed_by_current_user
    }
    return matchesSearch
  })

  if (isLoading) return <Loading />
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-red-500">Error loading ORG</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Modern Header */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Brands</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredBrands?.length || 0} brands available
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center space-x-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full p-1 shadow-lg">
              <span
                className={`text-xs px-2 ${!brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"
                  }`}
              >
                General
              </span>
              <Switch
                ref={modeButtonRef}
                checked={brandFollowMode}
                onCheckedChange={toggleBrandMode}
                className="data-[state=checked]:bg-violet-500"
              />
              <span
                className={`text-xs px-2 ${brandFollowMode ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"
                  }`}
              >
                Follow
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Search Bar */}
        <div ref={searchButtonRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg rounded-2xl"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            ref={brandListButtonRef}
            className="grid w-full grid-cols-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg p-1 rounded-2xl"
          >
            <TabsTrigger
              value="available"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg font-medium"
            >
              <Globe className="h-4 w-4 mr-2" />
              Available
            </TabsTrigger>
            <TabsTrigger
              value="followed"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg font-medium"
            >
              <Heart className="h-4 w-4 mr-2" />
              Followed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Brand List */}
        {filteredBrands?.length ? (
          <div className="space-y-3">
            {filteredBrands.map((brand: Brand, index) => (
              <Card
                key={brand.id}
                className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <Image
                          height={48}
                          width={48}
                          src={brand.logo || "/placeholder.svg"}
                          alt={brand.first_name}
                          className="h-12 w-12 rounded-xl shadow-md object-cover"
                        />
                        {brand.followed_by_current_user && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <Heart className="h-3 w-3 text-white fill-current" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{brand.first_name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Brand</p>
                      </div>
                    </div>

                    <Button
                      ref={index === 0 ? followButtonRef : null}
                      variant={brand.followed_by_current_user ? "outline" : "default"}
                      onClick={() => toggleFollow(brand.id, brand.followed_by_current_user)}
                      disabled={followLoadingId === brand.id || unfollowLoadingId === brand.id}
                      className={`rounded-xl font-medium transition-all duration-200 ${brand.followed_by_current_user
                        ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
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
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 mb-6 inline-block">
              <Users className="h-12 w-12 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No brands found</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {searchQuery ? "Try adjusting your search terms" : "No brands available at the moment"}
            </p>
          </div>
        )}
      </div>

      {showWalkthrough && <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />}
    </div>
  )
}

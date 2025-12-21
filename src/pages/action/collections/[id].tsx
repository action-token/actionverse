"use client"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import Map, { Marker } from "react-map-gl"
import { ArrowLeft, MapPin, Hash, HandIcon, Eye, Globe, Package, Star, Navigation, Clock, Trophy, Zap, Share2, Heart, Bookmark, Camera, Info, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "~/components/shadcn/ui/avatar"
import { Badge } from "~/components/shadcn/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { useCollection } from "~/lib/state/augmented-reality/useCollection"
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { BASE_URL } from "~/lib/common"
import { formatDistanceToNow } from "date-fns"

const SingleCollectionItem = () => {
  const { data } = useCollection()
  const { setData } = useNearByPin()
  const { onOpen } = useModal()
  const router = useRouter()
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log("Location access denied")
        }
      )
    }
  }, [])

  // Calculate distance
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const distance = userLocation && data.collections ?
    calculateDistance(userLocation.lat, userLocation.lng, data.collections.lat, data.collections.lng) : null

  if (!data.collections) {
    return (
      <div className="min-h-screen  bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Collection not found</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">The collection you{"'"}re looking for doesn{"'"}t exist.</p>
          <Button onClick={() => router.back()} className="rounded-xl">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen  pb-32 ">
      {/* Enhanced Header */}
      <motion.div
        className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="px-6 py-4 ">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-1">
                  {data.collections.title}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Collection Details</p>
              </div>
            </div>

            {/* <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLiked(!isLiked)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-blue-500 text-blue-500' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div> */}
          </div>
        </div>
      </motion.div>

      <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
        {/* Enhanced Hero Image */}
        <motion.div
          className="relative overflow-hidden rounded-3xl shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={data.collections.image_url || "/placeholder.svg"}
            alt={data.collections.title}
            width={800}
            height={400}
            className="h-80 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Enhanced Status Badges */}
          <div className="absolute top-6 right-6 flex flex-col gap-2">
            {data.collections.collected ? (
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg border-0 px-4 py-2 text-sm font-semibold">
                <Trophy className="w-4 h-4 mr-2" />
                Collected
              </Badge>
            ) : data.collections.collection_limit_remaining > 0 ? (
              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg border-0 px-4 py-2 text-sm font-semibold">
                <Zap className="w-4 h-4 mr-2" />
                {data.collections.collection_limit_remaining} uses left
              </Badge>
            ) : (
              <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg border-0 px-4 py-2 text-sm font-semibold">
                <Clock className="w-4 h-4 mr-2" />
                Expired
              </Badge>
            )}

            {distance && (
              <Badge className="bg-black/50 text-white shadow-lg border-0 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                <Navigation className="w-4 h-4 mr-2" />
                {distance.toFixed(1)}km away
              </Badge>
            )}
          </div>

          {/* Enhanced Brand Info Overlay */}
          <div className="absolute bottom-6 left-6">
            <motion.div
              className="flex items-center space-x-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-xl"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-lg">
                <AvatarImage
                  src={data.collections.brand_image_url || "/placeholder.svg"}
                  alt={data.collections.brand_name}
                />
                <AvatarFallback>{data.collections.brand_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-lg">{data.collections.brand_name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Brand Creator</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Enhanced Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-1">
            <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
            <TabsTrigger value="location" className="rounded-xl">Location</TabsTrigger>
            <TabsTrigger value="details" className="rounded-xl">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Collection Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center space-x-2 mb-4">
                    <Info className="h-5 w-5 text-violet-500" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">About This Collection</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Description */}
                  <div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base">
                      {data.collections.description}
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl">
                      <div className="p-2 rounded-xl bg-blue-500 shadow-lg">
                        <Hash className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Collection ID</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">#{data.collections.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
                      <div className="p-2 rounded-xl bg-purple-500 shadow-lg">
                        <Star className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Status</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {data.collections.collected ? 'Collected' : 'Available'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* Visit Website */}
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <Button
                    asChild
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25"
                  >
                    <Link
                      href={data?.collections?.url ?? "https://www.app.wadzoo.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="mr-2 h-5 w-5" />
                      Visit Website
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* View in AR */}
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <Button
                    onClick={() => {
                      setData({
                        nearbyPins: data.collections ? [data.collections] : [],
                        singleAR: true,
                      })
                      router.push("/action/ar")
                    }}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-violet-500/25"
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    View in AR
                    <Camera className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Claim Reward */}
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200">
                <CardContent className="p-6">
                  <Button
                    onClick={() => window.open(new URL("/pins", BASE_URL).href, "_blank")}
                    className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25"
                  >
                    <HandIcon className="mr-2 h-5 w-5" />
                    Claim Reward
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="location" className="space-y-6">
            {/* Location Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Location Details</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="p-2 rounded-xl bg-emerald-500 shadow-lg">
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Coordinates</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                          {data.collections.lat.toFixed(6)}, {data.collections.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>

                    {distance && (
                      <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                        <div className="p-2 rounded-xl bg-blue-500 shadow-lg">
                          <Navigation className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Distance</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {distance.toFixed(2)} km from your location
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Interactive Map */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-80 rounded-3xl overflow-hidden">
                    <Map
                      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API}
                      initialViewState={{
                        latitude: data.collections.lat,
                        longitude: data.collections.lng,
                        zoom: 14,
                      }}
                      style={{ width: "100%", height: "100%" }}
                      mapStyle="mapbox://styles/suppport-10/cmcntcaoj010m01sb66oiddp8"
                    >
                      <Marker
                        latitude={data.collections.lat}
                        longitude={data.collections.lng}
                        onClick={() =>
                          onOpen("LocationInformation", {
                            Collection: data.collections,
                          })
                        }
                      >
                        <motion.div
                          className="relative cursor-pointer"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-xl flex items-center justify-center border-3 border-white">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-emerald-500 rotate-45 border-r border-b border-white"></div>
                        </motion.div>
                      </Marker>

                      {/* User location marker */}
                      {userLocation && (
                        <Marker
                          latitude={userLocation.lat}
                          longitude={userLocation.lng}
                        >
                          <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
                        </Marker>
                      )}
                    </Map>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {/* Technical Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-violet-500" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Technical Details</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Collection ID</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">#{data.collections.id}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Remaining Uses</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {data.collections.collection_limit_remaining}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Status</span>
                        <Badge className={`${data.collections.collected
                          ? 'bg-emerald-100 text-emerald-700'
                          : data.collections.collection_limit_remaining > 0
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                          {data.collections.collected ? 'Collected' :
                            data.collections.collection_limit_remaining > 0 ? 'Available' : 'Expired'}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">Brand</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{data.collections.brand_name}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default SingleCollectionItem

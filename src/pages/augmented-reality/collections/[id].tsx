"use client"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import Map, { Marker } from "react-map-gl"
import { ArrowLeft, MapPin, Hash, HandIcon, Eye, Globe, Package, Star } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { Avatar, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Badge } from "~/components/shadcn/ui/badge"
import { useCollection } from "~/lib/state/augmented-reality/useCollection"
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import { BASE_URL } from "~/lib/common"

const SingleCollectionItem = () => {
  const { data } = useCollection()
  const { setData } = useNearByPin()
  const { onOpen } = useModal()
  const router = useRouter()

  if (!data.collections) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Modern Header */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="px-6 py-4">
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
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white line-clamp-1">
                {data.collections.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Collection Details</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
        {/* Hero Image */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl">
          <Image
            src={data.collections.image_url || "/placeholder.svg"}
            alt={data.collections.title}
            width={800}
            height={400}
            className="h-64 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Collection Limit Badge */}
          <div className="absolute top-6 right-6">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg border-0 px-4 py-2 text-sm font-semibold">
              {data.collections.collection_limit_remaining} uses left
            </Badge>
          </div>

          {/* Brand Info Overlay */}
          <div className="absolute bottom-6 left-6">
            <div className="flex items-center space-x-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg">
              <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800">
                <AvatarImage
                  src={data.collections.brand_image_url || "/placeholder.svg"}
                  alt={data.collections.brand_name}
                />
              </Avatar>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{data.collections.brand_name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Brand</p>
              </div>
            </div>
          </div>
        </div>

        {/* Collection Info */}
        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center space-x-2 mb-4">
              <Package className="h-5 w-5 text-violet-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Collection Information</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{data.collections.description}</p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <div className="p-2 rounded-xl bg-blue-500 shadow-lg">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Location</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {data.collections.lat.toFixed(4)}, {data.collections.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <div className="p-2 rounded-xl bg-purple-500 shadow-lg">
                  <Hash className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Collection ID</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{data.collections.id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Map */}
        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-xl overflow-hidden">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Location Map</h2>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-64 rounded-b-3xl overflow-hidden">
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
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-lg flex items-center justify-center border-2 border-white">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45"></div>
                  </div>
                </Marker>
              </Map>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  router.push("/augmented-reality/enter")
                }}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-violet-500/25"
              >
                <Eye className="mr-2 h-5 w-5" />
                View in AR
              </Button>
            </CardContent>
          </Card>

          {/* Claim Reward */}
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-6">
              <Button
                onClick={() => window.open(new URL("maps/pins/my", BASE_URL).href, "_blank")}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25"
              >
                <HandIcon className="mr-2 h-5 w-5" />
                Claim Reward
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SingleCollectionItem

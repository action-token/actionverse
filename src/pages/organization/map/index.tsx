"use client"
import type React from "react"
import { APIProvider, AdvancedMarker, Map, type MapMouseEvent } from "@vis.gl/react-google-maps"
import { format } from "date-fns"
import { ClipboardList, MapPin, Plus, Minus, ArrowRightFromLine, ArrowLeftFromLine, Trophy, Copy } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { useModal } from "~/lib/state/play/use-modal-store"
import { useSelectedAutoSuggestion } from "~/lib/state/play/use-selectedAutoSuggestion"
import { api } from "~/utils/api"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { CustomMapControl } from "~/components/map/custom-control"
import { useNearbyPinsStore } from "~/components/store/nearby-pin-store"
import { useCreatorMapModalStore } from "~/components/store/creator-map-modal-store"
import { useMapOptionsModalStore } from "~/components/store/map-options-modal-store"
import { useToast } from "~/components/shadcn/ui/use-toast"
import { useCreateLocationBasedBountyStore } from "~/components/store/create-locationbased-bounty-store"

type UserLocationType = {
  lat: number
  lng: number
}

function CreatorMap() {
  return (

    <MapSection />

  )
}

function MapSection() {
  const { toast } = useToast()
  const { manual, setManual, position, setPosition, setIsOpen, setPrevData } = useCreatorMapModalStore()
  const [mapZoom, setMapZoom] = useState<number>(3)
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({
    lat: 22.54992,
    lng: 0,
  })
  const [centerChanged, setCenterChanged] = useState<google.maps.LatLngBoundsLiteral | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [isCordsSearch, setIsCordsSearch] = useState<boolean>(false)
  const [searchCoordinates, setSearchCoordinates] = useState<google.maps.LatLngLiteral>()
  const [userLocation, setUserLocation] = useState<UserLocationType>({
    lat: 44.5,
    lng: -89.5,
  })
  const { selectedPlace: alreadySelectedPlace, setSelectedPlace: setAlreadySelectedPlace } = useSelectedAutoSuggestion()
  const [cordSearchCords, setCordSearchLocation] = useState<google.maps.LatLngLiteral>()
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null)
  const { onOpen, isPinCopied, data, isAutoCollect, isPinCut, setIsAutoCollect } = useModal()
  const { filterNearbyPins, setAllPins } = useNearbyPinsStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const [rightClickPosition, setRightClickPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

  function handleMapClick(event: MapMouseEvent): void {
    console.log(event)
    // Close context menu if it's open
    if (showContextMenu) {
      setShowContextMenu(false)
      return
    }

    setManual(false)
    const position = event.detail.latLng
    if (position) {
      setPosition(position)

      if (!isPinCopied && !isPinCut) {
        setIsOpen(true)
      } else if (isPinCopied || isPinCut) {
        onOpen("copied", {
          long: position.lng,
          lat: position.lat,
          pinId: data.pinId,
        })
      }
    }
  }

  // Handle direct right-click on map
  const handleMapRightClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    // Get the map container element
    const mapContainer = mapRef.current
    if (!mapContainer) return

    // Calculate relative position within the map container
    const rect = mapContainer.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Set the position for the context menu
    setContextMenuPosition({ x: event.clientX, y: event.clientY })

    // Calculate approximate lat/lng based on the map center and zoom level
    // This is a simplified calculation and may not be perfectly accurate
    const mapWidth = rect.width
    const mapHeight = rect.height

    // Calculate the offset from center in pixels
    const offsetX = x - mapWidth / 2
    const offsetY = y - mapHeight / 2

    // Convert pixel offset to lat/lng offset (simplified)
    // The actual conversion depends on the map projection, zoom level, etc.
    const latPerPixel = 180 / Math.pow(2, mapZoom) / mapHeight
    const lngPerPixel = 360 / Math.pow(2, mapZoom) / mapWidth

    const lat = mapCenter.lat - offsetY * latPerPixel
    const lng = mapCenter.lng + offsetX * lngPerPixel

    setRightClickPosition({ lat, lng })
    setShowContextMenu(true)
  }

  const handleCopyCoordinates = () => {
    if (!rightClickPosition) return

    const coordinates = `${rightClickPosition.lat.toFixed(6)},${rightClickPosition.lng.toFixed(6)}`
    navigator.clipboard
      .writeText(coordinates)
      .then(() => {
        toast({
          title: "Coordinates copied!",
          description: `${coordinates} copied to clipboard`,
          duration: 3000,
        })
        setShowContextMenu(false)
      })
      .catch((err) => {
        console.error("Failed to copy coordinates: ", err)
        toast({
          title: "Failed to copy",
          description: "Could not copy coordinates to clipboard",
          variant: "destructive",
          duration: 3000,
        })
      })
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showContextMenu) {
        setShowContextMenu(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [showContextMenu])

  useEffect(() => {
    if (alreadySelectedPlace) {
      const latLng = {
        lat: alreadySelectedPlace.lat,
        lng: alreadySelectedPlace.lng,
      }
      setMapCenter(latLng)
      setMapZoom(13)
      setPosition(latLng)
    }
  }, [alreadySelectedPlace])

  function handleManualPinClick() {
    setManual(true)
    setPosition(undefined)
    setPrevData(undefined)
    setIsOpen(true)
  }

  const handleDragEnd = () => {
    if (centerChanged) {
      filterNearbyPins(centerChanged)
    }
  }
  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }

    // Request location permission and get location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setMapCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })

        setLoading(false)
      },
      (error) => {
        alert("Permission to access location was denied")
        console.error(error)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }, [])
  const handleZoomIn = () => {
    setMapZoom((prev) => Math.min(prev + 1, 20))
  }

  const handleZoomOut = () => {
    setMapZoom((prev) => Math.max(prev - 1, 3))
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
      <CustomMapControl
        controlPosition={2}
        onPlaceSelect={setSelectedPlace}
        onCenterChange={setMapCenter}
        setIsCordsSearch={setIsCordsSearch}
        setSearchCoordinates={setSearchCoordinates}
        setCordSearchLocation={setCordSearchLocation}
        setZoom={setMapZoom}
      />
      <div ref={mapRef} className="relative h-screen w-full" onContextMenu={handleMapRightClick}>
        <Map
          zoomControl={false}
          onCenterChanged={(center) => {
            setMapCenter(center.detail.center)
            setCenterChanged(center.detail.bounds)
          }}
          onZoomChanged={(zoom) => {
            setMapZoom(zoom.detail.zoom)
          }}
          onClick={handleMapClick}
          mapId={"bf51eea910020fa25a"}
          className="h-screen w-full"
          defaultCenter={{ lat: 22.54992, lng: 0 }}
          defaultZoom={3}
          minZoom={3}
          zoom={mapZoom}
          center={mapCenter}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
          onDragend={() => handleDragEnd()}
        >
          {centerChanged && searchCoordinates && (
            <AdvancedMarker
              style={{
                color: "red",
              }}
              position={{
                lat: searchCoordinates.lat,
                lng: searchCoordinates.lng,
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary  shadow-lg">
                <MapPin className="h-5 w-5" />
              </div>
            </AdvancedMarker>
          )}

          {isCordsSearch && cordSearchCords && (
            <AdvancedMarker
              style={{
                color: "red",
              }}
              position={{
                lat: cordSearchCords.lat,
                lng: cordSearchCords.lng,
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary  shadow-lg">
                <MapPin className="h-5 w-5" />
              </div>
            </AdvancedMarker>
          )}
          <MyPins setIsAutoCollect={setIsAutoCollect} />
        </Map>

        {/* Custom Context Menu */}
        {showContextMenu && rightClickPosition && (
          <div
            className="fixed z-50 bg-white rounded-md shadow-lg p-2 border border-gray-200 w-64"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 text-sm font-medium">Location Coordinates</div>
            <div className="px-2 pb-2 text-xs text-gray-500">
              {rightClickPosition.lat.toFixed(6)}, {rightClickPosition.lng.toFixed(6)}
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full mt-2 flex items-center justify-center gap-2"
              onClick={handleCopyCoordinates}
            >
              <Copy className="h-4 w-4" />
              Copy Coordinates
            </Button>
          </div>
        )}
      </div>

      <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

      {/* Sidebar toggle button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-40 z-10 rounded-full bg-white shadow-md"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <ArrowRightFromLine className="h-4 w-4" /> : <ArrowLeftFromLine className="h-4 w-4" />}
        </Button>
      </motion.div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-20 right-4 top-52 z-10  "
          >
            <SideMapItem setAlreadySelectedPlace={setAlreadySelectedPlace} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-40  right-2  z-10 ">
        <CreateBounty />
      </div>
      <div className="absolute bottom-52  right-2  z-10 ">
        <ManualPinButton handleClick={handleManualPinClick} />
      </div>
      <div className="absolute bottom-24 right-2 z-10 flex flex-col gap-2 md:bottom-28">
        <ReportCollection />
      </div>

      {/* Tooltip for right-click instruction */}
      <div className="absolute left-4 top-4 z-10 rounded-md bg-white/90 p-2 text-sm shadow-md backdrop-blur-sm dark:bg-gray-800/9 hidden md:block">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-primary" />
          <span>Right-click anywhere to view and copy coordinates</span>
        </div>
      </div>
    </APIProvider>
  )
}

function SideMapItem({
  setAlreadySelectedPlace,
}: {
  setAlreadySelectedPlace: (coords: { lat: number; lng: number }) => void
}) {
  const { nearbyPins } = useNearbyPinsStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Card className="h-64 w-80 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Nearby Locations</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className="h-40 pr-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonPin key={index} />
              ))}
            </div>
          ) : nearbyPins.length <= 0 ? (
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-muted-foreground">No nearby locations found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyPins?.map((pin) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    setAlreadySelectedPlace({
                      lat: pin.latitude,
                      lng: pin.longitude,
                    })
                  }}
                  key={pin.id}
                  className="group cursor-pointer rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium group-hover:text-primary">
                        {pin.locationGroup?.title ?? "Unnamed Location"}
                      </h3>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={pin.locationGroup?.image ?? "/favicon.ico"} alt="Creator" />
                            <AvatarFallback>C</AvatarFallback>
                          </Avatar>
                          <Badge variant="secondary" className="text-xs">
                            {pin._count.consumers} visitors
                          </Badge>
                        </div>
                        {pin.locationGroup?.endDate && (
                          <span className="text-[0.65rem] text-muted-foreground">
                            Ends: {format(new Date(pin.locationGroup.endDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function SkeletonPin() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <Skeleton className="h-4 w-4 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

function ManualPinButton({ handleClick }: { handleClick: () => void }) {
  return (
    <Button type="button" onClick={handleClick} variant="accentOutline" className="flex items-center gap-2  shadow-md">
      <MapPin className="h-4 w-4" />
      <span className="hidden md:block">Drop Pin</span>
    </Button>
  )
}

function ReportCollection() {
  return (
    <Button variant="accentOutline" asChild className="flex items-center gap-2  shadow-md">
      <Link href="/organization/map/collection-report">
        <ClipboardList className="h-4 w-4" />
        <span className="hidden md:block">Collection Report</span>
      </Link>
    </Button>
  )
}
function CreateBounty() {
  const { setIsOpen: setBountyOpen } = useCreateLocationBasedBountyStore()

  return (
    <Button variant="destructive" className="flex items-center gap-2  shadow-md"
      onClick={() => setBountyOpen(true)}
    >
      <Trophy className="h-4 w-4" />
      <span className="hidden md:block">Create Bounty</span>
    </Button>
  )
}

function ZoomControls({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <>
      <style jsx global>{`
        .touch-manipulation {
          touch-action: manipulation;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <motion.div
        className="absolute bottom-4 left-2 z-10 flex
                 items-center gap-2 md:bottom-auto md:left-auto md:right-2 md:top-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 touch-manipulation select-none rounded-full shadow-sm shadow-foreground"
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </motion.div>
        <motion.div
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="destructive"
            size="icon"
            className="h-10 w-10 touch-manipulation  select-none rounded-full shadow-sm shadow-foreground"
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </motion.div>
      </motion.div>
    </>
  )
}

function MyPins({
  setIsAutoCollect,
}: {
  setIsAutoCollect: (value: boolean) => void
}) {
  const { setAllPins } = useNearbyPinsStore()
  const pins = api.maps.pin.getMyPins.useQuery({
    showExpired: false,
  })
  const { setData, setIsOpen } = useMapOptionsModalStore()
  const { setData: setBountyData } = useCreateLocationBasedBountyStore()
  useEffect(() => {
    if (pins.data) {
      setAllPins(pins.data)
    }
  }, [pins.data])
  console.log(pins)

  if (pins.data) {
    return (
      <>
        {pins.data.map((pin) => {
          return (
            <AdvancedMarker
              key={pin.id}
              position={{ lat: pin.latitude, lng: pin.longitude }}
              onClick={() => {
                setBountyData({
                  lat: pin.latitude,
                  lng: pin.longitude,
                })
                setIsOpen(true)
                setData({
                  pinId: pin.id,
                  long: pin.longitude,
                  lat: pin.latitude,
                  mapTitle: pin.locationGroup?.title,
                  image: pin.locationGroup?.image ?? undefined,
                  mapDescription: pin.locationGroup?.description,
                  endDate: pin.locationGroup?.endDate,
                  startDate: pin.locationGroup?.startDate,
                  pinCollectionLimit: pin.locationGroup?.limit,
                  pinRemainingLimit: pin.locationGroup?.remaining,
                  multiPin: pin.locationGroup?.multiPin,
                  subscriptionId: pin.locationGroup?.subscriptionId ?? undefined,
                  autoCollect: pin.autoCollect,
                  pageAsset: pin.locationGroup?.pageAsset ?? false,
                  privacy: pin.locationGroup?.privacy,
                  pinNumber: pin.locationGroup?.remaining,
                  link: pin.locationGroup?.link ?? undefined,
                  assetId: pin.locationGroup?.assetId ?? undefined,
                })
                setIsAutoCollect(pin.autoCollect)
              }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative transition-all ${!pin.autoCollect ? "rounded-full" : ""} ${pin._count.consumers <= 0 ? "ring-2 ring-primary ring-offset-2" : "opacity-80"}`}
              >
                <Avatar className="h-8 w-8 border-2 border-white bg-background shadow-md">
                  <AvatarImage src={pin.locationGroup?.creator.profileUrl ?? "/favicon.ico"} alt="Creator" />
                  <AvatarFallback>C</AvatarFallback>
                </Avatar>
                {pin._count.consumers > 0 && (
                  <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-center text-[10px]">
                    {pin._count.consumers}
                  </Badge>
                )}
              </motion.div>
            </AdvancedMarker>
          )
        })}
      </>
    )
  }

  return null
}

export default CreatorMap


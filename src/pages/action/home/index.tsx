"use client"

import { useEffect, useState, useRef, useLayoutEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import Map, { Marker } from "react-map-gl"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, ScanLine, RefreshCcw, Crosshair, Zap, Trophy, Star, Search, Filter, Navigation, Users, Clock, ChevronUp, ChevronDown, Menu, X, ScanEye } from 'lucide-react'
import { useExtraInfo } from "~/lib/state/augmented-reality/useExtraInfo"
import { useNearByPin } from "~/lib/state/augmented-reality/useNearbyPin"
import { useAccountAction } from "~/lib/state/augmented-reality/useAccountAction"
import { useModal } from "~/lib/state/augmented-reality/useModal"
import type { ConsumedLocation } from "~/types/game/location"
import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Input } from "~/components/shadcn/ui/input"
import { BASE_URL } from "~/lib/common"
import { useBrandFollowMode } from "~/lib/state/augmented-reality/useBrandFollowMode"
import { useWalkThrough } from "~/hooks/useWalkthrough"
import { getMapAllPins } from "~/lib/augmented-reality/get-Map-all-pins"
import { getUserPlatformAsset } from "~/lib/augmented-reality/get-user-platformAsset"
import Loading from "~/components/common/loading"
import { Walkthrough } from "~/components/common/walkthrough"
import { LocationPermissionHandler } from "~/components/common/location-permission-handler"
import { useUserStellarAcc } from "~/lib/state/wallete/stellar-balances"
import { PLATFORM_ASSET } from "~/lib/stellar/constant"

type UserLocationType = {
    lat: number
    lng: number
}

type ButtonLayout = {
    x: number
    y: number
    width: number
    height: number
}

export default function HomeScreen() {
    const [userLocation, setUserLocation] = useState<UserLocationType | null>(null)
    const [locationPermissionGranted, setLocationPermissionGranted] = useState(false)
    const [pinCollected, setPinCollected] = useState(false)
    const [collectedPinData, setCollectedPinData] = useState<ConsumedLocation | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [headerVisible, setHeaderVisible] = useState(true)
    const router = useRouter()
    const { setData: setExtraInfo } = useExtraInfo()
    const { setBalance, setActive } = useUserStellarAcc();

    const [center, setCenter] = useState<UserLocationType | null>(null)
    const { setData } = useNearByPin()
    const { data } = useAccountAction()
    const autoCollectModeRef = useRef(data.mode)
    const { onOpen } = useModal()
    const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([])
    const [showWalkthrough, setShowWalkthrough] = useState(false)
    const { data: walkthroughData } = useWalkThrough()
    const { data: brandFollowMode } = useBrandFollowMode()

    const welcomeRef = useRef<HTMLDivElement>(null)
    const balanceRef = useRef<HTMLDivElement>(null)
    const refreshButtonRef = useRef<HTMLButtonElement>(null)
    const recenterButtonRef = useRef<HTMLButtonElement>(null)
    const arButtonRef = useRef<HTMLButtonElement>(null)

    const steps = [
        {
            target: buttonLayouts[0],
            title: "Welcome to the Actionverse AR!",
            content: "This tutorial will show you how to use Actionverse to find pins around you, follow your favorite brands, and collect rewards.",
        },
        {
            target: buttonLayouts[1],
            title: "Actionverse Balance",
            content: "The Actionverse Balance displays your Actionverse count. Check the Bounty Board for the latest ways to earn more Actionverse!",
        },
        {
            target: buttonLayouts[2],
            title: "Refresh Button",
            content: "If you need to refresh your map, press the refresh button. This will reload your entire map with all up to date app data.",
        },
        {
            target: buttonLayouts[3],
            title: "Re-center button",
            content: "Press the Re-center button to center your map view to your current location",
        },
        {
            target: buttonLayouts[4],
            title: "AR button",
            content: "To collect manual pins, press the AR button on your map to view your surroundings. Locate the icon on your screen, then press the Collect button that appears below it to add the item to your collection.",
        },
        {
            target: buttonLayouts[5],
            title: "Pin Auto Collection",
            content: "This celebration occurs when a pin has been automatically collected in Actionverse.",
        },
    ]

    const handleLocationGranted = (location: UserLocationType) => {
        console.log("Location granted:", location)
        setUserLocation(location)
        setCenter(location)
        setLocationPermissionGranted(true)
    }

    const handleLocationDenied = () => {
        console.log("Location access denied")
        setLocationPermissionGranted(false)
    }

    const getNearbyPins = (
        userLocation: UserLocationType,
        locations: ConsumedLocation[],
        radius: number,
    ) => {
        return locations.filter((location) => {
            if (
                location.auto_collect ||
                location.collection_limit_remaining <= 0 ||
                location.collected
            )
                return false
            const distance = getDistanceFromLatLonInMeters(
                userLocation.lat,
                userLocation.lng,
                location.lat,
                location.lng,
            )
            return distance <= radius
        })
    }

    const getDistanceFromLatLonInMeters = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) => {
        const R = 6371000 // Radius of the Earth in meters
        const dLat = ((lat2 - lat1) * Math.PI) / 180
        const dLon = ((lon2 - lon1) * Math.PI) / 180
        const a =
            0.5 -
            Math.cos(dLat) / 2 +
            (Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                (1 - Math.cos(dLon))) /
            2
        return R * 2 * Math.asin(Math.sqrt(a))
    }

    const handleARPress = (
        userLocation: UserLocationType,
        locations: ConsumedLocation[],
    ) => {
        const nearbyPins = getNearbyPins(userLocation, locations, 75)
        setData({
            nearbyPins: nearbyPins,
            singleAR: false,
        })
        onOpen("ArQrSelection")
    }

    const handleRecenter = () => {
        if (userLocation) {
            setCenter({
                lat: userLocation.lat,
                lng: userLocation.lng,
            })
        }
    }

    const getAutoCollectPins = (
        userLocation: UserLocationType | null,
        locations: ConsumedLocation[],
        radius: number,
    ) => {
        if (!userLocation) return []
        return locations.filter((location) => {
            if (location.collection_limit_remaining <= 0 || location.collected)
                return false
            if (location.auto_collect) {
                const distance = getDistanceFromLatLonInMeters(
                    userLocation.lat,
                    userLocation.lng,
                    location.lat,
                    location.lng,
                )
                return distance <= radius
            }
        })
    }

    const collectPinsSequentially = async (pins: ConsumedLocation[]) => {
        for (const pin of pins) {
            if (!autoCollectModeRef.current) {
                console.log("Auto collect mode paused")
                return
            }
            if (pin.collection_limit_remaining <= 0 || pin.collected) {
                console.log("Pin limit reached:", pin.id)
                continue
            }
            const response = await fetch(
                new URL("api/game/locations/consume", BASE_URL).toString(),
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ location_id: pin.id.toString() }),
                },
            )
            if (response.ok) {
                console.log("Collected pin:", pin.id)
                setCollectedPinData(pin)
                showPinCollectionAnimation()
            }
            await new Promise((resolve) => setTimeout(resolve, 20000))
        }
    }

    const showPinCollectionAnimation = () => {
        setPinCollected(true)
        setTimeout(() => {
            setPinCollected(false)
            setCollectedPinData(null)
        }, 3000)
    }

    const response = useQuery({
        queryKey: ["MapsAllPins", brandFollowMode],
        queryFn: () =>
            getMapAllPins({
                filterID: brandFollowMode ? "1" : "0",
            }),
    })

    const balanceRes = useQuery({
        queryKey: ["balance"],
        queryFn: getUserPlatformAsset,
        onSuccess: (data) => {
            if (data && data >= 0) {
                setActive(true);
            }
        }
    })

    const locations = response.data?.locations ?? []
    const filteredLocations = locations.filter((location: ConsumedLocation) =>
        location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    useLayoutEffect(() => {
        const updateButtonLayouts = () => {
            if (!showWalkthrough) return

            const welcome = welcomeRef.current
            const balance = balanceRef.current
            const refreshButton = refreshButtonRef.current
            const recenterButton = recenterButtonRef.current
            const arButton = arButtonRef.current

            const allElementsExist =
                welcome && balance && refreshButton && recenterButton && arButton

            if (allElementsExist) {
                try {
                    const welcomeRect = welcome.getBoundingClientRect()
                    const balanceRect = balance.getBoundingClientRect()
                    const refreshRect = refreshButton.getBoundingClientRect()
                    const recenterRect = recenterButton.getBoundingClientRect()
                    const arRect = arButton.getBoundingClientRect()

                    if (
                        welcomeRect.width > 0 &&
                        balanceRect.width > 0 &&
                        refreshRect.width > 0 &&
                        recenterRect.width > 0 &&
                        arRect.width > 0
                    ) {
                        setButtonLayouts([
                            {
                                x: welcomeRect.left,
                                y: welcomeRect.top,
                                width: welcomeRect.width,
                                height: welcomeRect.height,
                            },
                            {
                                x: balanceRect.left,
                                y: balanceRect.top,
                                width: balanceRect.width,
                                height: balanceRect.height,
                            },
                            {
                                x: refreshRect.left,
                                y: refreshRect.top,
                                width: refreshRect.width,
                                height: refreshRect.height,
                            },
                            {
                                x: recenterRect.left,
                                y: recenterRect.top,
                                width: recenterRect.width,
                                height: recenterRect.height,
                            },
                            {
                                x: arRect.left,
                                y: arRect.top,
                                width: arRect.width,
                                height: arRect.height,
                            },
                        ])
                    }
                } catch (error) {
                    console.error("Error updating button layouts:", error)
                }
            }
        }

        let timeoutId: NodeJS.Timeout
        const debouncedUpdate = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(updateButtonLayouts, 100)
        }

        const observer = new MutationObserver(debouncedUpdate)

        if (showWalkthrough) {
            observer.observe(document.body, { childList: true, subtree: true })
            setTimeout(updateButtonLayouts, 500)
        }

        return () => {
            observer.disconnect()
            clearTimeout(timeoutId)
        }
    }, [showWalkthrough])

    const checkFirstTimeSignIn = async () => {
        try {
            if (walkthroughData?.showWalkThrough) {
                setTimeout(() => {
                    setShowWalkthrough(true)
                }, 1000)
            } else {
                setShowWalkthrough(false)
            }
        } catch (error) {
            console.error("Error checking walkthrough data:", error)
            setShowWalkthrough(false)
        }
    }

    useEffect(() => {
        checkFirstTimeSignIn()
    }, [walkthroughData])

    useEffect(() => {
        if (data.mode && locations) {
            const autoCollectPins = getAutoCollectPins(userLocation, locations, 50)
            if (autoCollectPins.length > 0) {
                collectPinsSequentially(autoCollectPins)
            }
        }
    }, [data.mode, locations])

    useEffect(() => {
        autoCollectModeRef.current = data.mode
    }, [data.mode])

    if (response.isLoading) {
        return <Loading />
    }

    if (!locationPermissionGranted) {
        return (
            <LocationPermissionHandler
                onLocationGranted={handleLocationGranted}
                onLocationDenied={handleLocationDenied}
            />
        )
    }

    if (!userLocation) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading map...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen  relative">
            <motion.div
                className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700 relative z-30"
                initial={{ opacity: 0, y: -100 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        {/* Logo */}
                        <Image
                            src="/images/action/logo.png"
                            alt="AR Icon"
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain"
                        />

                        {/* Searchbar */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    placeholder="Search locations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-9 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl text-sm"
                                />
                            </div>
                        </div>

                        {/* Balance */}
                        <motion.div
                            ref={balanceRef}
                            className="bg-primary rounded-xl px-3 py-2 min-w-[90px] flex-shrink-0"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="text-center">
                                <p className="text-white text-sm font-bold">
                                    {Number(balanceRes.data).toFixed(0) ?? 0} {PLATFORM_ASSET.code}
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Content */}
            <div className={`flex-1 `}>
                <motion.div
                    key="map"
                    className="relative h-[calc(100vh-80px)]"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                >
                    {userLocation && (
                        <Map
                            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API}
                            initialViewState={{
                                latitude: userLocation.lat,
                                longitude: userLocation.lng,
                                zoom: 14,
                            }}
                            latitude={center?.lat}
                            longitude={center?.lng}
                            onDrag={(e) => {
                                setCenter({
                                    lat: e.viewState.latitude ?? 0,
                                    lng: e.viewState.longitude ?? 0,
                                })
                            }}
                            style={{ width: "100%", height: "100%" }}
                            mapStyle="mapbox://styles/suppport-10/cmcntcaoj010m01sb66oiddp8"
                        >
                            {/* User Location Marker */}
                            <Marker
                                longitude={userLocation.lng}
                                latitude={userLocation.lat}
                                anchor="center"
                            >
                                <div className="relative">
                                    <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                    </div>
                                    <div className="absolute -inset-2 bg-blue-500/20 rounded-full animate-ping"></div>
                                </div>
                            </Marker>

                            {/* Location Pins */}
                            <MyPins locations={filteredLocations} />
                        </Map>
                    )}

                    {/* Map Controls - Fixed positioning */}
                    <div className={`absolute right-2 bottom-36 flex flex-col gap-3 z-20`}>
                        {/* AR Scan Button - Main Action */}
                        <motion.button
                            ref={arButtonRef}
                            onClick={() => handleARPress(userLocation, locations)}
                            className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-xl flex items-center justify-center border-4 border-white dark:border-slate-800"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}

                        >
                            <ScanLine className="w-7 h-7 text-white" />
                        </motion.button>

                        {/* Recenter Button */}
                        <motion.button
                            ref={recenterButtonRef}
                            onClick={handleRecenter}
                            className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <Crosshair className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </motion.button>


                    </div>
                    {/* Refresh Button */}
                    <div className={`absolute right-16 bottom-36 flex flex-col gap-3 z-20`}>
                        <motion.button
                            ref={refreshButtonRef}
                            onClick={() => response.refetch()}
                            className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700"
                            whileHover={{ scale: 1.1, rotate: 180 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                        >
                            <RefreshCcw className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </motion.button>
                    </div>

                </motion.div>
            </div>

            {/* Pin Collection Animation */}
            <AnimatePresence>
                {pinCollected && collectedPinData && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-white dark:bg-slate-800 rounded-3xl p-8 mx-4 max-w-sm shadow-2xl"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trophy className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Pin Collected!
                                </h3>
                                <p className="text-lg font-semibold text-green-600 mb-1">
                                    {collectedPinData.title}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    From {collectedPinData.brand_name}
                                </p>
                                <Badge className="bg-green-100 text-green-700">
                                    <Star className="w-3 h-3 mr-1" />
                                    Auto Collected
                                </Badge>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showWalkthrough && (
                <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />
            )}
        </div>
    )
}

function MyPins({ locations }: { locations: ConsumedLocation[] }) {
    const { onOpen } = useModal()

    return (
        <>
            {locations.map((location: ConsumedLocation, index: number) => (
                <Marker
                    key={index}
                    latitude={location.lat}
                    longitude={location.lng}
                    anchor="center"
                    onClick={() =>
                        onOpen("LocationInformation", {
                            Collection: location,
                        })
                    }
                >
                    <motion.div
                        className="cursor-pointer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.05 * index }}
                        style={{
                            height: 30,
                            width: 30,
                            borderWidth: 2,
                            ...(
                                !location.auto_collect && {
                                    borderRadius: 20, // Add borderRadius only when auto_collect is false
                                }
                            ),
                            ...(location.collected && { opacity: 0.4 }),
                        }}
                    >
                        <div className="relative">
                            <div className="w-12 h-12 bg-white rounded-full shadow-lg border-2 border-white overflow-hidden">
                                <Image
                                    height={48}
                                    width={48}
                                    alt="Pin"
                                    src={location.brand_image_url || "/placeholder.svg"}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {location.collection_limit_remaining > 0 && !location.collected && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                                    <span className="text-xs font-bold text-white">
                                        {location.collection_limit_remaining}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </Marker>
            ))}
        </>
    )
}

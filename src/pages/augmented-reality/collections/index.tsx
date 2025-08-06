"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Grid3X3, List, Filter, Star, Trophy, Package, Clock, MapPin, Zap, Eye, EyeOff, ChevronDown, ChevronUp, Navigation } from 'lucide-react'
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import { useQuery } from "@tanstack/react-query"
import { getUserPlatformAsset } from "~/lib/augmented-reality/get-user-platformAsset"
import { getMapAllPins } from "~/lib/augmented-reality/get-Map-all-pins"
import type { ConsumedLocation } from "~/types/game/location"
import Image from "next/image"
import Loading from "~/components/common/loading"
import { useRouter } from "next/router"
import { useCollection } from "~/lib/state/augmented-reality/useCollection"
import { formatDistanceToNow } from "date-fns"
import { BASE_URL } from "~/lib/common"
import { addrShort } from "~/utils/utils"

type ViewMode = 'grid' | 'list'
type SortOption = 'recent' | 'name' | 'brand' | 'distance' | 'collected'
type FilterOption = 'all' | 'collected' | 'available' | 'expired' | 'nearby'

export default function CollectionsPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [sortBy, setSortBy] = useState<SortOption>('recent')
    const [filterBy, setFilterBy] = useState<FilterOption>('all')
    const [showFilters, setShowFilters] = useState(false)
    const [showHeader, setShowHeader] = useState(true)
    const router = useRouter()
    const { setData } = useCollection()

    const balanceRes = useQuery({
        queryKey: ["balance"],
        queryFn: getUserPlatformAsset,
    })
    const getCollections = async () => {
        try {
            const response = await fetch(new URL("api/game/locations/get_consumed_location", BASE_URL).toString(), {
                method: "GET",
                credentials: "include",
            })

            if (!response.ok) {
                throw new Error("Failed to fetch collections")
            }

            const data = (await response.json()) as { locations: ConsumedLocation[] }
            return data
        } catch (error) {
            console.error("Error fetching collections:", error)
            throw error
        }
    }
    const locationsRes = useQuery({
        queryKey: ["MapsAllPins"],
        queryFn: () => getCollections(),
    })

    const locations = locationsRes.data?.locations ?? []

    // Calculate user's current location (mock for now)
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)

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

    // Calculate distance between two points
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

    // Filter and sort locations
    const filteredAndSortedLocations = locations
        .filter((location: ConsumedLocation) => {
            const matchesSearch = location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                location.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                location.description.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesFilter = (() => {
                switch (filterBy) {
                    case 'collected':
                        return location.collected
                    case 'available':
                        return !location.collected && location.collection_limit_remaining > 0
                    case 'expired':
                        return location.collection_limit_remaining <= 0
                    case 'nearby':
                        if (!userLocation) return false
                        const distance = calculateDistance(
                            userLocation.lat, userLocation.lng,
                            location.lat, location.lng
                        )
                        return distance <= 5 // Within 5km
                    default:
                        return true
                }
            })()

            return matchesSearch && matchesFilter
        })
        .sort((a: ConsumedLocation, b: ConsumedLocation) => {
            switch (sortBy) {
                case 'name':
                    return a.title.localeCompare(b.title)
                case 'brand':
                    return a.brand_name.localeCompare(b.brand_name)
                case 'distance':
                    if (!userLocation) return 0
                    const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
                    const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
                    return distA - distB
                case 'collected':
                    return (b.collected ? 1 : 0) - (a.collected ? 1 : 0)
                default:
                    return a.title.localeCompare(b.title)
            }
        })

    const collectedCount = locations.filter((loc: ConsumedLocation) => loc.collected).length
    const availableCount = locations.filter((loc: ConsumedLocation) => !loc.collected && loc.collection_limit_remaining > 0).length
    const nearbyCount = userLocation ? locations.filter((loc: ConsumedLocation) => {
        const distance = calculateDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng)
        return distance <= 5
    }).length : 0

    const handleCollectionClick = (location: ConsumedLocation) => {
        setData({ collections: location })
        router.push(`/augmented-reality/collections/${location.id}`)
    }

    if (locationsRes.isLoading) {
        return <Loading />
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Compact Header */}
            <AnimatePresence>
                {showHeader && (
                    <motion.div
                        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg border-b border-slate-200/50 dark:border-slate-700/50"
                        initial={{ opacity: 0, y: -100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -100 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="px-6 pt-4 pb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                                        AR Collections
                                    </h1>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                                        Discover and collect AR experiences
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowHeader(false)}
                                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Enhanced Stats Cards */}
                            {/* <div className="grid grid-cols-4 gap-3 mb-4">
                                <motion.div
                                    className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-3 text-center shadow-lg"
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Package className="w-5 h-5 text-white mx-auto mb-1" />
                                    <p className="text-white text-lg font-bold">{locations.length}</p>
                                    <p className="text-white/80 text-xs">Total</p>
                                </motion.div>

                                <motion.div
                                    className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-3 text-center shadow-lg"
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Trophy className="w-5 h-5 text-white mx-auto mb-1" />
                                    <p className="text-white text-lg font-bold">{collectedCount}</p>
                                    <p className="text-white/80 text-xs">Collected</p>
                                </motion.div>

                                <motion.div
                                    className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-3 text-center shadow-lg"
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Star className="w-5 h-5 text-white mx-auto mb-1" />
                                    <p className="text-white text-lg font-bold">{availableCount}</p>
                                    <p className="text-white/80 text-xs">Available</p>
                                </motion.div>

                                <motion.div
                                    className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-3 text-center shadow-lg"
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Navigation className="w-5 h-5 text-white mx-auto mb-1" />
                                    <p className="text-white text-lg font-bold">{nearbyCount}</p>
                                    <p className="text-white/80 text-xs">Nearby</p>
                                </motion.div>
                            </div> */}

                            {/* Enhanced Search Bar */}
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <Input
                                    placeholder="Search collections, brands, or descriptions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 h-12 bg-slate-100/70 dark:bg-slate-800/70 border-0 rounded-2xl backdrop-blur-sm text-base"
                                />
                            </div>

                            {/* Enhanced Controls */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={viewMode === 'grid' ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className="h-10 px-4 rounded-xl"
                                    >
                                        <Grid3X3 className="w-4 h-4 mr-2" />
                                        Grid
                                    </Button>
                                    <Button
                                        variant={viewMode === 'list' ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setViewMode('list')}
                                        className="h-10 px-4 rounded-xl"
                                    >
                                        <List className="w-4 h-4 mr-2" />
                                        List
                                    </Button>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="h-10 px-4 rounded-xl"
                                >
                                    <Filter className="w-4 h-4 mr-2" />
                                    Filters
                                    {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                                </Button>
                            </div>

                            {/* Enhanced Filter Panel */}
                            <AnimatePresence>
                                {showFilters && (
                                    <motion.div
                                        className="mt-4 p-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                                                    Sort by
                                                </label>
                                                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                                                    <SelectTrigger className="h-10 rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="name">Name A-Z</SelectItem>
                                                        <SelectItem value="brand">Brand A-Z</SelectItem>
                                                        <SelectItem value="collected">Collected First</SelectItem>
                                                        {userLocation && <SelectItem value="distance">Nearest First</SelectItem>}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                                                    Filter by
                                                </label>
                                                <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
                                                    <SelectTrigger className="h-10 rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Collections</SelectItem>
                                                        <SelectItem value="collected">Collected</SelectItem>
                                                        <SelectItem value="available">Available</SelectItem>
                                                        <SelectItem value="expired">Expired</SelectItem>
                                                        {userLocation && <SelectItem value="nearby">Nearby (5km)</SelectItem>}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Toggle Button (when collapsed) */}
            {!showHeader && (
                <motion.div
                    className="fixed top-4 right-4 z-50"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Button
                        onClick={() => setShowHeader(true)}
                        className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 hover:scale-105 transition-transform"
                    >
                        <ChevronDown className="h-5 w-5" />
                    </Button>
                </motion.div>
            )}

            {/* Content */}
            <div className={`px-6 py-6 pb-32 ${!showHeader ? 'pt-20' : ''}`}>
                <AnimatePresence mode="wait">
                    {viewMode === 'grid' ? (
                        <motion.div
                            key="grid"
                            className="grid grid-cols-2 gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {filteredAndSortedLocations.map((location: ConsumedLocation, index: number) => (
                                <motion.div
                                    key={location.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.05 * index }}
                                    whileHover={{ scale: 1.02, y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleCollectionClick(location)}
                                >
                                    <Card className="overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border-0">
                                        <CardContent className="p-0">
                                            <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                                                <Image
                                                    height={200}
                                                    width={200}
                                                    alt={location.title}
                                                    src={location.image_url || "/placeholder.svg"}
                                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                                                />

                                                {/* Enhanced Status Badge */}
                                                <div className="absolute top-3 right-2">
                                                    {location.collected ? (
                                                        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs shadow-lg border-0">
                                                            <Trophy className="w-3 h-3 mr-1" />
                                                            Collected
                                                        </Badge>
                                                    ) : location.collection_limit_remaining > 0 ? (
                                                        <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs shadow-lg border-0">
                                                            <Zap className="w-3 h-3 mr-1" />
                                                            {location.collection_limit_remaining} left
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white text-xs shadow-lg border-0">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            Expired
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Distance Badge */}
                                                {userLocation && (
                                                    <div className="absolute top-3 left-2">
                                                        <Badge className="bg-black/50 text-white text-xs backdrop-blur-sm border-0">
                                                            <Navigation className="w-3 h-3 mr-1" />
                                                            {calculateDistance(userLocation.lat, userLocation.lng, location.lat, location.lng).toFixed(1)}km
                                                        </Badge>
                                                    </div>
                                                )}

                                                {/* Gradient Overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                            </div>

                                            <div className="p-4">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">
                                                    {location.title}
                                                </h3>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-1">
                                                    by {location.brand_name}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                                                    {location.description}
                                                </p>
                                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        <span>ID: {addrShort(location.id.toString())}</span>
                                                    </div>
                                                    {location.collected && (
                                                        <div className="flex items-center gap-1 text-emerald-600">
                                                            <Star className="w-3 h-3 fill-current" />
                                                            <span>Owned</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
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
                            {filteredAndSortedLocations.map((location: ConsumedLocation, index: number) => (
                                <motion.div
                                    key={location.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: 0.05 * index }}
                                    whileHover={{ scale: 1.01, x: 4 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => handleCollectionClick(location)}
                                >
                                    <Card className="overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border-0">
                                        <CardContent className="p-0">
                                            <div className="flex">
                                                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                                                    <Image
                                                        height={96}
                                                        width={96}
                                                        alt={location.title}
                                                        src={location.image_url || "/placeholder.svg"}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                <div className="flex-1 p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                                                                {location.title}
                                                            </h3>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                                                                by {location.brand_name}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-col gap-1 ml-2">
                                                            {location.collected ? (
                                                                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                                                    <Trophy className="w-3 h-3 mr-1" />
                                                                    Collected
                                                                </Badge>
                                                            ) : location.collection_limit_remaining > 0 ? (
                                                                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs">
                                                                    {location.collection_limit_remaining} left
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white text-xs">
                                                                    Expired
                                                                </Badge>
                                                            )}

                                                            {userLocation && (
                                                                <Badge className="bg-black/10 text-slate-600 dark:text-slate-400 text-xs">
                                                                    {calculateDistance(userLocation.lat, userLocation.lng, location.lat, location.lng).toFixed(1)}km
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                                                        {location.description}
                                                    </p>

                                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                <span>ID: {addrShort(location.id.toString())}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                <span>Active</span>
                                                            </div>
                                                        </div>

                                                        {location.collected && (
                                                            <div className="flex items-center gap-1 text-emerald-600">
                                                                <Star className="w-3 h-3 fill-current" />
                                                                <span className="font-medium">Owned</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {filteredAndSortedLocations.length === 0 && (
                    <motion.div
                        className="text-center py-16"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Package className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">No collections found</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Try adjusting your search or filters to discover more AR experiences
                        </p>
                        <Button
                            onClick={() => {
                                setSearchQuery("")
                                setFilterBy('all')
                                setSortBy('recent')
                            }}
                            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl"
                        >
                            Reset Filters
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    )
}

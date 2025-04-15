"use client"

import type { Location, LocationGroup } from "@prisma/client"
import {
    Check,
    ChevronDown,
    ChevronUp,
    X,
    Search,
    MapPin,
    User,
    Info,
    Clock,
    Calendar,
    FileText,
    RefreshCw,
    AlertCircle,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import toast from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Checkbox } from "~/components/shadcn/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { ScrollArea } from "~/components/shadcn/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { api } from "~/utils/api"
import { CREATOR_TERM } from "~/utils/term"
import { cn } from "~/lib/utils"
import AdminLayout from "~/components/layout/root/AdminLayout"

export default function Pins() {
    const [isRefreshing, setIsRefreshing] = useState(false)

    const locationGroups = api.maps.pin.getLocationGroups.useQuery(undefined, {
        refetchOnWindowFocus: false,
        onSettled: () => {
            setIsRefreshing(false)
        },
    })

    const handleRefresh = () => {
        setIsRefreshing(true)
        locationGroups.refetch()
    }

    if (locationGroups.isLoading && !isRefreshing) {
        return <PinsLoadingSkeleton />
    }

    if (locationGroups.error) {
        return (
            <AdminLayout>
                <div className="container mx-auto px-4 py-12">
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                Error Loading Pins
                            </CardTitle>
                            <CardDescription className="text-destructive/80">
                                {locationGroups.error.message || "There was an error loading the pins data."}
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button variant="outline" onClick={handleRefresh}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </AdminLayout>
        )
    }

    if (locationGroups.data) {
        return (
            <AdminLayout>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="px-4 py-8"
                >
                    <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Manage Pins</h1>
                            <p className="text-muted-foreground">Review and approve location pins submitted by creators.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>

                    <GroupPins groups={locationGroups.data} />
                </motion.div>
            </AdminLayout>
        )
    }

    return null
}

type GroupPins = LocationGroup & {
    locations: Location[]
    creator: { name: string; id: string }
}

type Group = Record<string, GroupPins[]>

function PinsLoadingSkeleton() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="mt-2 h-4 w-48" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>

            <div className="space-y-4">
                {Array(3)
                    .fill(0)
                    .map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}

                <div className="pl-8 space-y-3">
                    {Array(2)
                        .fill(0)
                        .map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full rounded-lg" />
                        ))}
                </div>
            </div>
        </div>
    )
}

function GroupPins({ groups }: { groups: GroupPins[] }) {
    const [searchTerm, setSearchTerm] = useState("")

    const groupByCreator: Record<string, GroupPins[]> = {}

    groups.forEach((group) => {
        const creatorId = group.creator.id

        if (!groupByCreator[creatorId]) {
            groupByCreator[creatorId] = []
        }

        groupByCreator[creatorId].push(group)
    })

    // Filter groups based on search term
    const filteredGroupsByCreator: Record<string, GroupPins[]> = {}

    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase()

        Object.entries(groupByCreator).forEach(([creatorId, creatorGroups]) => {
            const filteredGroups = creatorGroups.filter(
                (group) =>
                    group.title.toLowerCase().includes(lowerSearchTerm) ??
                    group.description?.toLowerCase().includes(lowerSearchTerm) ??
                    group.creator.name.toLowerCase().includes(lowerSearchTerm),
            )

            if (filteredGroups.length > 0) {
                filteredGroupsByCreator[creatorId] = filteredGroups
            }
        })
    } else {
        Object.assign(filteredGroupsByCreator, groupByCreator)
    }

    const totalGroups = Object.values(filteredGroupsByCreator).flat().length
    const totalCreators = Object.keys(filteredGroupsByCreator).length

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pins by title or creator..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                        {totalGroups} Pin Groups
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                        {totalCreators} Creators
                    </Badge>
                </div>
            </div>

            {totalGroups === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium">No matching pins found</h3>
                    <p className="text-sm text-muted-foreground">
                        Try adjusting your search term to find what you{"'re"} looking for.
                    </p>
                </div>
            ) : (
                <PinsList groupsByCreator={filteredGroupsByCreator} />
            )}
        </div>
    )
}

function PinsList({ groupsByCreator }: { groupsByCreator: Record<string, GroupPins[]> }) {
    const [selectedGroup, setSelectedGroup] = useState<string[]>([])
    const [expandedCreators, setExpandedCreators] = useState<string[]>([])

    const approveM = api.maps.pin.approveLocationGroups.useMutation({
        onSuccess: (data, variable) => {
            if (variable.approved) toast.success("Pins Approved Successfully!")
            if (!variable.approved) toast.error("Pins Rejected Successfully!")
            setSelectedGroup([])
        },
        onError: (error) => {
            toast.error("Operation failed: " + error.message)
        },
    })

    function handleGroupSelection(groupId: string) {
        setSelectedGroup((prev) => {
            if (prev.includes(groupId)) {
                return prev.filter((id) => id !== groupId)
            } else {
                return [...prev, groupId]
            }
        })
    }

    function toggleCreatorExpanded(creatorId: string) {
        setExpandedCreators((prev) => {
            if (prev.includes(creatorId)) {
                return prev.filter((id) => id !== creatorId)
            } else {
                return [...prev, creatorId]
            }
        })
    }

    function selectAllGroups() {
        const allGroupIds = Object.values(groupsByCreator)
            .flat()
            .map((group) => group.id)

        setSelectedGroup(allGroupIds)
    }

    function deselectAllGroups() {
        setSelectedGroup([])
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllGroups}
                    disabled={Object.keys(groupsByCreator).length === 0}
                >
                    Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllGroups} disabled={selectedGroup.length === 0}>
                    Deselect All
                </Button>

                {selectedGroup.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                        {selectedGroup.length} selected
                    </Badge>
                )}
            </div>

            <div className="space-y-4">
                <AnimatePresence>
                    {Object.entries(groupsByCreator).map(([creatorId, creatorGroups]) => {
                        // Get creator name from the first group
                        const creatorName = creatorGroups[0]?.creator.name ?? "Unknown Creator"
                        const isCreatorExpanded = expandedCreators.includes(creatorId)

                        return (
                            <motion.div
                                key={`creator-${creatorId}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                                transition={{ duration: 0.3 }}
                            >
                                <Card>
                                    <CardHeader className="cursor-pointer py-4" onClick={() => toggleCreatorExpanded(creatorId)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User className="h-5 w-5 text-primary" />
                                                <CardTitle className="text-lg">
                                                    {CREATOR_TERM}: {creatorName}
                                                </CardTitle>
                                                <Badge variant="outline" className="ml-2">
                                                    {creatorGroups.length} pin groups
                                                </Badge>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                {isCreatorExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <AnimatePresence>
                                        {isCreatorExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <CardContent className="pb-4">
                                                    <div className="space-y-3">
                                                        {creatorGroups.map((group) => (
                                                            <PinGroupItem
                                                                key={group.id}
                                                                group={group}
                                                                isSelected={selectedGroup.includes(group.id)}
                                                                onToggleSelection={() => handleGroupSelection(group.id)}
                                                            />
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm py-4 border-t">
                <div className="flex justify-end gap-4">
                    <Button
                        variant="destructive"
                        onClick={() => {
                            approveM.mutate({
                                locationGroupIds: selectedGroup,
                                approved: false,
                            })
                        }}
                        disabled={selectedGroup.length === 0 || approveM.isLoading}
                        className="gap-2 shadow-sm shadow-foreground"
                    >
                        {approveM.isLoading && !approveM.variables?.approved ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <X className="h-4 w-4" />
                        )}
                        Reject {selectedGroup.length > 0 && `(${selectedGroup.length})`}
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            approveM.mutate({
                                locationGroupIds: selectedGroup,
                                approved: true,
                            })
                        }}
                        disabled={selectedGroup.length === 0 || approveM.isLoading}
                        className="gap-2 shadow-sm shadow-foreground"
                    >
                        {approveM.isLoading && approveM.variables?.approved ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        Approve {selectedGroup.length > 0 && `(${selectedGroup.length})`}
                    </Button>

                </div>
            </div>
        </div>
    )
}

function PinGroupItem({
    group,
    isSelected,
    onToggleSelection,
}: {
    group: GroupPins
    isSelected: boolean
    onToggleSelection: () => void
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Card
            className={cn(
                "border transition-all duration-200",
                isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/20",
            )}
        >
            <CardHeader className="p-4 pb-0">
                <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelection()} id={`group-${group.id}`} />
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                            <label htmlFor={`group-${group.id}`} className="font-medium cursor-pointer flex-1">
                                {group.title}
                            </label>
                            <Badge variant="outline" className="text-xs">
                                ID: {group.id}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{group.description}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="ml-auto">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <CardContent className="p-4 pt-4">
                            <Tabs defaultValue="details">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="details">
                                        <Info className="mr-2 h-4 w-4" />
                                        Details
                                    </TabsTrigger>
                                    <TabsTrigger value="locations">
                                        <MapPin className="mr-2 h-4 w-4" />
                                        Locations ({group.locations.length})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="mt-0">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    Description
                                                </h4>
                                                <p className="text-sm mt-1">{group.description}</p>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    Date Range
                                                </h4>
                                                <p className="text-sm mt-1">
                                                    {new Date(group.startDate).toLocaleDateString()} -{" "}
                                                    {new Date(group.endDate).toLocaleDateString()}
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    Created
                                                </h4>
                                                <p className="text-sm mt-1">{new Date(group.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {group.image && (
                                            <div className="flex justify-center items-center">
                                                <div className="relative overflow-hidden rounded-md border h-40 w-full">
                                                    <Image
                                                        src={group.image || "/placeholder.svg"}
                                                        alt={group.title}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="locations" className="mt-0">
                                    <ScrollArea className="h-[200px] rounded-md border p-4">
                                        <div className="space-y-4">
                                            {group.locations.map((location) => (
                                                <div key={location.id} className="flex items-center justify-between border-b pb-2">
                                                    <div>
                                                        <h4 className="text-sm font-medium">Location ID: {location.id}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                                            <p className="text-xs font-mono">
                                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant={location.autoCollect ? "default" : "outline"}>
                                                                    {location.autoCollect ? "Auto Collect" : "Manual Collect"}
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="text-xs">
                                                                    {location.autoCollect
                                                                        ? "Users automatically collect this pin when in range"
                                                                        : "Users must manually collect this pin when in range"}
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    )
}


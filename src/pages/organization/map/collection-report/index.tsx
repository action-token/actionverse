"use client"

import type React from "react"

import { useState, useMemo } from "react"
import {
    Loader2,
    Download,
    Search,
    Calendar,
    RefreshCw,
    ChevronDown,
    Info,
    MapPin,
    User,
    Mail,
    FileText,
} from "lucide-react"
import { motion } from "framer-motion"
import { api } from "~/utils/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/shadcn/ui/table"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { type CreatorConsumedPin, useModal } from "~/lib/state/augmented-reality/use-modal-store"
import { addrShort } from "~/utils/utils"
import { cn } from "~/lib/utils"
import toast from "react-hot-toast"

type ConsumerType = {
    user: {
        name: string | null
        id: string
        email: string | null
    }
}

const ITEMS_PER_PAGE = 10

const CreatorCollectionReport = () => {
    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const pins = api.maps.pin.getCreatorPinTConsumedByUser.useQuery(undefined, {
        refetchOnWindowFocus: false,
        onSettled: () => {
            setIsRefreshing(false)
        },
    })

    const handleRefresh = () => {
        setIsRefreshing(true)
        pins.refetch()
    }

    if (pins.isLoading && !isRefreshing) {
        return (
            <div className="container mx-auto px-4 py-12">
                <LoadingState />
            </div>
        )
    }

    if (pins.isError) {
        return (
            <div className="container mx-auto px-4 py-12">
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <Info className="h-5 w-5" />
                            Error Loading Data
                        </CardTitle>
                        <CardDescription className="text-destructive/80">
                            {pins.error?.message || "There was an error loading your collection reports."}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button variant="outline" onClick={() => pins.refetch()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Try Again
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    if (!pins.data || pins.data.length === 0) {
        return (
            <div className="container mx-auto px-4 py-12">
                <Card className="border-muted bg-muted/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-5 w-5" />
                            No Collection Data
                        </CardTitle>
                        <CardDescription>
                            No pin collection data is available yet. Create pins and wait for users to collect them.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button variant="outline" onClick={() => pins.refetch()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh Data
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (

        <div className="px-4 py-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Collection Reports</h2>
                        <p className="text-muted-foreground">Track and analyze all pin collections by your users.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                        <ReportDownloadMenu />
                    </div>
                </div>

                <Tabs defaultValue="table" className="w-full">
                    <TabsList className="mb-4 grid w-full grid-cols-2 md:w-[400px]">
                        <TabsTrigger value="table">
                            <FileText className="mr-2 h-4 w-4" />
                            Table View
                        </TabsTrigger>
                        <TabsTrigger value="summary">
                            <Info className="mr-2 h-4 w-4" />
                            Summary
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="table" className="mt-0">
                        <Card>
                            <CardHeader className="pb-0">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="relative w-full max-w-sm">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by title, location or email..."
                                            className="pl-8"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value)
                                                setCurrentPage(1) // Reset to first page on search
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {pins.data.reduce(
                                                (acc, pin) => acc + pin.locations.reduce((locAcc, loc) => locAcc + loc.consumers.length, 0),
                                                0,
                                            )}{" "}
                                            Total Collections
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            {pins.data.length} Pins
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <TableData
                                    pins={pins.data}
                                    searchTerm={searchTerm}
                                    currentPage={currentPage}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                    onPageChange={setCurrentPage}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="summary">
                        <SummaryView pins={pins.data} />
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>

    )
}

export default CreatorCollectionReport

function LoadingState() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="mt-2 h-4 w-48" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-full max-w-[800px]" />
                            </div>
                        </div>
                        {Array(5)
                            .fill(0)
                            .map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <Skeleton className="h-12 w-full max-w-[800px]" />
                                    </div>
                                </div>
                            ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function SummaryView({ pins }: { pins: CreatorConsumedPin[] }) {
    // Calculate summary statistics
    const totalPins = pins.length
    const totalLocations = pins.reduce((acc, pin) => acc + pin.locations.length, 0)
    const totalCollections = pins.reduce(
        (acc, pin) => acc + pin.locations.reduce((locAcc, loc) => locAcc + loc.consumers.length, 0),
        0,
    )

    const uniqueConsumers = new Set()
    pins.forEach((pin) => {
        pin.locations.forEach((location) => {
            location.consumers.forEach((consumer) => {
                uniqueConsumers.add(consumer.user.id)
            })
        })
    })

    const totalUniqueConsumers = uniqueConsumers.size

    // Find most collected pin
    let mostCollectedPin = { pin: null as CreatorConsumedPin | null, count: 0 }
    pins.forEach((pin) => {
        const pinCollections = pin.locations.reduce((acc, loc) => acc + loc.consumers.length, 0)
        if (pinCollections > mostCollectedPin.count) {
            mostCollectedPin = { pin, count: pinCollections }
        }
    })

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Pins</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{totalPins}</div>
                        <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{totalLocations}</div>
                        <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{totalCollections}</div>
                        <Download className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Unique Collectors</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold">{totalUniqueConsumers}</div>
                        <User className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Most Collected Pin</CardTitle>
                </CardHeader>
                <CardContent>
                    {mostCollectedPin.pin ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">{mostCollectedPin.pin.title}</div>
                                <Badge>{mostCollectedPin.count} collections</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">ID: {mostCollectedPin.pin.id}</div>
                            <div className="text-sm text-muted-foreground">
                                Active: {new Date(mostCollectedPin.pin.startDate).toLocaleDateString()} -{" "}
                                {new Date(mostCollectedPin.pin.endDate).toLocaleDateString()}
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted-foreground">No collections yet</div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export function TableData({
    pins,
    searchTerm,
    currentPage,
    itemsPerPage,
    onPageChange,
}: {
    pins: CreatorConsumedPin[]
    searchTerm: string
    currentPage: number
    itemsPerPage: number
    onPageChange: (page: number) => void
}) {
    const { onOpen } = useModal()

    // Filter pins based on search term
    const filteredPins = useMemo(() => {
        if (!searchTerm) return pins

        const lowerSearchTerm = searchTerm.toLowerCase()

        return pins.filter((pin) => {
            // Check pin title
            if (pin.title.toLowerCase().includes(lowerSearchTerm)) return true

            // Check locations
            return pin.locations.some((location) => {
                // Check location coordinates
                if (
                    location.latitude.toString().includes(lowerSearchTerm) ||
                    location.longitude.toString().includes(lowerSearchTerm)
                ) {
                    return true
                }

                // Check consumers
                return location.consumers.some(
                    (consumer) =>
                        consumer.user.email?.toLowerCase().includes(lowerSearchTerm) ??
                        consumer.user.name?.toLowerCase().includes(lowerSearchTerm) ??
                        consumer.user.id.toLowerCase().includes(lowerSearchTerm),
                )
            })
        })
    }, [pins, searchTerm])

    // Create flattened data for pagination
    const flattenedData = useMemo(() => {
        const data: {
            pinId: string
            pinTitle: string
            locationId: string
            latitude: number
            longitude: number
            consumerId: string
            consumerEmail: string | null
            rowSpan?: number
        }[] = []

        filteredPins.forEach((pin) => {
            pin.locations.forEach((location) => {
                if (location.consumers.length > 0) {
                    location.consumers.forEach((consumer, idx) => {
                        data.push({
                            pinId: pin.id,
                            pinTitle: pin.title,
                            locationId: location.id,
                            latitude: location.latitude,
                            longitude: location.longitude,
                            consumerId: consumer.user.id,
                            consumerEmail: consumer.user.email,
                            rowSpan: idx === 0 ? location.consumers.length : undefined,
                        })
                    })
                } else {
                    data.push({
                        pinId: pin.id,
                        pinTitle: pin.title,
                        locationId: location.id,
                        latitude: location.latitude,
                        longitude: location.longitude,
                        consumerId: "",
                        consumerEmail: null,
                    })
                }
            })
        })

        return data
    }, [filteredPins])

    // Calculate pagination
    const totalPages = Math.ceil(flattenedData.length / itemsPerPage)
    const paginatedData = flattenedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    if (filteredPins.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No matching results</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search term to find what you{"'re"} looking for.</p>
            </div>
        )
    }

    return (
        <div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pin Details</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Consumer</TableHead>
                            <TableHead>Email</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((row, index) => (
                            <TableRow key={`${row.pinId}-${row.locationId}-${row.consumerId || "empty"}-${index}`}>
                                {row.rowSpan ? (
                                    <TableCell className="font-medium" rowSpan={row.rowSpan}>
                                        <div className="flex flex-col gap-1">
                                            <div className="font-medium">{row.pinTitle}</div>
                                            <div className="text-xs text-muted-foreground">ID: {row.pinId}</div>
                                        </div>
                                    </TableCell>
                                ) : row.rowSpan === undefined ? null : (
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                            <div className="font-medium">{row.pinTitle}</div>
                                            <div className="text-xs text-muted-foreground">ID: {row.pinId}</div>
                                        </div>
                                    </TableCell>
                                )}

                                {row.rowSpan ? (
                                    <TableCell rowSpan={row.rowSpan}>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs font-mono">
                                                {row.latitude.toFixed(6)} | {row.longitude.toFixed(6)}
                                            </span>
                                        </div>
                                    </TableCell>
                                ) : row.rowSpan === undefined ? null : (
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs font-mono">
                                                {row.latitude.toFixed(6)} | {row.longitude.toFixed(6)}
                                            </span>
                                        </div>
                                    </TableCell>
                                )}

                                <TableCell>
                                    {row.consumerId ? (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help font-mono text-xs">{addrShort(row.consumerId, 5)}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="font-mono text-xs">{row.consumerId}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">No consumers</span>
                                    )}
                                </TableCell>

                                <TableCell>
                                    {row.consumerEmail ? (
                                        <div className="flex items-center gap-1">
                                            <Mail className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs">{row.consumerEmail}</span>
                                        </div>
                                    ) : row.consumerId ? (
                                        <span className="text-xs text-muted-foreground">Stellar Login</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {Math.min(flattenedData.length, (currentPage - 1) * itemsPerPage + 1)} to{" "}
                        {Math.min(flattenedData.length, currentPage * itemsPerPage)} of {flattenedData.length} results
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Show pages around current page
                                let pageNum = currentPage
                                if (totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                } else {
                                    pageNum = currentPage - 2 + i
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => onPageChange(pageNum)}
                                    >
                                        {pageNum}
                                    </Button>
                                )
                            })}

                            {totalPages > 5 && currentPage < totalPages - 2 && (
                                <>
                                    <span className="text-muted-foreground">...</span>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(totalPages)}>
                                        {totalPages}
                                    </Button>
                                </>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function ReportDownloadMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Download Report
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <ReportDownload day={7}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Weekly Report (Last 7 days)
                    </ReportDownload>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <ReportDownload day={30}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Monthly Report (Last 30 days)
                    </ReportDownload>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <ReportDownload day={90}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Quarterly Report (Last 90 days)
                    </ReportDownload>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <ReportDownload day={0}>
                        <Calendar className="mr-2 h-4 w-4" />
                        All-Time Report
                    </ReportDownload>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function ReportDownload({
    day,
    children,
}: {
    day: number
    children?: React.ReactNode
}) {
    const [isDownloading, setIsDownloading] = useState(false)

    const download = api.maps.pin.downloadCreatorPinTConsumedByUser.useMutation({
        onSuccess: (data) => {
            DownloadPinLocationAsCSV(data)
            setIsDownloading(false)
        },
        onError: (error) => {
            toast.error(`Download failed: ${error.message}`)
            setIsDownloading(false)
        },
    })

    const handleDownload = () => {
        setIsDownloading(true)
        download.mutate({ day: day })
    }

    return (
        <Button variant="ghost" className="w-full justify-start" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : children}
        </Button>
    )
}

function DownloadPinLocationAsCSV(data: CreatorConsumedPin[]) {
    const csvContent = [
        [
            "pin_title",
            "pin_id",
            "start_date",
            "end_date",
            "location_id",
            "latitude",
            "longitude",
            "auto_collect",
            "consumer_name",
            "consumer_email",
        ], // CSV headers
        ...data.flatMap((pin) =>
            pin.locations.flatMap((location) =>
                (location.consumers ?? []).map((consumer: ConsumerType) => [
                    pin.title,
                    pin.id,
                    new Date(pin.startDate).toISOString(),
                    new Date(pin.endDate).toISOString(),
                    location.id,
                    location.latitude,
                    location.longitude,
                    location.autoCollect,
                    consumer.user.name ?? "N/A",
                    consumer.user.email ?? "",
                ]),
            ),
        ),
    ]
        .map((e) => e.join(",")) // Convert each row into a comma-separated string
        .join("\n") // Combine all rows with newline characters

    // Create a Blob from the CSV data
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })

    // Create a link element and trigger a download
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `pin_locations_report_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Show success message
    toast.success("Report downloaded successfully")
}



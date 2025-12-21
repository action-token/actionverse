"use client"

import { Plus, Search, MapPin, Target, Trophy } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import type { sortOptionEnum } from "~/types/bounty/bounty-type"
import type { filterEnum } from "~/pages/bounty"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { useRouter } from "next/router"
import { useState } from "react"
import CreateBountyModal from "~/components/modal/create-bounty-modal"
import ScavengerHuntDialog from "~/components/modal/scavenger-hunt-modal"
import CreateLocationBasedBountyModal from "~/components/modal/create-locationbased-bounty"

export enum BountyTypeFilter {
    ALL = "ALL",
    GENERAL = "GENERAL",
    LOCATION_BASED = "LOCATION_BASED",
    SCAVENGER_HUNT = "SCAVENGER_HUNT",
}
export default function SearchAndSort({
    searchTerm,
    setSearchTerm,
    sortOption,
    setSortOption,
    filter,
    setFilter,
    typeFilter,
    setTypeFilter,
}: {
    searchTerm: string
    setSearchTerm: (value: string) => void
    sortOption: string
    setSortOption: (value: sortOptionEnum) => void
    filter: string
    setFilter?: (value: filterEnum) => void
    typeFilter: BountyTypeFilter
    setTypeFilter: (value: BountyTypeFilter) => void
}) {
    const router = useRouter()
    const [createBountyOpen, setCreateBountyOpen] = useState(false)
    const [scavengerHuntOpen, setScavengerHuntOpen] = useState(false)
    const [locationBasedOpen, setLocationBasedOpen] = useState(false)

    const handleCreateBountySelect = (value: string) => {
        switch (value) {
            case "general":
                setCreateBountyOpen(true)
                break
            case "scavenger":
                setScavengerHuntOpen(true)
                break
            case "location":
                setLocationBasedOpen(true)
                break
        }
    }

    return (
        <div className="bg-card rounded-lg shadow-sm p-5 m-4">
            <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold hidden md:block">
                        {router.pathname === "/organization/bounty" ? "Your Bounties" : "Discover Bounties"}
                    </h1>

                    {router.pathname === "/organization/bounty" && (
                        <Select onValueChange={handleCreateBountySelect}>
                            <SelectTrigger className="w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-sm transition-colors">
                                <SelectValue className="" placeholder="Create Bounty" />
                            </SelectTrigger>
                            <SelectContent className="min-w-[220px]">
                                <SelectItem value="general" className="cursor-pointer">
                                    <div className="flex items-center gap-3 py-1">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                        <span className="font-medium">Create Bounty</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="scavenger" className="cursor-pointer">
                                    <div className="flex items-center gap-3 py-1">
                                        <Target className="h-4 w-4 text-red-500" />
                                        <span className="font-medium">Create Scavenger Hunt</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="location" className="cursor-pointer">
                                    <div className="flex items-center gap-3 py-1">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">Create Location Based</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Input
                            type="search"
                            placeholder="Search bounties..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                        />
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>

                    <Select value={sortOption} onValueChange={(value: sortOptionEnum) => setSortOption(value)}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DATE_DESC">Newest First</SelectItem>
                            <SelectItem value="DATE_ASC">Oldest First</SelectItem>
                            <SelectItem value="PRICE_DESC">Highest Prize</SelectItem>
                            <SelectItem value="PRICE_ASC">Lowest Prize</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {setFilter && (
                        <Tabs value={filter} onValueChange={(value) => setFilter(value as filterEnum)} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="ALL">All</TabsTrigger>
                                <TabsTrigger value="NOT_JOINED">Not Joined</TabsTrigger>
                                <TabsTrigger value="JOINED">Joined</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}

                    {setTypeFilter && typeFilter && (
                        <Tabs
                            value={typeFilter}
                            onValueChange={(value) => setTypeFilter(value as BountyTypeFilter)}
                            className="w-full md:w-auto"
                        >
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="ALL">All Types</TabsTrigger>
                                <TabsTrigger value="GENERAL">
                                    General <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                                <TabsTrigger value="LOCATION_BASED">
                                    Location <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                                <TabsTrigger value="SCAVENGER_HUNT">
                                    Scavenger <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </div>
            </div>

            <CreateBountyModal open={createBountyOpen} onOpenChange={setCreateBountyOpen} />
            <ScavengerHuntDialog open={scavengerHuntOpen} onOpenChange={setScavengerHuntOpen} />
            <CreateLocationBasedBountyModal open={locationBasedOpen} onOpenChange={setLocationBasedOpen} />
        </div>
    )
}

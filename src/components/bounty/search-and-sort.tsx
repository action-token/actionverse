"use client"

import { Plus, Search, ChevronDown, MapPin, Target, Trophy } from "lucide-react"
import { Input } from "~/components/shadcn/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select"
import type { sortOptionEnum } from "~/types/bounty/bounty-type"
import { Button } from "~/components/shadcn/ui/button"
import type { filterEnum } from "~/pages/bounty"
import { useCreateBountyStore } from "../store/create-bounty-store"
import { useScavengerHuntModalStore } from "../store/scavenger-hunt-modal-store"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "~/components/shadcn/ui/dropdown-menu"
import { useCreateLocationBasedBountyStore } from "../store/create-locationbased-bounty-store"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { useRouter } from "next/router"
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
    const { setIsOpen } = useCreateBountyStore()
    const { setIsOpen: setIsOpenScavengerModal } = useScavengerHuntModalStore()
    const { setIsOpen: setIsOpenLocationModal } = useCreateLocationBasedBountyStore()
    const router = useRouter()
    return (
        <div className="bg-card rounded-lg shadow-sm p-5 m-4">
            <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold hidden md:block">{
                        router.pathname === "/organization/bounty"
                            ? "Your Bounties"
                            : "Discover Bounties"
                    }</h1>

                    {!setFilter && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="ml-auto">
                                    <Plus className="h-4 w-4 mr-2" /> Create <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsOpen(true)} className="cursor-pointer">
                                    <Trophy className="h-4 w-4 mr-2" />
                                    <span>Create Bounty</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsOpenScavengerModal(true)} className="cursor-pointer">
                                    <Target className="h-4 w-4 mr-2" />
                                    <span>Create Scavenger Hunt</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setIsOpenLocationModal(true)} className="cursor-pointer">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    <span>Create Location Based</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                            onValueChange={(value) => setTypeFilter(
                                value as BountyTypeFilter,
                            )}
                            className="w-full md:w-auto"
                        >
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="ALL">All Types</TabsTrigger>
                                <TabsTrigger value="GENERAL">General  <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                                <TabsTrigger value="LOCATION_BASED">Location <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                                <TabsTrigger value="SCAVENGER_HUNT">Scavenger <p className="hidden md:block">&nbsp;Bounty</p>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </div>
            </div>

        </div>
    )
}

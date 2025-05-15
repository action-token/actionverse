"use client"

import { useEffect, useState } from "react"
import BountyList from "~/components/bounty/bounty-list"
import BountySkeleton from "~/components/bounty/bounty-skeleton"
import SearchAndSort from "~/components/bounty/search-and-sort"
import { Button } from "~/components/shadcn/ui/button"
import { sortOptionEnum } from "~/types/bounty/bounty-type"
import { api } from "~/utils/api"

export enum filterEnum {
    ALL = "ALL",
    NOT_JOINED = "NOT_JOINED",
    JOINED = "JOINED",
}

export enum BountyTypeFilter {
    ALL = "ALL",
    GENERAL = "GENERAL",
    LOCATION_BASED = "LOCATION_BASED",
    SCAVENGER_HUNT = "SCAVENGER_HUNT",
}

const Bounty = () => {
    const [searchTerm, setSearchTerm] = useState("")
    const [sortOption, setSortOption] = useState<sortOptionEnum>(sortOptionEnum.DATE_DESC)
    const [filter, setFilter] = useState<filterEnum>(filterEnum.ALL)
    const [typeFilter, setTypeFilter] = useState<BountyTypeFilter>(BountyTypeFilter.ALL)
    const [scrolled, setScrolled] = useState(false)

    const debouncedSearchTerm = useDebounce(searchTerm, 500)

    const getAllBounty = api.bounty.Bounty.getAllBounties.useInfiniteQuery(
        {
            limit: 10,
            search: debouncedSearchTerm,
            sortBy: sortOption,
            filter: filter,
            bountyType: typeFilter !== BountyTypeFilter.ALL ? typeFilter : undefined,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )

    return (
        <div className="flex h-screen w-full flex-col relative">
            {/* Fixed header with search and filters */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4">
                <SearchAndSort
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    sortOption={sortOption}
                    setSortOption={setSortOption}
                    filter={filter}
                    setFilter={setFilter}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6">
                {/* Loading state */}
                {getAllBounty.isLoading && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 5 }, (_, index: number) => (
                            <BountySkeleton key={index} />
                        ))}
                    </div>
                )}

                {/* Bounty list */}
                <div className="mb-6">
                    {getAllBounty.data?.pages.map((page) => (
                        <BountyList key={page.nextCursor} bounties={page.bounties} />
                    ))}
                </div>

                {/* Load more button - centered at the bottom */}
                {getAllBounty.hasNextPage && (
                    <div className="flex justify-center pb-8">
                        <Button
                            className="w-full max-w-md"
                            onClick={() => void getAllBounty.fetchNextPage()}
                            disabled={getAllBounty.isFetchingNextPage}
                        >
                            {getAllBounty.isFetchingNextPage ? (
                                <div className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin h-4 w-4 mr-2"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Loading more...
                                </div>
                            ) : (
                                "Load More"
                            )}
                        </Button>
                    </div>
                )}

                {/* Empty state */}
                {!getAllBounty.isLoading && getAllBounty.data?.pages[0]?.bounties.length === 0 && (
                    <div className="flex h-40 items-center justify-center">
                        <div className="text-center">
                            <div className="mb-4 flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-muted-foreground"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <p className="text-lg font-medium">No bounties found</p>
                            <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

export default Bounty

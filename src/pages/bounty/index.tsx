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

const Bounty = () => {
    const [searchTerm, setSearchTerm] = useState("")
    const [sortOption, setSortOption] = useState<sortOptionEnum>(sortOptionEnum.DATE_DESC)
    const [filter, setFilter] = useState<filterEnum>(filterEnum.ALL)

    const debouncedSearchTerm = useDebounce(searchTerm, 500)

    const getAllBounty = api.bounty.Bounty.getAllBounties.useInfiniteQuery(
        {
            limit: 10,
            search: debouncedSearchTerm,
            sortBy: sortOption,
            filter: filter,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )

    return (
        <div className="flex h-full w-full flex-col">
            {/* Fixed header with search and filters */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4">
                <SearchAndSort
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    sortOption={sortOption}
                    setSortOption={setSortOption}
                    filter={filter}
                    setFilter={setFilter}
                />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
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
                            variant="accent"
                            className="w-full max-w-md shadow-sm"
                            onClick={() => void getAllBounty.fetchNextPage()}
                            disabled={getAllBounty.isFetchingNextPage}
                        >
                            {getAllBounty.isFetchingNextPage ? "Loading more..." : "Load More"}
                        </Button>
                    </div>
                )}

                {/* Empty state */}
                {!getAllBounty.isLoading && getAllBounty.data?.pages[0]?.bounties.length === 0 && (
                    <div className="flex h-40 items-center justify-center">
                        <p className="text-muted-foreground">No bounties found. Try adjusting your filters.</p>
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

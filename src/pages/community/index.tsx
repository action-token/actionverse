"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Plus } from "lucide-react"

import { BetaBadge } from "~/components/common/beta-badge"
import { Button } from "~/components/shadcn/ui/button"
import { api } from "~/utils/api"
import { CommunityCard } from "~/components/community/community-card"
import { CommunitySkeletonGrid } from "~/components/community/community-skeleton"
import { CommunitySearchFilter } from "~/components/community/community-search-filter"
import { CommunitySidebar } from "~/components/community/community-sidebar"
import { CreateCommunityModal } from "~/components/modal/create-community-modal"
import { useCommunityModalStore } from "~/components/store/community-modal-store"
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store"

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const CommunityPage = () => {
  const { data: session } = useSession()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [filter, setFilter] = useState<"ALL" | "TOKEN_GATED" | "OPEN">("ALL")
  const { setIsOpen } = useCommunityModalStore()
  const { setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore()

  const communities = api.community.community.getAll.useInfiniteQuery(
    {
      limit: 20,
      search: debouncedSearch || undefined,
      filter,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  return (
    <div className="flex h-[calc(100vh-11vh)]  w-full flex-col">
      {/* Header */}
      <div className="border-b bg-secondary px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Communities</h1>
            <BetaBadge />
          </div>
          <Button
            onClick={() => session?.user ? setIsOpen(true) : setLoginModalOpen(true)}
            className="gap-2 rounded-full px-5"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
        <div className="mt-4">
          <CommunitySearchFilter
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </div>

      {/* Content area: main scrollable + fixed sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main scrollable area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {communities.isLoading && <CommunitySkeletonGrid />}

          {communities.data && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {communities.data.pages.flatMap((page) =>
                  page.communities.map((community) => (
                    <CommunityCard
                      key={community.id}
                      community={community}
                    />
                  )),
                )}
              </div>

              {communities.data.pages[0]?.communities.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Plus className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium">No communities found</p>
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? "Try a different search term"
                      : "Be the first to create a community!"}
                  </p>
                  {!search && (
                    <Button
                      onClick={() => session?.user ? setIsOpen(true) : setLoginModalOpen(true)}
                      className="mt-2 gap-2 rounded-full px-6"
                    >
                      <Plus className="h-4 w-4" />
                      Create Community
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {communities.hasNextPage && (
            <div className="flex justify-center py-8">
              <Button
                variant="outline"
                className="rounded-full px-8"
                onClick={() => void communities.fetchNextPage()}
                disabled={communities.isFetchingNextPage}
              >
                {communities.isFetchingNextPage
                  ? "Loading..."
                  : "Load More"}
              </Button>
            </div>
          )}
        </div>

        {/* Right sidebar - independent scroll */}
        <div className="hidden w-80 shrink-0 overflow-y-auto border-l p-4 lg:block">
          <CommunitySidebar />
        </div>
      </div>

      <CreateCommunityModal />
    </div>
  )
}

export default CommunityPage

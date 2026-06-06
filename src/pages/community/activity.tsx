"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Button } from "~/components/shadcn/ui/button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { api } from "~/utils/api"
import { ActivityFeedItem } from "~/components/community/activity-feed-item"

const CommunityActivityPage = () => {
  const activities = api.community.activity.getMyActivity.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/community">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Community Activity</h1>
      </div>

      <div className="space-y-1">
        {activities.isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))
          : activities.data?.pages.flatMap((page) =>
              page.activities.map((activity) => (
                <ActivityFeedItem key={activity.id} activity={activity} />
              )),
            )}

        {activities.data?.pages[0]?.activities.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">
              No activity yet. Join some communities to see activity here!
            </p>
          </div>
        )}

        {activities.hasNextPage && (
          <div className="flex justify-center py-6">
            <Button
              variant="outline"
              onClick={() => void activities.fetchNextPage()}
              disabled={activities.isFetchingNextPage}
            >
              {activities.isFetchingNextPage ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommunityActivityPage

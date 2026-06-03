"use client"

import { useState } from "react"
import { api } from "~/utils/api"
import Link from "next/link"
import { TrendingUp, Activity, Bookmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Button } from "~/components/shadcn/ui/button"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { ActivityFeedItem } from "./activity-feed-item"
import { useSession } from "next-auth/react"

export function CommunitySidebar() {
  const { data: session } = useSession()

  return (
    <div className="space-y-6">
      <TrendingCommunitiesWidget />
      {session?.user && (
        <>
          <RecentActivityWidget />
          <MyCommunitiesWidget />
        </>
      )}
    </div>
  )
}

function TrendingCommunitiesWidget() {
  const { data, isLoading } = api.community.community.getTrending.useQuery({
    limit: 5,
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          Trending Communities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </div>
            </div>
          ))
          : data?.map((community) => (
            <Link
              key={community.id}
              href={`/community/${community.id}`}
              className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={community.profileUrl} />
                <AvatarFallback className="text-xs">
                  {community.title.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {community.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {community._count.members} members
                </p>
              </div>
            </Link>
          ))}
        {data?.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            No communities yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RecentActivityWidget() {
  const { data, isLoading } = api.community.activity.getMyActivity.useQuery({
    limit: 3,
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))
        ) : data?.activities && data.activities.length > 0 ? (
          <>
            {data.activities.map((activity) => (
              <ActivityFeedItem key={activity.id} activity={activity} />
            ))}
            <Link href="/community/activity">
              <Button variant="ghost" size="sm" className="mt-1 w-full text-xs">
                View all activity
              </Button>
            </Link>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            No recent activity
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MyCommunitiesWidget() {
  const { data, isLoading } =
    api.community.community.getMyCommunities.useQuery()
  const [filter, setFilter] = useState<"all" | "owned" | "joined">("all")

  const owned = data?.owned ?? []
  const joined = data?.joined ?? []
  const all = [...owned, ...joined]
  const communities =
    filter === "owned"
      ? owned
      : filter === "joined"
        ? joined
        : all

  const emptyMessage =
    filter === "owned"
      ? "No owned communities yet"
      : filter === "joined"
        ? "No joined communities yet"
        : "Not a member of any community yet"

  return (
    <Card>
      <CardHeader className="pb-3 px-2">
        <div className="flex  items-center justify-between gap-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bookmark className="h-4 w-4" />
            My Communities
          </CardTitle>
          <div className="flex items-center gap-1">
            {(
              [
                { key: "all", label: "All" },
                { key: "owned", label: "Owned" },
                { key: "joined", label: "Joined" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.key}
                variant={filter === tab.key ? "default" : "ghost"}
                size="sm"
                className="h-5 px-1 text-[10px] "
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))
        ) : communities.length > 0 ? (
          communities.slice(0, 5).map((community) => (
            <Link
              key={community.id}
              href={`/community/${community.id}`}
              className="flex items-center justify-between rounded-lg p-1.5 hover:bg-muted"
            >
              <span className="truncate text-sm">{community.title}</span>
              <span className="text-xs text-muted-foreground">
                {community._count.members}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

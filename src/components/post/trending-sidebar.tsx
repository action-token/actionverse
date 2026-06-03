"use client"
import { Button } from "~/components/shadcn/ui/button"
import { api } from "~/utils/api"
import CustomAvatar from "../common/custom-avatar"
import { clientsign } from "package/connect_wallet"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { clientSelect } from "~/lib/stellar/fan/utils"
import useNeedSign from "~/lib/hook"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Edit, Loader2, UserRoundPlus } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

export default function TrendingSidebar() {

    // Use infinite query for trending creators
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
        api.fan.creator.getTrandingCreators.useInfiniteQuery(
            { limit: 5 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        )

    // Flatten the pages data for rendering
    const creators = data?.pages.flatMap((page) => page.creators) ?? []

    // Mutations
    const follow = api.fan.member.followCreator.useMutation({
        onSuccess: () => {
            toast.success("Creator Followed")
        },
        onError: (e) => toast.error("Failed to follow creator"),
    })


    const handleFollowClick = (creatorId: string) => {
        follow.mutate({ creatorId: creatorId })
    }



    // Loading state for initial data fetch
    if (isLoading) {
        return (
            <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="rounded-lg p-3 shadow-sm animate-pulse">
                        <CardContent className="p-0">
                            <div className="mb-2 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-200" />
                                <div className="space-y-2">
                                    <div className="h-4 w-24 rounded bg-gray-200" />
                                    <div className="h-3 w-16 rounded bg-gray-200" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-1 overflow-y-auto h-full">
            {creators.map((creator) => (
                <div key={creator.id} className=" border-b-[1.5px]  p-1 shadow-sm">
                    <div className="p-0">
                        <div className="flex items-center  gap-2">
                            <Link
                                href={`/organization/${creator.id}`}
                            >
                                <CustomAvatar url={creator.profileUrl} />
                            </Link>
                            <div className="flex items-center justify-between gap-2 w-full">
                                <Link
                                    href={`/organization/${creator.id}`}
                                >
                                    <p className="font-medium">{creator.name}</p>
                                    <p className="text-xs text-gray-500">{creator._count.temporalFollows} followers</p>
                                </Link>
                                {creator.isCurrentUser ? (
                                    <Button variant="ghost" size="sm" className="">
                                        <Edit />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className=" shadow-sm shadow-foreground"
                                        onClick={() => handleFollowClick(creator.id)}

                                        disabled={follow.isLoading}
                                    >
                                        {follow.isLoading && follow.variables?.creatorId === creator.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                        ) : (
                                            <UserRoundPlus className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            ))}

            {hasNextPage && (
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                >
                    {isFetchingNextPage ? (
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : (
                        "Load More"
                    )}
                </Button>
            )}
        </div>
    )
}


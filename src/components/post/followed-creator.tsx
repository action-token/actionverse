"use client"

import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { api } from "~/utils/api"
import CustomAvatar from "../common/custom-avatar"
import { useToast } from "~/hooks/use-toast"
import { Loader2, UserX } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function CreatorSidebar() {
    const toast = useToast()
    const [unFollowLoadingId, setUnFollowLoadingId] = useState("")
    const unFollow = api.fan.member.unFollowCreator.useMutation({
        onSuccess: async () => {
            toast.toast({
                title: "Creator Unfollowed",
                variant: "default",
            })
        },
        onError: (e) =>
            toast.toast({
                title: "Failed to unfollow creator",
                variant: "destructive",
            }),
    })

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.fan.creator.getFollowedCreators.useInfiniteQuery(
            { limit: 3 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        )

    // Flatten the pages data for rendering
    const followedCreators = data?.pages.flatMap((page) => page.creators) ?? []

    return (
        <div className="space-y-1">
            {
                followedCreators.length === 0 && (
                    <p className="text-sm  text-center">You are not following any creator</p>
                )
            }
            {followedCreators.map((creator) => (
                <div
                    key={creator.id}
                    className=" border-b-[1.5px]  p-1 shadow-sm  "
                >
                    <div className="p-0">
                        <div className="flex items-center  gap-2">
                            <Link href={`/organization/${creator.id}`}>
                                <CustomAvatar url={creator.profileUrl} />
                            </Link>


                            <div className="flex items-center justify-between gap-2 w-full">
                                <Link href={`/organization/${creator.id}`}>
                                    <p className="text-sm font-medium truncate">{creator.name}</p>
                                </Link>
                                <Button
                                    onClick={() => {
                                        unFollow.mutate({ creatorId: creator.id })
                                        setUnFollowLoadingId(creator.id)
                                    }}
                                    variant="destructive"
                                    size="sm"
                                    className=" shadow-sm shadow-foreground"
                                    disabled={unFollow.isLoading}
                                >
                                    {unFollow.isLoading && unFollowLoadingId === creator.id ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />

                                        </div>
                                    ) : (
                                        <UserX className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                        </div>
                    </div>
                </div>


            ))}
            {hasNextPage && (
                <Button
                    size="sm"
                    variant="link"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                >
                    {isFetchingNextPage ? "Loading..." : "Load More"}
                </Button>
            )}
        </div>
    )
}


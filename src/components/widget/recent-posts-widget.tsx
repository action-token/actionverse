"use client"
import { Badge } from "~/components/shadcn/ui/badge"
import { Button } from "~/components/shadcn/ui/button"
import { ImageIcon, Lock, MessageSquare, Plus, ThumbsUp } from "lucide-react"
import { api } from "~/utils/api"
import { Creator, CreatorPageAsset } from "@prisma/client"
import { useSession } from "next-auth/react"
import PostCard from "../post/post-card"
import { Skeleton } from "../shadcn/ui/skeleton"
import { useCreatePostModalStore } from "../store/create-post-modal-store"
import React from "react"
import { Card, CardContent, CardHeader } from "~/components/shadcn/ui/card"
import { CreatorWithPageAsset } from "~/types/organization/dashboard"

interface RecentPostsWidgetProps {
    editMode?: boolean
    creatorData: CreatorWithPageAsset
}


export default function RecentPostsWidget({ editMode, creatorData }: RecentPostsWidgetProps) {
    const session = useSession()
    const { setIsOpen: setIsPostModalOpen } = useCreatePostModalStore()

    const allCreatedPost = api.fan.post.getPosts.useInfiniteQuery(
        {
            pubkey: session.data?.user.id ?? "",
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,

        },
    )

    return (
        <Card className="rounded-none  ">
            <CardHeader className="w-full sticky top-0 z-50 bg-secondary border-b-2 p-2 md:p-4 ">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Your Posts</h2>
                    {
                        (allCreatedPost.data?.pages[0]?.posts?.length ?? 0) > 0 && (
                            <div className="flex justify-between items-center">
                                <Button size="sm" onClick={() => setIsPostModalOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create New Post
                                </Button>
                            </div>
                        )
                    }
                </div>
            </CardHeader>

            <CardContent className="p-0   overflow-y-auto">

                <div className=" flex flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md ">
                    {allCreatedPost.isLoading && (
                        <div className="space-y-4 ">
                            {[1, 2].map((i) => (
                                <Card key={i} className="overflow-hidden">
                                    <CardHeader>
                                        <Skeleton className="h-6 w-1/3 mb-2" />
                                        <Skeleton className="h-4 w-1/4" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-4 w-full mb-2" />
                                        <Skeleton className="h-4 w-full mb-2" />
                                        <Skeleton className="h-4 w-2/3 mb-4" />
                                        <Skeleton className="h-48 w-full rounded-md mb-4" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {allCreatedPost.data?.pages.map((page, i) => (
                        <React.Fragment key={i}>


                            {page.posts.map((post) => (

                                <PostCard
                                    key={post.id}
                                    post={post}
                                    creator={post.creator}
                                    likeCount={post._count.likes}
                                    commentCount={post._count.comments}
                                    locked={post.subscription ? true : false}
                                    show={true}
                                    media={post.medias}
                                />

                            ))}
                        </React.Fragment>
                    ))}

                    {allCreatedPost.hasNextPage && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => allCreatedPost.fetchNextPage()}
                            disabled={allCreatedPost.isFetchingNextPage}
                        >
                            {allCreatedPost.isFetchingNextPage ? "Loading more..." : "Load More Posts"}
                        </Button>
                    )}

                    {allCreatedPost.data?.pages[0]?.posts.length === 0 && (
                        <div className="h-full flex items-center justify-center flex-col text-lg font-bold">
                            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Posts Yet</h3>
                            <p className="text-muted-foreground mb-4">Start creating content for your followers</p>
                            <Button onClick={() => setIsPostModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Post
                            </Button>
                        </div>
                    )}
                </div>

            </CardContent>

        </Card>
    )
}

"use client"
import { Button } from "~/components/shadcn/ui/button"
import { api } from "~/utils/api"
import CustomAvatar from "../common/custom-avatar"
import { useToast } from "~/hooks/use-toast"
import { clientsign } from "package/connect_wallet"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { clientSelect } from "~/lib/stellar/fan/utils"
import useNeedSign from "~/lib/hook"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Loader2, UserRoundPlus } from "lucide-react"

export default function TrendingSidebar() {
    const session = useSession()
    const { needSign } = useNeedSign()
    const { toast } = useToast()

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
            toast({
                title: "Creator Followed",
                variant: "default",
            })
            refetch()
        },
        onError: (e) =>
            toast({
                title: "Failed to follow creator",
                variant: "destructive",
            }),


    })



    const followXDR = api.fan.trx.followCreatorTRX.useMutation({
        onSuccess: async (xdr, variables) => {
            if (xdr) {
                if (xdr === true) {
                    toast({
                        title: "User already has trust in page asset",
                        variant: "default",
                    })
                    follow.mutate({ creatorId: variables.creatorId })
                } else {
                    try {
                        const res = await clientsign({
                            presignedxdr: xdr,
                            pubkey: session.data?.user.id,
                            walletType: session.data?.user.walletType,
                            test: clientSelect(),
                        })

                        if (res) {
                            follow.mutate({ creatorId: variables.creatorId })
                        } else
                            toast({
                                title: "Transaction failed while signing.",
                                variant: "destructive",
                            })
                    } catch (e) {
                        toast({
                            title: "Transaction failed while signing.",
                            variant: "destructive",
                        })
                    } finally {
                    }
                }
            } else {
                toast({
                    title: "Transaction failed while signing.",
                    variant: "destructive",
                })
            }
        },
        onError: (e) =>
            toast({
                title: "Transaction failed while signing.",
                variant: "destructive",
            }),
    })

    // Loading state for initial data fetch
    if (isLoading) {
        return (
            <div className="space-y-2">
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
        <div className="space-y-2 overflow-auto h-full">
            {creators.map((creator) => (
                <Card key={creator.id} className="rounded-lg p-3 shadow-sm">
                    <CardContent className="p-0">
                        <div className="mb-2 flex items-center gap-3">
                            <CustomAvatar url={creator.profileUrl} />
                            <div className="flex items-center justify-between gap-2 w-full">
                                <div>
                                    <p className="font-medium">{creator.name}</p>
                                    <p className="text-xs text-gray-500">{creator._count.followers} followers</p>
                                </div>
                                {creator.isCurrentUser ? (
                                    <Button variant="ghost" size="sm" className="w-full">
                                        Edit Profile
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className=" shadow-sm shadow-foreground"
                                        onClick={() =>
                                            followXDR.mutate({
                                                creatorId: creator.id,
                                                signWith: needSign(),
                                            })
                                        }
                                        disabled={followXDR.isLoading}
                                    >
                                        {followXDR.isLoading && followXDR.variables?.creatorId === creator.id ? (
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

                    </CardContent>
                </Card>
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


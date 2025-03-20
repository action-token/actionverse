"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tabs, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Button } from "~/components/shadcn/ui/button"
import { Lock, Globe, ChevronUp, ChevronDown, Users, Bell, Bookmark, Home, Search } from "lucide-react"
import { api } from "~/utils/api"
import { getAssetBalanceFromBalance } from "~/lib/stellar/marketplace/test/acc"

import { useMediaQuery } from "~/hooks/use-media-query"
import PostCard from "~/components/post/post-card"
import TrendingSidebar from "~/components/post/trending-sidebar"
import CreatorSidebar from "~/components/post/followed-creator"
import CreatorLayout from "~/components/layout/root/CreatorLayout"
import { useSession } from "next-auth/react"

enum TabEnum {
    All = "all",
    Public = "public",
    Locker = "locker",
}

export default function UserNewsFeedContent() {
    const [activeTab, setActiveTab] = useState<TabEnum>(TabEnum.All)
    const [isScrolled, setIsScrolled] = useState(false)
    const isDesktop = useMediaQuery("(min-width: 1024px)")
    const session = useSession()
    const posts = api.fan.post.getAllRecentPosts.useInfiniteQuery(
        {
            limit: 5,
        },
        {
            getNextPageParam: (lastPage) => {
                return lastPage.nextCursor
            },
            refetchOnWindowFocus: false,
        },
    )

    const accBalances = api.wallate.acc.getUserPubAssetBallances.useQuery(undefined, {
        enabled: !!session.data?.user?.id,
    })

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <CreatorLayout>
            <div className="flex  ">

                <div className="flex-1 max-w-5xl mx-auto px-4 py-6">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mb-6"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">News Feed</h1>
                                <p className="text-gray-600 dark:text-gray-400">Check out the latest stories and posts</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className={`sticky ${isScrolled
                            ? "top-0 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 py-3 shadow-sm"
                            : "top-0 z-10 py-1"
                            } transition-all duration-300`}
                    >
                        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setActiveTab(value as TabEnum)}>
                            <TabsList className="grid grid-cols-3 w-full">
                                <TabsTrigger value="all">All Posts</TabsTrigger>
                                <TabsTrigger value="public" className="flex items-center gap-1">
                                    <Globe className="w-4 h-4" /> Public
                                </TabsTrigger>
                                <TabsTrigger value="locker" className="flex items-center gap-1">
                                    <Lock className="w-4 h-4" /> Locked
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </motion.div>

                    <AnimatePresence initial={false} mode="sync">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{
                                duration: 0.2,
                                // Smoother animation with spring physics
                                type: "spring",
                                stiffness: 100,
                                damping: 15,
                            }}
                            className="space-y-6 mt-6"
                        >
                            {posts.data?.pages.map((page, pageIndex) => (
                                <div key={`page-${pageIndex}`} className="space-y-6">
                                    {page.posts.length === 0 && <p className="text-center py-8 ">There are no posts yet</p>}
                                    {page.posts
                                        .filter((post) => {
                                            if (activeTab === TabEnum.All) return true
                                            if (activeTab === TabEnum.Public) return !post.subscription
                                            if (activeTab === TabEnum.Locker) return !!post.subscription
                                            return true
                                        })
                                        .map((post, index) => {
                                            const locked = !!post.subscription

                                            // Determine if user has access to this content
                                            let hasAccess = !locked // Public posts are always accessible

                                            if (locked && post.subscription) {
                                                let pageAssetCode: string | undefined
                                                let pageAssetIssuer: string | undefined

                                                const customPageAsset = post.creator.customPageAssetCodeIssuer
                                                const pageAsset = post.creator.pageAsset

                                                if (pageAsset) {
                                                    pageAssetCode = pageAsset.code
                                                    pageAssetIssuer = pageAsset.issuer
                                                } else if (customPageAsset) {
                                                    const [code, issuer] = customPageAsset.split("-")
                                                    pageAssetCode = code
                                                    pageAssetIssuer = issuer
                                                }

                                                const bal = getAssetBalanceFromBalance({
                                                    balances: accBalances.data,
                                                    code: pageAssetCode,
                                                    issuer: pageAssetIssuer,
                                                })

                                                hasAccess = post.subscription.price <= (bal || 0) ||
                                                    post.creatorId === session.data?.user?.id
                                            }

                                            return (
                                                <PostCard
                                                    key={post.id}
                                                    post={post}
                                                    creator={post.creator}
                                                    likeCount={post._count.likes}
                                                    commentCount={post._count.comments}
                                                    locked={locked}
                                                    show={hasAccess}
                                                    media={post.medias}
                                                />
                                            )
                                        })}
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {posts.hasNextPage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="mt-8 flex justify-center"
                        >
                            <Button
                                onClick={() => void posts.fetchNextPage()}
                                variant="outline"
                                className="gap-2"
                                disabled={posts.isFetching}
                            >
                                {posts.isFetching ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                                Load More
                            </Button>
                        </motion.div>
                    )}

                    <AnimatePresence>
                        {isScrolled && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="fixed bottom-6 right-6"
                            >
                                <Button
                                    size="icon"
                                    className="rounded-full shadow-lg"
                                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>



            </div>
        </CreatorLayout>
    )
}


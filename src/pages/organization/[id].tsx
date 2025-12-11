"use client"

import React, { useEffect } from "react"
import { useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import {
    ImageIcon,
    Grid3X3,
    Calendar,
    Twitter,
    Instagram,
    Globe,
    CheckCircle2,
    Heart,
    Share2,
    ChevronUp,
    ChevronDown,
    Menu,
    Users,
    X,
} from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Separator } from "~/components/shadcn/ui/separator"
import { cn } from "~/lib/utils"
import { api } from "~/utils/api"
import ArtistProfileSkeleton from "~/components/creator/artist-profile-loading"
import NotFound from "~/pages/404"
import CustomAvatar from "~/components/common/custom-avatar"
import { useSession } from "next-auth/react"
import PostCard from "~/components/post/post-card"
import toast from "react-hot-toast"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { MoreAssetsSkeleton } from "~/components/common/grid-loading"
import MarketAssetComponent from "~/components/common/market-asset"
import { getAssetBalanceFromBalance } from "~/lib/stellar/marketplace/test/acc"
import { clientsign } from "package/connect_wallet"
import { clientSelect } from "~/lib/stellar/fan/utils"
import FollowCreatorButton from "~/components/creator/follow-creator-button"

export default function ArtistProfile() {
    const router = useRouter();
    const { id } = router.query as { id: string };


    const session = useSession()
    const [activeTab, setActiveTab] = useState("posts")
    const contentRef = useRef<HTMLDivElement>(null)
    const [isScrolled, setIsScrolled] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)
    const [showShareOptions, setShowShareOptions] = useState(false)
    const [singLoading, setSingLoading] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [expandedPackage, setExpandedPackage] = useState<number | null>(null)
    // API calls
    const creator = api.fan.creator.getCreator.useQuery({ id: id ?? "" })
    const subscriptionPackages = api.fan.creator.getCreatorPackages.useQuery({ id: id ?? "" })
    const isFollowing = api.fan.member.isFollower.useQuery({ creatorId: id ?? "" })
    const accBalances = api.wallate.acc.getUserPubAssetBallances.useQuery(undefined, {
        enabled: !!session.data?.user?.id,
    })

    const allCreatedPost = api.fan.post.getPosts.useInfiniteQuery(
        {
            pubkey: id ?? "",
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
            enabled: !!creator.data,
        },
    )

    const creatorNFT = api.marketplace.market.getCreatorNftsByCreatorID.useInfiniteQuery(
        { limit: 10, creatorId: id ?? "" },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
    )
    // Toggle sidebar on mobile
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen)
    }


    const togglePackageExpansion = (id: number) => {
        if (expandedPackage === id) {
            setExpandedPackage(null)
        } else {
            setExpandedPackage(id)
        }
    }
    useEffect(() => {
        const handleScroll = () => {
            console.log("calling")
            if (contentRef.current) {
                const scrollPosition = contentRef.current.scrollTop
                const scrollThreshold = 100

                if (scrollPosition > scrollThreshold) {
                    setIsScrolled(true)
                    setScrollProgress(Math.min(1, (scrollPosition - scrollThreshold) / 50))
                } else {
                    setIsScrolled(false)
                    setScrollProgress(0)
                }
            }
        }

        // Add event listener to the content div instead of window
        const currentContentRef = contentRef.current
        if (currentContentRef) {
            currentContentRef.addEventListener("scroll", handleScroll)
        }

        // Clean up
        return () => {
            if (currentContentRef) {
                currentContentRef.removeEventListener("scroll", handleScroll)
            }
        }
    }, [id, contentRef.current])
    // Handle share
    const handleShare = () => {
        if (navigator.share) {
            navigator
                .share({
                    title: `${creator.data?.name} | Artist Profile`,
                    url: window.location.href,
                })
                .catch((err) => {
                    console.error("Error sharing:", err)
                })
        } else {
            setShowShareOptions(!showShareOptions)
            if (!showShareOptions) {
                navigator.clipboard.writeText(window.location.href)
                toast.success("Profile link copied to clipboard!")
            }
        }
    }

    if (creator.isLoading) {
        return <ArtistProfileSkeleton />
    }

    if (!creator.data) {
        return <NotFound />
    }

    return (
        <div className="flex flex-col h-screen   bg-background">
            {/* Header with Cover Image */}
            <div className="w-full relative transition-all duration-500"
                style={{
                    height: isScrolled ? "0px" : "200px",

                }}
            >
                <div className="relative w-full h-full">
                    <Image
                        src={
                            creator.data.coverUrl?.length === 0 || creator.data.coverUrl === null
                                ? "/placeholder.svg?height=400&width=1200"
                                : creator.data.coverUrl
                        }
                        alt={`${creator.data.name}'s cover`}
                        fill
                        className="object-cover"
                        priority
                    />


                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 md:hidden z-20 text-white hover:bg-background/20"
                        onClick={toggleSidebar}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>


                    <header
                        className={cn(
                            "absolute top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-primary/20 shadow-md h-14 transition-all duration-500 flex items-center justify-between px-4",
                            isScrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
                        )}
                        style={{
                            transform: isScrolled ? `translateY(0)` : `translateY(-100%)`,
                            opacity: scrollProgress,
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <CustomAvatar url={creator.data.profileUrl} className="h-9 w-9 border-2 border-background" />
                            <div className="flex flex-col">
                                <span className="font-semibold text-sm flex items-center gap-1">
                                    {creator.data.name}
                                    {creator.data.approved && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                </span>

                            </div>

                        </div>
                        <Button variant="secondary" size="sm" className="gap-1" onClick={handleShare}>
                            <Share2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Share</span>
                        </Button>
                    </header>
                </div>
            </div>

            {/* Main Content Area with Responsive Sidebar */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Fixed on desktop, slide-in on mobile */}
                <div
                    className={cn(
                        "w-[300px] shrink-0 border-r bg-card h-full absolute md:relative transition-transform duration-500 z-20",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                    )}
                >
                    {/* Close button for mobile sidebar */}
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 md:hidden" onClick={toggleSidebar}>
                        <X className="h-5 w-5" />
                    </Button>

                    <div className="h-full flex flex-col p-6 overflow-auto">
                        <div className="flex flex-col items-center pt-4">
                            {/* Profile Image */}
                            <div className="relative">
                                <CustomAvatar
                                    url={creator.data?.profileUrl}
                                    className="h-24 w-24 border-4 border-background shadow-xl"
                                />

                                {creator.data.approved && (
                                    <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="mt-4 text-center w-full">
                                <h1 className="text-xl md:text-2xl font-bold flex items-center justify-center gap-1">
                                    {creator.data.name}
                                    {creator.data.approved && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                </h1>

                                <p className="mt-3 text-sm text-muted-foreground">
                                    {creator.data?.bio && creator.data.bio.length > 0 ? creator.data.bio : "No bio provided"}
                                </p>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Profile Stats */}
                        <div className="grid grid-cols-3 gap-2 w-full">
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.followers ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Followers</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.posts ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Posts</p>
                            </div>
                            <div className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                                <p className="text-xl font-bold">{creator.data._count.assets ?? 0}</p>
                                <p className="text-xs text-muted-foreground">NFTs</p>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        {/* Social Links */}
                        <div className="w-full space-y-3">
                            {creator.data.website && (
                                <div>
                                    <Link
                                        href={creator.data.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        <Globe className="h-4 w-4 mr-2" />
                                        <span>{creator.data.website.replace(/(^\w+:|^)\/\//, "")}</span>
                                    </Link>
                                </div>
                            )}
                            {creator.data.twitter && (
                                <div>
                                    <Link
                                        href={`https://twitter.com/${creator.data.twitter}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                                    >
                                        <Twitter className="h-4 w-4 mr-2" />
                                        <span>@{creator.data.twitter}</span>
                                    </Link>
                                </div>
                            )}
                            {creator.data.instagram && (
                                <div>
                                    <Link
                                        href={`https://instagram.com/${creator.data.instagram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center text-sm text-muted-foreground hover:text-[#E1306C] transition-colors"
                                    >
                                        <Instagram className="h-4 w-4 mr-2" />
                                        <span>@{creator.data.instagram}</span>
                                    </Link>
                                </div>
                            )}

                            <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-2" />
                                <span>Joined {new Date(creator.data.joinedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overlay for mobile sidebar */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-10 md:hidden" onClick={toggleSidebar} />
                )}

                {/* Right Content Area - Scrollable */}
                <div className="flex-1 relative"
                    onScroll={(e) => {
                        console.log(e.currentTarget.scrollTop)
                        if (e.currentTarget.scrollTop > 100) {
                            setShowShareOptions(false)
                        }
                    }
                    }
                >
                    <div ref={contentRef} className="absolute inset-0 overflow-auto">
                        <div className="p-6 pb-20">
                            {/* Profile Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h1 className="text-2xl md:text-3xl font-bold">{creator.data.name}{"'s"} Profile</h1>
                                <div className="flex items-center gap-2">
                                    <FollowCreatorButton creatorId={creator.data.id} />

                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Followers</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Users className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.followers ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Posts</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Grid3X3 className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.posts ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total NFTs</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <ImageIcon className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-2xl font-bold">{creator.data._count.assets ?? 0}</div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Joined</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center">
                                            <Calendar className="h-5 w-5 text-muted-foreground mr-2" />
                                            <div className="text-sm font-medium">{new Date(creator.data.joinedAt).toLocaleDateString()}</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Subscription Packages Section */}
                            {subscriptionPackages.data && subscriptionPackages.data.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold">Subscription Packages</h2>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {subscriptionPackages.isLoading && <SubscriptionPackagesSkeleton />}

                                        {subscriptionPackages.data.map((pkg) => (
                                            <Card
                                                key={pkg.id}
                                                className={cn(
                                                    "relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200",
                                                    pkg.popular ? "border-primary" : "border-border",
                                                    !pkg.isActive && "opacity-60",
                                                    expandedPackage === pkg.id && "ring-2 ring-primary",
                                                )}
                                            >
                                                <div className={cn("h-2", pkg.color)} />
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle>{pkg.name}</CardTitle>
                                                            <div className="flex items-baseline mt-2">
                                                                <span className="text-3xl font-bold">{pkg.price}</span>
                                                                <span className="text-muted-foreground ml-1">
                                                                    {creator.data?.pageAsset
                                                                        ? creator.data?.pageAsset.code
                                                                        : creator.data?.customPageAssetCodeIssuer?.split("-")[0]}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {pkg.popular && (
                                                        <div className="absolute top-0 right-0">
                                                            <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                                                POPULAR
                                                            </div>
                                                        </div>
                                                    )}
                                                    <CardDescription className="mt-2">{pkg.description}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4 pb-2">
                                                    <ul className="space-y-2">
                                                        {pkg.features
                                                            .slice(0, expandedPackage === pkg.id ? pkg.features.length : 3)
                                                            .map((feature, i) => (
                                                                <li key={i} className="flex items-start gap-2">
                                                                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                                    <span>{feature}</span>
                                                                </li>
                                                            ))}
                                                    </ul>

                                                    {pkg.features.length > 3 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-xs"
                                                            onClick={() => togglePackageExpansion(pkg.id)}
                                                        >
                                                            {expandedPackage === pkg.id ? (
                                                                <>
                                                                    <ChevronUp className="h-4 w-4 mr-1" />
                                                                    Show Less
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown className="h-4 w-4 mr-1" />
                                                                    Show All Features
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                </CardContent>
                                                <CardFooter>
                                                    <div className="flex items-center justify-between w-full">
                                                        <Badge variant={pkg.isActive ? "default" : "outline"}>
                                                            {pkg.isActive ? "Active" : "Inactive"}
                                                        </Badge>

                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Content Tabs */}
                            <div>
                                <Tabs defaultValue="posts" value={activeTab} onValueChange={setActiveTab} className="w-full"

                                >
                                    <TabsList className="grid grid-cols-2 w-full sm:w-[300px] mb-6">
                                        <TabsTrigger value="posts" className="flex items-center gap-2">
                                            <Grid3X3 className="h-4 w-4" />
                                            <span>Posts</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="nfts" className="flex items-center gap-2">
                                            <ImageIcon className="h-4 w-4" />
                                            <span>NFTs</span>
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Posts Tab */}
                                    <TabsContent value="posts" className="space-y-6 mb-8"

                                    >
                                        <div className="space-y-6">
                                            {allCreatedPost.isLoading && (
                                                <div className="space-y-4">
                                                    {[1, 2, 3].map((i) => (
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
                                                    {page.posts.map((post) => {
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

                                                            hasAccess = post.subscription.price <= (bal ?? 0) ||
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
                                                    }
                                                    )}
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
                                                <div className="text-center py-12 bg-muted/30 rounded-lg">
                                                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                    <h3 className="text-lg font-medium mb-2">No Posts Yet</h3>
                                                    <p className="text-muted-foreground mb-4">This creator hasn{"'t"} posted any content yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* NFTs Tab */}
                                    <TabsContent value="nfts">
                                        <div className="min-h-[calc(100vh-20vh)] flex flex-col gap-4 rounded-md bg-white/40 p-4 shadow-md">
                                            {creatorNFT.isLoading && (
                                                <MoreAssetsSkeleton className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5" />
                                            )}

                                            {creatorNFT.data?.pages[0]?.nfts.length === 0 && (
                                                <div className="h-full flex items-center justify-center flex-col text-lg font-bold">
                                                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                    <h3 className="text-lg font-medium mb-2">No NFTs Found</h3>
                                                    <p className="text-muted-foreground mb-4">This creator hasn{"'t "} created any NFTs yet</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 ">
                                                {creatorNFT.data?.pages.map((items, itemIndex) =>
                                                    items.nfts.map((item, index) => (
                                                        <MarketAssetComponent key={`music-${itemIndex}-${index}`} item={item} />
                                                    )),
                                                )}
                                            </div>

                                            {creatorNFT.hasNextPage && (
                                                <Button
                                                    className="flex w-1/2 items-center justify-center shadow-sm shadow-black md:w-1/4"
                                                    onClick={() => creatorNFT.fetchNextPage()}
                                                    disabled={creatorNFT.isFetchingNextPage}
                                                >
                                                    {creatorNFT.isFetchingNextPage ? "Loading more..." : "Load More"}
                                                </Button>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SubscriptionPackagesSkeleton() {
    // Create an array of 3 items to represent the loading cards
    const skeletonCards = Array(3).fill(null)

    return (
        <>
            {skeletonCards.map((_, index) => (
                <div key={index}>
                    <Card className="relative overflow-hidden h-full border-2 hover:shadow-md transition-all duration-200">
                        <div className="h-2 bg-muted" />
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="w-full">
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <div className="flex items-baseline mt-2">
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="h-4 w-12 ml-1" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-4 pb-2">
                            <div className="space-y-2">
                                {Array(4)
                                    .fill(null)
                                    .map((_, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                                            <Skeleton className="h-4 w-full" />
                                        </div>
                                    ))}
                            </div>
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center justify-between w-full">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            ))}
        </>
    )
}


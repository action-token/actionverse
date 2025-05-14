"use client"

import { Button } from "~/components/shadcn/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Users, Trophy } from "lucide-react"
import { ImageWithFallback } from "../common/image-with-fallback"
import { useState } from "react"
import { api } from "~/utils/api"
import { Skeleton } from "../shadcn/ui/skeleton"
import { HorizontalScroll } from "../common/horizontal-scroll"
import Link from "next/link"

export function OrganizationSection() {
    const [cursor, setCursor] = useState<string | null>(null)
    const { data, isLoading, error, fetchNextPage, isFetchingNextPage } =
        api.fan.creator.getPaginatedCreator.useInfiniteQuery(
            {
                limit: 7,
            },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        )

    const organizations = data?.pages.flatMap((page) => page.items) ?? []
    const hasMore = data?.pages[data.pages.length - 1]?.nextCursor != null

    const handleLoadMore = async (direction: "left" | "right") => {
        if (direction === "right" && hasMore) {
            await fetchNextPage()
        }
    }

    if (isLoading) {
        return (
            <section id="organizations-section" className="bg-muted py-20">
                <div className="container mx-auto px-4">
                    <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Join Organizations</h2>
                            <p className="mt-2 text-muted-foreground">Connect with communities of like-minded property owners.</p>
                        </div>
                    </div>

                    <HorizontalScroll>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <OrganizationCardSkeleton key={`skeleton-${index}`} />
                        ))}
                    </HorizontalScroll>
                </div>
            </section>
        )
    }

    if (error) {
        return (
            <div className="flex h-40 w-full items-center justify-center">
                <p className="text-destructive">Error loading organizations: {error.message}</p>
            </div>
        )
    }

    if (!organizations || organizations.length === 0) {
        return (
            <div className="flex h-40 w-full items-center justify-center">
                <p className="text-muted-foreground">No organizations found.</p>
            </div>
        )
    }

    return (
        <section id="organizations-section" className="bg-muted py-20">
            <div className="container mx-auto px-4">
                <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-foreground md:text-4xl">Join Organizations</h2>
                        <p className="mt-2 text-muted-foreground">Connect with communities of like-minded property owners.</p>
                    </div>
                </div>

                <HorizontalScroll onNavigate={handleLoadMore} isLoadingMore={isFetchingNextPage}>
                    {organizations.map((org) => (
                        <OrganizationCard key={org.id} {...org} />
                    ))}
                </HorizontalScroll>
            </div>
        </section>
    )
}

export interface OrganizationProps {
    id: string
    name: string
    bio?: string | null
    profileUrl?: string | null
    coverUrl?: string | null
    webite?: string | null
    twitter?: string | null
    instagram?: string | null
    _count: {
        Bounty: number
        followers: number
    }
}

export function OrganizationCard({
    id,
    name,
    bio,
    profileUrl,
    coverUrl,
    webite,
    twitter,
    instagram,
    _count,
}: OrganizationProps) {
    return (
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-card shadow-md snap-start">
            <div className="relative flex h-32 items-center justify-center bg-gradient-to-r from-muted to-muted/50 p-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-background">
                    <ImageWithFallback
                        src={profileUrl ?? "/images/action/logo.png"}
                        alt={name}
                        fill
                        className={profileUrl ? "object-cover" : "object-contain"}
                    />
                </div>
            </div>
            <CardHeader className="p-4 pb-0 text-center">
                <CardTitle className="text-xl">{name}</CardTitle>
                <CardDescription className="line-clamp-2 text-muted-foreground">{bio}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="flex justify-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{_count.followers}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <span>{_count.Bounty}</span>
                    </div>
                </div>
                <div className="flex justify-center mt-2 space-x-2">
                    {webite && (
                        <a href={webite} target="_blank" rel="noopener noreferrer">
                            <Button variant="link" className="text-muted-foreground hover:text-foreground">
                                Website
                            </Button>
                        </a>
                    )}
                    {twitter && (
                        <a href={twitter} target="_blank" rel="noopener noreferrer">
                            <Button variant="link" className="text-muted-foreground hover:text-foreground">
                                Twitter
                            </Button>
                        </a>
                    )}
                    {instagram && (
                        <a href={instagram} target="_blank" rel="noopener noreferrer">
                            <Button variant="link" className="text-muted-foreground hover:text-foreground">
                                Instagram
                            </Button>
                        </a>
                    )}
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Link href={`/organization/${id}`} className="w-full">
                    <Button variant="default" className="w-full">
                        View Profile
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    )
}

export function OrganizationCardSkeleton() {
    return (
        <Card className="w-[320px] flex-shrink-0 overflow-hidden bg-card shadow-md snap-start">
            {/* Logo background */}
            <div className="relative flex h-32 items-center justify-center bg-gradient-to-r from-muted to-muted/50 p-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-background">
                    <Skeleton className="h-full w-full rounded-full" /> {/* Logo */}
                </div>
            </div>
            <CardHeader className="p-4 pb-0 text-center">
                <Skeleton className="mx-auto h-6 w-32" /> {/* Name */}
                <div className="mt-2">
                    <Skeleton className="mx-auto h-4 w-full" /> {/* Description line 1 */}
                    <Skeleton className="mx-auto mt-1 h-4 w-3/4" /> {/* Description line 2 */}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="flex justify-center space-x-4">
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-6" /> {/* Members count */}
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-6" /> {/* Bounties count */}
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-4 w-4" /> {/* Icon */}
                        <Skeleton className="h-4 w-16" /> {/* Location */}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Skeleton className="h-9 w-full" /> {/* Button */}
            </CardFooter>
        </Card>
    )
}

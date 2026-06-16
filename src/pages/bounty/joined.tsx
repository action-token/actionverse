import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { BountyCard, BountyCardSkeleton } from "~/components/bounty/bounty-card";
import { ArrowLeft, Star, Trophy } from "lucide-react";

export default function JoinedBountiesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") void router.push("/bounty");
  }, [status, router]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    api.bounty.Bounty.getJoinedBounties.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (last) => last.nextCursor,
        enabled: !!session,
      },
    );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void router.push("/bounty")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Joined Bounties
            </h1>
            <p className="text-sm text-muted-foreground">
              All the bounties you&apos;re participating in
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <BountyCardSkeleton key={i} />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">No joined bounties</p>
            <p className="text-sm mb-6">
              Discover and join bounties to get started
            </p>
            <Button onClick={() => void router.push("/bounty")}>
              Browse Bounties
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allItems.map((p) => (
              <BountyCard
                key={p.id}
                bounty={p.bounty}
                showJoin={false}
                isJoined
              />
            ))}
          </div>
        )}

        <div ref={observerRef} className="h-4" />
        {isFetchingNextPage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <BountyCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

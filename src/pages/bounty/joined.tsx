import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import { BountyCard, BountyCardSkeleton } from "~/components/bounty/bounty-card";
import {
  ArrowLeft,
  Plus,
  Search,
  Star,
  Trophy,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "~/lib/utils";

type SortKey = "newest" | "oldest" | "prize_high" | "prize_low" | "title";
type FilterKey = "all" | "joined" | "owned";

export default function JoinedBountiesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const observerRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") void router.push("/bounty");
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = api.bounty.Bounty.getMyBountiesCombined.useInfiniteQuery(
    {
      limit: 20,
      search: debouncedSearch || undefined,
      sortBy,
      filter,
    },
    {
      getNextPageParam: (last) => last.nextCursor,
      enabled: !!session,
    },
  );

  // Refetch when sort/filter/search change to reset the cursor.
  useEffect(() => {
    void refetch();
  }, [sortBy, filter, debouncedSearch, refetch]);

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
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void router.push("/bounty")}
              className="h-9 w-9 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-primary shrink-0" />
                My Bounties
              </h1>
              <p className="text-sm text-muted-foreground">
                Bounties you joined and bounties you own
              </p>
            </div>
          </div>
          {session && (
            <Button
              onClick={() => void router.push("/bounty/create")}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Bounty
            </Button>
          )}
        </div>

        {/* Search + Sort + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your bounties…"
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-48 bg-secondary border-border">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="prize_high">Prize (high → low)</SelectItem>
              <SelectItem value="prize_low">Prize (low → high)</SelectItem>
              <SelectItem value="title">Title (A → Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(["all", "joined", "owned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f === "joined" ? "Joined" : "Owned"}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <BountyCardSkeleton key={i} />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">
              {debouncedSearch
                ? "No matches"
                : filter === "owned"
                  ? "No bounties you own"
                  : filter === "joined"
                    ? "No joined bounties"
                    : "No bounties yet"}
            </p>
            <p className="text-sm mb-6">
              {debouncedSearch
                ? "Try a different search term or filter."
                : "Discover and join bounties, or create your own."}
            </p>
            {!debouncedSearch && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => void router.push("/bounty")}>
                  Browse Bounties
                </Button>
                <Button onClick={() => void router.push("/bounty/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Bounty
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allItems.map((row) => (
              <BountyCard
                key={row.bountyId}
                bounty={row.bounty}
                showJoin={false}
                isJoined={!row.owned}
                isCreator={row.owned}
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

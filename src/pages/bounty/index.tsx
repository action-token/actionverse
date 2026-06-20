import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import { Input } from "~/components/shadcn/ui/input";
import { Button } from "~/components/shadcn/ui/button";
import { ScrollArea } from "~/components/shadcn/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select";
import { BountyCard, BountyCardWithJoin, BountyCardSkeleton } from "~/components/bounty/bounty-card";
import { RecentActivityItem } from "~/components/bounty/recent-activity-item";
import {
  Search,
  Trophy,
  Activity,
  ChevronRight,
  Zap,
  Star,
  SlidersHorizontal,
  X,
  Plus,
} from "lucide-react";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store";

export default function BountiesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "prize">("newest");
  const [filter, setFilter] = useState<"all" | "not_joined" | "joined">("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"filter" | "top" | "recent" | "my" | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const publicQuery = api.bounty.Bounty.getPublicBounties.useInfiniteQuery(
    {
      limit: 20,
      search: debouncedSearch || undefined,
      sortBy,
      filter: filter === "not_joined" ? "not_joined" : "all",
    },
    { getNextPageParam: (last) => last.nextCursor, enabled: filter !== "joined" },
  );

  const joinedQuery2 = api.bounty.Bounty.getJoinedBounties.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor, enabled: filter === "joined" && !!session },
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    filter === "joined" ? joinedQuery2 : publicQuery;

  const { data: topBounties } = api.bounty.Bounty.getTopBounties.useQuery({ limit: 5 });
  const { data: activities } = api.bounty.Bounty.getRecentActivities.useQuery({ limit: 8 });
  const myBountiesQuery = api.bounty.Bounty.getMyBountiesCombined.useQuery(
    { limit: 5, sortBy: "newest", filter: "all" },
    { enabled: !!session },
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

  const allBounties =
    filter === "joined"
      ? (joinedQuery2.data?.pages.flatMap((p) => p.items).map((p) => p.bounty) ?? [])
      : (publicQuery.data?.pages.flatMap((p) => p.items) ?? []);

  const mobileTabs = [
    { id: "filter" as const, label: "Filter", Icon: SlidersHorizontal },
    { id: "top" as const, label: "Top", Icon: Zap },
    { id: "recent" as const, label: "Recent", Icon: Activity },
    ...(session ? [{ id: "my" as const, label: "My", Icon: Star }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              <Trophy className="h-7 w-7 text-gold" />
              Bounties
            </h1>
            <p className="text-muted-foreground">
              Discover challenges, complete tasks, and earn {PLATFORM_ASSET.code} rewards
            </p>
          </div>
          <Button
            onClick={() => session ? void router.push("/bounty/create") : setLoginModalOpen(true)}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Bounty
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search & Sort */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bounties…"
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "prize")}>
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="prize">Highest Prize</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "not_joined", ...(session ? ["joined"] : [])] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as "all" | "not_joined" | "joined")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {f === "all" ? "All" : f === "not_joined" ? "Not Joined" : "Joined"}
                </button>
              ))}
            </div>

            {/* Bounty grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <BountyCardSkeleton key={i} />
                ))}
              </div>
            ) : allBounties.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No bounties found</p>
                <p className="text-sm">Check back soon for new challenges</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allBounties.map((bounty) => (
                  <BountyCardWithJoin key={bounty.id} bounty={bounty} />
                ))}
              </div>
            )}

            <div ref={observerRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <BountyCardSkeleton key={i} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar — desktop only */}
          <div className="hidden lg:block space-y-5">
            {/* Top Bounties */}
            {topBounties && topBounties.length > 0 && (
              <div className=" border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <span className="font-semibold text-sm">Top Bounties</span>
                </div>
                <div className="p-3 space-y-1">
                  {topBounties.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => void router.push(`/bounty/${b.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "text-xs font-bold w-5 shrink-0",
                          i === 0 ? "text-gold"
                            : i === 1 ? "text-muted-foreground"
                              : i === 2 ? "text-warning"
                                : "text-muted-foreground",
                        )}
                      >
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{b.title}</p>
                        <p className="text-xs text-gold">
                          {b.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* My Joined + Owned Bounties */}
            {session && (
              <div className=" border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">My Bounties</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => void router.push("/bounty/joined")}
                  >
                    See more
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="p-2">
                  {myBountiesQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
                      ))}
                    </div>
                  ) : myBountiesQuery.data?.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No bounties yet
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {myBountiesQuery.data?.items.map((row) => (
                        <li key={row.bountyId}>
                          <button
                            onClick={() => void router.push(`/bounty/${row.bountyId}`)}
                            className="group w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                {row.owned && (
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" title="You own this bounty" />
                                )}
                                <span className="truncate">{row.bounty.title}</span>
                              </p>
                              <p className="text-[11px] text-gold font-medium tabular-nums">
                                {row.bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
                              </p>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Recent Activities */}
            {activities && activities.length > 0 && (
              <div className=" border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Recent Activity</span>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-3 space-y-1">
                    {activities.map((act) => (
                      <RecentActivityItem key={act.id} activity={act} />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile floating sidebar (hidden on lg+) ──────────────────── */}
      <div className="lg:hidden">
        {/* Backdrop */}
        {mobilePanel && (
          <div
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px]"
            onClick={() => setMobilePanel(null)}
          />
        )}

        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center">
          {/* Floating panel */}
          {mobilePanel && (
            <div className="mr-1 w-72 shadow-2xl">
              <div className="relative bg-card border border-border  overflow-hidden">
                {/* Connector dot */}
                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary/50 border-2 border-card z-10" />

                {/* Close button */}
                <button
                  onClick={() => setMobilePanel(null)}
                  className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Filter panel */}
                {mobilePanel === "filter" && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Filter</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Show</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["all", "not_joined", ...(session ? ["joined"] : [])] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f as "all" | "not_joined" | "joined")}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                              filter === f
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary text-muted-foreground border-border",
                            )}
                          >
                            {f === "all" ? "All" : f === "not_joined" ? "Not Joined" : "Joined"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Sort by</p>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "prize")}>
                        <SelectTrigger className="bg-secondary border-border text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="prize">Highest Prize</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Top Bounties panel */}
                {mobilePanel === "top" && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <Zap className="h-4 w-4 text-gold" />
                      <span className="font-semibold text-sm">Top Bounties</span>
                    </div>
                    <div className="p-3 space-y-1 max-h-[60vh] overflow-y-auto">
                      {!topBounties || topBounties.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No bounties yet</p>
                      ) : (
                        topBounties.map((b, i) => (
                          <button
                            key={b.id}
                            onClick={() => { setMobilePanel(null); void router.push(`/bounty/${b.id}`); }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                          >
                            <span className={cn("text-xs font-bold w-5 shrink-0", i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-warning" : "text-muted-foreground")}>
                              #{i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{b.title}</p>
                              <p className="text-xs text-gold">{b.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Activity panel */}
                {mobilePanel === "recent" && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Recent Activity</span>
                    </div>
                    <div className="p-3 space-y-1 max-h-[60vh] overflow-y-auto">
                      {!activities || activities.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
                      ) : (
                        activities.map((act) => (
                          <RecentActivityItem
                            key={act.id}
                            activity={act}
                            onNavigate={() => setMobilePanel(null)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* My Bounties panel */}
                {mobilePanel === "my" && session && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">My Bounties</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => { setMobilePanel(null); void router.push("/bounty/joined"); }}
                      >
                        See all <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                    <div className="p-2 max-h-[60vh] overflow-y-auto">
                      {myBountiesQuery.isLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
                          ))}
                        </div>
                      ) : !myBountiesQuery.data?.items.length ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No bounties yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {myBountiesQuery.data.items.map((row) => (
                            <li key={row.bountyId}>
                              <button
                                onClick={() => { setMobilePanel(null); void router.push(`/bounty/${row.bountyId}`); }}
                                className="group w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                    {row.owned && (
                                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" title="You own this bounty" />
                                    )}
                                    <span className="truncate">{row.bounty.title}</span>
                                  </p>
                                  <p className="text-[11px] text-gold font-medium tabular-nums">
                                    {row.bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
                                  </p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab rail */}
          <div className="flex flex-col gap-px">
            {mobileTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMobilePanel((prev) => (prev === id ? null : id))}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-2 py-3 border border-r-0 rounded-l-lg transition-all duration-150",
                  mobilePanel === id
                    ? "bg-primary/5 border-primary/40 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-bold tracking-widest uppercase">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

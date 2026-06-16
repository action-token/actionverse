import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import { Input } from "~/components/shadcn/ui/input";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/shadcn/ui/select";
import { ScrollArea } from "~/components/shadcn/ui/scroll-area";
import { Separator } from "~/components/shadcn/ui/separator";
import { BountyCard, BountyCardSkeleton } from "~/components/bounty/bounty-card";
import { RecentActivityItem } from "~/components/bounty/recent-activity-item";
import { BountyStatus } from "@prisma/client";
import {
  Plus,
  Search,
  Trophy,
  Activity,
  Users,
  FileText,
  Crown,
  Filter,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "RUNNING", label: "Running" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

export default function OrganizationBountyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | BountyStatus>("RUNNING");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"filter" | "recent" | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") void router.push("/");
  }, [status, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    api.bounty.Bounty.getMyBounties.useInfiniteQuery(
      {
        limit: 20,
        status: filterStatus === "all" ? undefined : filterStatus,
        search: debouncedSearch || undefined,
      },
      { getNextPageParam: (last) => last.nextCursor },
    );

  const { data: activities, isLoading: activitiesLoading } =
    api.bounty.Bounty.getCreatorActivities.useQuery({ limit: 12 });

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

  const allBounties = data?.pages.flatMap((p) => p.items) ?? [];

  const mobileTabs = [
    { id: "filter" as const, label: "Filter", Icon: SlidersHorizontal },
    { id: "recent" as const, label: "Recent", Icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-400" />
              My Bounties
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your challenges and reward the best contributors
            </p>
          </div>
          <Button onClick={() => void router.push("/organization/bounty/create")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Bounty
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main area */}
          <div className="lg:col-span-3 space-y-5">
            {/* Search + Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your bounties…"
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as "all" | BountyStatus)}
              >
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bounty grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <BountyCardSkeleton key={i} />
                ))}
              </div>
            ) : allBounties.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Trophy className="h-14 w-14 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No bounties yet</p>
                <p className="text-sm mb-6">
                  Create your first bounty to start engaging your community
                </p>
                <Button onClick={() => void router.push("/organization/bounty/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Bounty
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allBounties.map((bounty) => (
                  <BountyCard
                    key={bounty.id}
                    bounty={bounty}
                    showJoin={false}
                  />
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
          <div className="hidden lg:block space-y-6">
            {/* Status filter shortcuts */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">Filter</span>
              </div>
              <div className="p-3 space-y-1">
                {statusOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setFilterStatus(o.value as "all" | BountyStatus)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      filterStatus === o.value
                        ? "bg-secondary font-medium"
                        : "hover:bg-secondary text-muted-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Recent Activity</span>
              </div>
              <ScrollArea className="h-80">
                <div className="p-3 space-y-1">
                  {activitiesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 rounded-lg bg-secondary animate-pulse"
                      />
                    ))
                  ) : !activities?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No recent activity
                    </p>
                  ) : (
                    activities.map((act) => (
                      <RecentActivityItem key={act.id} activity={act} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile floating sidebar (hidden on lg+) ──────────────────── */}
      <div className="lg:hidden">
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
              <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary/50 border-2 border-card z-10" />
                <button
                  onClick={() => setMobilePanel(null)}
                  className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Filter panel */}
                {mobilePanel === "filter" && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Filter</span>
                    </div>
                    <div className="p-3 space-y-1">
                      {statusOptions.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => {
                            setFilterStatus(o.value as "all" | BountyStatus);
                            setMobilePanel(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                            filterStatus === o.value
                              ? "bg-secondary font-medium"
                              : "hover:bg-secondary text-muted-foreground",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
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
                      {activitiesLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />
                        ))
                      ) : !activities?.length ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>
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

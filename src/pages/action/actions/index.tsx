import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { api } from "~/utils/api";
import { Input } from "~/components/shadcn/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar";
import { BountyStatus } from "@prisma/client";
import {
  Trophy,
  Search,
  Loader2,
  ChevronRight,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  Activity,
  Star,
  X,
  Eye,
  Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useShareBountyModalStore } from "~/components/store/share-bounty-modal-store";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { cn } from "~/lib/utils";
import { RecentActivityItem } from "~/components/bounty/recent-activity-item";
import { Button } from "~/components/shadcn/ui/button";
import { useWalkThrough } from "~/hooks/useWalkthrough";
import { Walkthrough } from "~/components/common/walkthrough";

type ButtonLayout = { x: number; y: number; width: number; height: number };

type BountyCardData = {
  id: number;
  title: string;
  summary: string;
  prizeAmount: number;
  prizeAssetCode: string;
  status: BountyStatus;
  maxWinners?: number | null;
  user: { id: string; name: string | null; image: string | null };
  _count: { participants: number; submissions: number; winners: number };
};

/* ── Compact card ─────────────────────────────────────────────────────────── */
function ActionBountyCard({
  bounty,
  isCreator = false,
  isJoined = false,
  showJoin = false,
  joining = false,
  onJoin,
  onShare,
  onPress,
}: {
  bounty: BountyCardData;
  isCreator?: boolean;
  isJoined?: boolean;
  showJoin?: boolean;
  joining?: boolean;
  onJoin?: () => void;
  onShare?: () => void;
  onPress: () => void;
}) {
  const statusDot =
    bounty.status === BountyStatus.RUNNING
      ? "bg-primary animate-pulse"
      : bounty.status === BountyStatus.PAUSED
        ? "bg-warning"
        : "bg-muted-foreground";

  const statusLabel =
    bounty.status === BountyStatus.RUNNING
      ? "Live"
      : bounty.status === BountyStatus.PAUSED
        ? "Paused"
        : "Ended";

  const maxW = bounty.maxWinners ?? 1;
  const slotsLeft = Math.max(0, maxW - bounty._count.winners);

  const stopAndCall = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <div
      onClick={onPress}
      className="w-full text-left bg-card rounded-2xl shadow-sm border border-border px-4 py-3.5 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Prize + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-bold text-sm">
            {bounty.prizeAmount.toLocaleString()} {bounty.prizeAssetCode}
          </span>
          <span className="text-muted-foreground text-xs">
            / {maxW > 1 ? `${maxW} winners` : "winner"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          <span className="text-[10px] font-semibold text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {/* Title */}
      <p className="text-foreground font-semibold text-sm leading-snug line-clamp-2 mb-2">
        {bounty.title}
      </p>

      {/* Summary */}
      {bounty.summary && (
        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-2">
          {bounty.summary}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {bounty._count.participants} joined
        </span>
        <span className="text-border text-xs">·</span>
        <span className="text-[11px] text-muted-foreground">{slotsLeft} slots left</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        {/* Owner */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="h-4 w-4 shrink-0">
            <AvatarImage src={bounty.user.image ?? ""} />
            <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
              {(bounty.user.name ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-[11px] truncate">{bounty.user.name ?? "Unknown"}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">

          {/* View — creator or joined */}
          {(isCreator || isJoined) && (
            <button
              onClick={(e) => stopAndCall(e, onPress)}
              className="flex items-center gap-1 text-primary hover:text-primary/80 text-[12px] font-semibold transition-colors"
            >
              <Eye className="h-3 w-3" />
              View
            </button>
          )}

          {/* Join */}
          {!isCreator && !isJoined && showJoin && (
            <button
              onClick={(e) => stopAndCall(e, onJoin)}
              disabled={joining}
              className="flex items-center gap-1 text-primary hover:text-primary/80 text-[12px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {joining ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {joining ? "Joining…" : "Join"}
            </button>
          )}

          <span className="text-border">|</span>

          {/* Share */}
          <button
            onClick={(e) => stopAndCall(e, onShare)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary text-[12px] font-semibold transition-colors"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Card with join logic ─────────────────────────────────────────────────── */
function ActionBountyCardWithJoin({ bounty, onPress }: { bounty: BountyCardData; onPress: () => void }) {
  const { data: session } = useSession();
  const openShareModal = useShareBountyModalStore((s) => s.open);
  const isOwner = session?.user?.id === bounty.user.id;

  const { data: participation, refetch } = api.bounty.Bounty.getMyParticipation.useQuery(
    { bountyId: bounty.id },
    { enabled: !!session && !isOwner },
  );

  const joinM = api.bounty.Bounty.joinBounty.useMutation({
    onSuccess: () => { toast.success("Joined!"); void refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <ActionBountyCard
      bounty={bounty}
      isCreator={isOwner}
      isJoined={participation?.joined ?? false}
      showJoin={!!session && !isOwner && bounty.status === BountyStatus.RUNNING}
      joining={joinM.isLoading}
      onJoin={() => joinM.mutate({ bountyId: bounty.id })}
      onShare={() =>
        openShareModal({
          id: bounty.id,
          title: bounty.title,
          prizeAmount: bounty.prizeAmount,
          participantCount: bounty._count.participants,
          submissionCount: bounty._count.submissions,
        })
      }
      onPress={onPress}
    />
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function ActionBountyCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border px-4 py-3.5 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 w-36 rounded bg-secondary" />
        <div className="h-3 w-10 rounded bg-secondary" />
      </div>
      <div className="h-4 w-4/5 rounded bg-secondary mb-2" />
      <div className="h-3 w-full rounded bg-muted mb-1" />
      <div className="h-3 w-3/4 rounded bg-muted mb-3" />
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

/* ── Rail (portal-mounted) ────────────────────────────────────────────────── */
type RailPanel = "filter" | "top" | "recent" | "my";

function FloatingRail({
  panel,
  setPanel,
  sortBy,
  setSortBy,
  filter,
  setFilter,
  session,
  topBounties,
  activities,
  joinedItems,
  joinedLoading,
  router,
}: {
  panel: RailPanel | null;
  setPanel: (p: RailPanel | null) => void;
  sortBy: "newest" | "prize";
  setSortBy: (v: "newest" | "prize") => void;
  filter: "all" | "not_joined" | "joined";
  setFilter: (v: "all" | "not_joined" | "joined") => void;
  session: boolean;
  topBounties?: { id: number; title: string; prizeAmount: number; prizeAssetCode: string }[];
  activities?: Parameters<typeof RecentActivityItem>[0]["activity"][];
  joinedItems?: { id: number; bounty: { id: number; title: string; prizeAmount: number; prizeAssetCode: string } }[];
  joinedLoading?: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const tabs: { id: RailPanel; label: string; Icon: React.ElementType }[] = [
    { id: "filter", label: "Filter", Icon: SlidersHorizontal },
    { id: "top", label: "Top", Icon: Zap },
    { id: "recent", label: "Recent", Icon: Activity },
    ...(session ? [{ id: "my" as RailPanel, label: "My", Icon: Star }] : []),
  ];

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="max-w-md mx-auto relative h-full">
        {panel && (
          <div
            className="absolute inset-0 bg-foreground/20 pointer-events-auto"
            onClick={() => setPanel(null)}
          />
        )}

        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pointer-events-auto">
          {panel && (
            <div className="mr-1 w-64 bg-card rounded-xl shadow-2xl border border-border relative">
              <button
                onClick={() => setPanel(null)}
                className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground z-20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="absolute right-0 top-6 translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary/60 border-2 border-card z-20" />
              <div className="max-h-[60vh] overflow-y-auto rounded-xl">

                {panel === "filter" && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm text-foreground">Filter</span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Show</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["all", "not_joined", ...(session ? ["joined"] : [])] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f as "all" | "not_joined" | "joined")}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
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
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Sort by</p>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "prize")}>
                        <SelectTrigger className="h-8 text-xs bg-secondary border-border rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="prize">Top Prize</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {panel === "top" && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <Zap className="h-4 w-4 text-gold" />
                      <span className="font-semibold text-sm text-foreground">Top Bounties</span>
                    </div>
                    <div className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
                      {!topBounties?.length ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No bounties yet</p>
                      ) : (
                        topBounties.map((b, i) => (
                          <button
                            key={b.id}
                            onClick={() => { setPanel(null); void router.push(`/action/actions/${b.id}`); }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                          >
                            <span className={cn(
                              "text-xs font-bold w-5 shrink-0",
                              i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-warning" : "text-muted-foreground/60",
                            )}>
                              #{i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate text-foreground">{b.title}</p>
                              <p className="text-xs text-primary">{b.prizeAmount.toLocaleString()} {b.prizeAssetCode}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {panel === "recent" && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm text-foreground">Recent Activity</span>
                    </div>
                    <div className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
                      {!activities?.length ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
                      ) : (
                        activities.map((act) => (
                          <RecentActivityItem key={act.id} activity={act} onNavigate={() => setPanel(null)} />
                        ))
                      )}
                    </div>
                  </div>
                )}

                {panel === "my" && session && (
                  <div>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm text-foreground">My Bounties</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => { setPanel(null); void router.push("/bounty/joined"); }}
                      >
                        See all <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                    <div className="p-2 max-h-[50vh] overflow-y-auto">
                      {joinedLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />
                          ))}
                        </div>
                      ) : !joinedItems?.length ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No joined bounties yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {joinedItems.map((p) => (
                            <li key={p.id}>
                              <button
                                onClick={() => { setPanel(null); void router.push(`/action/actions/${p.bounty.id}`); }}
                                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate text-foreground">{p.bounty.title}</p>
                                  <p className="text-[11px] text-primary">{p.bounty.prizeAmount.toLocaleString()} {p.bounty.prizeAssetCode}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>{/* end scroll container */}
            </div>
          )}

          {/* Tab rail */}
          <div className="flex flex-col gap-px">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setPanel(panel === id ? null : id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-2 py-3 border border-r-0 rounded-l-lg transition-all duration-150",
                  panel === id
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
    </div>,
    document.body,
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ActionsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "prize">("newest");
  const [filter, setFilter] = useState<"all" | "not_joined" | "joined">("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [railPanel, setRailPanel] = useState<RailPanel | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [buttonLayouts, setButtonLayouts] = useState<ButtonLayout[]>([]);
  const observerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const filterChipsRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);

  const { data: walkthroughData } = useWalkThrough();

  const steps = [
    {
      target: buttonLayouts[0],
      title: "Welcome to Bounties!",
      content: "This is the Bounties page where you can discover challenges, complete tasks, and earn rewards. Let's walk you through the key features.",
    },
    {
      target: buttonLayouts[1],
      title: "Search & Sort",
      content: "Use the search bar to find bounties by name. Use the sort dropdown to order by Newest or Top Prize.",
    },
    {
      target: buttonLayouts[2],
      title: "Filter Bounties",
      content: "Use the filter chips to switch between All bounties, Not Joined (ones you haven't entered yet), or your Joined bounties.",
    },
    {
      target: buttonLayouts[3],
      title: "Bounty Cards",
      content: "Tap any bounty card to view its full details, requirements, prize pool, and to join or submit your report.",
    },
    {
      target: undefined,
      title: "Side Panel",
      content: "Use the floating tab rail on the right edge to quickly access Filters, Top Bounties, Recent Activity, and your joined bounties — without leaving the page.",
    },
  ];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const publicQuery = api.bounty.Bounty.getPublicBounties.useInfiniteQuery(
    {
      limit: 15,
      search: debouncedSearch || undefined,
      sortBy,
      filter: filter === "not_joined" ? "not_joined" : "all",
    },
    { getNextPageParam: (last) => last.nextCursor, enabled: filter !== "joined" },
  );

  const joinedInfiniteQuery = api.bounty.Bounty.getJoinedBounties.useInfiniteQuery(
    { limit: 15 },
    { getNextPageParam: (last) => last.nextCursor, enabled: filter === "joined" && !!session },
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    filter === "joined" ? joinedInfiniteQuery : publicQuery;

  const { data: topBounties } = api.bounty.Bounty.getTopBounties.useQuery({ limit: 5 });
  const { data: activities } = api.bounty.Bounty.getRecentActivities.useQuery({ limit: 8 });
  const joinedQuery = api.bounty.Bounty.getJoinedBounties.useQuery(
    { limit: 10 },
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

  useLayoutEffect(() => {
    const capture = () => {
      if (!showWalkthrough) return;
      const toLayout = (r: DOMRect): ButtonLayout => ({ x: r.left, y: r.top, width: r.width, height: r.height });
      try {
        const h = headerRef.current?.getBoundingClientRect();
        const s = searchRowRef.current?.getBoundingClientRect();
        const f = filterChipsRef.current?.getBoundingClientRect();
        const c = firstCardRef.current?.getBoundingClientRect();
        if (h && s && f && h.width > 0 && s.width > 0 && f.width > 0) {
          setButtonLayouts([
            toLayout(h),
            toLayout(s),
            toLayout(f),
            ...(c && c.width > 0 ? [toLayout(c)] : []),
          ]);
        }
      } catch (err) {
        console.error("Error capturing layouts:", err);
      }
    };
    let timerId: ReturnType<typeof setTimeout>;
    const debounced = () => { clearTimeout(timerId); timerId = setTimeout(capture, 100); };
    const mo = new MutationObserver(debounced);
    if (showWalkthrough) {
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(capture, 500);
    }
    return () => { mo.disconnect(); clearTimeout(timerId); };
  }, [showWalkthrough]);

  useEffect(() => {
    try {
      if (walkthroughData?.showWalkThrough) {
        setTimeout(() => setShowWalkthrough(true), 1000);
      } else {
        setShowWalkthrough(false);
      }
    } catch {
      setShowWalkthrough(false);
    }
  }, [walkthroughData]);

  const allBounties =
    filter === "joined"
      ? (joinedInfiniteQuery.data?.pages.flatMap((p) => p.items).map((p) => p.bounty) ?? [])
      : (publicQuery.data?.pages.flatMap((p) => p.items) ?? []);

  return (
    <div className="min-h-full bg-background">
      {mounted && (
        <FloatingRail
          panel={railPanel}
          setPanel={setRailPanel}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filter={filter}
          setFilter={setFilter}
          session={!!session}
          topBounties={topBounties ?? undefined}
          activities={activities ?? undefined}
          joinedItems={joinedQuery.data?.items ?? undefined}
          joinedLoading={joinedQuery.isLoading}
          router={router}
        />
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 pt-4 pb-3">
        <div ref={headerRef} className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-gold" />
          <h1 className="text-base font-bold text-foreground">Bounties</h1>
        </div>
        <div ref={searchRowRef} className="flex gap-2 mb-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bounties…"
              className="pl-8 h-8 text-sm bg-secondary border-0 rounded-xl focus-visible:ring-1"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "prize")}>
            <SelectTrigger className="w-28 h-8 text-xs bg-secondary border-0 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="prize">Top Prize</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter chips */}
        <div ref={filterChipsRef} className="flex gap-2">
          {(["all", "not_joined", ...(session ? ["joined"] : [])] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as "all" | "not_joined" | "joined")}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-medium border transition-colors",
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

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <ActionBountyCardSkeleton key={i} />)
        ) : allBounties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Trophy className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No bounties found</p>
            {search && (
              <button onClick={() => setSearch("")} className="text-xs text-primary font-medium">
                Clear search
              </button>
            )}
          </div>
        ) : (
          allBounties.map((bounty, i) => (
            <div key={bounty.id} ref={i === 0 ? firstCardRef : undefined}>
              <ActionBountyCardWithJoin
                bounty={bounty}
                onPress={() => void router.push(`/action/actions/${bounty.id}`)}
              />
            </div>
          ))
        )}

        <div ref={observerRef} className="h-4" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showWalkthrough && (
        <Walkthrough steps={steps} onFinish={() => setShowWalkthrough(false)} />
      )}
    </div>
  );
}

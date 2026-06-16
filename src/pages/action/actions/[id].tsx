import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { api } from "~/utils/api";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar";
import { Badge } from "~/components/shadcn/ui/badge";
import { Button } from "~/components/shadcn/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/shadcn/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { SubmitReportDialog } from "~/components/bounty/submit-report-dialog";
import { ReportMediaViewer } from "~/components/bounty/report-media-viewer";
import { Markdown } from "~/components/bounty/markdown";
import { BountyStatus } from "@prisma/client";
import {
  Trophy,
  Users,
  FileText,
  Pencil,
  Share2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Crown,
  Lock,
  AlertCircle,
  X,
  Clock,
  Zap,
  Target,
  Eye,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { cn } from "~/lib/utils";
import { useShareBountyModalStore } from "~/components/store/share-bounty-modal-store";

/* ── Types ───────────────────────────────────────────────────────────────── */
interface Submission {
  id: number;
  userId: string;
  content: string;
  status: string;
  createdAt: Date;
  user?: { id: string; name: string | null; image: string | null };
  media: { id: number; url: string; type: string; fileName: string | null }[];
}

/* ── Status config ───────────────────────────────────────────────────────── */
const statusCfg: Record<BountyStatus, { label: string; dot: string; pill: string }> = {
  RUNNING: { label: "Live", dot: "bg-primary animate-pulse", pill: "bg-primary/10 text-primary border-primary/30" },
  PAUSED: { label: "Paused", dot: "bg-warning", pill: "bg-warning/10 text-warning border-warning/30" },
  COMPLETED: { label: "Ended", dot: "bg-muted-foreground", pill: "bg-secondary text-muted-foreground border-border" },
};

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ActionBountyDetailPage() {
  const router = useRouter();
  const id = parseInt(router.query.id as string);
  const { data: session } = useSession();
  const openShareModal = useShareBountyModalStore((s) => s.open);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
  const [mobilePanel, setMobilePanel] = useState<
    "requirements" | "rewards" | "stats" | "winners" | null
  >(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /* queries */
  const bountyQ = api.bounty.Bounty.getBounty.useQuery(
    { bountyId: id },
    { enabled: !!id },
  );
  const bounty = bountyQ.data;
  const isCreator = session?.user?.id === bounty?.creatorId;

  const submissionsQ = api.bounty.Bounty.getBountySubmissions.useQuery(
    { bountyId: id },
    { enabled: !!id && isCreator },
  );
  const myParticipation = api.bounty.Bounty.getMyParticipation.useQuery(
    { bountyId: id },
    { enabled: !!id && !!session && !isCreator },
  );
  const mySubmissions = api.bounty.Bounty.getMySubmissions.useQuery(
    { bountyId: id },
    { enabled: !!id && !!session && !isCreator },
  );

  /* mutations */
  const joinM = api.bounty.Bounty.joinBounty.useMutation({
    onSuccess: () => {
      toast.success("Joined!");
      void myParticipation.refetch();
      void bountyQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const statusM = api.bounty.Bounty.updateBountyStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      void bountyQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const winnerM = api.bounty.Bounty.selectWinner.useMutation({
    onSuccess: () => {
      toast.success("Winner selected!");
      void submissionsQ.refetch();
      void bountyQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const claimXdrM = api.bounty.Bounty.getClaimRewardXDR.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const claimM = api.bounty.Bounty.claimReward.useMutation({
    onSuccess: () => {
      toast.success("Reward claimed!");
      void myParticipation.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClaim = async () => {
    if (!session?.user) return;
    try {
      const result = await claimXdrM.mutateAsync({
        bountyId: id,
        signWith: { email: session.user.email! },
      });
      await submitSignedXDRToServer4User(result.xdr);
      await claimM.mutateAsync({ bountyId: id });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to claim reward");
    }
  };

  const submittedUserIds = useMemo(() => {
    if (!bounty) return new Set<string>();
    if (isCreator && submissionsQ.data)
      return new Set(submissionsQ.data.map((s) => s.userId));
    if (!isCreator && session?.user?.id && mySubmissions.data?.length)
      return new Set([session.user.id]);
    return new Set<string>();
  }, [bounty, isCreator, submissionsQ.data, mySubmissions.data, session]);

  /* loading / not found */
  if (bountyQ.isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!bounty) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 bg-background px-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Bounty not found</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void router.push("/action/actions")}
        >
          Back to Bounties
        </Button>
      </div>
    );
  }

  const sc = statusCfg[bounty.status];
  const isJoined = myParticipation.data?.joined ?? false;
  const winner = myParticipation.data?.winner;
  const canSubmit = isJoined && bounty.status === BountyStatus.RUNNING && !isCreator;
  const perWinner = bounty.prizeAmount / bounty.maxWinners;
  const submissionCount = isCreator
    ? bounty._count.submissions
    : (mySubmissions.data?.length ?? 0);

  return (
    <div className="min-h-full bg-background relative">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="h-[3px] w-full bg-primary" />
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => void router.back()}
            className="shrink-0 -ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{bounty.title}</p>
          </div>
          <div
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide",
              sc.pill,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
            {sc.label}
          </div>
        </div>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          {/* Prize */}
          <div className="flex items-baseline gap-1.5">
            <Trophy className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <span className="text-2xl font-black text-gold">
              {bounty.prizeAmount.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {PLATFORM_ASSET.code}
            </span>
            {bounty.maxWinners > 1 && (
              <span className="text-xs text-muted-foreground ml-1">
                / {bounty.maxWinners} winners
              </span>
            )}
          </div>

          {/* Creator + time */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={bounty.creator.profileUrl ?? ""} />
                <AvatarFallback className="text-[8px] bg-secondary">
                  {bounty.creator.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{bounty.creator.name}</span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Summary */}
          {bounty.summary && (
            <p className="text-muted-foreground text-xs leading-relaxed">{bounty.summary}</p>
          )}

          {/* Creator tools */}
          {isCreator && (
            <div className="pt-1 border-t border-border flex flex-wrap items-center gap-2">
              <Select
                value={bounty.status}
                onValueChange={(s) =>
                  statusM.mutate({ bountyId: id, status: s as BountyStatus })
                }
                disabled={statusM.isLoading}
              >
                <SelectTrigger className="h-8 text-xs w-[130px] border-border bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RUNNING">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Running
                    </span>
                  </SelectItem>
                  <SelectItem value="PAUSED">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Paused
                    </span>
                  </SelectItem>
                  <SelectItem value="COMPLETED">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      Completed
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() =>
                  openShareModal({
                    id: bounty.id,
                    title: bounty.title,
                    prizeAmount: bounty.prizeAmount,
                    participantCount: bounty._count.participants,
                    submissionCount: bounty._count.submissions,
                  })
                }
              >
                <Share2 className="h-3 w-3" />
                Share
              </Button>

              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => void router.push(`/organization/bounty/edit/${id}`)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main action row (non-creator) ──────────────────────────────── */}
      {!isCreator && session && (
        <div className="px-4 pt-3">
          {winner && !winner.claimedAt && (
            <Button
              className="w-full h-11 font-bold bg-gold hover:bg-gold/90 text-gold-foreground gap-2"
              onClick={() => void handleClaim()}
              disabled={claimXdrM.isLoading || claimM.isLoading}
            >
              {claimXdrM.isLoading || claimM.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crown className="h-4 w-4" />
              )}
              Claim {winner.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
            </Button>
          )}

          {winner?.claimedAt && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary bg-primary/10 rounded-2xl border border-primary/20">
              <CheckCircle2 className="h-4 w-4" />
              Reward claimed
            </div>
          )}

          {!winner && (
            <div className="space-y-2">
              {bounty.status === BountyStatus.PAUSED && isJoined && (
                <div className="flex items-center gap-2 px-4 py-3 bg-warning/10 rounded-2xl border border-warning/20 text-xs text-warning">
                  <Lock className="h-4 w-4 shrink-0" />
                  Submissions are paused.
                </div>
              )}
              {!isJoined && bounty.status === BountyStatus.RUNNING && (
                <Button
                  className="w-full h-11 font-semibold gap-2"
                  onClick={() => joinM.mutate({ bountyId: id })}
                  disabled={joinM.isLoading}
                >
                  {joinM.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Join Bounty
                </Button>
              )}
              {canSubmit && (
                <Button
                  className="w-full h-11 gap-2 font-semibold"
                  variant="outline"
                  onClick={() => setSubmitOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  Submit Report
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              )}
              {bounty.status === BountyStatus.COMPLETED && !isJoined && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  This bounty has ended
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-4">
        <Tabs defaultValue="description">
          <TabsList className="h-9 bg-card border border-border rounded-xl p-1 gap-0 w-full shadow-sm">
            {[
              { value: "description", label: "Description" },
              {
                value: "participants",
                label: "Participants",
                count: bounty._count.participants,
              },
              {
                value: "reports",
                label: isCreator ? "Submissions" : "My Reports",
                count: submissionCount,
              },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-1 h-7 text-[11px] font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground"
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-black/10 text-[9px]">
                    {t.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Description */}
          <TabsContent value="description" className="mt-4 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              {bounty.description ? (
                <Markdown content={bounty.description} />
              ) : (
                <p className="text-xs text-muted-foreground italic">No description provided.</p>
              )}
            </div>
            {bounty.rewardNote && (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Reward Delivery
                </p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {bounty.rewardNote}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Participants */}
          <TabsContent value="participants" className="mt-4">
            {bounty.participants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" />
                <p className="text-xs">No participants yet — be the first!</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {bounty.participants.map((p, idx) => {
                  const isWin = bounty.winners.some((w) => w.userId === p.userId);
                  const winData = bounty.winners.find((w) => w.userId === p.userId);
                  const submitted = submittedUserIds.has(p.userId);
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0",
                        isWin ? "bg-gold/5" : "",
                      )}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">
                        {isWin ? (
                          <Crown className="h-3.5 w-3.5 text-gold mx-auto" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={p.user.image ?? ""} />
                        <AvatarFallback className="text-[9px] bg-secondary">
                          {(p.user.name ?? "U").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {p.user.name ?? "Anonymous"}
                        </p>
                        {isWin && winData && (
                          <p className="text-[10px] text-gold">
                            {winData.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {submitted && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        )}
                        {isWin && (
                          <span className="text-[10px] font-bold text-gold bg-gold/20 border border-gold/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Crown className="h-2.5 w-2.5" />
                            Winner
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Reports / Submissions */}
          <TabsContent value="reports" className="mt-4">
            {isCreator ? (
              <CreatorReportsTab
                submissions={submissionsQ.data ?? []}
                loading={submissionsQ.isLoading}
                maxWinners={bounty.maxWinners}
                currentWinners={bounty._count.winners}
                onSelectWinner={(uid) =>
                  winnerM.mutate({ bountyId: id, winnerId: uid, prizeAmount: perWinner })
                }
                selecting={winnerM.isLoading}
                winnerIds={bounty.winners.map((w) => w.userId)}
                onView={setViewSubmission}
              />
            ) : (
              <UserReportsTab
                submissions={(mySubmissions.data ?? []) as unknown as Submission[]}
                loading={mySubmissions.isLoading}
                onView={setViewSubmission}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Floating right rail (portal — escapes ARLayout stacking context) ── */}
      {mounted && createPortal(
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="max-w-md mx-auto relative h-full">
            {mobilePanel && (
              <div
                className="absolute inset-0 bg-foreground/20 pointer-events-auto"
                onClick={() => setMobilePanel(null)}
              />
            )}

            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pointer-events-auto">
              {mobilePanel && (
                <div className="mr-1 w-64 shadow-xl bg-card border border-border rounded-2xl relative">
                  <button
                    onClick={() => setMobilePanel(null)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-20"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute right-0 top-6 translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary/60 border-2 border-card z-20" />
                  <div className="max-h-[70vh] overflow-y-auto">

                  {mobilePanel === "requirements" && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Requirements</p>
                      </div>
                      {bounty.instructions.length > 0 ? (
                        <div className="space-y-2">
                          {bounty.instructions.map((inst, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <span className="text-muted-foreground leading-snug">{inst}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No specific requirements.</p>
                      )}
                    </div>
                  )}

                  {mobilePanel === "rewards" && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Trophy className="h-3.5 w-3.5 text-gold" />
                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Rewards</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prize pool</p>
                        <p className="text-2xl font-black text-gold">
                          {bounty.prizeAmount.toLocaleString()}
                          <span className="text-sm font-semibold text-muted-foreground ml-1.5">{PLATFORM_ASSET.code}</span>
                        </p>
                      </div>
                      {bounty.maxWinners > 1 && (
                        <div className="border-t border-border pt-2 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Per winner</span>
                            <span className="font-semibold text-foreground">{perWinner.toLocaleString()} {PLATFORM_ASSET.code}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Max winners</span>
                            <span className="font-semibold text-foreground">{bounty.maxWinners}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mobilePanel === "stats" && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Stats</p>
                      </div>
                      {[
                        { icon: <Target className="h-3.5 w-3.5 text-primary" />, label: "Max Winners", value: String(bounty.maxWinners) },
                        { icon: <Users className="h-3.5 w-3.5 text-primary" />, label: "Participants", value: String(bounty._count.participants) },
                        { icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" />, label: "Submissions", value: String(bounty._count.submissions) },
                        { icon: <Crown className="h-3.5 w-3.5 text-gold" />, label: "Winners", value: `${bounty._count.winners} / ${bounty.maxWinners}` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</span>
                          <span className="text-xs font-bold text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {mobilePanel === "winners" && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Crown className="h-3.5 w-3.5 text-gold" />
                        <p className="text-xs font-bold uppercase tracking-wide text-gold">
                          Winners ({bounty.winners.length}/{bounty.maxWinners})
                        </p>
                      </div>
                      {bounty.winners.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No winners yet</p>
                      ) : (
                        <div className="space-y-2.5">
                          {bounty.winners.map((w, i) => (
                            <div key={w.id} className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-gold w-4 shrink-0">#{i + 1}</span>
                              <Avatar className="h-7 w-7 ring-1 ring-gold/30 shrink-0">
                                <AvatarImage src={w.user.image ?? ""} />
                                <AvatarFallback className="text-[9px] bg-gold/10 text-gold">
                                  {(w.user.name ?? "U").charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-foreground truncate">{w.user.name ?? "Anonymous"}</p>
                                <p className="text-[10px] text-gold">{w.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}</p>
                              </div>
                              {w.claimedAt && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  </div>{/* end scroll container */}
                </div>
              )}

              {/* Tab rail */}
              <div className="flex flex-col gap-px">
                {(
                  [
                    { id: "requirements" as const, label: "Req", Icon: FileText },
                    { id: "rewards" as const, label: "Prize", Icon: Trophy },
                    { id: "stats" as const, label: "Stats", Icon: Zap },
                    { id: "winners" as const, label: "Win", Icon: Crown },
                  ] as const
                ).map(({ id: tabId, label, Icon }) => (
                  <button
                    key={tabId}
                    onClick={() => setMobilePanel((prev) => (prev === tabId ? null : tabId))}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 border border-r-0 rounded-l-lg transition-all duration-150",
                      mobilePanel === tabId
                        ? "bg-primary/5 border-primary/40 text-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="[writing-mode:vertical-rl] rotate-180 text-[8px] font-semibold tracking-widest uppercase">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <SubmitReportDialog
        bountyId={id}
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSuccess={() => {
          void mySubmissions.refetch();
          void bountyQ.refetch();
        }}
      />

      <Dialog open={!!viewSubmission} onOpenChange={() => setViewSubmission(null)}>
        <DialogContent className="max-w-sm mx-4 bg-card border-border max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Submission
            </DialogTitle>
          </DialogHeader>
          {viewSubmission && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={viewSubmission.user?.image ?? ""} />
                  <AvatarFallback className="text-xs bg-secondary">
                    {(viewSubmission.user?.name ?? "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {viewSubmission.user?.name ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(viewSubmission.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-xs border capitalize",
                    viewSubmission.status === "APPROVED"
                      ? "border-primary/30 text-primary bg-primary/10"
                      : viewSubmission.status === "REJECTED"
                        ? "border-destructive/30 text-destructive bg-destructive/10"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {viewSubmission.status.toLowerCase()}
                </Badge>
              </div>
              <div className="p-3 rounded-xl bg-secondary border border-border overflow-hidden">
                <Markdown content={viewSubmission.content} />
              </div>
              {viewSubmission.media.length > 0 && (
                <ReportMediaViewer media={viewSubmission.media} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
      <div className="opacity-30">{icon}</div>
      <p className="text-xs">{text}</p>
    </div>
  );
}

/* ── Creator reports tab ─────────────────────────────────────────────────── */
function CreatorReportsTab({
  submissions,
  loading,
  maxWinners,
  currentWinners,
  onSelectWinner,
  selecting,
  winnerIds,
  onView,
}: {
  submissions: Submission[];
  loading: boolean;
  maxWinners: number;
  currentWinners: number;
  onSelectWinner: (uid: string) => void;
  selecting: boolean;
  winnerIds: string[];
  onView: (s: Submission) => void;
}) {
  if (loading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  if (!submissions.length)
    return <EmptyState icon={<FileText className="h-8 w-8" />} text="No submissions yet" />;

  const slotsLeft = maxWinners - currentWinners;

  return (
    <div className="space-y-3">
      {slotsLeft > 0 && (
        <p className="text-xs text-muted-foreground bg-card rounded-xl px-3 py-2 border border-border">
          {slotsLeft} winner slot{slotsLeft > 1 ? "s" : ""} remaining
        </p>
      )}
      {submissions.map((sub) => {
        const isWinner = winnerIds.includes(sub.userId);
        const canSel = slotsLeft > 0 && !isWinner;
        return (
          <div
            key={sub.id}
            className={cn(
              "rounded-2xl border p-4 space-y-3 bg-card",
              isWinner ? "border-gold/30 bg-gold/5" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={sub.user?.image ?? ""} />
                  <AvatarFallback className="text-xs bg-secondary">
                    {(sub.user?.name ?? "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {sub.user?.name ?? "Anonymous"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {isWinner && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/20 border border-gold/30 px-2 py-0.5 rounded-full">
                    <Crown className="h-2.5 w-2.5" />
                    Winner
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onView(sub)}
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
                {canSel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-gold/30 text-gold hover:bg-gold/10 gap-1"
                    onClick={() => onSelectWinner(sub.userId)}
                    disabled={selecting}
                  >
                    {selecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Crown className="h-3 w-3" />
                    )}
                    Select
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="max-h-16 overflow-hidden text-xs text-muted-foreground leading-relaxed">
                <Markdown content={sub.content} compact />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── User reports tab ────────────────────────────────────────────────────── */
function UserReportsTab({
  submissions,
  loading,
  onView,
}: {
  submissions: Submission[];
  loading: boolean;
  onView: (s: Submission) => void;
}) {
  if (loading)
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  if (!submissions.length)
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        text="You haven't submitted yet"
      />
    );

  return (
    <div className="space-y-3">
      {submissions.map((sub) => (
        <div
          key={sub.id}
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs border capitalize",
                  sub.status === "APPROVED"
                    ? "border-primary/30 text-primary bg-primary/10"
                    : sub.status === "REJECTED"
                      ? "border-destructive/30 text-destructive bg-destructive/10"
                      : "border-border text-muted-foreground",
                )}
              >
                {sub.status.toLowerCase()}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onView(sub)}
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
          </div>
          <div className="relative">
            <div className="max-h-16 overflow-hidden text-xs text-muted-foreground leading-relaxed">
              <Markdown content={sub.content} compact />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}

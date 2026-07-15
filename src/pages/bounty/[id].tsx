/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api, type RouterOutputs } from "~/utils/api";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar";
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
import { ActionCamCaptureModal } from "~/components/action-cam/capture-modal";
import { ActionCamGuideCard } from "~/components/action-cam/guide-card";
import { CaptureValidationBadge } from "~/components/action-cam/validation-badge";
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
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Zap,
  ArrowRight,
  ExternalLink,
  Camera,
  Video,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { PLATFORM_ASSET, stellarExpertUrl } from "~/lib/stellar/constant";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { cn } from "~/lib/utils";
import { useShareBountyModalStore } from "~/components/store/share-bounty-modal-store";
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store";
import useNeedSign from "~/lib/hook";
/* ── Types ───────────────────────────────────────────────────────────────────── */
interface Submission {
  id: number; userId: string; content: string; status: string; createdAt: Date;
  bountyId: number;
  user?: { id: string; name: string | null; image: string | null };
  media: { id: number; url: string; type: string; fileName: string | null }[];
  captures?: {
    id: number; captureType: string; status: string;
    capturePreviewUrl: string | null; captureStorageUrl: string;
    captureOriginalHash: string; createdAt: Date;
    validation?: { live: boolean; stamped: boolean; sealed: boolean; sealedAt: Date | null } | null;
  }[];
}

/* ── Status config ───────────────────────────────────────────────────────────── */
const statusCfg: Record<BountyStatus, { label: string; dot: string; pill: string }> = {
  RUNNING: { label: "Live", dot: "bg-primary animate-pulse", pill: "bg-primary/10 text-primary border-primary/30" },
  PAUSED: { label: "Paused", dot: "bg-warning", pill: "bg-warning/10 text-warning border-warning/25" },
  COMPLETED: { label: "Ended", dot: "bg-muted-foreground", pill: "bg-secondary text-muted-foreground border-border" },
};

function accentGradient(amount: number) {
  if (amount >= 10000) return "from-gold via-gold/70 to-warning";
  if (amount >= 1000) return "from-violet-500 via-purple-400 to-fuchsia-500";
  return "from-primary via-emerald-400 to-teal-500";
}

/* ── Page ────────────────────────────────────────────────────────────────────── */
export default function BountyDetailPage() {
  const router = useRouter();
  const { needSign } = useNeedSign();
  const id = parseInt(router.query.id as string);
  const { data: session } = useSession();
  const openShareModal = useShareBountyModalStore((s) => s.open);
  const { setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore();

  const [submitOpen, setSubmitOpen] = useState(false);
  const [showMoreReqs, setShowMoreReqs] = useState(false);
  const moreReqsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [moreReqsPos, setMoreReqsPos] = useState<{ top: number; left: number } | null>(null);

  // Recompute the popover position from the trigger button's bounding rect.
  // Closes the popover if the trigger scrolls out of view.
  useLayoutEffect(() => {
    if (!showMoreReqs) return;
    const update = () => {
      const btn = moreReqsTriggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      // If the trigger has scrolled out of the visible viewport, close the popover.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setShowMoreReqs(false);
        return;
      }
      setMoreReqsPos({
        top: rect.bottom + 8, // 8px = mt-2
        left: rect.left,
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", update);
    };
  }, [showMoreReqs]);

  // SSR guard for createPortal
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [lightboxItem, setLightboxItem] = useState<{ url: string; type: string } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"participants" | "rewards" | "stats" | "winners" | null>(null);
  const [actionCamOpen, setActionCamOpen] = useState(false);

  /* queries */
  const bountyQ = api.bounty.Bounty.getBounty.useQuery({ bountyId: id }, { enabled: !!id });
  const bounty = bountyQ.data;
  const isOwner = session?.user?.id === bounty?.userId;

  const ownerQ = api.bounty.Bounty.getBountyForOwner.useQuery({ bountyId: id }, { enabled: !!id && isOwner });
  const submissionsQ = api.bounty.Bounty.getBountySubmissions.useQuery({ bountyId: id }, { enabled: !!id && isOwner });
  const myParticipation = api.bounty.Bounty.getMyParticipation.useQuery({ bountyId: id }, { enabled: !!id && !!session && !isOwner });
  const mySubmissions = api.bounty.Bounty.getMySubmissions.useQuery({ bountyId: id }, { enabled: !!id && !!session && !isOwner });

  /* mutations */
  const joinM = api.bounty.Bounty.joinBounty.useMutation({ onSuccess: () => { toast.success("Joined!"); void myParticipation.refetch(); void bountyQ.refetch(); }, onError: (e) => toast.error(e.message) });
  const statusM = api.bounty.Bounty.updateBountyStatus.useMutation({ onSuccess: () => { toast.success("Status updated"); void bountyQ.refetch(); void ownerQ.refetch(); }, onError: (e) => toast.error(e.message) });
  const selectWinnerXdrM = api.bounty.Bounty.getSelectWinnerXDR.useMutation({ onError: (e) => toast.error(e.message) });
  const winnerM = api.bounty.Bounty.selectWinner.useMutation({ onSuccess: () => { toast.success("Winner selected!"); void submissionsQ.refetch(); void bountyQ.refetch(); }, onError: (e) => toast.error(e.message) });
  const claimXdrM = api.bounty.Bounty.getClaimRewardXDR.useMutation({ onError: (e) => toast.error(e.message) });
  const claimM = api.bounty.Bounty.claimReward.useMutation({ onSuccess: () => { toast.success("Reward claimed!"); void myParticipation.refetch(); }, onError: (e) => toast.error(e.message) });

  const handleClaim = async () => {
    if (!session?.user) return;
    try {
      const result = await claimXdrM.mutateAsync({ bountyId: id, signWith: needSign() });
      let txHash: string | undefined;
      if (result.needsUserSign) {
        // User must sign changeTrust op / escrow claim; clientsign signs + submits the tx
        const submitted = await clientsign({
          presignedxdr: result.xdr,
          walletType: session.user.walletType,
          pubkey: session.user.id,
          test: clientSelect(),
        });
        if (!submitted) throw new Error("Transaction signing was cancelled.");
        txHash = extractTxHash(submitted);
      } else {
        const submitted = await submitSignedXDRToServer4User(result.xdr);
        txHash = extractTxHash(submitted);
      }
      if (!txHash) throw new Error("Claim transaction could not be confirmed.");
      await claimM.mutateAsync({ bountyId: id, txHash });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to claim reward");
    }
  };

  // Commits the winner's award on-chain first (creator-signed — auto-signed
  // server-side if this bounty was funded from the creator's storage account),
  // then records the winner row once that transaction is confirmed.
  const handleSelectWinner = async (winnerId: string, prizeAmount: number) => {
    if (!session?.user) return;
    try {
      const result = await selectWinnerXdrM.mutateAsync({
        bountyId: id,
        winnerId,
        prizeAmount,
        signWith: needSign(),
      });
      let txHash: string | undefined;
      if (result.needsUserSign) {
        const submitted = await clientsign({
          presignedxdr: result.xdr,
          walletType: session.user.walletType,
          pubkey: session.user.id,
          test: clientSelect(),
        });
        if (!submitted) throw new Error("Transaction signing was cancelled.");
        txHash = extractTxHash(submitted);
      } else {
        const submitted = await submitSignedXDRToServer4User(result.xdr);
        txHash = extractTxHash(submitted);
      }
      if (!txHash) throw new Error("Selection transaction could not be confirmed.");
      await winnerM.mutateAsync({ bountyId: id, winnerId, prizeAmount, txHash });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to select winner");
    }
  };

  /* Rules of Hooks: must be above every early return */
  const submittedUserIds = useMemo(() => {
    if (!bounty) return new Set<string>();
    if (isOwner && submissionsQ.data) return new Set(submissionsQ.data.map((s) => s.userId));
    if (!isOwner && session?.user?.id && mySubmissions.data?.length) return new Set([session.user.id]);
    return new Set<string>();
  }, [bounty, isOwner, submissionsQ.data, mySubmissions.data, session]);

  /* loading / not found */
  if (bountyQ.isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );
  if (!bounty) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <AlertCircle className="h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">Bounty not found</p>
      <Button variant="outline" onClick={() => void router.push("/bounty")}>Browse Bounties</Button>
    </div>
  );

  /* bounty is guaranteed non-null past this point */
  const sc = statusCfg[bounty.status];
  const prizeAssetCode = bounty.prizeAssetCode;
  const prizeAssetIssuer = bounty.prizeAssetIssuer;
  const prizeExpertUrl = stellarExpertUrl(prizeAssetCode, prizeAssetIssuer);
  const isJoined = myParticipation.data?.joined ?? false;
  const winner = myParticipation.data?.winner;
  const canSubmit = isJoined && bounty.status === BountyStatus.RUNNING && !isOwner;
  const perWinner = bounty.prizeAmount / bounty.maxWinners;
  const visibleReqs = bounty.instructions.slice(0, 4);
  const extraReqs = bounty.instructions.slice(4);

  return (
    <div className="min-h-screen bg-background">

      {/* ── COVER ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-card overflow-hidden">
        {/* Accent top bar */}
        <div className={cn("h-[3px] w-full bg-gradient-to-r relative z-10", accentGradient(bounty.prizeAmount))} />
        {/* Cover image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/bounty-header.jpg')" }}
        />
        {/* Overlay so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/60" />
        <div className="relative max-w-6xl mx-auto px-4 pt-10  ">
          {/* Back */}
          <button
            onClick={() => void router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-stretch pb-2">

            {/* ── Left: creator + title + info ──────────────────────────── */}
            <div className="space-y-5 flex-1">
              <div className=" flex flex-col gap-5 w-full h-full">
                <div className="flex flex-col gap-5 w-full h-full  justify-between">
                  {/* Badges row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wide", sc.pill)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sc.dot)} />
                        {sc.label}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-secondary text-[11px] font-semibold text-muted-foreground">
                        <Trophy className="h-3 w-3 text-gold" />
                        Bounty
                      </span>
                      {bounty.requiresActionCam && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary">
                          <Camera className="h-3 w-3" />
                          Action Cam required
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl md:text-[30px] font-extrabold leading-tight tracking-tight">
                      {bounty.title}
                    </h1>

                    {/* Summary */}
                    <p className="text-muted-foreground leading-relaxed text-[15px] max-w-2xl min-h-[80px]">
                      {bounty.summary ?? ""}
                    </p>
                  </div>

                  {/* Creator meta */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>By</span>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={bounty.user.image ?? ""} />
                          <AvatarFallback className="text-[9px] bg-secondary">{(bounty.user.name ?? "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold text-foreground">{bounty.user.name ?? "Unknown"}</span>
                      </div>
                    </div>
                    <span className="hidden md:inline h-3 w-px bg-border" />
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Creator actions toolbar */}
                  {isOwner && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="hidden md:block">
                        <Select
                          value={bounty.status}
                          onValueChange={(s) => statusM.mutate({ bountyId: id, status: s as BountyStatus })}
                          disabled={statusM.isLoading}
                        >
                          <SelectTrigger className="border-border bg-secondary h-9 text-xs w-[150px]">
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
                                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
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
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border hidden md:inline-flex"
                        onClick={() => openShareModal({
                          id: bounty.id,
                          title: bounty.title,
                          prizeAmount: bounty.prizeAmount,
                          participantCount: bounty._count.participants,
                          submissionCount: bounty._count.submissions,
                        })}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        className="h-9 gap-1.5 hidden md:inline-flex"
                        onClick={() => void router.push(`/bounty/edit/${id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </div>


            </div>

            {/* ── Right: glass requirements card ────────────────────────── */}
            <div className="hidden lg:block rounded-2xl backdrop-blur-xl border border-border/40 p-5 space-y-4 shadow-md">

              {/* Status line */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Requirements</span>
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold", sc.pill)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", sc.dot)} />
                  {sc.label}
                </span>
              </div>

              {/* Requirements list */}
              {bounty.instructions.length > 0 ? (
                <div className="space-y-2.5">
                  {visibleReqs.map((inst, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground leading-snug">{inst}</span>
                    </div>
                  ))}

                  {/* More requirements sticky popup */}
                  {extraReqs.length > 0 && (
                    <div className="relative">
                      <button
                        ref={moreReqsTriggerRef}
                        onClick={() => setShowMoreReqs((v) => !v)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                      >
                        {showMoreReqs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {showMoreReqs ? "Show less" : `+${extraReqs.length} more`}
                      </button>

                      {showMoreReqs && mounted && moreReqsPos &&
                        createPortal(
                          <>
                            <div
                              className="fixed inset-0 z-[100]"
                              onClick={() => setShowMoreReqs(false)}
                            />
                            <div
                              className="fixed z-[101] w-72 max-h-[60vh] overflow-y-auto bg-card border border-border rounded-2xl p-4 shadow-2xl space-y-2.5"
                              style={{ top: moreReqsPos.top, left: moreReqsPos.left }}
                            >
                              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground pb-1 border-b border-border">
                                All requirements
                              </p>
                              {bounty.instructions.map((inst, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <span className="text-muted-foreground leading-snug">{inst}</span>
                                </div>
                              ))}
                              {/* Arrow tip pointing up to the trigger button */}
                              <div className="absolute -top-[7px] left-6 h-3 w-3 rotate-45 bg-card border-l border-t border-border" />
                            </div>
                          </>,
                          document.body,
                        )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No specific requirements listed.</p>
              )}


              {/* User actions (not winner) */}
              {!isOwner && !winner && session && (
                <>
                  {bounty.status === BountyStatus.PAUSED && isJoined && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-muted-foreground leading-snug">Submissions are paused.</p>
                    </div>
                  )}

                  {canSubmit && (
                    <Button
                      className="w-full h-11 gap-2 font-semibold"
                      onClick={() =>
                        bounty.requiresActionCam
                          ? setActionCamOpen(true)
                          : setSubmitOpen(true)
                      }
                    >
                      {bounty.requiresActionCam ? (
                        <Camera className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {bounty.requiresActionCam ? "Open Action Cam" : "Submit Report"}
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Button>
                  )}
                  {bounty.status === BountyStatus.COMPLETED && !isJoined && (
                    <div className="text-xs text-muted-foreground text-center py-1">This bounty has ended</div>
                  )}
                </>
              )}

              {/* Guest */}
              {!isOwner && !session && bounty.status === BountyStatus.RUNNING && (
                <Button className="w-full h-11 gap-2 font-semibold" onClick={() => setLoginModalOpen(true)}>
                  <Users className="h-4 w-4" />
                  Join Bounty
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile action footer (hidden on lg+) ─────────────────────────────── */}
      {
        !isOwner && (
          <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
            <div className="mx-4 mb-4 rounded-2xl border border-border bg-background/95 backdrop-blur-xl p-3 shadow-xl">
              {winner && !winner.claimedAt ? (
                <Button
                  className="w-full h-11 font-bold bg-gold hover:bg-gold/90 text-gold-foreground gap-2"
                  onClick={() => void handleClaim()}
                  disabled={claimXdrM.isLoading || claimM.isLoading}
                >
                  {(claimXdrM.isLoading || claimM.isLoading)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Crown className="h-4 w-4" />}
                  Claim {winner.prizeAmount.toLocaleString()} {prizeAssetCode}
                </Button>
              ) : winner?.claimedAt ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Reward claimed
                </div>

              ) : (!isOwner && !winner && session) ? (
                <div className="space-y-2">
                  {bounty.status === BountyStatus.PAUSED && isJoined && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-muted-foreground leading-snug">Submissions are paused.</p>
                    </div>
                  )}
                  {!isJoined && bounty.status === BountyStatus.RUNNING && (
                    <Button
                      className="w-full h-11 font-semibold gap-2"
                      onClick={() => joinM.mutate({ bountyId: id })}
                      disabled={joinM.isLoading}
                    >
                      {joinM.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Join Bounty
                    </Button>
                  )}
                  {canSubmit && (
                    <Button
                      className="w-full h-11 gap-2 font-semibold"
                      onClick={() =>
                        bounty.requiresActionCam
                          ? setActionCamOpen(true)
                          : setSubmitOpen(true)
                      }
                    >
                      {bounty.requiresActionCam ? (
                        <Camera className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {bounty.requiresActionCam ? "Open Action Cam" : "Submit Report"}
                    </Button>
                  )}
                  {bounty.status === BountyStatus.COMPLETED && !isJoined && (
                    <div className="text-xs text-muted-foreground text-center py-1">This bounty has ended</div>
                  )}
                </div>
              ) : (!isOwner && !session && bounty.status === BountyStatus.RUNNING) ? (
                <Button className="w-full h-11 gap-2 font-semibold" onClick={() => setLoginModalOpen(true)}>
                  <Users className="h-4 w-4" />
                  Join Bounty
                </Button>
              ) : null}
            </div>
          </div>
        )
      }

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start">

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div className="min-w-0">
            <Tabs defaultValue="description">
              <TabsList className="h-12 bg-secondary/50 rounded-2xl p-1.5 gap-1 w-full justify-start border border-border/40">
                {[
                  { value: "description", label: "Description" },
                  { value: "requirements", label: "Requirements", className: "lg:hidden" },
                  { value: "participants", label: "Participants", className: "hidden lg:inline-flex" },
                  { value: "reports", label: isOwner ? "Submissions" : "My Reports" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className={cn(
                      "rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground px-3 sm:px-4 h-9 text-sm font-medium transition-all",
                      t.className,
                    )}
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Description tab */}
              <TabsContent value="description" className="mt-6 space-y-5">
                {bounty.description ? (
                  <Markdown content={bounty.description} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}
                {bounty.rewardNote && (
                  <div className="p-4 rounded-xl border border-border bg-card space-y-1">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Reward Delivery</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bounty.rewardNote}</p>
                  </div>
                )}
              </TabsContent>

              {/* Requirements tab (md/sm only — replaces Participants on small screens) */}
              <TabsContent value="requirements" className="mt-6">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Requirements</span>
                    <span className="text-xs text-muted-foreground">
                      {bounty.instructions.length} item{bounty.instructions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <RequirementsList instructions={bounty.instructions} />
                </div>
              </TabsContent>

              {/* Participants tab (lg+ only — replaced by Requirements on md/sm) */}
              <TabsContent value="participants" className="mt-6">
                <ParticipantsTable
                  participants={bounty.participants}
                  winners={bounty.winners}
                  prizeAssetCode={prizeAssetCode}
                  submittedUserIds={submittedUserIds}
                />
              </TabsContent>

              {/* Reports tab */}
              <TabsContent value="reports" className="mt-6">
                {isOwner ? (
                  <CreatorReportsTab
                    submissions={submissionsQ.data ?? []}
                    loading={submissionsQ.isLoading}
                    maxWinners={bounty.maxWinners}
                    currentWinners={bounty._count.winners}
                    onSelectWinner={(uid) => void handleSelectWinner(uid, perWinner)}
                    selecting={selectWinnerXdrM.isLoading || winnerM.isLoading}
                    winnerIds={bounty.winners.map((w) => w.userId)}
                    requiresActionCam={bounty.requiresActionCam}
                    onOpenMedia={setLightboxItem}
                  />
                ) : (
                  <>
                    {bounty.requiresActionCam &&
                      canSubmit &&
                      !mySubmissions.isLoading &&
                      (mySubmissions.data?.length ?? 0) === 0 && (
                        <ActionCamGuideCard
                          onOpenCapture={() => setActionCamOpen(true)}
                        />
                      )}
                    <UserReportsTab
                      submissions={(mySubmissions.data ?? []) as unknown as Submission[]}
                      loading={mySubmissions.isLoading}
                      requiresActionCam={bounty.requiresActionCam}
                      onOpenMedia={setLightboxItem}
                    />
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Right sidebar (rewards / stats / winners) ────────────────── */}
          <div className="hidden lg:block space-y-4 lg:sticky lg:top-6">

            {/* Prize / Rewards */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <p className="text-sm font-bold">Rewards</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Prize pool</p>
                <p className="text-2xl font-black text-gold leading-none">
                  {bounty.prizeAmount.toLocaleString()}
                  <a
                    href={prizeExpertUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-sm font-semibold text-muted-foreground ml-1.5 hover:text-primary transition-colors"
                    title={`View ${prizeAssetCode} on Stellar Expert`}
                  >
                    {prizeAssetCode}
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>
                </p>
              </div>
              {bounty.maxWinners > 1 && (
                <div className="pt-1 border-t border-border space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Per winner </span>
                    <span className="font-semibold">{perWinner.toLocaleString()} {prizeAssetCode}</span>
                  </div>
                </div>
              )}

              {(winner || (!isOwner && !session && bounty.status === BountyStatus.RUNNING)) && (
                <div className="border-t border-border/60 pt-4" />
              )}

              {winner && !winner.claimedAt && (
                <Button
                  className="w-full h-11 font-bold bg-gold hover:bg-gold/90 text-gold-foreground gap-2"
                  onClick={() => void handleClaim()}
                  disabled={claimXdrM.isLoading || claimM.isLoading}
                >
                  {(claimXdrM.isLoading || claimM.isLoading)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Crown className="h-4 w-4" />}
                  Claim {winner.prizeAmount.toLocaleString()} {prizeAssetCode}
                </Button>
              )}
              {winner?.claimedAt && (
                <div className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Reward claimed
                </div>
              )}

              {!isOwner && !winner && session && (
                <div className="space-y-2">
                  {bounty.status === BountyStatus.PAUSED && isJoined && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <Lock className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-muted-foreground leading-snug">Submissions are paused.</p>
                    </div>
                  )}
                  {!isJoined && bounty.status === BountyStatus.RUNNING && (
                    <Button
                      className="w-full h-11 font-semibold gap-2"
                      onClick={() => joinM.mutate({ bountyId: id })}
                      disabled={joinM.isLoading}
                    >
                      {joinM.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                      Join Bounty
                    </Button>
                  )}


                </div>
              )}

              {!isOwner && !session && bounty.status === BountyStatus.RUNNING && (
                <Button className="w-full h-11 gap-2 font-semibold" onClick={() => setLoginModalOpen(true)}>
                  <Users className="h-4 w-4" />
                  Join Bounty
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pb-2">Stats</p>
              {[
                { icon: <Users className="h-3.5 w-3.5 text-primary" />, label: "Participants", value: String(bounty._count.participants) },
                { icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" />, label: "Submissions", value: String(bounty._count.submissions) },
                { icon: <Crown className="h-3.5 w-3.5 text-gold" />, label: "Winners", value: `${bounty._count.winners} / ${bounty.maxWinners}` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</span>
                  <span className="text-xs font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>

            {/* Winners */}
            {bounty.winners.length > 0 && (
              <div className="rounded-2xl border border-gold/20 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gold" />
                  <p className="text-sm font-bold text-gold">
                    Winners
                    <span className="ml-1 text-xs font-normal text-gold/60">({bounty.winners.length}/{bounty.maxWinners})</span>
                  </p>
                </div>
                {bounty.winners.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-gold/60 w-4 shrink-0">#{i + 1}</span>
                    <Avatar className="h-7 w-7 ring-1 ring-gold/30 shrink-0">
                      <AvatarImage src={w.user.image ?? ""} />
                      <AvatarFallback className="text-[9px] bg-gold/10 text-gold">{(w.user.name ?? "U").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{w.user.name ?? "Anonymous"}</p>
                      <p className="text-[11px] text-gold/80">{w.prizeAmount.toLocaleString()} {prizeAssetCode}</p>
                    </div>
                    {w.claimedAt && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <SubmitReportDialog
        bountyId={id}
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSuccess={() => { void mySubmissions.refetch(); void bountyQ.refetch(); }}
      />

      <ActionCamCaptureModal
        open={actionCamOpen}
        onOpenChange={setActionCamOpen}
        bountyId={id}
        onSubmitted={() => {
          void mySubmissions.refetch();
          void bountyQ.refetch();
        }}
      />

      {/* Media lightbox */}
      <Dialog open={!!lightboxItem} onOpenChange={() => setLightboxItem(null)}>
        <DialogContent
          className="!max-w-none !w-screen !h-screen !max-h-screen p-0 gap-0 bg-background text-foreground border-border rounded-none top-0 left-0 translate-x-0 translate-y-0 overflow-hidden flex flex-col"
          showCloseButton={false}
        >
          {lightboxItem && (
            <>
              {/* Top bar */}
              <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0 bg-card/30 backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    {lightboxItem.type === "VIDEO" ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : lightboxItem.type === "IMAGE" || lightboxItem.type === "PHOTO" ? (
                      <Camera className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-sm font-bold tracking-wide">
                      {lightboxItem.type === "VIDEO" ? "Video" : lightboxItem.type === "IMAGE" || lightboxItem.type === "PHOTO" ? "Image" : "File"}
                    </DialogTitle>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {lightboxItem.type === "VIDEO" ? "Video player" : lightboxItem.type === "IMAGE" || lightboxItem.type === "PHOTO" ? "Full resolution" : "Download available"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted">
                    <a href={lightboxItem.url} target="_blank" rel="noopener noreferrer" title="Download">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted">
                    <a href={lightboxItem.url} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setLightboxItem(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              {/* Media viewer */}
              <div className="flex-1 flex items-center justify-center bg-foreground/[0.03] overflow-hidden p-4 sm:p-6">
                {(lightboxItem.type === "IMAGE" || lightboxItem.type === "PHOTO") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxItem.url}
                    alt="Full size"
                    className="max-h-[calc(100vh-8rem)] max-w-full object-contain rounded-xl shadow-2xl"
                  />
                )}
                {lightboxItem.type === "VIDEO" && (
                  <video
                    src={lightboxItem.url}
                    className="max-h-[calc(100vh-8rem)] max-w-full rounded-xl shadow-2xl"
                    controls
                    autoPlay
                    playsInline
                  />
                )}
                {lightboxItem.type !== "IMAGE" && lightboxItem.type !== "PHOTO" && lightboxItem.type !== "VIDEO" && (
                  <div className="flex flex-col items-center gap-5 py-12">
                    <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-foreground">No preview available</p>
                      <p className="text-xs text-muted-foreground">This file type cannot be previewed in the browser</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a href={lightboxItem.url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download file
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="mr-1 w-80 max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="relative bg-card border border-border px-4 py-2">
                {/* Close button */}
                <button
                  onClick={() => setMobilePanel(null)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Participants panel (replaces Requirements slot on md/sm) */}
                {mobilePanel === "participants" && (
                  <div className="space-y-2 -mx-2">
                    <div className="flex items-center gap-2 px-2">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-wide">Participants</p>
                      <span className="ml-auto text-xs text-muted-foreground">{bounty._count.participants}</span>
                    </div>
                    <ParticipantsTable
                      participants={bounty.participants}
                      winners={bounty.winners}
                      prizeAssetCode={prizeAssetCode}
                      submittedUserIds={submittedUserIds}
                    />
                  </div>
                )}

                {/* Rewards panel */}
                {mobilePanel === "rewards" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5 text-gold" />
                      <p className="text-xs font-semibold uppercase tracking-wide">Rewards</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Prize pool</p>
                      <p className="text-2xl font-black text-gold leading-none">
                        {bounty.prizeAmount.toLocaleString()}
                        <a
                          href={prizeExpertUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-sm font-semibold text-muted-foreground ml-1.5 hover:text-primary transition-colors"
                          title={`View ${prizeAssetCode} on Stellar Expert`}
                        >
                          {prizeAssetCode}
                          <ExternalLink className="h-3 w-3 ml-0.5" />
                        </a>
                      </p>
                    </div>
                    {bounty.maxWinners > 1 && (
                      <div className="pt-1 border-t border-border space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Per winner</span>
                          <span className="font-semibold">{perWinner.toLocaleString()} {prizeAssetCode}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats panel */}
                {mobilePanel === "stats" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-wide">Stats</p>
                    </div>
                    <div className="space-y-1">
                      {[
                        { icon: <Target className="h-3.5 w-3.5 text-primary" />, label: "Max Winners", value: String(bounty.maxWinners) },
                        { icon: <Users className="h-3.5 w-3.5 text-primary" />, label: "Participants", value: String(bounty._count.participants) },
                        { icon: <FileText className="h-3.5 w-3.5 text-muted-foreground" />, label: "Submissions", value: String(bounty._count.submissions) },
                        { icon: <Crown className="h-3.5 w-3.5 text-gold" />, label: "Winners", value: `${bounty._count.winners} / ${bounty.maxWinners}` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</span>
                          <span className="text-xs font-bold text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Winners panel */}
                {mobilePanel === "winners" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3.5 w-3.5 text-gold" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                        Winners
                        <span className="ml-1 text-xs font-normal text-gold/60">({bounty.winners.length}/{bounty.maxWinners})</span>
                      </p>
                    </div>
                    {bounty.winners.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No winners yet</p>
                    ) : (
                      <div className="space-y-2">
                        {bounty.winners.map((w, i) => (
                          <div key={w.id} className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-gold/60 w-4 shrink-0">#{i + 1}</span>
                            <Avatar className="h-7 w-7 ring-1 ring-gold/30 shrink-0">
                              <AvatarImage src={w.user.image ?? ""} />
                              <AvatarFallback className="text-[9px] bg-gold/10 text-gold">{(w.user.name ?? "U").charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate">{w.user.name ?? "Anonymous"}</p>
                              <p className="text-[11px] text-gold/80">{w.prizeAmount.toLocaleString()} {prizeAssetCode}</p>
                            </div>
                            {w.claimedAt && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab rail */}
          <div className="flex flex-col  gap-2">
            {[
              // On md/sm the first rail slot is now Participants (the table moved here).
              { id: "participants" as const, label: "Participants", Icon: Users },
              { id: "rewards" as const, label: "Rewards", Icon: Trophy },
              { id: "stats" as const, label: "Stats", Icon: Zap },
              { id: "winners" as const, label: "Winners", Icon: Crown },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMobilePanel((prev) => (prev === id ? null : id))}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 border border-r-0 rounded-l-lg transition-all duration-150",
                  mobilePanel === id
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
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────────── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-16 w-16 rounded-2xl bg-secondary border border-border/50 flex items-center justify-center text-muted-foreground/30">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}

/* ── Creator reports tab ─────────────────────────────────────────────────────── */
function CreatorReportsTab({
  submissions, loading, maxWinners, currentWinners,
  onSelectWinner, selecting, winnerIds, requiresActionCam, onOpenMedia,
}: {
  submissions: Submission[]; loading: boolean; maxWinners: number; currentWinners: number;
  onSelectWinner: (uid: string) => void; selecting: boolean; winnerIds: string[];
  requiresActionCam: boolean;
  onOpenMedia: (item: { url: string; type: string }) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpandedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded-lg bg-secondary animate-pulse" />
              <div className="h-3 w-20 rounded-lg bg-secondary animate-pulse" />
            </div>
          </div>
          <div className="px-4 pb-4"><div className="h-16 rounded-xl bg-secondary/50 animate-pulse" /></div>
        </div>
      ))}
    </div>
  );
  if (!submissions.length) return <EmptyState icon={<FileText className="h-8 w-8" />} text="No submissions yet" />;

  const slotsLeft = maxWinners - currentWinners;

  return (
    <div className="space-y-3">
      {slotsLeft > 0 && (
        <div className="flex items-center gap-2.5 text-xs bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
          <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-primary font-medium">{slotsLeft} winner slot{slotsLeft > 1 ? "s" : ""} remaining</span>
        </div>
      )}
      {submissions.map((sub) => {
        const isWinner = winnerIds.includes(sub.userId);
        const canSel = slotsLeft > 0 && !isWinner;
        const captures = sub.captures ?? [];
        const media = sub.media ?? [];
        const isExpanded = expandedIds.has(sub.id);
        const shouldTruncate = !requiresActionCam && (sub.content?.length ?? 0) > 250;

        return (
          <div
            key={sub.id}
            className={cn(
              "rounded-2xl border overflow-hidden transition-all duration-200",
              isWinner
                ? "border-gold/30 bg-gradient-to-br from-gold/[0.04] via-card to-card"
                : "border-border bg-card",
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={sub.user?.image ?? ""} />
                    <AvatarFallback className="text-xs bg-secondary font-semibold">{(sub.user?.name ?? "U").charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isWinner && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-gold flex items-center justify-center ring-2 ring-card">
                      <Crown className="h-2.5 w-2.5 text-gold-foreground" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{sub.user?.name ?? "Anonymous"}</p>
                    {isWinner && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full shrink-0">
                        Winner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canSel && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20 gap-1.5"
                    onClick={() => onSelectWinner(sub.userId)}
                    disabled={selecting}
                  >
                    {selecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />}
                    <span className="hidden sm:inline">Select Winner</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Markdown content — show whenever the submission has text.
                Action Cam submissions store content="" so they won't render this. */}
            {sub.content && (
              <div className="px-4 pb-3">
                <div className={cn(
                  "text-sm text-muted-foreground leading-relaxed",
                  !isExpanded && shouldTruncate && "line-clamp-4",
                )}>
                  <Markdown content={isExpanded || !shouldTruncate ? sub.content : sub.content.slice(0, 250) + "…"} compact />
                </div>
                {shouldTruncate && (
                  <button
                    onClick={() => toggleExpand(sub.id)}
                    className="mt-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    {isExpanded ? "Show less" : "Continue reading"}
                  </button>
                )}
              </div>
            )}

            {/* Media grid — captures + legacy combined — owner gets download + validation */}
            {(captures.length > 0 || media.length > 0) && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {captures.map((cap) => (
                    <div key={`cap-${cap.id}`} className="group/card rounded-xl border border-border bg-muted overflow-hidden">
                      <button
                        onClick={() => onOpenMedia({ url: cap.captureStorageUrl, type: cap.captureType })}
                        className="group/thumb relative w-full aspect-square overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cap.capturePreviewUrl ?? cap.captureStorageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform group-hover/thumb:scale-105"
                        />
                        <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
                          {cap.captureType === "VIDEO" ? <Video className="h-2.5 w-2.5 text-background" /> : <Camera className="h-2.5 w-2.5 text-background" />}
                        </div>
                        <div className="absolute inset-0 bg-foreground/0 group-hover/thumb:bg-foreground/20 transition-colors" />
                      </button>
                      <div className="px-1.5 py-1 flex items-center justify-between gap-1">
                        {cap.validation ? (
                          <CaptureValidationBadge validation={cap.validation} compact />
                        ) : (
                          <span className="text-[10px] text-muted-foreground uppercase">{cap.captureType}</span>
                        )}
                        <a href={cap.captureStorageUrl} target="_blank" rel="noopener noreferrer" className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Download">
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                  {media.map((m) => (
                    <div key={`med-${m.id}`} className="group/card rounded-xl border border-border bg-muted overflow-hidden">
                      <button
                        onClick={() => onOpenMedia({ url: m.url, type: m.type })}
                        className="group/thumb relative w-full aspect-square overflow-hidden"
                      >
                        {m.type === "IMAGE" ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="h-full w-full object-cover transition-transform group-hover/thumb:scale-105" />
                            <div className="absolute inset-0 bg-foreground/0 group-hover/thumb:bg-foreground/20 transition-colors" />
                          </>
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 bg-secondary">
                            {m.type === "VIDEO" ? <Video className="h-6 w-6 text-muted-foreground" /> : <FileText className="h-6 w-6 text-muted-foreground" />}
                            <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-1">{m.fileName ?? m.type.toLowerCase()}</span>
                          </div>
                        )}
                      </button>
                      <div className="px-1.5 py-1 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase truncate">{m.type}</span>
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Download">
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Participants table (shared by main content tab + mobile rail) ──────────── */
function ParticipantsTable({
  participants,
  winners,
  prizeAssetCode,
  submittedUserIds,
}: {
  participants: RouterOutputs["bounty"]["Bounty"]["getBounty"]["participants"];
  winners: RouterOutputs["bounty"]["Bounty"]["getBounty"]["winners"];
  prizeAssetCode: string;
  submittedUserIds: Set<string>;
}) {
  if (participants.length === 0) {
    return <EmptyState icon={<Users className="h-8 w-8" />} text="No participants yet — be the first to join!" />;
  }
  // Hoist per-row derived values so they're computed once and reused in both renders.
  const rows = participants.map((p, idx) => {
    const isWin = winners.some((w) => w.userId === p.userId);
    const winData = winners.find((w) => w.userId === p.userId);
    const submitted = submittedUserIds.has(p.userId);
    return { p, idx, isWin, winData, submitted };
  });
  return (
    <>
      {/* Mobile / tablet — vertical card list (fits inside the 320px floating rail, no horizontal scroll) */}
      <div className="lg:hidden space-y-2">
        {rows.map(({ p, idx, isWin, winData, submitted }) => (
          <div
            key={p.id}
            className={cn(
              "rounded-xl border p-3 flex items-center gap-3",
              isWin ? "border-gold/25 bg-gold/5" : "border-border bg-card",
            )}
          >
            <div className="relative shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.user.image ?? ""} />
                <AvatarFallback className="text-[10px] bg-secondary">{(p.user.name ?? "U").charAt(0)}</AvatarFallback>
              </Avatar>
              {isWin && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-card border border-gold/30 flex items-center justify-center">
                  <Crown className="h-2.5 w-2.5 text-gold" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate">{p.user.name ?? "Anonymous"}</span>
                <span className="shrink-0 text-[10px] font-bold text-muted-foreground/70 tabular-nums">#{idx + 1}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                <span className="truncate">Joined {formatDistanceToNow(new Date(p.joinedAt), { addSuffix: true })}</span>
                {submitted && (
                  <span className="inline-flex items-center gap-1 text-primary shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    Submitted
                  </span>
                )}
              </div>
              {isWin && winData && (
                <p className="text-xs font-bold text-gold mt-0.5">
                  Won {winData.prizeAmount.toLocaleString()} {prizeAssetCode}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop — original table (unchanged content, only its wrapper is now lg+ only) */}
      <div className="hidden lg:block rounded-xl border border-border overflow-x-auto scrollbar-hide">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wide w-10">#</th>
              <th className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Participant</th>
              <th className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Joined</th>
              <th className="text-center py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Submitted</th>
              <th className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, idx, isWin, winData, submitted }) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-border/50 last:border-0 transition-colors",
                  isWin ? "bg-gold/5 hover:bg-gold/8" : "hover:bg-secondary/40",
                )}
              >
                <td className="py-3 px-4">
                  {isWin
                    ? <Crown className="h-4 w-4 text-gold" />
                    : <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  }
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={p.user.image ?? ""} />
                      <AvatarFallback className="text-[10px] bg-secondary">{(p.user.name ?? "U").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">
                      {p.user.name ?? "Anonymous"}
                    </span>
                    {isWin && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full">
                        <Crown className="h-2.5 w-2.5" />Winner
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.joinedAt), { addSuffix: true })}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {submitted
                    ? <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </td>
                <td className="py-3 px-4">
                  {isWin && winData ? (
                    <span className="text-xs font-bold text-gold">
                      {winData.prizeAmount.toLocaleString()} {prizeAssetCode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Requirements list (mobile-only — renders ALL items, no '+N more') ──────── */
function RequirementsList({
  instructions,
}: {
  instructions: string[];
}) {
  if (instructions.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No specific requirements listed.</p>;
  }
  return (
    <div className="space-y-2.5">
      {instructions.map((inst, i) => (
        <div key={i} className="flex items-start gap-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span className="text-muted-foreground leading-snug">{inst}</span>
        </div>
      ))}
    </div>
  );
}

/* ── User reports tab ────────────────────────────────────────────────────────── */
function UserReportsTab({ submissions, loading, requiresActionCam, onOpenMedia }: {
  submissions: Submission[]; loading: boolean; requiresActionCam: boolean;
  onOpenMedia: (item: { url: string; type: string }) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpandedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return (
    <div className="space-y-3">
      {[0, 1].map(i => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 rounded-lg bg-secondary animate-pulse" />
              <div className="h-3 w-16 rounded-lg bg-secondary animate-pulse" />
            </div>
          </div>
          <div className="px-4 pb-4"><div className="h-16 rounded-xl bg-secondary/50 animate-pulse" /></div>
        </div>
      ))}
    </div>
  );
  if (!submissions.length) return <EmptyState icon={<FileText className="h-8 w-8" />} text="You haven't submitted yet" />;

  return (
    <div className="space-y-3">
      {submissions.map((sub) => {
        const captures = sub.captures ?? [];
        const media = sub.media ?? [];
        const totalCaptures = captures.length;
        const approvedCount = captures.filter((c) => c.status === "APPROVED").length;
        const rejectedCount = captures.filter((c) => c.status === "REJECTED").length;
        const pendingCount = totalCaptures - approvedCount - rejectedCount;
        const isExpanded = expandedIds.has(sub.id);
        const shouldTruncate = !requiresActionCam && (sub.content?.length ?? 0) > 250;

        return (
          <div
            key={sub.id}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={sub.user?.image ?? ""} />
                  <AvatarFallback className="text-xs bg-secondary font-semibold">
                    {(sub.user?.name ?? "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {sub.user?.name ?? "You"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Capture status pills */}
              {totalCaptures > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {approvedCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      {approvedCount}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" />
                      {pendingCount}
                    </span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                      <X className="h-3 w-3" />
                      {rejectedCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Markdown content — show whenever the submission has text.
                Action Cam submissions store content="" so they won't render this. */}
            {sub.content && (
              <div className="px-4 pb-3">
                <div className={cn(
                  "text-sm text-muted-foreground leading-relaxed",
                  !isExpanded && shouldTruncate && "line-clamp-4",
                )}>
                  <Markdown content={isExpanded || !shouldTruncate ? sub.content : sub.content.slice(0, 250) + "…"} compact />
                </div>
                {shouldTruncate && (
                  <button
                    onClick={() => toggleExpand(sub.id)}
                    className="mt-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    {isExpanded ? "Show less" : "Continue reading"}
                  </button>
                )}
              </div>
            )}

            {/* Media grid — captures + legacy combined */}
            {(captures.length > 0 || media.length > 0) && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {captures.map((cap) => (
                    <button
                      key={`cap-${cap.id}`}
                      onClick={() => onOpenMedia({ url: cap.captureStorageUrl, type: cap.captureType })}
                      className="group/thumb relative aspect-square rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/40 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cap.capturePreviewUrl ?? cap.captureStorageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover/thumb:scale-105"
                      />
                      <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
                        {cap.captureType === "VIDEO" ? <Video className="h-2.5 w-2.5 text-background" /> : <Camera className="h-2.5 w-2.5 text-background" />}
                      </div>
                      <div className="absolute inset-0 bg-foreground/0 group-hover/thumb:bg-foreground/20 transition-colors" />
                    </button>
                  ))}
                  {media.map((m) => (
                    <button
                      key={`med-${m.id}`}
                      onClick={() => onOpenMedia({ url: m.url, type: m.type })}
                      className="group/thumb relative aspect-square rounded-xl overflow-hidden border border-border bg-muted hover:border-primary/40 transition-all"
                    >
                      {m.type === "IMAGE" ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" className="h-full w-full object-cover transition-transform group-hover/thumb:scale-105" />
                          <div className="absolute inset-0 bg-foreground/0 group-hover/thumb:bg-foreground/20 transition-colors" />
                        </>
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 bg-secondary">
                          {m.type === "VIDEO" ? <Video className="h-6 w-6 text-muted-foreground" /> : <FileText className="h-6 w-6 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-1">{m.fileName ?? m.type.toLowerCase()}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


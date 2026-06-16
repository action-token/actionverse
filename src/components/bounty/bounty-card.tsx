import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar";
import { BountyStatus } from "@prisma/client";
import { CheckCircle2, Eye, Loader2, Share2, Users } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";
import { useShareBountyModalStore } from "~/components/store/share-bounty-modal-store";

type BountyCardData = {
  id: number;
  title: string;
  summary: string;
  description: string;
  prizeAmount: number;
  status: BountyStatus;
  instructions: string[];
  creator: { id: string; name: string; profileUrl: string | null };
  _count: { participants: number; submissions: number; winners: number };
  maxWinners?: number;
};

interface BountyCardProps {
  bounty: BountyCardData;
  showJoin?: boolean;
  isJoined?: boolean;
  isCreator?: boolean;
  onJoin?: () => void;
  joining?: boolean;
}

const CHAR_LIMIT = 250;

function truncate(text: string) {
  return text.length > CHAR_LIMIT ? text.slice(0, CHAR_LIMIT) + "…" : text;
}

export function BountyCard({
  bounty,
  showJoin = true,
  isJoined = false,
  isCreator = false,
  onJoin,
  joining = false,
}: BountyCardProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const openShareModal = useShareBountyModalStore((s) => s.open);

  const maxW = bounty.maxWinners ?? 1;
  const slotsLeft = Math.max(0, maxW - bounty._count.winners);
  const showJoinBtn =
    showJoin && session && !isJoined && bounty.status === BountyStatus.RUNNING;

  const slotLabel =
    bounty.status === BountyStatus.COMPLETED
      ? "Ended"
      : bounty.status === BountyStatus.PAUSED
        ? "Paused"
        : `${slotsLeft} left`;

  const displayText =
    bounty.summary?.trim()
      ? truncate(bounty.summary.trim())
      : bounty.description?.trim()
        ? truncate(bounty.description.trim())
        : "";

  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onJoin?.();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    openShareModal({
      id: bounty.id,
      title: bounty.title,
      prizeAmount: bounty.prizeAmount,
      participantCount: bounty._count.participants,
      submissionCount: bounty._count.submissions,
    });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-card border border-border rounded-xl px-[22px] py-5 cursor-pointer",
        "transition-all duration-200 hover:border-primary/30 hover:shadow-[0_8px_32px_hsl(var(--background)/0.6)]",
      )}
      onClick={() => void router.push(`/bounty/${bounty.id}`)}
    >
      {/* Top row: prize + slots */}
      <div className="flex items-start justify-between gap-3 mb-[14px]">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
          <span className="text-primary font-bold text-[15px] tracking-[0.01em] leading-none">
            {bounty.prizeAmount.toLocaleString()} {PLATFORM_ASSET.code}
          </span>
          <span className="text-muted-foreground text-[13px] font-normal leading-none">
            / {maxW > 1 ? `${maxW} winners` : "winner"}
          </span>
        </div>
        <div className="bg-secondary border border-border rounded-full px-3 py-[3px] text-muted-foreground text-[11px] font-medium whitespace-nowrap shrink-0">
          {slotLabel}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-foreground text-[16px] font-bold mb-2 leading-[1.3] line-clamp-2 group-hover:text-primary transition-colors duration-150">
        {bounty.title}
      </h3>

      {/* Description — summary first, fall back to description, fixed min-height if empty */}
      <div className="mb-[18px] min-h-[3.5rem]">
        {displayText && (
          <p className="text-muted-foreground text-[13.5px] leading-[1.6]">
            {displayText}
          </p>
        )}
      </div>

      {/* Footer: creator | View → | Joined | Join | Share */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarImage src={bounty.creator.profileUrl ?? ""} />
            <AvatarFallback className="text-[9px] font-bold bg-secondary text-muted-foreground">
              {bounty.creator.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-[12px] truncate">
            By {bounty.creator.name}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* View — for creator or already joined */}
          {(isCreator || isJoined) && (
            <button
              onClick={(e) => { e.stopPropagation(); void router.push(`/bounty/${bounty.id}`); }}
              className="flex items-center gap-1 text-primary hover:text-primary/80 text-[13.5px] font-semibold transition-colors duration-150"
            >
              <Eye className="h-[13px] w-[13px]" />
              View
            </button>
          )}

          {/* Join — for non-creator, not yet joined */}
          {!isCreator && !isJoined && showJoinBtn && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex items-center gap-1 text-primary hover:text-primary/80 text-[13.5px] font-semibold transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {joining ? (
                <Loader2 className="h-[13px] w-[13px] animate-spin" />
              ) : (
                <Users className="h-[13px] w-[13px]" />
              )}
              {joining ? "Joining…" : "Join"}
            </button>
          )}

          {/* Share */}
          <span className="text-border">|</span>
          <button
            onClick={handleShare}
            title="Share to community"
            className="flex items-center gap-1 text-muted-foreground hover:text-primary text-[13.5px] font-semibold transition-colors duration-150"
          >
            <Share2 className="h-[13px] w-[13px]" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
export function BountyCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl px-[22px] py-5 animate-pulse">
      <div className="flex items-center justify-between mb-[14px]">
        <div className="flex items-center gap-2">
          <div className="h-[18px] w-[18px] rounded-full bg-secondary" />
          <div className="h-4 w-36 rounded bg-secondary" />
          <div className="h-3 w-16 rounded bg-secondary" />
        </div>
        <div className="h-5 w-16 rounded-full bg-secondary" />
      </div>
      <div className="h-[22px] w-4/5 rounded bg-secondary mb-2" />
      <div className="space-y-1.5 mb-[18px] min-h-[3.5rem]">
        <div className="h-[13px] w-full rounded bg-secondary" />
        <div className="h-[13px] w-full rounded bg-secondary" />
        <div className="h-[13px] w-3/5 rounded bg-secondary" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded bg-secondary" />
        <div className="h-3 w-20 rounded bg-secondary" />
      </div>
    </div>
  );
}

/* ── BountyCardWithJoin ───────────────────────────────────────────────────── */
export function BountyCardWithJoin({ bounty }: { bounty: BountyCardData }) {
  const { data: session } = useSession();
  const isCreator = session?.user?.id === bounty.creator.id;

  const { data: participation, refetch } = api.bounty.Bounty.getMyParticipation.useQuery(
    { bountyId: bounty.id },
    { enabled: !!session && !isCreator },
  );

  const joinMutation = api.bounty.Bounty.joinBounty.useMutation({
    onSuccess: () => {
      toast.success("Joined bounty!");
      void refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <BountyCard
      bounty={bounty}
      showJoin={!!session && !isCreator}
      isCreator={isCreator}
      isJoined={participation?.joined ?? false}
      onJoin={() => joinMutation.mutate({ bountyId: bounty.id })}
      joining={joinMutation.isLoading}
    />
  );
}

import { useRouter } from "next/router";
import { Trophy, FileText, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import Link from "next/link";

export type RecentActivityType = "win" | "submit" | "join";

export interface RecentActivity {
  id: string;
  type: RecentActivityType;
  bountyId: number;
  bountyTitle: string;
  userName: string | null;
  userId: string;
  createdAt: Date | string;
}

interface RecentActivityItemProps {
  activity: RecentActivity;
  /** Optional hook fired before navigation (e.g. close mobile panel). */
  onNavigate?: () => void;
  className?: string;
}

const verb: Record<RecentActivityType, string> = {
  win: "won",
  submit: "submitted on",
  join: "joined",
};

const style: Record<
  RecentActivityType,
  { Icon: typeof Trophy; color: string; pill: string }
> = {
  win: {
    Icon: Trophy,
    color: "text-yellow-400",
    pill: "bg-yellow-500/10 border-yellow-500/25",
  },
  submit: {
    Icon: FileText,
    color: "text-primary",
    pill: "bg-primary/10 border-primary/20",
  },
  join: {
    Icon: UserPlus,
    color: "text-muted-foreground",
    pill: "bg-secondary border-border",
  },
};

/**
 * A single row in a "Recent Activity" feed.
 *
 * Layout:
 *   ┌───┐  Alice won
 *   │ 🏆│  Bounty title…
 *   └───┘  2 minutes ago
 */
export function RecentActivityItem({
  activity,
  onNavigate,
  className,
}: RecentActivityItemProps) {
  const router = useRouter();
  const { Icon, color, pill } = style[activity.type];

  const displayName = activity.userName ?? "Someone";

  return (
    <div className={cn("flex items-start gap-3 py-1.5", className)}>
      {/* Icon badge */}
      <div
        className={cn(
          "shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border",
          pill,
        )}
        aria-hidden
      >
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1 space-y-0.5 ">
        {/* Username + verb on first line */}
        <p className="text-xs leading-snug text-foreground/90">
          <span className="font-semibold text-foreground">{displayName}</span>{" "}
          <span className="text-muted-foreground">{verb[activity.type]}</span> {" "}
        </p>

        {/* Bounty title on its own line so it can wrap cleanly */}
        <Link
          href={`/bounty/${activity.bountyId}`}

          className=" w-full text-left text-xs font-medium text-primary hover:underline line-clamp-2 leading-snug break-normal "
        >
          {activity.bountyTitle}
        </Link>

        {/* Timestamp */}
        <p className="text-[11px] text-muted-foreground/70 leading-none pt-0.5">
          {formatDistanceToNow(new Date(activity.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
}
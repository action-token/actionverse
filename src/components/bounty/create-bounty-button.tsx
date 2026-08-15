import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/shadcn/ui/dropdown-menu";
import { Button } from "~/components/shadcn/ui/button";
import { Badge } from "~/components/shadcn/ui/badge";
import { ListChecks, MapPin, Music, Plus, ChevronDown } from "lucide-react";
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store";
import { cn } from "~/lib/utils";

interface CreateBountyButtonProps {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
}

export function CreateBountyButton({
  variant = "default",
  size = "default",
  className,
  label = "Create Bounty",
}: CreateBountyButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { setIsOpen: setLoginModalOpen } = useLoginRequiredModalStore();

  const goCreate = (type: "general" | "music") => {
    if (!session) {
      setLoginModalOpen(true);
      return;
    }
    void router.push(`/bounty/create?type=${type}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn("shrink-0", className)}>
          <Plus className="h-4 w-4 mr-2" />
          {label}
          <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Choose a bounty type
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => goCreate("general")}
          className="py-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">General Bounty</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Any task or challenge with manual submissions
              </p>
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => goCreate("music")}
          className="py-2.5 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Music className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Music Bounty</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Verified listening challenge via Last.fm
              </p>
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="py-2.5 opacity-60">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Location Based Bounty</p>
              <p className="text-[11px] text-muted-foreground truncate">
                Challenges tied to real-world locations
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="ml-auto shrink-0 text-[9px] font-semibold text-amber-400 border-amber-400/30 bg-amber-400/10"
          >
            Coming soon
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

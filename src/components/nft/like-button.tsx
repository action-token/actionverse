import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "~/lib/utils";

// Shared heart-toggle control used for both NFT and Collection likes — keeps
// the visual style and tap animation consistent wherever a like count shows.
export function LikeButton({
  isLiked,
  likeCount,
  onToggle,
  variant = "overlay",
  className,
}: {
  isLiked: boolean;
  likeCount: number;
  onToggle: (e: React.MouseEvent) => void;
  variant?: "overlay" | "pill";
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.85 }}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition-colors",
        variant === "overlay"
          ? "bg-white/90 px-2.5 py-1.5 text-xs text-black shadow backdrop-blur hover:bg-white dark:bg-black/70 dark:text-white"
          : "border px-3 py-2 text-sm text-foreground",
        className,
      )}
    >
      {/* Heart inherits its stroke color from the button's text color
          (currentColor) unless liked, so callers can theme it via `className`
          without also overriding the icon. */}
      <Heart
        className={cn(
          "transition-colors",
          variant === "overlay" ? "h-3.5 w-3.5" : "h-4 w-4",
          isLiked && "fill-foreground text-foreground",
        )}
      />
      {likeCount}
    </motion.button>
  );
}

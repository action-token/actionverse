import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import { Button } from "~/components/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog";
import { LockedContentList } from "~/components/smart-contract/locked-media-panel";
import type { LockedMediaItem } from "~/components/smart-contract/locked-media-panel";
import { useDialogStore } from "package/connect_wallet/src/state/connect_wallet_dialog";

/**
 * Shown once a purchase settles, in place of the old silent redirect.
 *
 * A buyer who has just paid needs three things: confirmation it worked, what
 * they now own, and a way in. The reward list is the same
 * `LockedContentList` the pre-purchase teaser uses, so what they were promised
 * and what they got are rendered by one component and cannot drift — each row
 * still shows whether it is instant or behind pins, which is now a to-do list
 * rather than a warning.
 */
export function PurchaseSuccessModal({
  open,
  onClose,
  onViewItem,
  itemName,
  thumbnail,
  quantity,
  rewards,
  guestEmail,
}: {
  open: boolean;
  onClose: () => void;
  onViewItem: () => void;
  itemName: string;
  thumbnail?: string | null;
  quantity: number;
  rewards: {
    type: LockedMediaItem["type"];
    label: string | null;
    unlockRule?: { points: unknown[] } | null;
  }[];
  /** Set only for a guest (no-session) card purchase — the buyer was never
   *  signed into the account it landed in (see `buyEditionWithCardAsGuest`'s
   *  doc comment for why), so "View item" is replaced with a real login
   *  prompt instead of a direct link to a page they can't access yet. */
  guestEmail?: string;
}) {
  const lockedCount = rewards.filter((r) => (r.unlockRule?.points.length ?? 0) > 0).length;
  const setConnectDialogOpen = useDialogStore((s) => s.setIsOpen);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
            <DialogTitle className="text-xl">Your purchase was successful</DialogTitle>
            <DialogDescription>
              {quantity > 1 ? `${quantity} copies are now yours.` : "It's now yours."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              You received
            </p>
            <div className="mt-2 flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              {thumbnail && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image src={thumbnail} alt="" fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{itemName}</p>
                {quantity > 1 && (
                  <p className="text-xs text-muted-foreground">×{quantity} copies</p>
                )}
              </div>
            </div>
          </div>

          {rewards.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Rewards inside
              </p>
              <div className="mt-2">
                <LockedContentList items={rewards} />
              </div>
              {lockedCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {lockedCount === rewards.length
                    ? "Collect each reward's pins to unlock it."
                    : `${lockedCount} of ${rewards.length} still need their pins collected.`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {guestEmail ? (
            <>
              <Button
                onClick={() => {
                  onClose();
                  setConnectDialogOpen(true);
                }}
                className="h-11 w-full rounded-full font-bold"
              >
                Log in to view this item
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Use Google or Apple with {guestEmail}, or reset your password from the email tab —
                this is the first time this account has been signed into.
              </p>
            </>
          ) : (
            <Button onClick={onViewItem} className="h-11 w-full rounded-full font-bold">
              View item
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="h-9 w-full rounded-full text-sm">
            Keep browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, PaymentForm } from "react-square-web-payments-sdk";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { isPreconditionSignal } from "~/components/nft/use-nft-buy-flow";
import { ActivationModal } from "~/components/modal/activation-modal";
import { env } from "~/env";
import { api } from "~/utils/api";

/**
 * Card checkout for one nft_oz item — primary edition or resale listing —
 * per the nft_oz payment design's Part C: Square charges the card for the
 * item's own USD sticker price (set by the creator/reseller, not converted
 * live from the ACTION price), then treasury delivers the item directly.
 * The buyer signs nothing on-chain at all; a successful charge is the only
 * thing this component waits on.
 *
 * Modeled directly on `buy-with-squire.tsx`, generalized to nft_oz's two
 * delivery mutations instead of one (primary mint vs. resale transfer).
 */
export function BuyNftWithCard({
  target,
  onSuccess,
  className,
}: {
  target: { kind: "edition"; nftId: string; quantity: number } | { kind: "resale"; tokenId: string };
  onSuccess: () => void | Promise<void>;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  // The server checks activation *before* charging Square (see
  // `buyEditionWithCard`), so this branch means the card was never
  // billed — it is a "do this first" prompt, not a failed payment.
  const [showActivation, setShowActivation] = useState(false);

  const buyEdition = api.nft.buyEditionWithCard.useMutation();
  const buyResale = api.nft.buyResaleWithCard.useMutation();

  async function handleToken(sourceId: string) {
    setLoading(true);
    try {
      if (target.kind === "edition") {
        await buyEdition.mutateAsync({ nftId: target.nftId, quantity: target.quantity, sourceId });
      } else {
        await buyResale.mutateAsync({ tokenId: target.tokenId, sourceId });
      }
      toast.success("Purchase complete!");
      await onSuccess();
    } catch (e) {
      if (isPreconditionSignal(e, "NEEDS_ACTIVATION")) {
        // Raw signal names ("NEEDS_ACTIVATION") used to reach the buyer
        // verbatim through the generic handler below.
        toast.error("Activate your account to finish this purchase.");
        setShowActivation(true);
      } else {
        toast.error(e instanceof Error ? e.message : "Card payment failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <ActivationModal dialogOpen={showActivation} setDialogOpen={setShowActivation} />
      <PaymentForm
        applicationId={env.NEXT_PUBLIC_SQUARE_APP_ID}
        locationId={env.NEXT_PUBLIC_SQUARE_LOCATION}
        cardTokenizeResponseReceived={(token) =>
          void (async () => {
            if (!token.token) {
              toast.error("Could not read card details");
              return;
            }
            await handleToken(token.token);
          })()
        }
      >
        <CreditCard />
      </PaymentForm>
      {loading && (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Charging card…
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, PaymentForm } from "react-square-web-payments-sdk";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { fireConfetti } from "~/lib/ui/confetti";
import { env } from "~/env";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";

const emailSchema = z.string().email();

/**
 * Guest counterpart to `BuyNftWithCard` — no session at all, just an email
 * typed at checkout. Same inline (no dialog) shape as the logged-in
 * version, with one extra step first: an email field gates the Square form,
 * since `buyEditionWithCardAsGuest`/`buyResaleWithCardAsGuest` need one to
 * resolve-or-create the custodial account the item gets delivered to (only
 * ever *after* the charge succeeds — see those mutations' doc comments).
 * The buyer is never signed into that account; `onSuccess` reports the
 * email used so the caller can show a "log in to view this" prompt instead
 * of a direct link.
 */
export function GuestBuyNftWithCard({
  target,
  onSuccess,
  className,
}: {
  target: { kind: "edition"; nftId: string; quantity: number } | { kind: "resale"; tokenId: string };
  onSuccess: (email: string) => void | Promise<void>;
  className?: string;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const buyEdition = api.nft.buyEditionWithCardAsGuest.useMutation();
  const buyResale = api.nft.buyResaleWithCardAsGuest.useMutation();

  async function handleToken(sourceId: string) {
    if (!email) return;
    setLoading(true);
    try {
      if (target.kind === "edition") {
        await buyEdition.mutateAsync({ nftId: target.nftId, quantity: target.quantity, sourceId, email });
      } else {
        await buyResale.mutateAsync({ tokenId: target.tokenId, sourceId, email });
      }
      fireConfetti();
      toast.success("Purchase complete!");
      await onSuccess(email);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Card payment failed");
    } finally {
      setLoading(false);
    }
  }

  if (email === null) {
    const isValid = emailSchema.safeParse(emailInput).success;
    return (
      <div className={cn("w-full space-y-2", className)}>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            className="pl-9"
          />
        </div>
        {touched && !isValid && emailInput.length > 0 && (
          <p className="text-xs text-destructive">Enter a valid email address</p>
        )}
        <p className="text-xs text-muted-foreground">
          No account needed — we&apos;ll deliver this to whichever account matches your email,
          creating one if it doesn&apos;t exist yet.
        </p>
        <Button type="button" disabled={!isValid} onClick={() => setEmail(emailInput)} className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
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

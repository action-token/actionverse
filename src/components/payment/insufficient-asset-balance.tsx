"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { WalletType } from "~/types/wallet/wallet-types";
import { AlertTriangle, ArrowLeftRight, ArrowRight, Mail, Wallet } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { PLATFORM_ASSET, stellarTermSwapUrl } from "~/lib/stellar/constant";
import { SUPPORT_EMAIL } from "~/lib/defaults";
import { isRechargeAbleClient } from "~/utils/recharge/is-rechargeable-client";

/**
 * Shown in place of a Platform-Asset buy button when the grand total is more
 * than the wallet holds. Only ever applies to the Platform-Asset payment
 * option — a card/USD checkout is funded by the card, not this balance, so
 * gating it on the asset balance would block a purchase that would have gone
 * through fine.
 *
 * The two audiences need different outs, which is the whole reason this
 * isn't just a disabled button:
 *
 * - **Custodial** (Google/Facebook sign-in — `isRechargeAbleClient`): they
 *   top up inside the app, so they get a "Recharge first" call to action to
 *   `/recharge`.
 * - **External wallet**: there is no in-app top-up path for them — they get
 *   sent to trade for it themselves on StellarTerm's DEX UI
 *   (`stellarTermSwapUrl`), which works with any wallet, plus a support
 *   address as a fallback for anyone who'd rather not.
 */
export function InsufficientAssetBalance({
  required,
  balance,
}: {
  /** Grand total the purchase needs, fees included. */
  required: number;
  /** What the connected wallet currently holds. */
  balance: number;
}) {
  const { data: session } = useSession();
  const canRechargeInApp = isRechargeAbleClient(session?.user.walletType ?? WalletType.none);
  const shortfall = Math.max(0, required - balance);
  const fmt = (n: number) => `${n.toFixed(2)} ${PLATFORM_ASSET.code}`;
  const swapUrl = stellarTermSwapUrl();

  return (
    // `mt-4` mirrors the `BuyButton` this stands in for, so swapping between
    // the two does not shift the card above it.
    <div className="mt-4 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Not enough {PLATFORM_ASSET.code}
          </p>
          <p className="text-sm text-muted-foreground">
            {canRechargeInApp
              ? `You need ${fmt(shortfall)} more to complete this purchase.`
              : `This purchase needs ${fmt(required)} and your wallet holds ${fmt(balance)}.`}
          </p>
        </div>
      </div>

      <dl className="space-y-1 rounded-lg bg-background/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Total needed</dt>
          <dd className="font-medium tabular-nums text-foreground">{fmt(required)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Your balance</dt>
          <dd className="font-medium tabular-nums text-foreground">{fmt(balance)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-1">
          <dt className="font-medium text-foreground">Short by</dt>
          <dd className="font-bold tabular-nums text-amber-700 dark:text-amber-500">
            {fmt(shortfall)}
          </dd>
        </div>
      </dl>

      {canRechargeInApp ? (
        <Link href="/recharge" className="block">
          <Button className="w-full gap-2">
            <Wallet className="h-4 w-4" />
            Recharge first
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <div className="space-y-2">
          {swapUrl && (
            <a href={swapUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full gap-2 bg-emerald-500 text-white hover:bg-emerald-500/80">
                <ArrowLeftRight className="h-4 w-4" />
                Trade on StellarTerm
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          )}
          <p className="text-xs text-muted-foreground">
            {swapUrl
              ? `Swap XLM for ${PLATFORM_ASSET.code} on the Stellar DEX, then come back and try again. Need a hand?`
              : `Add ${PLATFORM_ASSET.code} to your connected wallet and try again. Need a hand?`}
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="block">
            <Button variant="outline" className="w-full gap-2">
              <Mail className="h-4 w-4" />
              {SUPPORT_EMAIL}
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

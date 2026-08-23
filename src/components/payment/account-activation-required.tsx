"use client";

import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";
import { ActivationModal } from "~/components/modal/activation-modal";
import { PLATFORM_ASSET } from "~/lib/stellar/constant";

/**
 * Shown in place of a Platform-Asset buy button when the viewer's Stellar
 * account isn't active yet. Activation is a one-off paid step that has to
 * happen before the account can hold {@link PLATFORM_ASSET} or receive a
 * minted copy at all.
 *
 * Without this the requirement was only discoverable by failing: the buyer
 * pressed Buy, `withPreconditionHandling` caught the contract's
 * `NEEDS_ACTIVATION` signal, and they got a toast telling them to activate
 * and try again. Surfacing it up front turns a failed purchase into a
 * next step.
 *
 * Owns its own `ActivationModal` instance rather than reaching for the
 * page's — the page's copy is driven by `needsActivation` from the buy
 * flow (i.e. the post-failure path), and the two open independently.
 */
export function AccountActivationRequired() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-4 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">Activate your account first</p>
            <p className="text-sm text-muted-foreground">
              Your wallet isn&apos;t activated yet, so it can&apos;t hold {PLATFORM_ASSET.code} or
              receive this item. Activation is a one-time step.
            </p>
          </div>
        </div>

        <Button type="button" className="w-full gap-2" onClick={() => setOpen(true)}>
          <KeyRound className="h-4 w-4" />
          Activate account
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <ActivationModal dialogOpen={open} setDialogOpen={setOpen} />
    </>
  );
}

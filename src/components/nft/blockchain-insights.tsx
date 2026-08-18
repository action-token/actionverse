import { CheckCircle2, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { priceTokenLabel } from "~/components/nft/nft-card";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import {
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
} from "~/lib/stellar/explorer";
import { truncateString } from "~/utils/string";
import { type RouterOutputs } from "~/utils/api";

type Insights = RouterOutputs["nft"]["onChainInsights"];

function CopyableRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-sm font-semibold">{truncateString(value, 6, 6)}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
          }}
          aria-label={`Copy ${label}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${label} on explorer`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function BlockchainInsights({
  insights,
  isLoading,
}: {
  insights: Insights | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !insights) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!insights.minted ? (
        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          No copies minted yet — the first purchase registers this edition on-chain and
          mints straight to that buyer.
        </div>
      ) : (
        <>
          <div
            className={
              insights.verified
                ? "flex items-center gap-2 rounded-2xl border border-foreground/30 bg-foreground/10 p-4 text-foreground"
                : "flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-warning"
            }
          >
            {insights.verified ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {insights.verified ? "Verified on-chain" : "Cache out of sync"}
              </p>
              <p className="text-xs opacity-80">
                {insights.verified
                  ? "Edition data matches the contract right now."
                  : "The contract reports different edition data than our cache — reload to resync."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Minted" value={`${insights.mintedCount} / ${insights.supply}`} />
            <Stat label="You hold" value={String(insights.myTokenIds.length)} />
            <Stat label="Royalty" value={`${(insights.royaltyBps / 100).toFixed(2)}%`} />
            <Stat label="Remaining" value={String(insights.remainingSupply)} />
          </div>

          <div className="rounded-2xl border bg-card px-4">
            <CopyableRow label="Edition ID" value={String(insights.editionId)} />
            {insights.creator && (
              <CopyableRow
                label="On-chain creator"
                value={insights.creator}
                href={stellarExpertAccountUrl(insights.creator)}
              />
            )}
          </div>

          {insights.myTokenIds.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your token IDs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.myTokenIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-semibold"
                  >
                    #{id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {insights.prices.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price grid
          </p>
          <div className="space-y-1">
            {insights.prices.map((p) => (
              <div key={p.paymentToken} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{priceTokenLabel(p.paymentToken)}</span>
                <span className="font-semibold tabular-nums">{p.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.contractId && (
        <div className="rounded-2xl border bg-card px-4">
          <CopyableRow
            label="Contract"
            value={insights.contractId}
            href={stellarExpertContractUrl(insights.contractId)}
          />
        </div>
      )}
    </div>
  );
}

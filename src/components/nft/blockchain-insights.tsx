import { CheckCircle2, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import {
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
} from "~/lib/stellar/explorer";
import { truncateString } from "~/utils/string";
import { cn } from "~/lib/utils";
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
  nftName,
  nftThumbnail,
}: {
  insights: Insights | undefined;
  isLoading: boolean;
  /** Shown on each of "your tokens"' rows below its `Token #N` — every
   *  token here is a copy of this same edition, so the name/thumbnail is
   *  identical across rows, but still worth showing per row so the list
   *  reads as a proper item list rather than bare ids. */
  nftName?: string;
  nftThumbnail?: string;
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your token{insights.myTokenIds.length === 1 ? "" : "s"} ({insights.myTokenIds.length})
              </p>
              <div
                className={cn(
                  "divide-y divide-border/60",
                  insights.myTokenIds.length > 6 && "max-h-64 overflow-y-auto pr-1",
                )}
              >
                {insights.myTokenIds.map((id) => (
                  <div key={id} className="flex items-center gap-3 py-2">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {nftThumbnail && (
                        <Image src={nftThumbnail} alt={nftName ?? "NFT thumbnail"} fill className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-semibold">Token #{id}</p>
                      {nftName && <p className="truncate text-xs text-muted-foreground">{nftName}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(id));
                        toast.success(`Token #${id} copied`);
                      }}
                      aria-label={`Copy token #${id}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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

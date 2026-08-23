import { X } from "lucide-react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import { ActivationModal } from "~/components/modal/activation-modal";
import { LikeButton } from "~/components/nft/like-button";
import { NftDetailView } from "~/components/nft/nft-detail-view";
import { NftMediaViewer } from "~/components/nft/nft-media-viewer";
import { useNftBuyFlow } from "~/components/nft/use-nft-buy-flow";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import { type NftPaymentToken } from "~/lib/stellar/oz/nft";
import { api } from "~/utils/api";
import toast from "react-hot-toast";

export default function NftBuyPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: session } = useSession();

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id });
  const { data: onChainInsights, isLoading: isLoadingOnChainInsights } =
    api.nft.onChainInsights.useQuery({ id: id ?? "" }, { enabled: !!id });

  const {
    isBuyingPrimary,
    isBuyingResale,
    needsActivation,
    setNeedsActivation,
    buyEdition,
    buyResaleBatch,
    utils,
  } = useNftBuyFlow();
  const toggleLike = api.nft.toggleLike.useMutation({
    onSuccess: () => void utils.nft.byId.invalidate({ id }),
  });

  function close() {
    if (window.history.length > 1) router.back();
    else void router.push("/");
  }

  function handleLike() {
    if (!session?.user) {
      toast.error("Connect your wallet to save favorites");
      return;
    }
    toggleLike.mutate({ nftId: nft!.id });
  }

  async function invalidateAfterPurchase() {
    await Promise.all([
      utils.nft.byId.invalidate({ id: nft!.id }),
      utils.nft.onChainInsights.invalidate({ id: nft!.id }),
      utils.nft.list.invalidate(),
      utils.nft.myOwned.invalidate(),
      utils.nft.myCreated.invalidate(),
    ]);
  }

  /**
   * One signature: `buy_edition` both registers the edition on-chain (if
   * this is its first-ever sale) and mints the requested quantity straight
   * to the buyer, so there's only one transaction to sign here regardless of
   * whether this is the very first copy sold or the thousandth.
   */
  async function handleBuyPrimary(args: { paymentToken: NftPaymentToken; quantity: number }) {
    if (!session?.user || !nft) {
      toast.error("Connect your wallet first");
      return;
    }
    await buyEdition(nft.id, args);
    await invalidateAfterPurchase();
  }

  /**
   * Buys several pooled resale listings at once via the contract's
   * `buy_batch` — one signature for the whole batch, not one `buy`
   * transaction per token.
   */
  async function handleBuyResaleBatch(tokenIds: string[], paymentToken: NftPaymentToken) {
    if (!session?.user || !nft || tokenIds.length === 0) {
      toast.error("Connect your wallet first");
      return;
    }
    await buyResaleBatch(tokenIds, paymentToken);
    await invalidateAfterPurchase();
  }

  return (
    <>
      <Head>
        <title>{nft ? `${nft.name} — Actionverse` : "Actionverse"}</title>
      </Head>
      <ActivationModal dialogOpen={needsActivation} setDialogOpen={setNeedsActivation} />
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-background lg:overflow-hidden">
        <div className="fixed right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
          {nft && (
            <LikeButton
              isLiked={nft.isLiked}
              likeCount={nft.likeCount}
              onToggle={handleLike}
              variant="pill"
              className="bg-card/80 shadow-lg backdrop-blur"
            />
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card/80 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !nft ? (
          <div className="min-h-full lg:flex lg:h-full">
            <Skeleton className="h-72 w-full rounded-none sm:h-96 lg:h-full lg:w-1/2" />
            <div className="space-y-6 p-6 sm:p-10 lg:h-full lg:w-1/2">
              <div className="space-y-2">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-32 w-full rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-full lg:flex lg:h-full">
            <div className="relative h-72 w-full sm:h-96 lg:h-full lg:w-1/2">
              <NftMediaViewer
                thumbnail={nft.thumbnail}
                contentUrl={nft.contentUrl}
                mediaType={nft.mediaType}
                name={nft.name}
                locked
                fill
              />
            </div>

            <div className="p-6 sm:p-10 lg:h-full lg:w-1/2 lg:overflow-y-auto">
              <NftDetailView
                nft={nft}
                mode="buy"
                viewerId={session?.user.id}
                onBuyPrimary={handleBuyPrimary}
                isBuyingPrimary={isBuyingPrimary}
                onBuyResaleBatch={handleBuyResaleBatch}
                onCardPurchaseSuccess={invalidateAfterPurchase}
                isBuyingResale={isBuyingResale}
                onChainInsights={onChainInsights}
                isLoadingOnChainInsights={isLoadingOnChainInsights}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

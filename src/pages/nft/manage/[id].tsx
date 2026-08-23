import { X } from "lucide-react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { clientsign, extractTxHash } from "package/connect_wallet";
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g";
import { useState } from "react";
import toast from "react-hot-toast";
import { LikeButton } from "~/components/nft/like-button";
import { NftDetailView } from "~/components/nft/nft-detail-view";
import { NftMediaViewer } from "~/components/nft/nft-media-viewer";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import useNeedSign from "~/lib/hook";
import { clientSelect } from "~/lib/stellar/fan/utils";
import { type NftDisplayCurrency } from "~/lib/stellar/oz/nft";
import { api } from "~/utils/api";

export default function ManageNftPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: session } = useSession();
  const utils = api.useContext();
  const { needSign } = useNeedSign();

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id });
  const { data: onChainInsights, isLoading: isLoadingOnChainInsights } =
    api.nft.onChainInsights.useQuery({ id: id ?? "" }, { enabled: !!id });
  // `myOwned` groups every edition the caller holds copies of — filtered to
  // this one for the per-copy list/price/cancel controls below rather than a
  // dedicated endpoint, since the data already exists there.
  const { data: myOwned } = api.nft.myOwned.useQuery();

  const getListXDR = api.nft.getListXDR.useMutation();
  const confirmListing = api.nft.confirmListing.useMutation();
  const getListBatchXDR = api.nft.getListBatchXDR.useMutation();
  const confirmListBatch = api.nft.confirmListBatch.useMutation();
  const getCancelListingXDR = api.nft.getCancelListingXDR.useMutation();
  const confirmCancelListing = api.nft.confirmCancelListing.useMutation();
  const toggleLike = api.nft.toggleLike.useMutation({
    onSuccess: () => void utils.nft.byId.invalidate({ id }),
  });

  const [isSavingListing, setIsSavingListing] = useState(false);

  function close() {
    if (window.history.length > 1) router.back();
    else void router.push("/my-collection");
  }

  const myEntry = myOwned?.find((o) => o.nft.id === id);
  const myTokens = myEntry?.tokens ?? [];

  function handleLike() {
    if (!session?.user) {
      toast.error("Connect your wallet to save favorites");
      return;
    }
    toggleLike.mutate({ nftId: nft!.id });
  }

  // Same build-XDR -> sign (server-side or via clientsign) -> confirm shape
  // as the bounty escrow flow (see src/pages/bounty/create.tsx).
  async function signAndSubmit(
    getXdr: () => Promise<{ xdr: string; fullySignedByServer: boolean }>,
  ): Promise<string | undefined> {
    if (!session?.user) return undefined;
    const { xdr, fullySignedByServer } = await getXdr();
    if (fullySignedByServer) {
      const result = await submitSignedXDRToServer4User(xdr);
      return extractTxHash(result);
    }
    const clientResponse = await clientsign({
      presignedxdr: xdr,
      walletType: session.user.walletType,
      pubkey: session.user.id,
      test: clientSelect(),
    });
    return extractTxHash(clientResponse);
  }

  async function invalidateAfterListingChange() {
    await Promise.all([
      utils.nft.byId.invalidate({ id }),
      utils.nft.onChainInsights.invalidate({ id }),
      utils.nft.myOwned.invalidate(),
      utils.nft.myCreated.invalidate(),
    ]);
  }

  /** Lists one specific token, without the loading-state/invalidate/toast
   *  wrapper — shared by both the single- and batch-listing flows below.
   *  `prices` always has both an "asset" and a "usd" entry now (see
   *  `DisplayPricesSchema`) — only the "asset" one goes into the on-chain
   *  XDR (`getListXDR` itself filters that out), but `confirmListing` needs
   *  the "usd" one passed through explicitly since it has no on-chain
   *  counterpart to read back. */
  async function listOneToken(
    tokenId: string,
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ): Promise<boolean> {
    const txHash = await signAndSubmit(() =>
      getListXDR.mutateAsync({ tokenId, prices, signWith: needSign() }),
    );
    if (!txHash) return false;
    const usdPrice = prices.find((p) => p.paymentToken === "usd")!.price;
    await confirmListing.mutateAsync({ tokenId, txHash, usdPrice });
    return true;
  }

  async function handleListToken(
    tokenId: string,
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ) {
    if (!session?.user) return;
    setIsSavingListing(true);
    try {
      const ok = await listOneToken(tokenId, prices);
      if (!ok) {
        toast.error("Listing transaction could not be confirmed.");
        return;
      }
      await invalidateAfterListingChange();
      toast.success("Listed for sale");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally {
      setIsSavingListing(false);
    }
  }

  /**
   * Lists N held copies at once via the contract's `list_batch` — one
   * signature for the whole batch, not one `list` transaction per token.
   * Powers the manage page's `[-] N / M Hold [+]` control.
   */
  async function handleListMultiple(
    tokenIds: string[],
    prices: { paymentToken: NftDisplayCurrency; price: number }[],
  ) {
    if (!session?.user || tokenIds.length === 0) return;
    setIsSavingListing(true);
    try {
      const txHash = await signAndSubmit(() =>
        getListBatchXDR.mutateAsync({ tokenIds, prices, signWith: needSign() }),
      );
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.");
        return;
      }
      const usdPrice = prices.find((p) => p.paymentToken === "usd")!.price;
      await confirmListBatch.mutateAsync({ tokenIds, txHash, usdPrice });
      await invalidateAfterListingChange();
      toast.success(tokenIds.length > 1 ? `${tokenIds.length} copies listed for sale` : "Listed for sale");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally {
      setIsSavingListing(false);
    }
  }

  async function handleCancelListing(tokenId: string) {
    if (!session?.user) return;
    setIsSavingListing(true);
    try {
      const txHash = await signAndSubmit(() =>
        getCancelListingXDR.mutateAsync({ tokenId, signWith: needSign() }),
      );
      if (!txHash) {
        toast.error("Cancel transaction could not be confirmed.");
        return;
      }
      await confirmCancelListing.mutateAsync({ tokenId, txHash });
      await invalidateAfterListingChange();
      toast.success("Listing cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setIsSavingListing(false);
    }
  }

  return (
    <>
      <Head>
        <title>{nft ? `Manage ${nft.name} — Actionverse` : "Actionverse"}</title>
      </Head>
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
                locked={myTokens.length <= 0}
                fill
              />
            </div>

            <div className="p-6 sm:p-10 lg:h-full lg:w-1/2 lg:overflow-y-auto">
              <NftDetailView
                nft={nft}
                mode="manage"
                myTokens={myTokens}
                onListToken={handleListToken}
                onListMultiple={handleListMultiple}
                onCancelListing={handleCancelListing}
                isSavingListing={isSavingListing}
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

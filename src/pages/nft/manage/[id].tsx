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

  const getListForSaleXDR = api.nft.getListForSaleXDR.useMutation();
  const confirmListing = api.nft.confirmListing.useMutation();
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

  const viewerId = session?.user.id;
  const myListing = nft?.listings.find((l) => l.sellerId === viewerId) ?? null;
  const heldQuantity = nft?.ownerships.find((o) => o.owner.id === viewerId)?.quantity ?? 0;

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

  async function handleUpdatePrice(price: number) {
    if (!session?.user || !nft?.onChainTokenId) return;
    setIsSavingListing(true);
    try {
      const txHash = await signAndSubmit(() =>
        getListForSaleXDR.mutateAsync({
          nftId: nft.id,
          price,
          signWith: needSign(),
        }),
      );
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.");
        return;
      }
      await confirmListing.mutateAsync({ nftId: nft.id, txHash });
      await Promise.all([
        utils.nft.byId.invalidate({ id: nft.id }),
        utils.nft.myOwned.invalidate(),
        utils.nft.myCreated.invalidate(),
      ]);
      toast.success(myListing?.isActive ? "Price updated" : "Listed for sale");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally {
      setIsSavingListing(false);
    }
  }

  async function handleCancelListing() {
    if (!session?.user || !nft?.onChainTokenId) return;
    setIsSavingListing(true);
    try {
      const txHash = await signAndSubmit(() =>
        getCancelListingXDR.mutateAsync({ nftId: nft.id, signWith: needSign() }),
      );
      if (!txHash) {
        toast.error("Cancel transaction could not be confirmed.");
        return;
      }
      await confirmCancelListing.mutateAsync({ nftId: nft.id, txHash });
      await Promise.all([
        utils.nft.byId.invalidate({ id: nft.id }),
        utils.nft.myOwned.invalidate(),
        utils.nft.myCreated.invalidate(),
      ]);
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
                locked={heldQuantity <= 0}
                fill
              />
            </div>

            <div className="p-6 sm:p-10 lg:h-full lg:w-1/2 lg:overflow-y-auto">
              <NftDetailView
                nft={nft}
                mode="manage"
                myListing={myListing}
                heldQuantity={heldQuantity}
                onUpdatePrice={handleUpdatePrice}
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

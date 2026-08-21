import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import { clientsign, extractTxHash } from "package/connect_wallet"
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { useState } from "react"
import toast from "react-hot-toast"
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, Music, Image as ImageIcon, Video as VideoIcon, Link as LinkIcon, MapPin, Sparkles } from "lucide-react"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { type NftPaymentToken } from "~/lib/stellar/oz/nft"
import { api } from "~/utils/api"
import { LikeButton } from "~/components/nft/like-button"
import { ManagePriceCard } from "~/components/nft/nft-detail-view"
import { BlockchainInsights } from "~/components/nft/blockchain-insights"
import { UnlockProgressList } from "~/components/smart-contract/unlock-progress-list"
import { LockedMediaPanel, lockedMediaSummary } from "~/components/smart-contract/locked-media-panel"

/**
 * The **manage** page for a copy the caller already owns — resale listing
 * controls and unlock progress/reward reveal, separate from
 * `src/pages/smart-contract/[id].tsx` (buying only) so that page's job
 * stays one thing. Replaces `src/pages/nft/manage/[id].tsx`. Reached from
 * `/my-collection` and `/organization/store` for items you hold.
 * See VIP_TICKET_UNLOCK_PLAN.md.
 */
export default function SmartContractManagePage() {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : undefined
  const { data: session } = useSession()
  const utils = api.useContext()
  const { needSign } = useNeedSign()

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id })
  const { data: onChainInsights, isLoading: isLoadingOnChainInsights } = api.nft.onChainInsights.useQuery({ id: id ?? "" }, { enabled: !!id })
  // `myOwned` groups every edition the caller holds copies of — filtered to
  // this one for the per-copy list/price/cancel controls, same pattern the
  // old `nft/manage/[id].tsx` used.
  const { data: myOwned } = api.nft.myOwned.useQuery(undefined, { enabled: !!session?.user })
  const toggleLike = api.nft.toggleLike.useMutation({
    onSuccess: () => void utils.nft.byId.invalidate({ id }),
  })

  const getListXDR = api.nft.getListXDR.useMutation()
  const confirmListing = api.nft.confirmListing.useMutation()
  const getListBatchXDR = api.nft.getListBatchXDR.useMutation()
  const confirmListBatch = api.nft.confirmListBatch.useMutation()
  const getCancelListingXDR = api.nft.getCancelListingXDR.useMutation()
  const confirmCancelListing = api.nft.confirmCancelListing.useMutation()
  const [isSavingListing, setIsSavingListing] = useState(false)

  const myEntry = myOwned?.find((o) => o.nft.id === id)
  const myTokens = myEntry?.tokens ?? []

  function handleLike() {
    if (!session?.user) {
      toast.error("Connect your wallet to save favorites")
      return
    }
    toggleLike.mutate({ nftId: nft!.id })
  }

  async function signAndSubmit(xdr: string, fullySignedByServer: boolean) {
    if (fullySignedByServer) {
      return extractTxHash(await submitSignedXDRToServer4User(xdr))
    }
    const clientResponse = await clientsign({
      presignedxdr: xdr,
      walletType: session!.user.walletType,
      pubkey: session!.user.id,
      test: clientSelect(),
    })
    return extractTxHash(clientResponse)
  }

  async function invalidateAfterListingChange() {
    await Promise.all([
      utils.nft.byId.invalidate({ id }),
      utils.nft.onChainInsights.invalidate({ id }),
      utils.nft.myOwned.invalidate(),
      utils.nft.myCreated.invalidate(),
    ])
  }

  async function handleListToken(
    tokenId: string,
    prices: { paymentToken: NftPaymentToken; price: number }[],
    priceUSD?: number,
  ) {
    if (!session?.user) return
    setIsSavingListing(true)
    try {
      const { xdr, fullySignedByServer } = await getListXDR.mutateAsync({ tokenId, prices, signWith: needSign() })
      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.")
        return
      }
      await confirmListing.mutateAsync({ tokenId, txHash, priceUSD })
      await invalidateAfterListingChange()
      toast.success("Listed for sale")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed")
    } finally {
      setIsSavingListing(false)
    }
  }

  /**
   * Lists N held copies at once via the contract's `list_batch` — one
   * signature for the whole batch, not one `list` transaction per token.
   */
  async function handleListMultiple(
    tokenIds: string[],
    prices: { paymentToken: NftPaymentToken; price: number }[],
    priceUSD?: number,
  ) {
    if (!session?.user || tokenIds.length === 0) return
    setIsSavingListing(true)
    try {
      const { xdr, fullySignedByServer } = await getListBatchXDR.mutateAsync({ tokenIds, prices, signWith: needSign() })
      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.")
        return
      }
      await confirmListBatch.mutateAsync({ tokenIds, txHash, priceUSD })
      await invalidateAfterListingChange()
      toast.success(tokenIds.length > 1 ? `${tokenIds.length} copies listed for sale` : "Listed for sale")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed")
    } finally {
      setIsSavingListing(false)
    }
  }

  async function handleCancelListing(tokenId: string) {
    if (!session?.user) return
    setIsSavingListing(true)
    try {
      const { xdr, fullySignedByServer } = await getCancelListingXDR.mutateAsync({ tokenId, signWith: needSign() })
      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Cancel transaction could not be confirmed.")
        return
      }
      await confirmCancelListing.mutateAsync({ tokenId, txHash })
      await invalidateAfterListingChange()
      toast.success("Listing cancelled")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed")
    } finally {
      setIsSavingListing(false)
    }
  }

  if (isLoading || !nft) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const isGated = nft.lockedMedia.length > 0
  const gatedItemCount = nft.lockedMedia.filter((m) => m.unlockRule).length
  // Summed across every gated item — a ticket with a 2-location song and a
  // 3-location video reports 5, not one shared count.
  const requiredLocations = nft.lockedMedia.reduce(
    (sum, m) => sum + (m.unlockRule?.points.length ?? 0),
    0,
  )
  const mediaCounts = {
    songs: nft.lockedMedia.filter((m) => m.type === "SONG").length,
    images: nft.lockedMedia.filter((m) => m.type === "IMAGE").length,
    videos: nft.lockedMedia.filter((m) => m.type === "VIDEO").length,
    links: nft.lockedMedia.filter((m) => m.type === "OTHER").length,
  }

  return (
    <>
      <Head>
        <title>{`Manage ${nft.name} — Actionverse`}</title>
      </Head>
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/my-collection"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            My Collection
          </Link>
          <LikeButton isLiked={nft.isLiked} likeCount={nft.likeCount} onToggle={handleLike} variant="pill" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg">
              <Image src={nft.thumbnail} alt={nft.name} fill className="object-cover" />
              {isGated && (
                <div className="absolute left-4 top-4">
                  <Badge className="gap-1 bg-black/70 text-white">
                    <Sparkles className="h-3 w-3" />
                    VIP Ticket
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">{nft.name}</h1>
              <p className="text-muted-foreground">{nft.description}</p>
            </div>

            {isGated && (
              <>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      Unlock requirement
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {requiredLocations > 0 ? (
                        gatedItemCount === nft.lockedMedia.length ? (
                          <>
                            Every copy of this ticket unlocks its rewards independently — visit and
                            collect{" "}
                            <span className="font-medium text-foreground">
                              {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                            </span>{" "}
                            with that copy to reveal them.
                          </>
                        ) : (
                          <>
                            Some items unlock the moment you own a copy; the rest reveal once you visit
                            and collect{" "}
                            <span className="font-medium text-foreground">
                              {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                            </span>{" "}
                            with that copy.
                          </>
                        )
                      ) : (
                        "Owning a copy unlocks its rewards immediately — no extra requirement."
                      )}
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <LockedContentIcon counts={mediaCounts} />
                    Locked content
                  </h3>
                  <p className="text-xs text-muted-foreground">{lockedMediaSummary(mediaCounts)}</p>
                </div>
              </>
            )}

            <ManagePriceCard
              myTokens={myTokens}
              onListToken={handleListToken}
              onListMultiple={handleListMultiple}
              onCancelListing={handleCancelListing}
              isSaving={isSavingListing}
              network={onChainInsights?.network}
            />

            {isGated && (
              <UnlockProgressList nftId={nft.id} ticketName={nft.name} ticketThumbnail={nft.thumbnail} />
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">On-chain details</h3>
              <BlockchainInsights insights={onChainInsights} isLoading={isLoadingOnChainInsights} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function LockedContentIcon({ counts }: { counts: { songs: number; images: number; videos: number; links: number } }) {
  if (counts.songs) return <Music className="h-4 w-4 text-primary" />
  if (counts.videos) return <VideoIcon className="h-4 w-4 text-primary" />
  if (counts.images) return <ImageIcon className="h-4 w-4 text-primary" />
  return <LinkIcon className="h-4 w-4 text-primary" />
}

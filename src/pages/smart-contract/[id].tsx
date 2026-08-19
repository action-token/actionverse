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
import { PrimaryBuyCard, ResaleBuyCard } from "~/components/nft/nft-detail-view"
import { BlockchainInsights } from "~/components/nft/blockchain-insights"
import { LockedMediaPanel, lockedMediaSummary } from "~/components/smart-contract/locked-media-panel"

/**
 * The one **buy** page for every NFT — gated ("VIP ticket") or ordinary
 * alike, primary or resale. Purely about buying: an owner managing what
 * they already hold (resale listing, unlock progress, reward reveal) uses
 * `src/pages/smart-contract/manage/[id].tsx` instead — kept as a separate
 * route rather than folded in here, so this page's job stays one thing.
 * Replaces `src/pages/nft/[id].tsx`. See VIP_TICKET_UNLOCK_PLAN.md.
 */
export default function SmartContractTicketPage() {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : undefined
  const { data: session } = useSession()
  const utils = api.useContext()
  const { needSign } = useNeedSign()

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id })
  const { data: onChainInsights, isLoading: isLoadingOnChainInsights } = api.nft.onChainInsights.useQuery(
    { id: id ?? "" },
    { enabled: !!id },
  )
  const getBuyEditionXDR = api.nft.getBuyEditionXDR.useMutation()
  const confirmBuyEdition = api.nft.confirmBuyEdition.useMutation()
  const getBuyBatchXDR = api.nft.getBuyBatchXDR.useMutation()
  const confirmBuyBatch = api.nft.confirmBuyBatch.useMutation()
  const toggleLike = api.nft.toggleLike.useMutation({
    onSuccess: () => void utils.nft.byId.invalidate({ id }),
  })
  const [isBuyingPrimary, setIsBuyingPrimary] = useState(false)
  const [isBuyingResale, setIsBuyingResale] = useState(false)

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

  async function invalidateAfterPurchase() {
    await Promise.all([
      utils.nft.byId.invalidate({ id: nft!.id }),
      utils.nft.onChainInsights.invalidate({ id: nft!.id }),
      utils.nft.unlockStatus.invalidate({ nftId: nft!.id }),
      utils.nft.list.invalidate(),
      utils.nft.myOwned.invalidate(),
    ])
  }

  async function handleBuyPrimary({ paymentToken, quantity }: { paymentToken: NftPaymentToken; quantity: number }) {
    if (!session?.user || !nft) {
      toast.error("Connect your wallet first")
      return
    }
    setIsBuyingPrimary(true)
    try {
      const { xdr, fullySignedByServer, purchaseId } = await getBuyEditionXDR.mutateAsync({
        nftId: nft.id,
        paymentToken,
        quantity,
        signWith: needSign(),
      })

      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Purchase transaction could not be confirmed.")
        return
      }

      await confirmBuyEdition.mutateAsync({ nftId: nft.id, purchaseId, txHash })
      await invalidateAfterPurchase()
      toast.success(
        nft.unlockRuleType
          ? quantity > 1
            ? `${quantity} tickets purchased! Each one has its own ${nft.unlockLocationRule?.points.length ?? 0}-pin set to collect.`
            : "Ticket purchased! Go collect its pins to unlock the reward."
          : quantity > 1
            ? `${quantity} copies purchased!`
            : "Purchase complete!",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed")
    } finally {
      setIsBuyingPrimary(false)
    }
  }

  async function handleBuyResaleBatch(tokenIds: string[], paymentToken: NftPaymentToken) {
    if (!session?.user || !nft || tokenIds.length === 0) {
      toast.error("Connect your wallet first")
      return
    }
    setIsBuyingResale(true)
    try {
      const { xdr, fullySignedByServer } = await getBuyBatchXDR.mutateAsync({
        tokenIds,
        paymentToken,
        signWith: needSign(),
      })

      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Purchase transaction could not be confirmed.")
        return
      }

      await confirmBuyBatch.mutateAsync({ tokenIds, txHash })
      await invalidateAfterPurchase()
      toast.success(tokenIds.length > 1 ? `${tokenIds.length} copies purchased!` : "Purchase complete!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed")
    } finally {
      setIsBuyingResale(false)
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

  // "Gated" mirrors `nft.unlockStatus`'s own definition: having locked
  // content at all, not whether a location rule was added. A ticket with
  // a reward but no rule still needs this section — it just unlocks
  // immediately once owned instead of requiring pins first.
  const isGated = nft.lockedMedia.length > 0
  const requiredLocations = nft.unlockLocationRule?.points.length ?? 0
  const mediaCounts = {
    songs: nft.lockedMedia.filter((m) => m.type === "SONG").length,
    images: nft.lockedMedia.filter((m) => m.type === "IMAGE").length,
    videos: nft.lockedMedia.filter((m) => m.type === "VIDEO").length,
    links: nft.lockedMedia.filter((m) => m.type === "OTHER").length,
  }

  return (
    <>
      <Head>
        <title>{`${nft.name} — Actionverse`}</title>
      </Head>
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Marketplace
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
                        <>
                          Every copy of this ticket unlocks its own reward independently — visit and collect{" "}
                          <span className="font-medium text-foreground">
                            {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                          </span>{" "}
                          with that copy to reveal it.
                        </>
                      ) : (
                        "Owning a copy unlocks its reward immediately — no extra requirement."
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
                  <LockedMediaPanel
                    items={nft.lockedMedia.map((m) => ({ url: "", type: m.type, label: m.label }))}
                    locked
                    ticketName={nft.name}
                    ticketThumbnail={nft.thumbnail}
                  />
                </div>
              </>
            )}

            {nft.resaleListings.length > 0 ? (
              <ResaleBuyCard
                listings={nft.resaleListings}
                viewerId={session?.user.id}
                onBuy={handleBuyResaleBatch}
                isBuying={isBuyingResale}
              />
            ) : (
              <PrimaryBuyCard
                nft={nft}
                onChainInsights={onChainInsights}
                isLoadingOnChainInsights={isLoadingOnChainInsights}
                onBuy={handleBuyPrimary}
                isBuying={isBuyingPrimary}
              />
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

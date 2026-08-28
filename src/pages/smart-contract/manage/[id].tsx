import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import { clientsign, extractTxHash } from "package/connect_wallet"
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, MapPin, Package, Pencil, Sparkles } from "lucide-react"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { type NftDisplayCurrency } from "~/lib/stellar/oz/nft"
import { api } from "~/utils/api"
import { LikeButton } from "~/components/nft/like-button"
import { ManagePriceCard } from "~/components/nft/nft-detail-view"
import { BlockchainInsights } from "~/components/nft/blockchain-insights"
import { ItemVault } from "~/components/smart-contract/unlock-progress-list"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"

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
  // Which of the Your Tokens / Description / On-Chain tabs is active
  const [infoTab, setInfoTab] = useState<"tokens" | "description" | "onchain">("tokens")
  const vaultRef = useRef<HTMLDivElement>(null)

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

  async function handleListToken(tokenId: string, prices: { paymentToken: NftDisplayCurrency; price: number }[]) {
    if (!session?.user) return
    setIsSavingListing(true)
    try {
      const { xdr, fullySignedByServer } = await getListXDR.mutateAsync({ tokenId, prices, signWith: needSign() })
      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.")
        return
      }
      const usdPrice = prices.find((p) => p.paymentToken === "usd")!.price
      await confirmListing.mutateAsync({ tokenId, txHash, usdPrice })
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
  async function handleListMultiple(tokenIds: string[], prices: { paymentToken: NftDisplayCurrency; price: number }[]) {
    if (!session?.user || tokenIds.length === 0) return
    setIsSavingListing(true)
    try {
      const { xdr, fullySignedByServer } = await getListBatchXDR.mutateAsync({ tokenIds, prices, signWith: needSign() })
      const txHash = await signAndSubmit(xdr, fullySignedByServer)
      if (!txHash) {
        toast.error("Listing transaction could not be confirmed.")
        return
      }
      const usdPrice = prices.find((p) => p.paymentToken === "usd")!.price
      await confirmListBatch.mutateAsync({ tokenIds, txHash, usdPrice })
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
      <div className="mx-auto max-w-6xl p-4 md:px-6 md:pt-4 md:pb-2 lg:h-[calc(100vh-11vh)] lg:overflow-hidden">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 lg:h-full">
          <div className="flex flex-col gap-3 lg:h-full lg:overflow-hidden">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="aspect-square rounded-2xl lg:aspect-auto lg:flex-1 lg:min-h-0" />
          </div>
          <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-3">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const isGated = nft.lockedMedia.length > 0
  // Summed across every gated item — a ticket with a 2-location song and a
  // 3-location video reports 5, not one shared count.
  const requiredLocations = nft.lockedMedia.reduce(
    (sum, m) => sum + (m.unlockRule?.points.length ?? 0),
    0,
  )
  // Items with an actual location rule to show names/pins for — same set
  // `requiredLocations` sums over, just kept as the items themselves.
  const gatedMedia = nft.lockedMedia.filter((m) => (m.unlockRule?.points.length ?? 0) > 0)

  return (
    <>
      <Head>
        <title>{`Manage ${nft.name} — Actionverse`}</title>
      </Head>
      <div className="mx-auto max-w-6xl p-4 md:px-6 md:pt-4 md:pb-2 lg:h-[calc(100vh-11vh)] lg:overflow-hidden">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 lg:h-full">
          <div className="flex flex-col gap-3 lg:h-full lg:overflow-hidden">
            <Link
              href="/my-collection"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              My Collection
            </Link>
            <div className="relative aspect-square lg:aspect-auto lg:flex-1 lg:min-h-0 overflow-hidden rounded-2xl bg-muted shadow-lg">
              <Image src={nft.thumbnail} alt={nft.name} fill className="object-cover" />
              {isGated && (
                <div className="absolute left-4 top-4">
                  <Badge className="gap-1 bg-black/70 text-white">
                    <Sparkles className="h-3 w-3" />
                    VIP Item
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-3">
            <div className="sticky top-0 z-10 space-y-1.5 bg-background/95 pb-2 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-xl font-bold leading-tight text-foreground md:text-2xl">{nft.name}</h1>
                <div className="flex shrink-0 items-center gap-2">
                  {session?.user?.id === nft.creatorId && (
                    <Link
                      href={`/organization/smart-contract/edit/${nft.id}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </Link>
                  )}
                  <LikeButton isLiked={nft.isLiked} likeCount={nft.likeCount} onToggle={handleLike} variant="pill" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  {myTokens.length} {myTokens.length === 1 ? "copy" : "copies"} owned
                </span>
                {isGated && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      {nft.lockedMedia.length} reward{nft.lockedMedia.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
                {requiredLocations > 0 && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        vaultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="inline-flex items-center gap-1 text-amber-600 transition-colors hover:underline dark:text-amber-400"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {requiredLocations} location{requiredLocations === 1 ? "" : "s"} to visit
                    </button>
                  </>
                )}
              </div>
            </div>

            {isGated && (
              <div ref={vaultRef}>
                <ItemVault
                  nftId={nft.id}
                  itemName={nft.name}
                  itemThumbnail={nft.thumbnail}
                  lockedMedia={gatedMedia}
                />
              </div>
            )}

            <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as "tokens" | "description" | "onchain")}>
              <TabsList className="w-full">
                <TabsTrigger value="tokens" className="flex-1">
                  Your tokens ({myTokens.length})
                </TabsTrigger>
                <TabsTrigger value="description" className="flex-1">
                  Description
                </TabsTrigger>
                <TabsTrigger value="onchain" className="flex-1">
                  On-Chain
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tokens" className="mt-3">
                <ManagePriceCard
                  myTokens={myTokens}
                  onListToken={handleListToken}
                  onListMultiple={handleListMultiple}
                  onCancelListing={handleCancelListing}
                  isSaving={isSavingListing}
                  network={onChainInsights?.network}
                />
              </TabsContent>

              <TabsContent value="description" className="mt-3">
                <Card>
                  <CardContent className="p-4">
                    {nft.description ? (
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {nft.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No description provided.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="onchain" className="mt-3">
                <BlockchainInsights
                  insights={onChainInsights}
                  isLoading={isLoadingOnChainInsights}
                  nftName={nft.name}
                  nftThumbnail={nft.thumbnail}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  )
}

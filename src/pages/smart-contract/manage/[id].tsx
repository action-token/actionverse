import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import { clientsign, extractTxHash } from "package/connect_wallet"
import { submitSignedXDRToServer4User } from "package/connect_wallet/src/lib/stellar/trx/payment_fb_g"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, MapPin, Pencil, Sparkles, Ticket } from "lucide-react"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import useNeedSign from "~/lib/hook"
import { clientSelect } from "~/lib/stellar/fan/utils"
import { type NftDisplayCurrency } from "~/lib/stellar/oz/nft"
import { api } from "~/utils/api"
import { LikeButton } from "~/components/nft/like-button"
import { ManagePriceCard } from "~/components/nft/nft-detail-view"
import { BlockchainInsights } from "~/components/nft/blockchain-insights"
import { TicketVault } from "~/components/smart-contract/unlock-progress-list"
import { UnlockLocationsPreview } from "~/components/smart-contract/unlock-locations-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { cn } from "~/lib/utils"

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
  // Which of the Your Tokens / Locations / On-Chain tabs is active —
  // defaults to Your Tokens, the primary action on this page; the
  // "N locations to visit" chip in the header forces this to "location"
  // and scrolls the tab group into view when clicked.
  const [infoTab, setInfoTab] = useState<"tokens" | "location" | "onchain">("tokens")
  const infoTabsRef = useRef<HTMLDivElement>(null)

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
  // Items with an actual location rule to show names/pins for — same set
  // `requiredLocations` sums over, just kept as the items themselves.
  const gatedMedia = nft.lockedMedia.filter((m) => (m.unlockRule?.points.length ?? 0) > 0)

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
          <div className="flex items-center gap-3">
            {session?.user?.id === nft.creatorId && (
              <Link
                href={`/organization/smart-contract/edit/${nft.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            )}
            <LikeButton isLiked={nft.isLiked} likeCount={nft.likeCount} onToggle={handleLike} variant="pill" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="lg:sticky lg:top-6 lg:self-start">
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

          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-foreground">{nft.name}</h1>
              {nft.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Ticket className="h-3.5 w-3.5 text-primary" />
                {myTokens.length} cop{myTokens.length === 1 ? "y" : "ies"} owned
              </span>
              {requiredLocations > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setInfoTab("location")
                    infoTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {requiredLocations} location{requiredLocations === 1 ? "" : "s"} to visit
                </button>
              )}
              {isGated && (
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {nft.lockedMedia.length} reward{nft.lockedMedia.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {isGated && (
              <TicketVault
                nftId={nft.id}
                ticketName={nft.name}
                ticketThumbnail={nft.thumbnail}
                lockedMedia={gatedMedia}
              />
            )}

            {isGated ? (
              <div ref={infoTabsRef}>
                <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as "tokens" | "location" | "onchain")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="tokens" className="flex-1">
                      Your tokens ({myTokens.length})
                    </TabsTrigger>
                    <TabsTrigger value="location" className="flex-1">
                      Locations
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

                  <TabsContent value="location" className="mt-3">
                    <Card>
                      <CardContent className="space-y-3 p-4">
                        <p className="text-sm text-muted-foreground">
                          {requiredLocations > 0 ? (
                            gatedItemCount === nft.lockedMedia.length ? (
                              <>
                                Every copy of this ticket unlocks its rewards independently — visit and
                                collect{" "}
                                <span className="font-medium text-foreground">
                                  {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                                </span>{" "}
                                with that copy — you&apos;ll need to be within 50 meters of each pin to
                                collect it.
                              </>
                            ) : (
                              <>
                                Some items unlock the moment you own a copy; the rest reveal once you
                                visit and collect{" "}
                                <span className="font-medium text-foreground">
                                  {requiredLocations} location{requiredLocations === 1 ? "" : "s"}
                                </span>{" "}
                                with that copy — you&apos;ll need to be within 50 meters of each pin to
                                collect it.
                              </>
                            )
                          ) : (
                            "Owning a copy unlocks its rewards immediately — no extra requirement."
                          )}
                        </p>

                        {requiredLocations > 0 && (
                          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                            <li>
                              Go to the pin&apos;s location — get within{" "}
                              <span className="font-medium text-foreground">50 meters</span>, in person,
                              with this device.
                            </li>
                            <li>Open the AR camera once you&apos;re in range.</li>
                            <li>Collect the pin — it unlocks the reward automatically from there.</li>
                          </ul>
                        )}

                        {gatedMedia.map((m, i) => (
                          <div
                            key={m.label ?? i}
                            className={cn("space-y-2", i > 0 && "border-t border-border/60 pt-3")}
                          >
                            {gatedMedia.length > 1 && (
                              <p className="text-xs font-semibold text-foreground">Locations:</p>
                            )}
                            <UnlockLocationsPreview points={m.unlockRule!.points} />
                          </div>
                        ))}
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
            ) : (
              <Tabs
                value={infoTab === "location" ? "tokens" : infoTab}
                onValueChange={(v) => setInfoTab(v as "tokens" | "onchain")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="tokens" className="flex-1">
                    Your tokens ({myTokens.length})
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

                <TabsContent value="onchain" className="mt-3">
                  <BlockchainInsights
                    insights={onChainInsights}
                    isLoading={isLoadingOnChainInsights}
                    nftName={nft.name}
                    nftThumbnail={nft.thumbnail}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

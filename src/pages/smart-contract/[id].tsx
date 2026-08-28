import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, Footprints, MapPin, Sparkles } from "lucide-react"
import { ActivationModal } from "~/components/modal/activation-modal"
import { Badge } from "~/components/shadcn/ui/badge"
import { Card, CardContent } from "~/components/shadcn/ui/card"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { useNftBuyFlow } from "~/components/nft/use-nft-buy-flow"
import { type NftPaymentToken } from "~/lib/stellar/oz/nft"
import { api } from "~/utils/api"
import { LikeButton } from "~/components/nft/like-button"
import { PrimaryBuyCard, ResaleBuyCard } from "~/components/nft/nft-detail-view"
import { BlockchainInsights } from "~/components/nft/blockchain-insights"
import { PurchaseSuccessModal } from "~/components/nft/purchase-success-modal"
import { useLoginRequiredModalStore } from "~/components/store/login-required-modal-store"
import {
  LockedContentList,
  lockedMediaSummary,
  UnlockRequirementNotice,
} from "~/components/smart-contract/locked-media-panel"
import { UnlockLocationsPreview } from "~/components/smart-contract/unlock-locations-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { cn } from "~/lib/utils"

/**
 * The one **buy** page for every NFT — gated ("VIP ticket") or ordinary
 * alike, primary or resale. Purely about buying: an owner managing what
 * they already hold (resale listing, unlock progress, reward reveal) uses
 * `src/pages/smart-contract/manage/[id].tsx` instead — kept as a separate
 * route rather than folded in here, so this page's job stays one thing.
 * Replaces `src/pages/nft/[id].tsx`. See VIP_TICKET_UNLOCK_PLAN.md.
 */
export default function SmartContractItemPage() {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : undefined
  // Set when the viewer arrived from a resale card in the feed (see
  // `NftCard`'s href). Scopes this page to that seller's resold copies:
  // primary "buy new" pricing is for a different supply and would be
  // misleading to someone who clicked a specific resale offer.
  const resaleSellerId = typeof router.query.resale === "string" ? router.query.resale : undefined
  const { data: session } = useSession()

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id })
  const { data: onChainInsights, isLoading: isLoadingOnChainInsights } = api.nft.onChainInsights.useQuery(
    { id: id ?? "" },
    { enabled: !!id },
  )
  const {
    isBuyingPrimary,
    isBuyingResale,
    needsActivation,
    setNeedsActivation,
    buyEdition,
    buyResaleBatch,
    utils,
  } = useNftBuyFlow()
  const toggleLike = api.nft.toggleLike.useMutation({
    onSuccess: () => void utils.nft.byId.invalidate({ id }),
  })
  // Which of the Locations / Description / On-Chain tabs is active — defaults to
  // Locations for gated tickets, or Description when not gated.
  const [infoTab, setInfoTab] = useState<"location" | "description" | "onchain">("location")
  const infoTabsRef = useRef<HTMLDivElement>(null)
  // Shown instead of redirecting straight to the manage page: a buyer who
  // has just paid gets confirmation and a list of what they now own, and
  // chooses when to go in. `guestEmail` set only for a guest purchase — see
  // `PurchaseSuccessModal`'s doc comment.
  const [purchased, setPurchased] = useState<{ quantity: number; guestEmail?: string } | null>(null)
  const setLoginModalOpen = useLoginRequiredModalStore((s) => s.setIsOpen)

  function handleLike() {
    if (!session?.user) {
      toast.error("Connect your wallet to save favorites")
      return
    }
    toggleLike.mutate({ nftId: nft!.id })
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
      // Wallet/asset purchase needs a real session to sign with — a guest
      // buys with card instead (see `PrimaryBuyCard`'s guest branch).
      setLoginModalOpen(true)
      return
    }
    const bought = await buyEdition(
      nft.id,
      { paymentToken, quantity },
      gatedItemCount > 0
        ? quantity > 1
          ? `${quantity} copies purchased! Each one has its own pin sets to collect for ${gatedItemCount} reward item${gatedItemCount === 1 ? "" : "s"}.`
          : "Purchased! Go collect its pins to unlock the reward."
        : quantity > 1
          ? `${quantity} copies purchased!`
          : "Purchase complete!",
    )
    await invalidateAfterPurchase()
    if (bought) setPurchased({ quantity })
  }

  async function handleBuyResaleBatch(tokenIds: string[], paymentToken: NftPaymentToken) {
    if (!session?.user || !nft || tokenIds.length === 0) {
      setLoginModalOpen(true)
      return
    }
    const bought = await buyResaleBatch(tokenIds, paymentToken)
    await invalidateAfterPurchase()
    if (bought) setPurchased({ quantity: tokenIds.length })
  }

  // `quantity` defaults to 1 for `ResaleBuyCard`'s call sites, which never
  // pass one — a resale card purchase is always a single token.
  async function handleCardPurchaseSuccess(quantity = 1) {
    await invalidateAfterPurchase()
    setPurchased({ quantity })
  }

  async function handleGuestCardPurchaseSuccess(email: string, quantity = 1) {
    await invalidateAfterPurchase()
    setPurchased({ quantity, guestEmail: email })
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

  // "Gated" mirrors `nft.unlockStatus`'s own definition: having locked
  // content at all, not whether any item has a location rule. A ticket
  // with reward items but no rules on any of them still needs this
  // section — those items just unlock immediately once owned instead of
  // requiring pins first.
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
  // Prefer the live on-chain figure over the cached counter, same as
  // `PrimaryBuyCard` does internally — the two can drift between a mint
  // landing on-chain and `mintedCount` being refreshed.
  const remainingSupply = onChainInsights?.remainingSupply ?? nft.supply - nft.mintedCount
  // Narrowed to one seller when the viewer came in via that seller's resale
  // card; an unknown/stale `?resale=` seller falls back to the full list
  // rather than showing an empty page.
  const sellerListings = resaleSellerId
    ? nft.resaleListings.filter((l) => l.sellerId === resaleSellerId)
    : nft.resaleListings
  const visibleResaleListings = sellerListings.length > 0 ? sellerListings : nft.resaleListings
  const isResaleView = !!resaleSellerId && sellerListings.length > 0
  // Primary and resale are separate storefronts, each with its own card in
  // the feed, so this page shows one or the other — never both. The only
  // time a primary visit falls through to resale is when the edition is
  // sold out: otherwise that visitor would hit "Sold out" with no route to
  // the copies that *are* on offer.
  const showResale = isResaleView || (remainingSupply <= 0 && visibleResaleListings.length > 0)
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
      <ActivationModal dialogOpen={needsActivation} setDialogOpen={setNeedsActivation} />
      <PurchaseSuccessModal
        open={purchased !== null}
        onClose={() => setPurchased(null)}
        onViewItem={() => {
          setPurchased(null)
          void router.push(`/smart-contract/manage/${nft.id}`)
        }}
        itemName={nft.name}
        thumbnail={nft.thumbnail}
        quantity={purchased?.quantity ?? 1}
        rewards={nft.lockedMedia}
        guestEmail={purchased?.guestEmail}
      />
      <div className="mx-auto max-w-6xl p-4 md:px-6 md:pt-4 md:pb-2 lg:h-[calc(100vh-11vh)] lg:overflow-hidden">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 lg:h-full">
          <div className="flex flex-col gap-3 lg:h-full lg:overflow-hidden">
            <Link
              href="/marketplace"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Marketplace
            </Link>
            <div className="relative aspect-square lg:aspect-auto lg:flex-1 lg:min-h-0 overflow-hidden rounded-2xl bg-muted shadow-lg">
              <Image src={nft.thumbnail} alt={nft.name} fill className="object-cover" />
              {isGated && (
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <Badge className="gap-1 bg-black/70 text-white">
                    <Sparkles className="h-3 w-3" />
                    VIP Item
                  </Badge>
                  {requiredLocations > 0 && (
                    <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                      <Footprints className="h-3 w-3" />
                      Travel to unlock
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-3">
            <div className="sticky top-0 z-10 space-y-1.5 bg-background/95 pb-2 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-xl font-bold leading-tight text-foreground md:text-2xl">{nft.name}</h1>
                <div className="shrink-0">
                  <LikeButton isLiked={nft.isLiked} likeCount={nft.likeCount} onToggle={handleLike} variant="pill" />
                </div>
              </div>

              {isGated && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {nft.lockedMedia.length} reward{nft.lockedMedia.length === 1 ? "" : "s"}
                  </span>
                  {requiredLocations > 0 && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setInfoTab("location")
                          infoTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                        }}
                        className="inline-flex items-center gap-1 text-amber-600 transition-colors hover:underline dark:text-amber-400"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {requiredLocations} location{requiredLocations === 1 ? "" : "s"} to visit
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isGated && (
              <UnlockRequirementNotice
                requiredLocations={requiredLocations}
                gatedItemCount={gatedItemCount}
                totalItemCount={nft.lockedMedia.length}
                onSeeLocations={
                  requiredLocations > 0
                    ? () => {
                        setInfoTab("location")
                        infoTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                      }
                    : undefined
                }
              />
            )}

            {isGated && (
              <Card>
                <CardContent className="space-y-2.5 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What you get</h3>
                    <span className="text-xs text-muted-foreground">
                      {lockedMediaSummary(mediaCounts)}
                    </span>
                  </div>
                  <LockedContentList items={nft.lockedMedia} />
                </CardContent>
              </Card>
            )}

            {showResale ? (
              <ResaleBuyCard
                listings={visibleResaleListings}
                viewerId={session?.user.id}
                onBuy={handleBuyResaleBatch}
                isBuying={isBuyingResale}
                onCardPurchaseSuccess={handleCardPurchaseSuccess}
                onGuestCardPurchaseSuccess={handleGuestCardPurchaseSuccess}
              />
            ) : (
              <PrimaryBuyCard
                nft={nft}
                onChainInsights={onChainInsights}
                isLoadingOnChainInsights={isLoadingOnChainInsights}
                onBuy={handleBuyPrimary}
                isBuying={isBuyingPrimary}
                onCardPurchaseSuccess={handleCardPurchaseSuccess}
                onGuestCardPurchaseSuccess={handleGuestCardPurchaseSuccess}
              />
            )}

            {isGated ? (
              <div ref={infoTabsRef}>
                <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as "location" | "description" | "onchain")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="location" className="flex-1">
                      Locations
                    </TabsTrigger>
                    <TabsTrigger value="description" className="flex-1">
                      Description
                    </TabsTrigger>
                    <TabsTrigger value="onchain" className="flex-1">
                      On-Chain
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="location" className="mt-3">
                    <Card>
                      <CardContent className="space-y-4 p-4">
                        {requiredLocations > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-foreground">
                              How to unlock after buying
                            </p>
                            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                              <li>
                                Go to the pin&apos;s location — get within{" "}
                                <span className="font-medium text-foreground">50 meters</span>, in person,
                                with this device.
                              </li>
                              <li>Open the AR camera once you&apos;re in range.</li>
                              <li>Collect the pin — it unlocks the reward automatically from there.</li>
                            </ol>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Owning a copy unlocks its rewards immediately — no extra requirement.
                          </p>
                        )}

                        {gatedMedia.map((m, i) => (
                          <div
                            key={m.label ?? i}
                            className={cn("space-y-2 border-t border-border/60 pt-4")}
                          >
                            <p className="text-xs font-semibold text-foreground">
                              {m.label ?? `Reward ${i + 1}`} — {m.unlockRule!.points.length} location
                              {m.unlockRule!.points.length === 1 ? "" : "s"}
                            </p>
                            <UnlockLocationsPreview points={m.unlockRule!.points} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
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
            ) : (
              <Tabs defaultValue="description">
                <TabsList className="w-full">
                  <TabsTrigger value="description" className="flex-1">
                    Description
                  </TabsTrigger>
                  <TabsTrigger value="onchain" className="flex-1">
                    On-Chain
                  </TabsTrigger>
                </TabsList>
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
            )}
          </div>
        </div>
      </div>
    </>
  )
}

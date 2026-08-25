"use client"

import { type ChangeEvent, useEffect, useState } from "react"
import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  Upload,
  Check,
  X,
  Loader2,
  Coins,
  Lock,
  Sparkles,
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  Info,
} from "lucide-react"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/shadcn/ui/tooltip"
import { LISTING_PRICE_FLOOR_MARGIN, PLATFORM_ASSET } from "~/lib/stellar/constant"
import { ipfsHashToPinataGatewayUrl } from "~/utils/ipfs"
import { api } from "~/utils/api"
import { UnlockLocationsPreview } from "~/components/smart-contract/unlock-locations-preview"

/** Icon per locked-content item type, matching the icons the create page's
 *  `LockedMediaEditor` and the buyer-facing `LockedMediaPanel` already use. */
const LOCKED_MEDIA_ICONS = {
  SONG: Music,
  IMAGE: ImageIcon,
  VIDEO: VideoIcon,
  OTHER: LinkIcon,
} as const

/**
 * Edit page for a creator's own smart-contract NFT edition — mirrors
 * `organization/smart-contract/create.tsx`'s layout, prefilled from the
 * existing row. Name/description/thumbnail/supply/prices are always
 * editable; royalty is shown but permanently locked (see
 * docs/superpowers/specs/2026-08-24-edition-price-editing-design.md).
 * Before the first sale this is a plain database write; after it, saving
 * also calls the nft_oz contract's `update_edition` — either way the
 * creator signs nothing.
 */
export default function EditSmartContractNftPage() {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : undefined
  const { data: session } = useSession()
  const utils = api.useContext()

  const { data: nft, isLoading } = api.nft.byId.useQuery({ id: id ?? "" }, { enabled: !!id })
  const updateNft = api.nft.update.useMutation()

  // Live floor for the Platform Asset price — see the matching comment in
  // `smart-contract/create.tsx`.
  const feePreview = api.nft.getInclusionAndNetworkFeePreview.useQuery({ quantity: 1 })
  const minPriceAsset = feePreview.data
    ? (feePreview.data.inclusionFee + feePreview.data.networkFee) * LISTING_PRICE_FLOOR_MARGIN
    : null

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [supply, setSupply] = useState(1)
  const [priceAsset, setPriceAsset] = useState("")
  const [priceUsd, setPriceUsd] = useState("")
  const [thumbnailUrl, setThumbnailUrl] = useState<string>()
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Prefill once the row loads — a plain effect rather than defaulting
  // `useState` from `nft` directly, since `nft` is undefined on the first
  // render (the query hasn't resolved yet).
  useEffect(() => {
    if (!nft || hydrated) return
    setName(nft.name)
    setDescription(nft.description)
    setSupply(nft.supply)
    setThumbnailUrl(nft.thumbnail)
    const assetRow = nft.prices.find((p) => p.paymentToken === "asset")
    const usdRow = nft.prices.find((p) => p.paymentToken === "usd")
    setPriceAsset(assetRow ? String(assetRow.price) : "")
    setPriceUsd(usdRow ? String(usdRow.price) : "")
    setHydrated(true)
  }, [nft, hydrated])

  async function uploadThumbnail(file: File) {
    try {
      setThumbnailUploading(true)
      const formData = new FormData()
      formData.append("file", file, file.name)
      const res = await fetch("/api/file", { method: "POST", body: formData })
      const ipfsHash = await res.text()
      setThumbnailUrl(ipfsHashToPinataGatewayUrl(ipfsHash))
      toast.success("Thumbnail uploaded successfully")
    } catch {
      toast.error("Failed to upload file")
    } finally {
      setThumbnailUploading(false)
    }
  }

  function handleThumbnailChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB")
      return
    }
    void uploadThumbnail(file)
  }

  const parsedPriceAsset = Number(priceAsset) || 0
  const parsedPriceUsd = Number(priceUsd) || 0
  const isMinted = !!nft && nft.onChainEditionId !== null
  const minSupply = isMinted ? nft!.mintedCount : 1
  const maxSupply = isMinted ? nft!.supply : 100_000

  const canSubmit =
    !!nft &&
    name.trim().length > 0 &&
    !!thumbnailUrl &&
    supply >= minSupply &&
    supply <= maxSupply &&
    parsedPriceAsset > 0 &&
    (minPriceAsset === null || parsedPriceAsset >= minPriceAsset) &&
    parsedPriceUsd > 0

  async function handleSave() {
    if (!nft || !thumbnailUrl) return
    setSubmitLoading(true)
    try {
      await updateNft.mutateAsync({
        nftId: nft.id,
        name: name.trim(),
        description: description.trim(),
        thumbnail: thumbnailUrl,
        supply,
        prices: [
          { paymentToken: "asset", price: parsedPriceAsset },
          { paymentToken: "usd", price: parsedPriceUsd },
        ],
      })
      toast.success("Changes saved!")
      await Promise.all([
        utils.nft.list.invalidate(),
        utils.nft.myCreated.invalidate(),
        utils.nft.byId.invalidate({ id: nft.id }),
      ])
      await router.push(`/smart-contract/manage/${nft.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save changes")
      setSubmitLoading(false)
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

  if (!session?.user || session.user.id !== nft.creatorId) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Alert>
          <AlertDescription>You can only edit your own listings.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <Link
        href={`/smart-contract/manage/${nft.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to manage
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit {nft.name}</h1>
        <p className="text-sm text-muted-foreground">
          {isMinted
            ? "This edition has already sold — saving updates the real on-chain price and listing, still with no signature from you."
            : "Nothing has sold yet, so saving is a plain database update — no blockchain call."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item name</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Thumbnail Image</Label>
                {isMinted && (
                  <p className="text-xs text-muted-foreground">
                    Updating this changes what buyers see going forward. The original artwork
                    record on-chain doesn&apos;t change.
                  </p>
                )}
                <AnimatePresence>
                  {!thumbnailUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("edit-coverImg")?.click()}
                      className="relative flex h-36 w-full flex-col items-center justify-center gap-2 border-dashed"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload Thumbnail</span>
                      {thumbnailUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      )}
                    </Button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative h-36 overflow-hidden rounded-md"
                    >
                      <Image fill alt="preview image" src={thumbnailUrl} className="object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => setThumbnailUrl(undefined)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1">
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <Check className="mr-1 h-3 w-3" /> Uploaded
                        </Badge>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Input
                  id="edit-coverImg"
                  type="file"
                  accept=".jpg, .png"
                  onChange={handleThumbnailChange}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-royalty" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Creator royalty (%)
                  </Label>
                  <Input id="edit-royalty" value={nft.royaltyBps / 100} disabled />
                  <p className="text-xs text-muted-foreground">Fixed at creation — cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supply">Supply limit</Label>
                  <Input
                    id="edit-supply"
                    type="number"
                    min={minSupply}
                    max={maxSupply}
                    step="1"
                    value={supply}
                    onChange={(e) =>
                      setSupply(
                        Math.min(maxSupply, Math.max(minSupply, Math.round(Number(e.target.value) || minSupply))),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {isMinted
                      ? `${nft.mintedCount} already minted — can't go lower, or above ${nft.supply}`
                      : "Copies ever mintable"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Price per copy</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price-asset" className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      Price ({PLATFORM_ASSET.code})
                      {minPriceAsset !== null && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>
                                Minimum right now: {minPriceAsset.toFixed(2)} {PLATFORM_ASSET.code} —
                                below this, the network fee would cost more than the item itself and
                                purchases would be rejected.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </Label>
                    <Input
                      id="edit-price-asset"
                      type="number"
                      min={minPriceAsset ?? 0}
                      step="any"
                      value={priceAsset}
                      onChange={(e) => setPriceAsset(e.target.value)}
                    />
                    {parsedPriceAsset > 0 && minPriceAsset !== null && parsedPriceAsset < minPriceAsset && (
                      <p className="text-sm text-destructive">
                        Price ({PLATFORM_ASSET.code}) is below the minimum.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price-usd" className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      Price (USD)
                    </Label>
                    <Input
                      id="edit-price-usd"
                      type="number"
                      min={0}
                      step="any"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                    />
                    {(parsedPriceAsset <= 0 || parsedPriceUsd <= 0) && (
                      <p className="text-sm text-destructive">Set a price in both currencies.</p>
                    )}
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  Saving doesn{"'"}t ask for a signature — {isMinted
                    ? "the platform submits the on-chain update on your behalf."
                    : "nothing is on-chain yet, so this is just a database update."}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Locked Content, shown for visibility but not
            editable here: a gated item's reward content and unlock rule
            are fixed at creation, since editing them after buyers may
            already be mid-unlock would desync their progress. */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Locked Content
                <Badge variant="outline" className="ml-auto gap-1 text-xs font-normal text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Fixed at creation
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nft.lockedMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This edition has no locked reward content.
                </p>
              ) : (
                nft.lockedMedia.map((media, i) => {
                  const TypeIcon = LOCKED_MEDIA_ICONS[media.type]
                  return (
                    <div key={media.id} className="space-y-2 rounded-lg border p-3 opacity-80">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {media.label?.trim() || `Item ${i + 1}`}
                        </span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {media.type}
                        </Badge>
                      </div>
                      {media.unlockRule && media.unlockRule.points.length > 0 && (
                        <UnlockLocationsPreview points={media.unlockRule.points} />
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t pt-6">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSubmit || submitLoading}
          size="lg"
          className="flex items-center gap-2 shadow-sm shadow-foreground"
        >
          {submitLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}

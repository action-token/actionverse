"use client"

import { type ChangeEvent, useState } from "react"
import { useRouter } from "next/router"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Upload, Check, X, Loader2, Coins, Sparkles } from "lucide-react"
import toast from "react-hot-toast"
import { Button } from "~/components/shadcn/ui/button"
import { Input } from "~/components/shadcn/ui/input"
import { Label } from "~/components/shadcn/ui/label"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/shadcn/ui/card"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"
import { Alert, AlertDescription } from "~/components/shadcn/ui/alert"
import { MAX_ROYALTY_BPS, PLATFORM_ASSET } from "~/lib/stellar/constant"
import { cn } from "~/lib/utils"
import { ipfsHashToPinataGatewayUrl } from "~/utils/ipfs"
import { api } from "~/utils/api"
import { LockedMediaEditor, type LockedMediaDraft } from "~/components/smart-contract/locked-media-editor"

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Full page for creating a smart-contract NFT — replaces the old
 * step-by-step `SmartContractNftForm` dialog. Two-column layout, no
 * steps: everything is visible and editable at once. Living under
 * `/organization/*` so it automatically inherits `CreatorLayout` via
 * `RootLayout`'s route-prefix check, the same way `organization/store`,
 * `organization/music`, etc. already do. See
 * VIP_TICKET_UNLOCK_PLAN.md Phase 2.
 */
const MAX_NAME_LEN = 128
const MAX_DESCRIPTION_LEN = 2000
const MAX_SUPPLY = 100_000
const MAX_ROYALTY_PERCENT = MAX_ROYALTY_BPS / 100 // 90%
const MAX_PRICE_ASSET = 100_000_000 // 100M tokens max
const MAX_PRICE_USD = 100_000 // $100k max

export default function CreateSmartContractNftPage() {
  const router = useRouter()
  const utils = api.useContext()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [royaltyPercent, setRoyaltyPercent] = useState(0)
  const [supply, setSupply] = useState(1)
  // Empty string means "not offered in this currency" — at least one of
  // the two must end up positive. USD is a creator-set sticker price
  // (charged via Square), independent of the ACTION price, not derived
  // from it.
  const [priceAsset, setPriceAsset] = useState("")
  const [priceUsd, setPriceUsd] = useState("")

  // The thumbnail *is* the item's own visible content here — there's no
  // separate "media" upload step. `contentMimeType` is the thumbnail
  // file's own mime type, captured at upload time, since `nft.create`
  // still needs some `mediaType` even though this page never asks the
  // creator to pick one.
  const [thumbnailUrl, setThumbnailUrl] = useState<string>()
  const [contentMimeType, setContentMimeType] = useState<string>()
  const [thumbnailUploading, setThumbnailUploading] = useState(false)

  // Optional "VIP ticket" gating, one condition per locked-content row —
  // see LockedMediaEditor. Leaving this empty produces an ordinary,
  // ungated listing exactly as before.
  const [lockedMedia, setLockedMedia] = useState<LockedMediaDraft[]>([])
  const [submitLoading, setSubmitLoading] = useState(false)

  const createNft = api.nft.create.useMutation()


  async function uploadThumbnail(file: File) {
    try {
      setThumbnailUploading(true)
      const formData = new FormData()
      formData.append("file", file, file.name)
      const res = await fetch("/api/file", { method: "POST", body: formData })
      const ipfsHash = await res.text()
      setThumbnailUrl(ipfsHashToPinataGatewayUrl(ipfsHash))
      setContentMimeType(file.type)
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
      toast.error("File size should be less than 2MB")
      return
    }
    void uploadThumbnail(file)
  }

  const parsedPriceAsset = Number(priceAsset) || 0
  const parsedPriceUsd = Number(priceUsd) || 0

  const completeLockedMedia = lockedMedia.filter(
    (m): m is LockedMediaDraft & { url: string } => !!m.url && isValidHttpUrl(m.url),
  )
  const incompleteUnlockRule = lockedMedia.some((m) => m.unlockRule && m.unlockRule.points.length === 0)

  const isPriceAssetValid = parsedPriceAsset > 0 && parsedPriceAsset <= MAX_PRICE_ASSET
  const isPriceUsdValid = parsedPriceUsd > 0 && parsedPriceUsd <= MAX_PRICE_USD

  const canSubmit =
    name.trim().length > 0 &&
    name.trim().length <= MAX_NAME_LEN &&
    description.trim().length <= MAX_DESCRIPTION_LEN &&
    !!thumbnailUrl &&
    !!contentMimeType &&
    supply >= 1 &&
    supply <= MAX_SUPPLY &&
    royaltyPercent >= 0 &&
    royaltyPercent <= MAX_ROYALTY_PERCENT &&
    isPriceAssetValid &&
    isPriceUsdValid &&
    completeLockedMedia.length > 0 &&
    !incompleteUnlockRule

  /**
   * A plain database write — no XDR, no signature, nothing for the creator
   * to sign or pay for. Nothing mints here: the row becomes a live,
   * buyable marketplace entry immediately, and `buy_edition` registers it
   * on-chain (from this same data) the moment someone actually buys a
   * copy.
   */
  async function handleCreate() {
    if (!thumbnailUrl || !contentMimeType) return
    setSubmitLoading(true)
    try {
      const prices: { paymentToken: "asset" | "usd"; price: number }[] = []
      if (parsedPriceAsset > 0) prices.push({ paymentToken: "asset", price: parsedPriceAsset })
      if (parsedPriceUsd > 0) prices.push({ paymentToken: "usd", price: parsedPriceUsd })

      const created = await createNft.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        thumbnail: thumbnailUrl,
        // No separate "content" upload in this form — the thumbnail is
        // the item's own visible content.
        contentUrl: thumbnailUrl,
        mediaType: contentMimeType,
        royaltyBps: Math.round(royaltyPercent * 100),
        supply,
        prices,
        lockedMedia: completeLockedMedia.map((m) => ({
          url: m.url,
          type: m.type,
          label: m.label.trim() || undefined,
          unlockRule: m.unlockRule ? { points: m.unlockRule.points } : undefined,
        })),
      })

      toast.success("Listing created!")
      await Promise.all([utils.nft.list.invalidate(), utils.nft.myCreated.invalidate()])
      await router.push(`/smart-contract/${created.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create listing")
      setSubmitLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <Link
        href="/organization/store"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to store
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create Smart Contract NFT</h1>
        <p className="text-sm text-muted-foreground">
          On-chain ownership, royalties, and resale built in — you sign nothing and pay nothing to
          create this. Copies mint straight to each buyer when they buy.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — Details + Pricing */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sc-name">Item name</Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      name.length >= MAX_NAME_LEN
                        ? "font-semibold text-destructive"
                        : name.length > MAX_NAME_LEN - 15
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {name.length}/{MAX_NAME_LEN}
                  </span>
                </div>
                <Input
                  id="sc-name"
                  maxLength={MAX_NAME_LEN}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a name for your item (max 128 chars)"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sc-description">Description</Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      description.length >= MAX_DESCRIPTION_LEN
                        ? "font-semibold text-destructive"
                        : description.length > MAX_DESCRIPTION_LEN - 100
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {description.length}/{MAX_DESCRIPTION_LEN.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  id="sc-description"
                  maxLength={MAX_DESCRIPTION_LEN}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your NFT (max 2,000 chars)"
                  className="min-h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Thumbnail Image</Label>
                <AnimatePresence>
                  {!thumbnailUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("sc-coverImg")?.click()}
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
                  id="sc-coverImg"
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sc-royalty">Creator royalty (%)</Label>
                    <span className="text-[11px] text-muted-foreground">Max {MAX_ROYALTY_PERCENT}%</span>
                  </div>
                  <Input
                    id="sc-royalty"
                    type="number"
                    min={0}
                    max={MAX_ROYALTY_PERCENT}
                    step="0.1"
                    value={royaltyPercent}
                    onChange={(e) =>
                      setRoyaltyPercent(
                        Math.min(MAX_ROYALTY_PERCENT, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">Earned on every resale (0 - 90%)</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sc-supply">Supply limit</Label>
                    <span className="text-[11px] text-muted-foreground">Max {MAX_SUPPLY.toLocaleString()}</span>
                  </div>
                  <Input
                    id="sc-supply"
                    type="number"
                    min={1}
                    max={MAX_SUPPLY}
                    step="1"
                    value={supply}
                    onChange={(e) =>
                      setSupply(
                        Math.min(MAX_SUPPLY, Math.max(1, Math.round(Number(e.target.value) || 1))),
                      )
                    }
                    placeholder="Default: 1"
                  />
                  <p className="text-xs text-muted-foreground">Copies ever mintable (1 to 100,000)</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Price per copy</p>
                  <span className="text-[11px] text-muted-foreground">Both currencies required</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The USD price is charged by card (Square); it&apos;s a sticker price you set, not
                  converted live from the {PLATFORM_ASSET.code} price (min 0.0000001, max 100M).
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sc-price-asset" className="flex items-center gap-1.5 text-xs font-medium">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                        Price ({PLATFORM_ASSET.code})
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Max 100M</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="sc-price-asset"
                        type="number"
                        min={0.0000001}
                        max={MAX_PRICE_ASSET}
                        step="any"
                        value={priceAsset}
                        onChange={(e) => setPriceAsset(e.target.value)}
                        placeholder="e.g. 5"
                        className={cn(
                          "pr-16",
                          priceAsset && !isPriceAssetValid && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        {PLATFORM_ASSET.code}
                      </span>
                    </div>
                    {priceAsset && parsedPriceAsset <= 0 ? (
                      <p className="text-[11px] text-destructive">Price must be greater than 0.</p>
                    ) : priceAsset && parsedPriceAsset > MAX_PRICE_ASSET ? (
                      <p className="text-[11px] text-destructive">
                        Max price is {MAX_PRICE_ASSET.toLocaleString()} {PLATFORM_ASSET.code}.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sc-price-usd" className="flex items-center gap-1.5 text-xs font-medium">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                        Price (USD)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Max $100k</span>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="sc-price-usd"
                        type="number"
                        min={0.01}
                        max={MAX_PRICE_USD}
                        step="0.01"
                        value={priceUsd}
                        onChange={(e) => setPriceUsd(e.target.value)}
                        placeholder="e.g. 10"
                        className={cn(
                          "pl-7 pr-12",
                          priceUsd && !isPriceUsdValid && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        USD
                      </span>
                    </div>
                    {priceUsd && parsedPriceUsd <= 0 ? (
                      <p className="text-[11px] text-destructive">Price must be greater than 0.</p>
                    ) : priceUsd && parsedPriceUsd > MAX_PRICE_USD ? (
                      <p className="text-[11px] text-destructive">
                        Max price is ${MAX_PRICE_USD.toLocaleString()} USD.
                      </p>
                    ) : null}
                  </div>
                </div>

                {(!priceAsset || !priceUsd) && (
                  <p className="text-xs text-destructive">Set a price in both currencies.</p>
                )}
              </div>

              <Alert>
                <AlertDescription>
                  Creating this doesn{"'"}t touch the blockchain or ask for a signature — it just
                  lists the item. Copies mint on-chain straight to each buyer, right when they buy.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Locked Content, each row optionally gated by its
            own unlock condition. */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Locked Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Songs, images, videos, or links that stay hidden from every buyer until they unlock
                this copy. Add at least one — this is the reward the ticket is actually for. Each
                item can optionally require visiting real-world locations to reveal it; an item with
                no condition reveals the moment a copy is bought.
              </p>
              <LockedMediaEditor items={lockedMedia} onChange={setLockedMedia} />
              {completeLockedMedia.length === 0 && (
                <p className="text-sm text-destructive">
                  Add at least one reward item (with a valid link, if using "Link") to continue.
                </p>
              )}
              {incompleteUnlockRule && (
                <p className="text-sm text-destructive">
                  Add at least one location to every item with an unlock condition turned on, or
                  turn it off.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t pt-6">
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!canSubmit || submitLoading}
          size="lg"
          className="flex items-center gap-2 shadow-sm shadow-foreground"
        >
          {submitLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Listing"
          )}
        </Button>
      </div>
    </div>
  )
}

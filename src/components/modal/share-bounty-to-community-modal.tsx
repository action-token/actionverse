"use client"

import { useState } from "react"
import Image from "next/image"
import { api } from "~/utils/api"
import { Loader2, Check } from "lucide-react"

import { Button } from "~/components/shadcn/ui/button"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Label } from "~/components/shadcn/ui/label"
import { Switch } from "~/components/shadcn/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/shadcn/ui/dialog"
import toast from "react-hot-toast"
import { useShareBountyModalStore } from "../store/share-bounty-modal-store"
import { BountyLinkEmbed } from "../bounty/bounty-embed-card"

export function ShareBountyToCommunityModal() {
  const { isOpen, setIsOpen, bountyId, bountyUrl } = useShareBountyModalStore()
  const [content, setContent] = useState("")
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [selectedCommunities, setSelectedCommunities] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: communities, isLoading: communitiesLoading } =
    api.community.community.getMyPostableCommunities.useQuery(undefined, {
      enabled: isOpen,
    })

  const createPost = api.community.post.create.useMutation()
  const utils = api.useUtils()

  const handleClose = () => {
    setIsOpen(false)
    setContent("")
    setCommentsEnabled(true)
    setSelectedCommunities([])
  }

  const toggleCommunity = (id: number) => {
    setSelectedCommunities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const handleShare = async () => {
    if (selectedCommunities.length === 0) {
      toast.error("Select at least one community")
      return
    }

    setIsSubmitting(true)
    try {
      const postContent = content.trim()
        ? `${content.trim()}\n\n${bountyUrl}`
        : bountyUrl

      await Promise.all(
        selectedCommunities.map((communityId) =>
          createPost.mutateAsync({
            communityId,
            content: postContent,
            commentsEnabled,
          }),
        ),
      )

      toast.success(
        selectedCommunities.length === 1
          ? "Shared to community!"
          : `Shared to ${selectedCommunities.length} communities!`,
      )
      void utils.community.post.getAll.invalidate()
      handleClose()
    } catch (err) {
      toast.error("Failed to share")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Bounty</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bounty preview */}
          {bountyId && <BountyLinkEmbed bountyId={bountyId} />}

          {/* Caption */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Add a caption (optional)
            </Label>
            <Textarea
              placeholder="Say something about this bounty..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border-0 bg-muted/50 text-sm focus-visible:ring-1"
            />
          </div>

          {/* Comments toggle */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label className="text-xs">Allow comments</Label>
            <Switch
              checked={commentsEnabled}
              onCheckedChange={setCommentsEnabled}
            />
          </div>

          {/* Community selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Share to communities
            </Label>
            {communitiesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : communities && communities.length > 0 ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {communities.map((community) => {
                  const isSelected = selectedCommunities.includes(community.id)
                  return (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => toggleCommunity(community.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={community.profileUrl}
                          alt={community.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {community.title}
                      </span>
                      {isSelected && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                You don&apos;t have any communities where you can post.
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full gap-2 rounded-full"
            onClick={handleShare}
            disabled={isSubmitting || selectedCommunities.length === 0}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectedCommunities.length > 0
              ? `Share to ${selectedCommunities.length} communit${selectedCommunities.length === 1 ? "y" : "ies"}`
              : "Select communities"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

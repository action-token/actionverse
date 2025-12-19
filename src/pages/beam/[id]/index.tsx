"use client"

import { useState } from "react"
import { Button } from "~/components/shadcn/ui/button"
import { Card } from "~/components/shadcn/ui/card"
import { Textarea } from "~/components/shadcn/ui/textarea"
import { Badge } from "~/components/shadcn/ui/badge"
import { Separator } from "~/components/shadcn/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/shadcn/ui/tabs"
import { Download, Share2, Heart, MessageCircle, Eye, Sparkles, Clock, Send, RotateCcw, Copy, Loader2, ArrowLeft, Link } from "lucide-react"
import { useToast } from "~/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { api } from "~/utils/api"
import { useRouter } from "next/router"
import { QRCodeModal } from "~/components/beam/qr-code-modal"
import { BeamComments } from "~/components/beam/beam-comments"
import { BeamReactions } from "~/components/beam/beam-reactions"
import { BeamContentCard } from "~/components/beam/beam-content-card"
import { BeamActions } from "~/components/beam/beam-actions"

const emojis = ["❤️", "🎉", "👏", "😊", "🔥", "✨", "💯", "🎈"]


export default function BeamPage() {
  const router = useRouter()
  const id = router.query.id as string
  const { toast } = useToast()

  const [comment, setComment] = useState("")
  const [loadingEmoji, setLoadingEmoji] = useState<string | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)

  const { data: beam, isLoading, refetch } = api.beam.getById.useQuery({ id })

  const addReactionMutation = api.beam.addReaction.useMutation({
    onSuccess: () => {
      toast({ title: "Reaction added!", description: "Your reaction has been recorded." })
      refetch()
    },
    onSettled: () => setLoadingEmoji(null),
  })

  const addCommentMutation = api.beam.addComment.useMutation({
    onSuccess: () => {
      toast({ title: "Comment posted!", description: "Your comment has been added." })
      setComment("")
      refetch()
    },
  })

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: "Link copied!", description: "Beam link copied to clipboard." })
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Beam from ${beam?.senderName}`,
        text: `Check out this Beam!`,
        url: window.location.href,
      })
    } else {
      handleCopyLink()
    }
  }

  const handleDownload = () => {
    if (beam?.contentUrl) window.open(beam.contentUrl, "_blank")
  }

  const handleReaction = (emoji: string) => {
    setLoadingEmoji(emoji)
    addReactionMutation.mutate({ beamId: id, emoji })
  }

  const handleAddComment = () => {
    if (comment.trim()) {
      addCommentMutation.mutate({ beamId: id, content: comment })
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <Sparkles className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your Beam...</p>
        </div>
      </div>
    )
  }

  if (!beam) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
          <Sparkles className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Beam not found</h1>
        <p className="mb-8 text-center text-muted-foreground max-w-md">
          This beam may have been deleted or doesn't exist.
        </p>
        <Button onClick={() => router.push("/beam")} className="gap-2">
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-2 md:p-6 md:m-2">
      {/* Header */}
      <Button variant="destructive" onClick={() => router.back()} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Sender Info */}
        <div className="flex items-start gap-4 mb-8">
          <Avatar className="h-14 w-14 ring-2 ring-primary/20">
            <AvatarImage src="/diverse-user-avatars.png" />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {beam.senderName?.charAt(0) || "B"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">{beam.senderName}</h1>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-medium text-foreground">{beam.recipientName}</span>
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(beam.createdAt), { addSuffix: true })}
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-medium">
            {beam.type}
          </Badge>
        </div>

        {/* Content Card */}
        <div className="mb-6">
          <BeamContentCard
            type={beam.type}
            contentUrl={beam.contentUrl}
            overlayText={beam.overlayText}
            message={beam.message}
            senderName={beam.senderName}
            recipientName={beam.recipientName}
          />
        </div>

        {/* Video Message */}
        {beam.type === "VIDEO" && beam.message && (
          <div className="mb-6 p-6 rounded-2xl bg-secondary/50 border border-border">
            <p className="text-foreground leading-relaxed italic">"{beam.message}"</p>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 py-6 mb-6 border-y border-border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-5 w-5" />
            <span className="font-semibold text-foreground">{beam.viewCount?.toLocaleString() || 0}</span>
            <span className="text-sm">views</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Heart className="h-5 w-5" />
            <span className="font-semibold text-foreground">{beam.reactions?.length || 0}</span>
            <span className="text-sm">reactions</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold text-foreground">{beam.comments?.length || 0}</span>
            <span className="text-sm">comments</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-10">
          <BeamActions
            onCopyLink={handleCopyLink}
            onShare={handleShare}
            onDownload={handleDownload}
            onShowQR={() => setShowQRModal(true)}
            onOpenAR={beam.arEnabled ? () => router.push(`/beam/ar/${beam.id}`) : undefined}
            hasContent={!!beam.contentUrl}
            arEnabled={beam.arEnabled}
            contentType={beam.type}
          />
        </div>

        <Separator className="mb-10" />

        {/* Reactions */}
        <div className="mb-10">
          <BeamReactions
            beamId={id}
            reactions={beam.reactions || []}
            loadingEmoji={loadingEmoji}
            setLoadingEmoji={setLoadingEmoji}
            onSuccess={() => refetch()}
          />
        </div>
        <Separator className="mb-10" />

        {/* Comments */}
        <BeamComments
          comments={beam.comments || []}
          comment={comment}
          onCommentChange={setComment}
          onSubmit={handleAddComment}
          isLoading={addCommentMutation.isPending}
        />
      </main>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={`Beam from ${beam.senderName}`}
      />
    </div>
  )
}

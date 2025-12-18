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

const emojis = ["❤️", "🎉", "👏", "😊", "🔥", "✨", "💯", "🎈"]

export default function BeamPage() {
  const router = useRouter()
  const id = router.query.id as string
  const { toast } = useToast()
  const [isFlipped, setIsFlipped] = useState(false)
  const [comment, setComment] = useState("")
  const [loadingEmoji, setLoadingEmoji] = useState<string | null>(null)

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
      toast({ title: "Comment added!", description: "Your comment has been posted." })
      setComment("")
      refetch()
    },
  })

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: "Copied", description: "Beam link copied to clipboard." })
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

  const handleAddComment = () => {
    if (comment.trim()) addCommentMutation.mutate({ beamId: id, content: comment })
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
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted/50">
          <Sparkles className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Beam not found</h1>
        <p className="mb-8 text-center text-muted-foreground max-w-md">
          This beam may have been deleted or doesn't exist. Check the link and try again.
        </p>
        <Button onClick={() => router.push("/beam")} variant="outline" className="gap-2">
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <div className="py-8 bg-background min-h-screen">
      <div className="mx-auto max-w-4xl">
        {/* Back Button */}
        <div className="mb-4">
          <Button variant="destructive" onClick={() => router.back()} className="gap-2 p-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Main Content Card */}
        <Card className="border-x-0 border-t-0 rounded-none shadow-none md:border-x md:border-t md:rounded-xl md:my-6 md:shadow-sm overflow-hidden">
          {/* User Header */}
          <div className="flex items-start gap-3 p-4 border-b border-border">
            <Avatar className="h-11 w-11 ring-2 ring-background">
              <AvatarImage src="/diverse-user-avatars.png" />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {beam.senderName?.charAt(0) || "B"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="font-semibold text-foreground truncate">{beam.senderName}</h2>
                {beam.isPublic && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Sent to <span className="font-medium text-foreground">{beam.recipientName}</span>
              </p>
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(beam.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <Badge variant="outline" className="text-xs font-medium">
                {beam.type}
              </Badge>
              {beam.arEnabled && (
                <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AR
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="w-full rounded-none border-b border-border bg-card/50 backdrop-blur-sm p-0 h-auto justify-start">
              <TabsTrigger
                value="content"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3.5 font-medium gap-2"
              >
                <Eye className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3.5 font-medium gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden xs:inline">Comments</span>
                <span className="inline xs:hidden">({beam.comments.length})</span>
                <span className="hidden xs:inline">({beam.comments.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* CONTENT TAB */}
            <TabsContent value="content" className="mt-0 p-0 focus-visible:outline-none focus-visible:ring-0">
              {/* Media Display */}
              {beam.type === "VIDEO" ? (
                <div className="relative aspect-video overflow-hidden bg-black">
                  <video
                    src={beam.contentUrl || ""}
                    controls
                    className="h-full w-full"
                    poster="/video-thumbnail.png"
                  />
                </div>
              ) : (
                <div
                  className="relative cursor-pointer bg-card group"
                  style={{ perspective: "1400px" }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div
                    className="relative w-full transition-transform duration-700 ease-out"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Front Side - Image */}
                    <div
                      className="relative aspect-[16/10] w-full overflow-hidden"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <img
                        src={beam.contentUrl || "/placeholder.svg?height=800&width=1200&query=beam content image"}
                        alt="Beam content"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {beam.overlayText && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                          <p className="px-8 text-center text-2xl font-bold text-white md:text-4xl drop-shadow-2xl leading-tight text-balance">
                            {beam.overlayText}
                          </p>
                        </div>
                      )}
                      {/* Flip Indicator */}
                      <div className="absolute bottom-4 right-4 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RotateCcw className="h-3 w-3" />
                        Tap to flip
                      </div>
                    </div>

                    {/* Back Side - Message */}
                    <div
                      className="absolute inset-0 flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-card via-card to-muted/30 p-8 md:p-16"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <div className="text-center max-w-2xl">
                        <Sparkles className="h-8 w-8 text-primary/60 mx-auto mb-6" />
                        <p className="mb-8 text-lg leading-relaxed text-foreground md:text-2xl font-light text-balance">
                          "{beam.message || "No message included"}"
                        </p>
                        <Separator className="mx-auto my-8 w-20 bg-primary/20" />
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>
                            <span className="text-foreground/60">From:</span>{" "}
                            <span className="font-semibold text-foreground">{beam.senderName}</span>
                          </p>
                          <p>
                            <span className="text-foreground/60">To:</span>{" "}
                            <span className="font-semibold text-foreground">{beam.recipientName}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Message Display */}
              {beam.type === "VIDEO" && beam.message && (
                <div className="p-4 border-b border-border bg-muted/30">
                  <p className="text-foreground leading-relaxed">{beam.message}</p>
                </div>
              )}

              {/* Engagement Stats */}
              <div className="flex items-center gap-6 px-4 py-3 border-b border-border text-sm">
                <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">{beam.viewCount}</span>
                </button>
                <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Heart className="h-4 w-4" />
                  <span className="font-medium">{beam.reactions.length}</span>
                </button>
                <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-medium">{beam.comments.length}</span>
                </button>
              </div>

              {/* Actions Section */}
              <div className="p-4 space-y-4 bg-card">
                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-2">
                  {beam.type !== "VIDEO" && (
                    <Button
                      variant="default"
                      className="col-span-2 gap-2 bg-primary hover:bg-primary/90"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsFlipped(!isFlipped)
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {isFlipped ? "View Image" : "Reveal Message"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleCopyLink} className="gap-2 bg-transparent">
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  <Button variant="outline" onClick={handleShare} className="gap-2 bg-transparent">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  {beam.contentUrl && (
                    <Button variant="outline" onClick={handleDownload} className="gap-2 col-span-2 bg-transparent">
                      <Download className="h-4 w-4" />
                      Download {beam.type === "VIDEO" ? "Video" : "Image"}
                    </Button>
                  )}
                  {beam.arEnabled && (
                    <Button onClick={handleDownload} className="gap-2 col-span-2 ">
                      <Link className="h-4 w-4" />
                      Open In Augmented Reality
                    </Button>
                  )}
                </div>

                <Separator className="my-6" />

                {/* Reactions Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    React to this Beam
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {emojis.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setLoadingEmoji(emoji)
                          addReactionMutation.mutate({ beamId: id, emoji })
                        }}
                        className="text-2xl h-14 w-14 p-0 transition-all rounded-xl"
                        disabled={loadingEmoji === emoji}
                      >
                        {loadingEmoji === emoji ? <Loader2 className="h-6 w-6 animate-spin" /> : emoji}
                      </Button>
                    ))}
                  </div>

                  {/* Recent Reactions Display */}
                  {beam.reactions.length > 0 && (
                    <div className="space-y-3 pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Recent Reactions</h4>
                      <div className="flex flex-wrap gap-2">
                        {beam.reactions.slice(0, 12).map((reaction) => (
                          <div
                            key={reaction.id}
                            className="flex items-center gap-2 rounded-full bg-muted/70 backdrop-blur-sm px-3 py-1.5 text-sm border border-border/50"
                          >
                            <span className="text-lg leading-none">{reaction.emoji}</span>
                            <span className="text-xs text-muted-foreground font-medium">{reaction.user.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* COMMENTS TAB */}
            <TabsContent value="comments" className="mt-0 p-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="p-4 space-y-6 min-h-[400px]">
                {/* Add Comment Form */}
                <div className="space-y-3 pb-6 border-b border-border">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Leave a Comment
                  </h3>
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background">
                      <AvatarImage src="/current-user.jpg" />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">You</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share your thoughts..."
                        rows={3}
                        className="resize-none bg-muted/30 border-border focus-visible:ring-primary"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={!comment.trim() || addCommentMutation.isLoading}
                        className="gap-2 w-full sm:w-auto"
                      >
                        <Send className="h-4 w-4" />
                        {addCommentMutation.isLoading ? "Posting..." : "Post Comment"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Comments List */}
                {beam.comments.length > 0 ? (
                  <div className="space-y-6">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {beam.comments.length} {beam.comments.length === 1 ? "Comment" : "Comments"}
                    </h4>
                    {beam.comments.map((commentItem) => (
                      <div key={commentItem.id} className="flex gap-3 group">
                        <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background">
                          <AvatarImage src="/diverse-user-avatars.png" />
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                            {commentItem.user.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="rounded-2xl bg-muted/50 border border-border/50 p-4 group-hover:bg-muted/70 transition-colors">
                            <p className="font-semibold text-sm mb-2 text-foreground">{commentItem.user.name}</p>
                            <p className="text-sm leading-relaxed text-foreground/90">{commentItem.content}</p>
                          </div>
                          <div className="flex items-center gap-4 px-3">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(commentItem.createdAt), { addSuffix: true })}
                            </span>
                            <button className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                              Like
                            </button>
                            <button className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mx-auto">
                      <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground font-medium mb-2">No comments yet</p>
                    <p className="text-sm text-muted-foreground/70">Be the first to share your thoughts!</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

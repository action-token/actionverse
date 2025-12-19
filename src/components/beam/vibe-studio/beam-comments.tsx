"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Comment {
  id: string
  content: string
  createdAt: Date
  user: { name: string }
}

interface BeamCommentsProps {
  comments: Comment[]
  comment: string
  onCommentChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
}

export function BeamComments({ comments, comment, onCommentChange, onSubmit, isLoading }: BeamCommentsProps) {
  return (
    <div className="space-y-8">
      {/* Add Comment Form */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Leave a Comment</h3>
        <div className="flex gap-4">
          <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-primary/20">
            <AvatarImage src="/diverse-user-avatars.png" />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">You</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Share your thoughts..."
              rows={3}
              className="resize-none bg-secondary/50 border-border/50 focus-visible:ring-primary rounded-xl"
            />
            <Button onClick={onSubmit} disabled={!comment.trim() || isLoading} className="gap-2">
              <Send className="h-4 w-4" />
              {isLoading ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {comments.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </h3>
          <div className="space-y-4">
            {comments.map((commentItem) => (
              <div
                key={commentItem.id}
                className="flex gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src="/commenter-avatar.jpg" />
                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                    {commentItem.user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{commentItem.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(commentItem.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{commentItem.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
        </div>
      )}
    </div>
  )
}

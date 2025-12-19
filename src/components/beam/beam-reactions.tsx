"use client"

import { Button } from "~/components/shadcn/ui/button"
import { Loader2 } from "lucide-react"
import { api } from "~/utils/api"
import toast from "react-hot-toast"
import { useSession } from "next-auth/react"

const emojis = ["❤️", "🎉", "👏", "😊", "🔥", "✨", "💯", "🎈"]

interface Reaction {
  id: string
  emoji: string
  user: { name: string }
}

interface BeamReactionsProps {
  beamId: string
  reactions: Reaction[]
  loadingEmoji: string | null
  setLoadingEmoji: (emoji: string | null) => void
  onSuccess: () => void
}

export function BeamReactions({ beamId, reactions, loadingEmoji, setLoadingEmoji, onSuccess }: BeamReactionsProps) {
  const session = useSession()
  const addReactionMutation = api.beam.addReaction.useMutation({
    onSuccess: () => {
      toast.success("Reaction added!")
      onSuccess()
    },
    onSettled: () => setLoadingEmoji(null),
  })

  const handleReact = (emoji: string) => {
    setLoadingEmoji(emoji)
    addReactionMutation.mutate({ beamId, emoji })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Add Reaction</h3>
        <div className="flex flex-wrap gap-2">
          {emojis.map((emoji) => (
            <Button
              key={emoji}
              variant="outline"
              size="lg"
              onClick={() => handleReact(emoji)}
              className="text-2xl h-14 w-14 p-0 rounded-xl hover:scale-110 hover:bg-primary/10 transition-all duration-200"
              disabled={loadingEmoji === emoji || session.status === "unauthenticated"}
            >
              {loadingEmoji === emoji ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : emoji}
            </Button>
          ))}
        </div>
      </div>

      {reactions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
            Reactions ({reactions.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {reactions.slice(0, 12).map((reaction) => (
              <div
                key={reaction.id}
                className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm ring-1 ring-border/50"
              >
                <span className="text-lg leading-none">{reaction.emoji}</span>
                <span className="text-xs text-muted-foreground font-medium">{reaction.user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

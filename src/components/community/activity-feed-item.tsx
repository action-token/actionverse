"use client"

import { formatDistanceToNow } from "date-fns"
import { CommunityActivityType } from "@prisma/client"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn/ui/avatar"
import {
  UserPlus,
  UserMinus,
  FileText,
  Heart,
  MessageCircle,
  Send,
} from "lucide-react"

interface ActivityFeedItemProps {
  activity: {
    id: number
    type: CommunityActivityType
    createdAt: Date
    actor: {
      id: string
      name: string | null
      image: string | null
    }
    community: {
      id: number
      title: string
    }
  }
}

const activityConfig: Record<
  CommunityActivityType,
  { icon: typeof UserPlus; verb: string; color: string }
> = {
  JOIN: { icon: UserPlus, verb: "joined", color: "text-green-500" },
  LEAVE: { icon: UserMinus, verb: "left", color: "text-red-500" },
  POST_CREATED: { icon: FileText, verb: "posted in", color: "text-blue-500" },
  POST_LIKED: { icon: Heart, verb: "liked a post in", color: "text-pink-500" },
  COMMENT_CREATED: {
    icon: MessageCircle,
    verb: "commented in",
    color: "text-purple-500",
  },
  MEMBER_INVITED: {
    icon: Send,
    verb: "invited someone to",
    color: "text-orange-500",
  },
}

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
  const config = activityConfig[activity.type]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 text-sm">
        <span className="font-medium">
          {activity.actor.name ?? "Someone"}
        </span>{" "}
        <span className="text-muted-foreground">{config.verb}</span>{" "}
        <Link
          href={`/community/${activity.community.id}`}
          className="font-medium hover:underline"
        >
          {activity.community.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(activity.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
      <Avatar className="h-6 w-6">
        <AvatarImage src={activity.actor.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {activity.actor.name?.charAt(0) ?? "?"}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

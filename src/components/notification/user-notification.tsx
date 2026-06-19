"use client"

import { NotificationType } from "@prisma/client"
import Image from "next/image"
import Link from "next/link"
import { Separator } from "~/components/shadcn/ui/separator"
import { api } from "~/utils/api"
import { formatPostCreatedAt } from "~/utils/format-date"
import { motion, AnimatePresence } from "framer-motion"
import {
    Bell, ChevronDown, Loader2, CheckCheck,
    Heart, MessageSquare, UserPlus, FileText, Trophy, MessagesSquare,
    Users, Send, SmilePlus
} from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"

type NotificationItem = {
    id: number
    seen: Date | null
    createdAt: Date
    isCreator: boolean
    notificationObject: {
        entityType: NotificationType
        entityId: number
        createdAt: Date
        actor: { id: string; name: string | null; image: string | null }
    }
}

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case NotificationType.LIKE:
            return <Heart className="h-3.5 w-3.5 text-pink-500" />
        case NotificationType.COMMENT:
        case NotificationType.REPLY:
            return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
        case NotificationType.FOLLOW:
            return <UserPlus className="h-3.5 w-3.5 text-purple-500" />
        case NotificationType.POST:
            return <FileText className="h-3.5 w-3.5 text-emerald-500" />
        case NotificationType.BOUNTY:
        case NotificationType.BOUNTY_PARTICIPANT:
        case NotificationType.BOUNTY_SUBMISSION:
        case NotificationType.BOUNTY_WINNER:
            return <Trophy className="h-3.5 w-3.5 text-amber-500" />
        case NotificationType.COMMUNITY_POST:
            return <FileText className="h-3.5 w-3.5 text-violet-500" />
        case NotificationType.COMMUNITY_COMMENT:
        case NotificationType.COMMUNITY_REPLY:
            return <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
        case NotificationType.COMMUNITY_MEMBER_JOIN:
            return <Users className="h-3.5 w-3.5 text-teal-500" />
        case NotificationType.COMMUNITY_INVITE:
            return <Send className="h-3.5 w-3.5 text-indigo-500" />
        case NotificationType.COMMUNITY_REACTION:
            return <SmilePlus className="h-3.5 w-3.5 text-pink-500" />
        default:
            return <Bell className="h-3.5 w-3.5 text-gray-400" />
    }
}

const getNotificationIconBg = (type: NotificationType) => {
    switch (type) {
        case NotificationType.LIKE:
            return "bg-pink-100"
        case NotificationType.COMMENT:
        case NotificationType.REPLY:
            return "bg-blue-100"
        case NotificationType.FOLLOW:
            return "bg-purple-100"
        case NotificationType.POST:
            return "bg-emerald-100"
        case NotificationType.BOUNTY:
        case NotificationType.BOUNTY_PARTICIPANT:
        case NotificationType.BOUNTY_SUBMISSION:
        case NotificationType.BOUNTY_WINNER:
            return "bg-amber-100"
        case NotificationType.COMMUNITY_POST:
        case NotificationType.COMMUNITY_COMMENT:
        case NotificationType.COMMUNITY_REPLY:
            return "bg-violet-100"
        case NotificationType.COMMUNITY_MEMBER_JOIN:
            return "bg-teal-100"
        case NotificationType.COMMUNITY_INVITE:
            return "bg-indigo-100"
        case NotificationType.COMMUNITY_REACTION:
            return "bg-pink-100"
        default:
            return "bg-gray-100"
    }
}

const getNotificationMessage = (n: NotificationItem) => {
    const actorName = n.notificationObject.actor.name ?? "Someone"
    switch (n.notificationObject.entityType) {
        case NotificationType.LIKE:
            return `${actorName} liked a post`
        case NotificationType.COMMENT:
            return `${actorName} commented on a post`
        case NotificationType.FOLLOW:
            return `${actorName} followed you`
        case NotificationType.MEMBER:
            return `${actorName} became a member`
        case NotificationType.REPLY:
            return `${actorName} replied to a comment`
        case NotificationType.POST:
            return `${actorName} created a new post`
        case NotificationType.BOUNTY:
            return `A new bounty has been created`
        case NotificationType.BOUNTY_PARTICIPANT:
            return `${actorName} joined a bounty`
        case NotificationType.BOUNTY_SUBMISSION:
            return `${actorName} submitted to a bounty`
        case NotificationType.BOUNTY_WINNER:
            return "You won a bounty! Claim your reward."
        case NotificationType.COMMUNITY_POST:
            return `${actorName} posted in a community`
        case NotificationType.COMMUNITY_COMMENT:
            return `${actorName} commented on a community post`
        case NotificationType.COMMUNITY_REPLY:
            return `${actorName} replied to your comment`
        case NotificationType.COMMUNITY_MEMBER_JOIN:
            return `${actorName} joined your community`
        case NotificationType.COMMUNITY_INVITE:
            return `${actorName} invited you to a community`
        case NotificationType.COMMUNITY_REACTION:
            return `${actorName} liked your community post`
        default:
            return "You have a new notification"
    }
}

const getNotificationUrl = (n: NotificationItem) => {
    switch (n.notificationObject.entityType) {
        case NotificationType.LIKE:
        case NotificationType.COMMENT:
        case NotificationType.REPLY:
        case NotificationType.POST:
            return `/fans/posts/${n.notificationObject.entityId}`
        case NotificationType.FOLLOW:
            return `/fans/creator/${n.notificationObject.actor.id}`
        case NotificationType.BOUNTY:
        case NotificationType.BOUNTY_PARTICIPANT:
        case NotificationType.BOUNTY_SUBMISSION:
        case NotificationType.BOUNTY_WINNER:
            return `/bounty/${n.notificationObject.entityId}`
        case NotificationType.COMMUNITY_POST:
        case NotificationType.COMMUNITY_COMMENT:
        case NotificationType.COMMUNITY_REPLY:
        case NotificationType.COMMUNITY_MEMBER_JOIN:
        case NotificationType.COMMUNITY_INVITE:
        case NotificationType.COMMUNITY_REACTION:
            return `/community/${n.notificationObject.entityId}`
        default:
            return ""
    }
}

function groupByDate(notifications: NotificationItem[]) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups: { label: string; items: NotificationItem[] }[] = []
    const map = new Map<string, NotificationItem[]>()

    for (const n of notifications) {
        const d = new Date(n.createdAt)
        d.setHours(0, 0, 0, 0)

        let label: string
        if (d.getTime() === today.getTime()) label = "Today"
        else if (d.getTime() === yesterday.getTime()) label = "Yesterday"
        else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

        if (!map.has(label)) {
            const items: NotificationItem[] = []
            map.set(label, items)
            groups.push({ label, items })
        }
        map.get(label)!.push(n)
    }

    return groups
}

export default function UserNotification() {
    const utils = api.useUtils()

    const notifications = api.fan.notification.getUserNotification.useInfiniteQuery(
        { limit: 15 },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
            refetchInterval: 30000,
        },
    )

    const markAllSeen = api.fan.notification.markAllAsSeen.useMutation({
        onSuccess: () => {
            void utils.fan.notification.getUserNotification.invalidate()
            void utils.fan.notification.getUnseenNotificationCount.invalidate()
        },
    })

    const markSeen = api.fan.notification.markAsSeen.useMutation({
        onSuccess: () => {
            void utils.fan.notification.getUserNotification.invalidate()
            void utils.fan.notification.getUnseenNotificationCount.invalidate()
        },
    })

    const allNotifications = (notifications.data?.pages.flatMap((page) => page.notifications) ?? []) as NotificationItem[]
    const unseenCount = allNotifications.filter((n) => !n.seen).length
    const groups = groupByDate(allNotifications)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-xl shadow-md lg:w-[715px] overflow-hidden"
        >
            <div className="p-6">
                {/* Header */}
                <motion.div
                    className="mb-6 flex items-center justify-between"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3">
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100"
                        >
                            <Bell className="h-5 w-5 text-indigo-600" />
                        </motion.div>
                        <div>
                            <h1 className="text-2xl font-bold">Notifications</h1>
                            <p className="text-sm text-muted-foreground">Your activity updates</p>
                        </div>
                        {unseenCount > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                            >
                                <Badge variant="destructive" className="ml-2">
                                    {unseenCount} new
                                </Badge>
                            </motion.div>
                        )}
                    </div>

                    {unseenCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => markAllSeen.mutate({ isCreator: false })}
                            disabled={markAllSeen.isLoading}
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all as read
                        </Button>
                    )}
                </motion.div>

                {/* Content */}
                {notifications.isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-start gap-4 p-2">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[250px]" />
                                    <Skeleton className="h-3 w-[100px]" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : allNotifications.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-medium">No notifications yet</h3>
                        <p className="text-muted-foreground mt-2">When you get notifications, they{"'ll"} show up here</p>
                    </motion.div>
                ) : (
                    <div className="max-h-[70vh] min-h-[70vh] overflow-y-auto rounded-lg border border-border scrollbar-hide overflow-x-hidden">
                        <AnimatePresence>
                            {groups.map((group) => (
                                <motion.div
                                    key={group.label}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {group.label}
                                    </div>

                                    {group.items.map((notification, index) => {
                                        const unseen = !notification.seen
                                        const message = getNotificationMessage(notification)
                                        const url = getNotificationUrl(notification)
                                        const icon = getNotificationIcon(notification.notificationObject.entityType)
                                        const iconBg = getNotificationIconBg(notification.notificationObject.entityType)

                                        return (
                                            <motion.div
                                                key={notification.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ delay: index * 0.03, duration: 0.3 }}
                                            >
                                                <Link
                                                    href={url}
                                                    onClick={() => {
                                                        if (unseen) markSeen.mutate({ notificationId: notification.id })
                                                    }}
                                                >
                                                    <motion.div
                                                        className={`relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 ${unseen ? "bg-primary/5" : ""}`}
                                                        whileHover={{ x: 4 }}
                                                        transition={{ duration: 0.15 }}
                                                    >
                                                        {unseen && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
                                                        )}

                                                        <div className="relative shrink-0">
                                                            <Image
                                                                width={40}
                                                                height={40}
                                                                className="h-10 w-10 rounded-full object-cover border border-border"
                                                                src={notification.notificationObject.actor.image ?? "https://app.action-tokens.com/images/logo.png"}
                                                                alt={notification.notificationObject.actor.name ?? "User"}
                                                            />
                                                            <div className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ${iconBg}`}>
                                                                {icon}
                                                            </div>
                                                        </div>

                                                        <div className="flex w-full flex-col gap-0.5">
                                                            <span className={`text-sm leading-snug ${unseen ? "font-semibold" : "font-medium text-foreground/80"}`}>
                                                                {message}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatPostCreatedAt(notification.createdAt)}
                                                            </span>
                                                        </div>

                                                        {unseen && (
                                                            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                                        )}
                                                    </motion.div>
                                                </Link>
                                                {index < group.items.length - 1 && <Separator />}
                                            </motion.div>
                                        )
                                    })}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {notifications.hasNextPage && (
                            <motion.div
                                className="flex justify-center p-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <Button
                                    variant="outline"
                                    onClick={() => void notifications.fetchNextPage()}
                                    disabled={notifications.isFetchingNextPage}
                                    className="w-full"
                                >
                                    {notifications.isFetchingNextPage ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="mr-2 h-4 w-4" />
                                            Load More
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

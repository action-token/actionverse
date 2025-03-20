"use client"

import { NotificationType } from "@prisma/client"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Separator } from "~/components/shadcn/ui/separator"
import { api } from "~/utils/api"
import { formatPostCreatedAt } from "~/utils/format-date"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
type notificationObject = {
    id: number;
    createdAt: Date;
    entityType: NotificationType;
    entityId: number;
    actorId: string;
    isUser: boolean;
    actor: { name: string | null; image: string | null; id: string };
};
export default function UserNotification() {
    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-row items-start justify-center ">
                <Notifications />
            </div>
        </div>
    )
}

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case NotificationType.LIKE:
            return "❤️"
        case NotificationType.COMMENT:
        case NotificationType.REPLY:
            return "💬"
        case NotificationType.FOLLOW:
            return "👤"
        case NotificationType.POST:
            return "📝"
        case NotificationType.BOUNTY:
        case NotificationType.BOUNTY_WINNER:
            return "🏆"
        case NotificationType.BOUNTY_COMMENT:
        case NotificationType.BOUNTY_REPLY:
        case NotificationType.BOUNTY_DOUBT_REPLY:
            return "💭"
        default:
            return "🔔"
    }
}

const Notifications = () => {
    const [viewedNotifications, setViewedNotifications] = useState<Set<number>>(new Set())
    const [filter, setFilter] = useState<string>("all")

    const notifications = api.fan.notification.getUserNotification.useInfiniteQuery(
        {
            limit: 10,
        },
        {
            getNextPageParam: (lastPage) => lastPage.nextCursor,
            refetchInterval: 30000, // Refetch every 30 seconds
        },
    )

    // Mark notifications as viewed when they appear on screen
    useEffect(() => {
        if (notifications.data) {
            const newViewedSet = new Set(viewedNotifications)
            notifications.data.pages.forEach((page) => {
                page.notifications.forEach((notification) => {
                    newViewedSet.add(notification.id)
                })
            })
            setViewedNotifications(newViewedSet)
        }
    }, [notifications.data])

    // Get notification count for badge
    const newNotificationCount = () => {
        if (!notifications.data) return 0

        let count = 0
        notifications.data.pages.forEach((page) => {
            page.notifications.forEach((notification) => {
                if (!viewedNotifications.has(notification.id)) {
                    count++
                }
            })
        })
        return count
    }

    const getNotificationMessage = (notificationObject: notificationObject) => {

        const actorName = notificationObject.actor.name ?? "Someone"

        switch (notificationObject.entityType) {
            case NotificationType.LIKE:
                return `${actorName} liked a post`
            case NotificationType.COMMENT:
                return `${actorName} commented on a post`
            case NotificationType.FOLLOW:
                return `${actorName} followed you`
            case NotificationType.REPLY:
                return `${actorName} replied to a comment`
            case NotificationType.POST:
                return `${actorName} created a new post`
            case NotificationType.BOUNTY:
                return `${actorName} added a bounty`
            case NotificationType.BOUNTY_WINNER:
                return "You won a bounty"
            case NotificationType.BOUNTY_COMMENT:
                return `${actorName} commented on a bounty`
            case NotificationType.BOUNTY_REPLY:
                return `${actorName} replied to a comment on bounty`
            case NotificationType.BOUNTY_DOUBT_REPLY:
                return `${actorName} replied to your chat on bounty`
            default:
                return "You have a new notification"
        }
    }

    const getNotificationUrl = (notificationObject: notificationObject) => {


        switch (notificationObject.entityType) {
            case NotificationType.LIKE:
            case NotificationType.COMMENT:
            case NotificationType.REPLY:
            case NotificationType.POST:
                return `/fans/posts/${notificationObject.entityId}`
            case NotificationType.FOLLOW:
                return `/fans/creator/${notificationObject.actor.id}`
            case NotificationType.BOUNTY:
            case NotificationType.BOUNTY_WINNER:
            case NotificationType.BOUNTY_COMMENT:
            case NotificationType.BOUNTY_REPLY:
            case NotificationType.BOUNTY_DOUBT_REPLY:
                return `/bounty/${notificationObject.entityId}`
            default:
                return ""
        }
    }

    const allNotifications = notifications.data?.pages.flatMap((page) => page.notifications) ?? []

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-xl  shadow-md lg:w-[715px]  overflow-y-auto bg-primary "
        >
            <div className="p-6">
                <motion.div
                    className="mb-6 flex flex-row items-center justify-between"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3">
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
                            <Bell className="h-6 w-6 text-indigo-500" />
                        </motion.div>
                        <h1 className="text-2xl font-bold">Notifications</h1>
                        {newNotificationCount() > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                            >
                                <Badge variant="destructive" className="ml-2">
                                    {newNotificationCount()} new
                                </Badge>
                            </motion.div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className={filter === "all" ? "bg-indigo-50 text-indigo-700" : ""}
                            onClick={() => setFilter("all")}
                        >
                            All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={filter === "unread" ? "bg-indigo-50 text-indigo-700" : ""}
                            onClick={() => setFilter("unread")}
                        >
                            Unread
                        </Button>
                    </div>
                </motion.div>

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
                        className="flex flex-col items-center justify-center py-16 text-center "
                    >
                        <Bell className="h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-xl font-medium text-gray-700">No notifications yet</h3>
                        <p className="text-gray-500 mt-2">When you get notifications, they{"'ll"} show up here</p>
                    </motion.div>
                ) : (
                    <div className="max-h-[70vh] min-h-[70vh] overflow-y-auto rounded-lg border border-gray-100 scrollbar-hide overflow-x-hidden">
                        <AnimatePresence>
                            {allNotifications
                                .filter((notification) => {
                                    if (filter === "unread") {
                                        return !viewedNotifications.has(notification.id)
                                    }
                                    return true
                                })
                                .map((notification, index) => {
                                    const isNew = !viewedNotifications.has(notification.id)
                                    const message = getNotificationMessage({
                                        id: notification.id,
                                        createdAt: notification.notificationObject.createdAt,
                                        entityType: notification.notificationObject.entityType,
                                        entityId: notification.notificationObject.entityId,
                                        actorId: notification.notificationObject.actor.id,
                                        isUser: notification.isCreator ? true : false,
                                        actor: notification.notificationObject.actor,
                                    })
                                    const url = getNotificationUrl({
                                        id: notification.id,
                                        createdAt: notification.notificationObject.createdAt,
                                        entityType: notification.notificationObject.entityType,
                                        entityId: notification.notificationObject.entityId,
                                        actorId: notification.notificationObject.actor.id,
                                        isUser: notification.isCreator ? true : false,
                                        actor: notification.notificationObject.actor,
                                    })
                                    const icon = getNotificationIcon(notification.notificationObject.entityType)

                                    return (
                                        <motion.div
                                            key={notification.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ delay: index * 0.05, duration: 0.3 }}
                                        >
                                            <Link href={url}>
                                                <motion.div
                                                    className={`relative flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${isNew ? "bg-indigo-50/50" : ""}`}
                                                    whileHover={{ x: 5 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    {isNew && (
                                                        <motion.div
                                                            className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"
                                                            layoutId="newIndicator"
                                                        />
                                                    )}

                                                    <div className="relative">
                                                        <Image
                                                            width={40}
                                                            height={40}
                                                            className="h-10 w-10 rounded-full object-cover border border-gray-200"
                                                            src={
                                                                notification.notificationObject.actor.image ??
                                                                "/images/icons/avatar-icon.png" ??
                                                                "/placeholder.svg"
                                                            }
                                                            alt={notification.notificationObject.actor.name ?? "User"}
                                                        />
                                                        <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs">
                                                            {icon}
                                                        </div>
                                                    </div>

                                                    <div className="flex w-full flex-col items-start">
                                                        <span className="font-medium text-gray-900">{message}</span>
                                                        <p className="text-sm text-gray-500">{formatPostCreatedAt(notification.createdAt)}</p>
                                                    </div>
                                                </motion.div>
                                            </Link>
                                            {index < allNotifications.length - 1 && <Separator />}
                                        </motion.div>
                                    )
                                })}
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


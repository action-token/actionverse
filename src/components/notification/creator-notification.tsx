"use client"

import { NotificationObject, NotificationType } from "@prisma/client"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Separator } from "~/components/shadcn/ui/separator"
import { api } from "~/utils/api"
import { formatPostCreatedAt } from "~/utils/format-date"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Loader2, Users, Award } from "lucide-react"
import { Button } from "~/components/shadcn/ui/button"
import { Badge } from "~/components/shadcn/ui/badge"
import { Skeleton } from "~/components/shadcn/ui/skeleton"
import { i } from "vitest/dist/reporters-w_64AS5f"

const CreatorNotifications = () => {
    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-row items-start justify-center">
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
        case NotificationType.BOUNTY_PARTICIPANT:
        case NotificationType.BOUNTY_SUBMISSION:
            return "🏆"
        case NotificationType.BOUNTY_COMMENT:
        case NotificationType.BOUNTY_REPLY:
        case NotificationType.BOUNTY_DOUBT_CREATE:
        case NotificationType.BOUNTY_DOUBT_REPLY:
            return "💭"
        default:
            return "🔔"
    }
}


const getNotificationColor = (type: NotificationType) => {
    switch (type) {
        case NotificationType.LIKE:
            return "bg-pink-100"
        case NotificationType.COMMENT:
        case NotificationType.REPLY:
            return "bg-blue-100"
        case NotificationType.FOLLOW:
            return "bg-purple-100"
        case NotificationType.BOUNTY_PARTICIPANT:
        case NotificationType.BOUNTY_SUBMISSION:
            return "bg-amber-100"
        case NotificationType.BOUNTY_COMMENT:
        case NotificationType.BOUNTY_REPLY:
        case NotificationType.BOUNTY_DOUBT_CREATE:
        case NotificationType.BOUNTY_DOUBT_REPLY:
            return "bg-green-100"
        default:
            return "bg-gray-100"
    }
}

const Notifications = () => {
    const [viewedNotifications, setViewedNotifications] = useState<Set<number>>(new Set())
    const [filter, setFilter] = useState<string>("all")

    const notifications = api.fan.notification.getCreatorNotifications.useInfiniteQuery(
        { limit: 10 },
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
                page.items.forEach((notification) => {
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
            page.items.forEach((notification) => {
                if (!viewedNotifications.has(notification.id)) {
                    count++
                }
            })
        })
        return count
    }

    type notificationObject = {
        id: number;
        createdAt: Date;
        entityType: NotificationType;
        entityId: number;
        actorId: string;
        isUser: boolean;
        actor: { name: string | null; image: string | null; id: string };
    };

    const getNotificationMessage = (notificationObject: notificationObject) => {
        const actorName = notificationObject.actor.name ?? "Someone"

        switch (notificationObject.entityType) {
            case NotificationType.LIKE:
                return `${actorName} liked your post`
            case NotificationType.COMMENT:
                return `${actorName} commented on your post`
            case NotificationType.FOLLOW:
                return `${actorName} followed you`
            case NotificationType.REPLY:
                return `${actorName} replied to your comment`
            case NotificationType.BOUNTY_PARTICIPANT:
                return `${actorName} joined your bounty`
            case NotificationType.BOUNTY_SUBMISSION:
                return `${actorName} submitted to your bounty`
            case NotificationType.BOUNTY_COMMENT:
                return `${actorName} commented on your bounty`
            case NotificationType.BOUNTY_REPLY:
                return `${actorName} replied to your comment on bounty`
            case NotificationType.BOUNTY_DOUBT_CREATE:
                return `${actorName} created a chat on your bounty`
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
                return `/fans/posts/${notificationObject.entityId}`
            case NotificationType.FOLLOW:
                return `/fans/creator/${notificationObject.actor.id}`
            case NotificationType.BOUNTY_PARTICIPANT:
            case NotificationType.BOUNTY_SUBMISSION:
            case NotificationType.BOUNTY_COMMENT:
            case NotificationType.BOUNTY_REPLY:
            case NotificationType.BOUNTY_DOUBT_CREATE:
            case NotificationType.BOUNTY_DOUBT_REPLY:
                return `/bounty/${notificationObject.entityId}`
            default:
                return ""
        }
    }

    const isNotificationEnabled = (notificationObject: notificationObject) => {


        switch (notificationObject.entityType) {
            case NotificationType.LIKE:
            case NotificationType.COMMENT:
            case NotificationType.REPLY:
            case NotificationType.BOUNTY_PARTICIPANT:
            case NotificationType.BOUNTY_SUBMISSION:
            case NotificationType.BOUNTY_COMMENT:
            case NotificationType.BOUNTY_REPLY:
            case NotificationType.BOUNTY_DOUBT_CREATE:
            case NotificationType.BOUNTY_DOUBT_REPLY:
                return true
            default:
                return false
        }
    }

    const allNotifications = notifications.data?.pages.flatMap((page) => page.items) ?? []

    // Group notifications by date
    const groupedNotifications = allNotifications.reduce(
        (groups, notification) => {
            const date = new Date(notification.createdAt).toLocaleDateString()
            if (!groups[date]) {
                groups[date] = []
            }
            groups[date].push(notification)
            return groups
        },
        {} as Record<string, typeof allNotifications>,
    )

    // Get today and yesterday dates
    const today = new Date().toLocaleDateString()
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

    // Format date for display
    const formatGroupDate = (dateString: string) => {
        if (dateString === today) return "Today"
        if (dateString === yesterday) return "Yesterday"
        return dateString
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-xl bg-primary shadow-md lg:w-[715px] overflow-hidden"
        >
            <div className="p-6">
                <motion.div
                    className="mb-6 flex flex-row items-center justify-between"
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
                            <Users className="h-5 w-5 text-indigo-600" />
                        </motion.div>
                        <div>
                            <h1 className="text-2xl font-bold">Creator Notifications</h1>
                            <p className="text-sm text-gray-500">Updates from your fans and followers</p>
                        </div>
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
                        className="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <Award className="h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-xl font-medium text-gray-700">No creator notifications yet</h3>
                        <p className="text-gray-500 mt-2">
                            When your fans interact with your content, you{"'ll"} see notifications here
                        </p>
                    </motion.div>
                ) : (
                    <div className="max-h-[70vh] min-h-[70vh] overflow-y-auto rounded-lg border border-gray-100 scrollbar-hide overflow-x-hidden">
                        <AnimatePresence>
                            {Object.entries(groupedNotifications)
                                .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                                .map(([date, dateNotifications]) => (
                                    <motion.div
                                        key={date}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="sticky top-0 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-500 z-10">
                                            {formatGroupDate(date)}
                                        </div>

                                        {dateNotifications
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
                                                    isUser: notification.isCreator ? false : true,
                                                    actor: notification.notificationObject.actor,
                                                })
                                                const url = getNotificationUrl({
                                                    id: notification.id,
                                                    createdAt: notification.notificationObject.createdAt,
                                                    entityType: notification.notificationObject.entityType,
                                                    entityId: notification.notificationObject.entityId,
                                                    actorId: notification.notificationObject.actor.id,
                                                    isUser: notification.isCreator ? false : true,
                                                    actor: notification.notificationObject.actor,
                                                })
                                                const icon = getNotificationIcon(notification.notificationObject.entityType)
                                                const iconBg = getNotificationColor(notification.notificationObject.entityType)
                                                const isEnabled = isNotificationEnabled({
                                                    id: notification.id,
                                                    createdAt: notification.notificationObject.createdAt,
                                                    entityType: notification.notificationObject.entityType,
                                                    entityId: notification.notificationObject.entityId,
                                                    actorId: notification.notificationObject.actor.id,
                                                    isUser: notification.isCreator ? false : true,
                                                    actor: notification.notificationObject.actor,
                                                })

                                                const NotificationContent = () => (
                                                    <motion.div
                                                        className={`relative flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${isNew ? "bg-indigo-50/50" : ""}`}
                                                        whileHover={{ x: 5 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        {isNew && (
                                                            <motion.div
                                                                className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"
                                                                layoutId={`newIndicator-${notification.id}`}
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
                                                                    "/images/action/logo.png"
                                                                }
                                                                alt={notification.notificationObject.actor.name ?? "User"}
                                                            />
                                                            <div
                                                                className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ${iconBg} text-xs`}
                                                            >
                                                                {icon}
                                                            </div>
                                                        </div>

                                                        <div className="flex w-full flex-col items-start">
                                                            <span className="font-medium text-gray-900">{message}</span>
                                                            <p className="text-sm text-gray-500">{formatPostCreatedAt(notification.createdAt)}</p>
                                                        </div>

                                                        {notification.notificationObject.entityType === NotificationType.BOUNTY_SUBMISSION && (
                                                            <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">
                                                                Review
                                                            </Badge>
                                                        )}
                                                    </motion.div>
                                                )

                                                return (
                                                    <motion.div
                                                        key={notification.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                                    >
                                                        {isEnabled ? (
                                                            <Link href={url}>
                                                                <NotificationContent />
                                                            </Link>
                                                        ) : (
                                                            <NotificationContent />
                                                        )}
                                                        {index < dateNotifications.length - 1 && <Separator />}
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

export default CreatorNotifications


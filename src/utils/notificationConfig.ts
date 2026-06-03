import { NotificationObject, NotificationType } from "@prisma/client";
import { truncateString } from "./string";


export function getNotificationMessage(
  notificationObject: NotificationObject,
): { message: string; url: string } {
  const actoId = truncateString(notificationObject.actorId);

  switch (notificationObject.entityType) {

    case NotificationType.LIKE:
      return {
        message: `${actoId} liked your post`,
        url: `/fans/posts/${notificationObject.entityId}`,
      };
    case NotificationType.COMMENT:
      return {
        message: `${actoId} commented on your post ${notificationObject.entityId}`,
        url: `/fans/posts/${notificationObject.entityId}`,
      };
    case NotificationType.FOLLOW:
      return {
        message: `${actoId} follow to you`,
        url: `/fans/creator/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_POST:
      return {
        message: `${actoId} posted in your community`,
        url: `/community/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_COMMENT:
      return {
        message: `${actoId} commented on a post in your community`,
        url: `/community/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_REPLY:
      return {
        message: `${actoId} replied to your comment`,
        url: `/community/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_MEMBER_JOIN:
      return {
        message: `${actoId} joined your community`,
        url: `/community/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_INVITE:
      return {
        message: `${actoId} invited you to a community`,
        url: `/community/${notificationObject.entityId}`,
      };
    case NotificationType.COMMUNITY_REACTION:
      return {
        message: `${actoId} liked your post in a community`,
        url: `/community/${notificationObject.entityId}`,
      };
    default:
      return {
        message: "",
        url: "",
      };
  }
}

// post created
// you have ended subscription.

// commented on post.
// liked your post.
// subscribed

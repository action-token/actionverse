import { createTRPCRouter } from "~/server/api/trpc";
import { communityRouter } from "./community";
import { communityMemberRouter } from "./member";
import { communityPostRouter } from "./post";
import { communityCommentRouter } from "./comment";
import { communityActivityRouter } from "./activity";

export const communityRouters = createTRPCRouter({
  community: communityRouter,
  member: communityMemberRouter,
  post: communityPostRouter,
  comment: communityCommentRouter,
  activity: communityActivityRouter,
});

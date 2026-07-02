import { createTRPCRouter } from "~/server/api/trpc";
import { creatorRouter } from "./creator";
import { userRouter } from "./users";
import { telegramRouter } from "./telegram";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const adminRouter = createTRPCRouter({
  creator: creatorRouter,
  user: userRouter,
  telegram: telegramRouter,
});

// export type definition of API

import { createTRPCRouter } from "~/server/api/trpc";
import { checkerRouter } from "./checker";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const actionTokenRouter = createTRPCRouter({
  checker: checkerRouter,
});

// export type definition of API

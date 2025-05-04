import { createTRPCRouter } from "~/server/api/trpc";
import { BountyRoute } from "./bounty";
import { ScavengerHuntRoute } from "./scavenger-hunt";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const BountyRouters = createTRPCRouter({
    Bounty: BountyRoute,
    ScavengerHunt: ScavengerHuntRoute,

});

// export type definition of API

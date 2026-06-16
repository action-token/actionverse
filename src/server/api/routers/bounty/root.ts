import { createTRPCRouter } from "~/server/api/trpc";
import { BountyRoute } from "./bounty";

export const BountyRouters = createTRPCRouter({
    Bounty: BountyRoute,
});

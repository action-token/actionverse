import { aC } from "vitest/dist/reporters-w_64AS5f";
import { z } from "zod";
import {
  getActionHolders,
  getActionMinimumBalanceFromHistory,
} from "~/lib/stellar/action-token";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { quarterRewardSyncTask } from "~/trigger/quarter-reward";

export const triggerRouter = createTRPCRouter({
  tirggerQuarterTask: publicProcedure.mutation(async () => {
    const res = await quarterRewardSyncTask.trigger();
    return res;
  }),

  test: publicProcedure.mutation(async () => {
    const actionHolder =
      "GAQSJVWTG4HVG6QGE6PKIEXBYA6Y4U2EP2ETTPTILXPSMTOZBTQBTAYY";
    // const res = await getActionMinimumBalanceFromHistory(actionHolder);
    return await getActionHolders();
    // return res;
  }),
});

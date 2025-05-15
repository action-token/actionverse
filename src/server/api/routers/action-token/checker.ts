import { format } from "date-fns";
import { z } from "zod";
import { getActionMinimumBalanceFromHistory } from "~/lib/stellar/action-token";
import { holderWithPlotsSchema } from "~/lib/stellar/action-token/script";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const checkerRouter = createTRPCRouter({
  getCreators: adminProcedure.query(async ({ ctx }) => {
    const creators = await ctx.db.creator.findMany({});
    return creators;
  }),

  getOriginReward: protectedProcedure.query(async ({ ctx }) => {
    const reward = await ctx.db.originReward.findUnique({
      where: {
        monthYear: getCurrentMonthYear(),
      },
    });

    const data = reward?.data;

    if (data && typeof data == "object") {
      return holderWithPlotsSchema.array().parse(data);
    }
  }),

  getAllOriginRewards: protectedProcedure.query(async ({ ctx }) => {
    const rewards = await ctx.db.originReward.findMany({
      orderBy: {
        lastUpdatedAt: "desc",
      },
    });
    return rewards;
  }),

  getAllQuarterRewards: protectedProcedure.query(async ({ ctx }) => {
    const rewards = await ctx.db.quarterReward.findMany({
      orderBy: {
        lastUpdatedAt: "desc",
      },
    });
    return rewards;
  }),

  addOriginRewardData: protectedProcedure
    .input(
      z.object({
        data: holderWithPlotsSchema.array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.originReward.upsert({
        where: {
          monthYear: getCurrentMonthYear(),
        },
        create: {
          monthYear: getCurrentMonthYear(),
          data: input.data,
        },
        update: {
          monthYear: getCurrentMonthYear(),
          data: input.data,
        },
      });
    }),

  test: publicProcedure.query(async ({ ctx }) => {
    const res = await getActionMinimumBalanceFromHistory(
      "GDZ4SHUHW2CKBIHID2X57V6YXCGJAPE7IOTZLQEFHSBE7EVULF6K5HAS",
    );
    return res;
  }),
});

function getCurrentMonthYear() {
  return format(new Date(), "yyyy-MM");
}

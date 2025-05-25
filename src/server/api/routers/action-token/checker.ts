import { format } from "date-fns"
import { z } from "zod"
import { getActionMinimumBalanceFromHistory } from "~/lib/stellar/action-token"
import { holderWithPlotsSchema } from "~/lib/stellar/action-token/script"
import { adminProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc"
import { TRPCError } from "@trpc/server"

// Input validation schemas
const monthYearSchema = z.object({
  monthYear: z.string(),
})

const setBalanceSchema = z.object({
  monthYear: z.string(),
  amount: z.number().positive(),
})

const blockUserSchema = z.object({
  walletAddress: z.string(),
  reason: z.string().optional(),
})

const unblockUserSchema = z.object({
  id: z.string(),
})

const originRewardDataSchema = z.object({
  data: holderWithPlotsSchema.array(),
})

export const checkerRouter = createTRPCRouter({
  // Existing endpoints
  getCreators: adminProcedure.query(async ({ ctx }) => {
    const creators = await ctx.db.creator.findMany({})
    return creators
  }),

  getOriginReward: protectedProcedure.query(async ({ ctx }) => {
    const reward = await ctx.db.originReward.findUnique({
      where: {
        monthYear: getCurrentMonthYear(),
      },
    })

    const data = reward?.data

    if (data && typeof data == "object") {
      return holderWithPlotsSchema.array().parse(data)
    }
  }),

  getAllOriginRewards: publicProcedure.query(async ({ ctx }) => {
    const rewards = await ctx.db.originReward.findMany({
      orderBy: {
        lastUpdatedAt: "desc",
      },
    })
    return rewards
  }),

  getAllQuarterRewards: publicProcedure.query(async ({ ctx }) => {
    const rewards = await ctx.db.quarterReward.findMany({
      orderBy: {
        lastUpdatedAt: "desc",
      },
    })
    return rewards
  }),

  addOriginRewardData: publicProcedure
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
          lastUpdatedAt: new Date(),
        },
      })
    }),

  test: publicProcedure.query(async ({ ctx }) => {
    const res = await getActionMinimumBalanceFromHistory("GDZ4SHUHW2CKBIHID2X57V6YXCGJAPE7IOTZLQEFHSBE7EVULF6K5HAS")
    return res
  }),

  // New endpoints for the updated UI
  getOriginRewardHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.originReward.findMany({
        orderBy: {
          monthYear: "desc",
        },
      })
    } catch (error) {
      console.error("Error fetching origin reward history:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch origin reward history",
      })
    }
  }),

  getOriginRewardByMonth: protectedProcedure.input(monthYearSchema).query(async ({ ctx, input }) => {
    try {
      const reward = await ctx.db.originReward.findUnique({
        where: {
          monthYear: input.monthYear,
        },
      })

      if (!reward) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No reward data found for ${input.monthYear}`,
        })
      }

      return reward
    } catch (error) {
      if (error instanceof TRPCError) throw error
      console.error("Error fetching origin reward by month:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch origin reward data",
      })
    }
  }),

  setOriginRewardBalance: adminProcedure.input(setBalanceSchema).mutation(async ({ ctx, input }) => {
    try {
      // Check if the reward exists for the month
      const existingReward = await ctx.db.originReward.findUnique({
        where: {
          monthYear: input.monthYear,
        },
      })

      if (existingReward) {
        // If already distributed, don't allow changes
        if (existingReward.isDistributed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot modify balance for already distributed rewards",
          })
        }

        // Update existing reward
        return await ctx.db.originReward.update({
          where: {
            monthYear: input.monthYear,
          },
          data: {
            totalBalance: input.amount,
            lastUpdatedAt: new Date(),
          },
        })
      } else {
        // Create new reward entry
        return await ctx.db.originReward.create({
          data: {
            monthYear: input.monthYear,
            totalBalance: input.amount,
            data: [],
            isDistributed: false,
          },
        })
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      console.error("Error setting origin reward balance:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to set reward balance",
      })
    }
  }),

  distributeOriginRewards: adminProcedure.input(monthYearSchema).mutation(async ({ ctx, input }) => {
    try {
      // Get the reward for the month
      const reward = await ctx.db.originReward.findUnique({
        where: {
          monthYear: input.monthYear,
        },
      })

      if (!reward) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No reward data found for ${input.monthYear}`,
        })
      }

      if (reward.isDistributed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Rewards already distributed for this month",
        })
      }

      // Check if previous month is distributed
      const previousMonth = getPreviousMonth(input.monthYear)
      const previousReward = await ctx.db.originReward.findUnique({
        where: {
          monthYear: previousMonth,
        },
      })

      if (previousReward && !previousReward.isDistributed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Previous month rewards must be distributed first",
        })
      }

      // Calculate total distributed amount
      let distributedAmount = 0

      if (reward.data) {
        try {
          // Parse the data using the schema to ensure type safety
          const parsedData = holderWithPlotsSchema.array().parse(reward.data)

          // Get blocked users
          const blockedUsers = await ctx.db.blockedUser.findMany({
            select: {
              walletAddress: true,
            },
          })

          const blockedAddresses = new Set(blockedUsers.map((user) => user.walletAddress))

          // Calculate total distributed amount excluding blocked users
          distributedAmount = parsedData.reduce((total, user) => {
            if (!blockedAddresses.has(user.pubkey)) {
              return total + user.plotBal * user.plots.length
            }
            return total
          }, 0)
        } catch (parseError) {
          console.error("Error parsing reward data:", parseError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to parse reward data",
          })
        }
      }

      // Mark as distributed
      return await ctx.db.originReward.update({
        where: {
          monthYear: input.monthYear,
        },
        data: {
          isDistributed: true,
          distributedAmount,
          rewardedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      })
    } catch (error) {
      if (error instanceof TRPCError) throw error
      console.error("Error distributing origin rewards:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to distribute rewards",
      })
    }
  }),

  // Blocked Users API endpoints
  getBlockedUsers: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.blockedUser.findMany({
        orderBy: {
          blockedAt: "desc",
        },
      })
    } catch (error) {
      console.error("Error fetching blocked users:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch blocked users",
      })
    }
  }),

  blockUser: adminProcedure.input(blockUserSchema).mutation(async ({ ctx, input }) => {
    try {
      // Check if user is already blocked
      const existingBlock = await ctx.db.blockedUser.findUnique({
        where: {
          walletAddress: input.walletAddress,
        },
      })

      if (existingBlock) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is already blocked",
        })
      }

      // Block the user
      return await ctx.db.blockedUser.create({
        data: {
          walletAddress: input.walletAddress,
          reason: input.reason,
        },
      })
    } catch (error) {
      if (error instanceof TRPCError) throw error
      console.error("Error blocking user:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to block user",
      })
    }
  }),

  unblockUser: adminProcedure.input(unblockUserSchema).mutation(async ({ ctx, input }) => {
    try {
      // Check if block exists
      const existingBlock = await ctx.db.blockedUser.findUnique({
        where: {
          id: input.id,
        },
      })

      if (!existingBlock) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Block not found",
        })
      }

      // Unblock the user
      return await ctx.db.blockedUser.delete({
        where: {
          id: input.id,
        },
      })
    } catch (error) {
      if (error instanceof TRPCError) throw error
      console.error("Error unblocking user:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to unblock user",
      })
    }
  }),
})

// Helper function to get the current month in YYYY-MM format
function getCurrentMonthYear() {
  return format(new Date(), "yyyy-MM")
}

// Helper function to get the previous month in YYYY-MM format
function getPreviousMonth(monthYear: string): string {
  const [year, month] = monthYear.split("-").map(Number)

  if (!year || !month || isNaN(year) || isNaN(month)) {
    throw new Error(`Invalid monthYear format: ${monthYear}`)
  }

  if (month === 1) {
    return `${year - 1}-12`
  } else {
    return `${year}-${String(month - 1).padStart(2, "0")}`
  }
}

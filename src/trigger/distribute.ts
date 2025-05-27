/* eslint-disable */

import { task } from "@trigger.dev/sdk/v3";
import { distribute } from "~/lib/stellar/action-token/quarter-reward-distribute";
import { holderWithPlotsSchema, holderWithQuaterAmountSchema } from "~/lib/stellar/action-token/script";
import { db } from "~/server/db";

const MAX_OPERATIONS_PER_TX = 100;

interface DistributionUser {
  pubkey: string;
  amount: string;
}

export const distributeWorkflow = task({
  id: "distribute-reward",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },

  run: async ({ id }: { id: string }) => {
    console.log(`Starting distribution workflow for reward ID: ${id}`);

    try {
      // Get the reward data
      const reward = await db.originReward.findUnique({
        where: { id },
      });

      if (!reward) {
        throw new Error(`Reward with ID ${id} not found`);
      }

      if (reward.isDistributed) {
        console.log(`Reward ${id} already distributed, skipping`);
        return { success: true, message: "Already distributed" };
      }

      if (!reward.data || !Array.isArray(reward.data)) {
        throw new Error(`No valid data found for reward ${id}`);
      }

      // Parse and validate the reward data
      const parsedData = holderWithPlotsSchema.array().parse(reward.data);

      // Get blocked users
      const blockedUsers = await db.originBlockedUser.findMany({
        select: { walletAddress: true },
      });
      const blockedAddresses = new Set(
        blockedUsers.map((u) => u.walletAddress),
      );
      // Calculate total rewards for all non-blocked users
      const distributionData = parsedData.reduce(
        (acc, user) => {
          if (!blockedAddresses.has(user.pubkey)) {
            const userTotalReward = user.plotBal * user.plots.length;
            acc.totalRewards += userTotalReward;
          }
          return acc;
        },
        { totalRewards: 0 },
      );
      console.log(
        `Total rewards to distribute for ${id}: ${distributionData.totalRewards}`,
      );
      // Filter out blocked users and prepare distribution data
      const eligibleUsers = parsedData
        .filter((user) => !blockedAddresses.has(user.pubkey))
        .map((user) => {
          const userTotalReward = user.plotBal * user.plots.length
          const distributedAmount =
            distributionData.totalRewards > 0 && reward.totalBalance > 0
              ? (userTotalReward / distributionData.totalRewards) * reward.totalBalance
              : 0
          return (
            {
              pubkey: user.pubkey,
              amount: distributedAmount, // Ensure amount is a string with 7 decimal places
            })
        });


      if (eligibleUsers.length === 0) {
        console.log(`No eligible users for distribution ${id}`);
        await markAsCompleted(id, []);
        return { success: true, message: "No eligible users" };
      }

      // Get already completed users (for resuming)
      const completedUsers: string[] = Array.isArray(reward.completedUsers)
        ? (reward.completedUsers as string[])
        : [];



      // Get remaining users to distribute
      const remainingUsers = eligibleUsers.filter(
        (user) => !completedUsers.includes(user.pubkey),
      );

      if (remainingUsers.length === 0) {
        console.log(`All users already distributed for reward ${id}`);
        await markAsCompleted(id, completedUsers);
        return { success: true, message: "All users already distributed" };
      }


      // Process remaining users in batches of 100
      let currentCompletedUsers = [...completedUsers];

      let errorCount = 0;
      let errors: any[] = [];
      while (currentCompletedUsers.length < eligibleUsers.length) {
        // Check if we have too many errors
        if (errorCount >= 3) {
          console.error(
            `Too many errors encountered (${errorCount}), stopping distribution.`,
          );
          // await updateProgress(id, currentCompletedUsers, {
          //   timestamp: new Date().toISOString(),
          //   error: "Too many errors encountered",
          //   type: "workflow_error",
          // });
          throw new Error("Too many errors encountered during distribution");
        }
        // Get next batch of remaining users
        const currentRemaining = eligibleUsers.filter(
          (user) => !currentCompletedUsers.includes(user.pubkey),
        );

        if (currentRemaining.length === 0) break;

        const batchSize = Math.min(
          MAX_OPERATIONS_PER_TX,
          currentRemaining.length,
        );
        const currentBatch = currentRemaining.slice(0, batchSize);

        console.log(
          `Processing batch of ${currentBatch.length} users (${currentCompletedUsers.length + currentBatch.length}/${eligibleUsers.length})`,
        );

        try {
          // Generate transaction XDR for this batch
          const res = await distribute({ data: currentBatch });
          if (res.successful) {
            console.log(
              `this batch is successfull: ${currentBatch.length} `,
              currentBatch,
            );
            // Add successfully distributed users to completed list
            currentCompletedUsers.push(...currentBatch.map((u) => u.pubkey));

            // Update database with current progress and clear any previous errors
            await updateProgress(id, currentCompletedUsers, null);

            console.log(
              `Batch completed successfully. Progress: ${currentCompletedUsers.length}/${eligibleUsers.length}`,
            );
          } else {
            console.log("Batch failed:", res);

            // Store batch failure error to database
            const errorInfo = {
              timestamp: new Date().toISOString(),
              batchSize: currentBatch.length,
              batchUsers: currentBatch.map((u) => u.pubkey),
              error: "Transection was failed",
              type: "batch_failure",
            };

            await updateProgress(id, currentCompletedUsers, errorInfo);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing batch:`, error);

          // Store detailed error information to database
          const errorInfo = {
            timestamp: new Date().toISOString(),
            batchSize: currentBatch.length,
            batchUsers: currentBatch.map((u) => u.pubkey),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            type: "batch_exception",
          };

          // Save current progress and error before throwing
          errors.push(errorInfo);
          errorCount++;
        }
      }

      await markAsCompleted(id, currentCompletedUsers);
      await updateProgress(id, currentCompletedUsers, errors);
      console.log(
        `Distribution completed successfully. Total distributed: ${currentCompletedUsers.length}/${eligibleUsers.length}`,
      );

      return {
        success: true,
        totalEligibleUsers: eligibleUsers.length,
        distributedUsers: currentCompletedUsers.length,
      };
    } catch (error) {
      console.error(`Distribution workflow failed for reward ${id}:`, error);
      throw error;
    }
  },
});
export const distributeQuarterRewardWorkflow = task({
  id: "distribute-quarter-reward",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },

  run: async ({ id }: { id: string }) => {
    console.log(`Starting Quarter reward distribution workflow for reward ID: ${id}`);

    try {
      // Get the reward data
      const reward = await db.quarterReward.findUnique({
        where: { id },
      });

      if (!reward) {
        throw new Error(`Quarter Reward with ID ${id} not found`);
      }

      if (reward.isDistributed) {
        console.log(`Reward ${id} already distributed, skipping`);
        return { success: true, message: "Already distributed" };
      }

      if (!reward.data || !Array.isArray(reward.data)) {
        throw new Error(`No valid data found for reward ${id}`);
      }

      // Parse and validate the reward data
      const parsedData = holderWithQuaterAmountSchema.array().parse(reward.data);
      console.log("parsedData", parsedData);
      // Get blocked users
      const blockedUsers = await db.quarterBlockedUser.findMany({
        select: { walletAddress: true },
      });

      const blockedAddresses = new Set(
        blockedUsers.map((u) => u.walletAddress),
      );


      // Filter out blocked users and prepare distribution data
      const eligibleUsers = parsedData
        .filter((user) => !blockedAddresses.has(user.accountId))
        .map((user) => {

          return (
            {
              pubkey: user.accountId,
              amount: Number(user.action) / 1000,
            })
        });

      console.log("eligibleUsers", eligibleUsers);
      if (eligibleUsers.length === 0) {
        console.log(`No eligible users for distribution ${id}`);
        await markAsCompleted(id, [], true);
        return { success: true, message: "No eligible users" };
      }

      // Get already completed users (for resuming)
      const completedUsers: string[] = Array.isArray(reward.completedUsers)
        ? (reward.completedUsers as string[])
        : [];



      // Get remaining users to distribute
      const remainingUsers = eligibleUsers.filter(
        (user) => !completedUsers.includes(user.pubkey),
      );

      if (remainingUsers.length === 0) {
        console.log(`All users already distributed for reward ${id}`);
        await markAsCompleted(id, completedUsers, true);
        return { success: true, message: "All users already distributed" };
      }


      // Process remaining users in batches of 100
      let currentCompletedUsers = [...completedUsers];

      let errorCount = 0;
      let errors: any[] = [];
      while (currentCompletedUsers.length < eligibleUsers.length) {
        // Check if we have too many errors
        if (errorCount >= 3) {
          console.error(
            `Too many errors encountered (${errorCount}), stopping distribution.`,
          );
          // await updateProgress(id, currentCompletedUsers, {
          //   timestamp: new Date().toISOString(),
          //   error: "Too many errors encountered",
          //   type: "workflow_error",
          // });
          throw new Error("Too many errors encountered during distribution");
        }
        // Get next batch of remaining users
        const currentRemaining = eligibleUsers.filter(
          (user) => !currentCompletedUsers.includes(user.pubkey),
        );

        if (currentRemaining.length === 0) break;

        const batchSize = Math.min(
          MAX_OPERATIONS_PER_TX,
          currentRemaining.length,
        );
        const currentBatch = currentRemaining.slice(0, batchSize);

        console.log(
          `Processing batch of ${currentBatch.length} users (${currentCompletedUsers.length + currentBatch.length}/${eligibleUsers.length})`,
        );

        try {
          // Generate transaction XDR for this batch
          const res = await distribute({ data: currentBatch });
          if (res.successful) {
            console.log(
              `this batch is successfull: ${currentBatch.length} `,
              currentBatch,
            );
            // Add successfully distributed users to completed list
            currentCompletedUsers.push(...currentBatch.map((u) => u.pubkey));

            // Update database with current progress and clear any previous errors
            await updateProgress(id, currentCompletedUsers, null, true);

            console.log(
              `Batch completed successfully. Progress: ${currentCompletedUsers.length}/${eligibleUsers.length}`,
            );
          } else {
            console.log("Batch failed:", res);

            // Store batch failure error to database
            const errorInfo = {
              timestamp: new Date().toISOString(),
              batchSize: currentBatch.length,
              batchUsers: currentBatch.map((u) => u.pubkey),
              error: "Transection was failed",
              type: "batch_failure",
            };

            await updateProgress(id, currentCompletedUsers, errorInfo, true);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing batch:`, error);

          // Store detailed error information to database
          const errorInfo = {
            timestamp: new Date().toISOString(),
            batchSize: currentBatch.length,
            batchUsers: currentBatch.map((u) => u.pubkey),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            type: "batch_exception",
          };

          // Save current progress and error before throwing
          errors.push(errorInfo);
          errorCount++;
        }
      }

      await markAsCompleted(id, currentCompletedUsers, true);
      await updateProgress(id, currentCompletedUsers, errors, true);
      console.log(
        `Distribution completed successfully. Total distributed: ${currentCompletedUsers.length}/${eligibleUsers.length}`,
      );

      return {
        success: true,
        totalEligibleUsers: eligibleUsers.length,
        distributedUsers: currentCompletedUsers.length,
      };
    } catch (error) {
      console.error(`Distribution workflow failed for reward ${id}:`, error);
      throw error;
    }
  },
});

// Helper functions
async function updateProgress(
  rewardId: string,
  completedUsers: string[],
  lastError?: any,
  isQuarterReward = false,
): Promise<void> {
  const updateData: any = {
    completedUsers,
    lastUpdatedAt: new Date(),
  };

  if (lastError !== undefined) {
    updateData.lastError = lastError;
  }

  if (isQuarterReward) {
    await db.quarterReward.update({
      where: { id: rewardId },
      data: updateData,
    });
  } else {
    await db.originReward.update({
      where: { id: rewardId },
      data: updateData,
    });
  }
  console.log(`Progress updated for reward ${rewardId}:`, updateData);
}

async function markAsCompleted(
  rewardId: string,
  completedUsers: string[],
  isQuarterReward = false,
): Promise<void> {
  if (isQuarterReward) {
    await db.quarterReward.update({
      where: { id: rewardId },
      data: {
        isDistributed: true,
        completedUsers,
        lastUpdatedAt: new Date(),
      },
    });
  }
  else {
    await db.originReward.update({
      where: { id: rewardId },
      data: {
        isDistributed: true,
        completedUsers,
        rewardedAt: new Date(),
        lastUpdatedAt: new Date(),
        lastError: undefined, // Clear errors on successful completion
      },
    });
  }
}


function calculateDistributedAmount(
  eligibleUsers: DistributionUser[],
  completedUsers: string[],
): number {
  return eligibleUsers
    .filter((user) => completedUsers.includes(user.pubkey))
    .reduce((sum, user) => sum + parseFloat(user.amount), 0);
}

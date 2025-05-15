import { task } from "@trigger.dev/sdk/v3";
import { getActionHolders } from "~/lib/stellar/action-token";
import { db } from "~/server/db";

export const quarterRewardSyncTask = task({
  id: "quarter-reward-sync",

  run: async () => {
    const holders = await getActionHolders();
    // get current quarter of the year.
    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3);
    // quarter range jan-mar = 1, apr-jun = 2, jul-sep = 3, oct-dec = 4

    const quarterRange = getQuarterRange(currentQuarter);

    const data = await db.quarterReward.upsert({
      where: {
        year_quarter: {
          year: currentYear,
          quarter: quarterRange,
        },
      },
      create: {
        data: holders,
        year: currentYear,
        quarter: quarterRange,
      },
      update: {
        data: holders,
      },
    });
  },
});

function getQuarterRange(quarter: number): string {
  switch (quarter) {
    case 1:
      return "JAN-MAR";
    case 2:
      return "APR-JUN";
    case 3:
      return "JUL-SEP";
    case 4:
      return "OCT-DEC";
    default:
      throw new Error("Invalid quarter");
  }
}

import { runs } from "@trigger.dev/sdk/v3";

export async function getTaskRunStatus(runId: string) {
  try {
    const run = await runs.retrieve(runId);
    return run.status;
  } catch (error) {
    console.log("Error fetching run status:", error);
  }
}

import { useRealtimeRun } from "@trigger.dev/react-hooks";

export function RealtimeStatusOfRunId({
  runId,
  publicAccessToken,
}: {
  runId: string;
  publicAccessToken: string;
}) {
  const { run, error } = useRealtimeRun(runId, {
    accessToken: publicAccessToken, // This is required
  });

  // ...
  return (
    <div>
      {error && <div>Error: {error.message}</div>}
      {run ? (
        <div>
          <h2>Run Status: {run.status}</h2>
          <p>Started at: {new Date(run.createdAt).toLocaleString()}</p>
          <p>Last updated at: {new Date(run.updatedAt).toLocaleString()}</p>
          <p>Run ID: {run.id}</p>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}

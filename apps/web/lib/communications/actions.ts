import { processQueuedCommunicationById } from "./processor";

type CommunicationMutationResult = {
  error: Error | null;
  data: {
    id: string;
  } | null;
};

export async function processCommunicationMutationResult<T extends CommunicationMutationResult>(
  result: T,
  failureMessage: string
) {
  if (result.error || !result.data) {
    throw result.error ?? new Error(failureMessage);
  }

  try {
    await processQueuedCommunicationById(result.data.id);
  } catch {
    // The communication row still records queued/failed state for office follow-up.
  }

  return result.data;
}

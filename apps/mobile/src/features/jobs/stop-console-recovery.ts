import { clientStorage } from "../../lib/client-storage";

export type RecoverableStopSheet =
  | "approval_capture"
  | "call_followup"
  | "estimate_line"
  | "evidence"
  | "navigation_return"
  | "part_source"
  | "payment";

export type StopConsoleRecoveryState = {
  jobId: string;
  lineItemId?: string | null | undefined;
  sheet: RecoverableStopSheet;
  summary: string;
  updatedAt: string;
};

function buildRecoveryKey(jobId: string) {
  return `mobile-stop-console-recovery:${jobId}`;
}

export async function clearStopConsoleRecovery(jobId: string) {
  await clientStorage.removeItem(buildRecoveryKey(jobId));
}

export async function loadStopConsoleRecovery(jobId: string) {
  const raw = await clientStorage.getItem(buildRecoveryKey(jobId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StopConsoleRecoveryState;
    return parsed.jobId === jobId ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveStopConsoleRecovery(state: StopConsoleRecoveryState) {
  await clientStorage.setItem(buildRecoveryKey(state.jobId), JSON.stringify(state));
}

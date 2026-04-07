import type { Job } from "@mobile-mechanic/types";

export function getJobDisplayName(job: Pick<Job, "title">): string {
  return job.title.trim();
}

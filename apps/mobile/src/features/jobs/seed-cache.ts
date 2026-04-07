import type { TechnicianJobDetail, TechnicianJobSeed } from "@mobile-mechanic/types";

import {
  loadCachedAssignedJobDetail,
  saveCachedAssignedJobDetail
} from "./offline-job-store";

export async function saveTechnicianJobSeedToCache(seed: TechnicianJobSeed) {
  const existingDetail = await loadCachedAssignedJobDetail<TechnicianJobDetail>(seed.job.id);

  await saveCachedAssignedJobDetail(seed.job.id, {
    communications: existingDetail?.communications ?? [],
    customer: seed.customer,
    job: seed.job,
    notes: existingDetail?.notes ?? [],
    primaryAddress: seed.primaryAddress ?? existingDetail?.primaryAddress ?? null,
    serviceSite:
      seed.serviceSite ??
      existingDetail?.serviceSite ??
      seed.primaryAddress ??
      existingDetail?.primaryAddress ??
      null,
    statusHistory: existingDetail?.statusHistory ?? [],
    vehicle: seed.vehicle
  } satisfies TechnicianJobDetail);
}

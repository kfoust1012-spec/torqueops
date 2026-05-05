import { createServiceRoleSupabaseClient } from "../supabase/service-role";

const DEFAULT_COMPANY_REFRESH_LIMIT = 25;
const DEFAULT_OBSERVATION_SCAN_LIMIT = 5000;

type LaborObservationRow = {
  company_id: string;
  completed_at: string | null;
};

async function refreshLaborOperationStats(
  _client: ReturnType<typeof createServiceRoleSupabaseClient>,
  _companyId: string
): Promise<{ error: Error | null }> {
  return { error: null };
}

export async function refreshLaborOperationStatsForObservedCompanies(input?: {
  companyLimit?: number;
  observationScanLimit?: number;
}) {
  const companyLimit = input?.companyLimit ?? DEFAULT_COMPANY_REFRESH_LIMIT;
  const observationScanLimit = input?.observationScanLimit ?? DEFAULT_OBSERVATION_SCAN_LIMIT;
  const client = createServiceRoleSupabaseClient();
  const observationsResult = (await (client as any)
    .from("labor_observations")
    .select("company_id, completed_at")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(observationScanLimit)) as {
    data: LaborObservationRow[] | null;
    error: Error | null;
  };

  if (observationsResult.error) {
    throw observationsResult.error;
  }

  const companyIds = [...new Set((observationsResult.data ?? []).map((row) => row.company_id).filter(Boolean))].slice(
    0,
    companyLimit
  );
  const refreshedCompanyIds: string[] = [];
  const failedCompanyIds: Array<{ companyId: string; error: string }> = [];

  for (const companyId of companyIds) {
    const refreshResult = await refreshLaborOperationStats(client, companyId);

    if (refreshResult.error) {
      failedCompanyIds.push({
        companyId,
        error: refreshResult.error.message
      });
      continue;
    }

    refreshedCompanyIds.push(companyId);
  }

  return {
    failedCompanyIds,
    refreshedCompanyIds,
    scannedObservationCount: observationsResult.data?.length ?? 0
  };
}

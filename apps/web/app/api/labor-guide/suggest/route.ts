import { getEstimateDetailById, getJobById, getVehicleById } from "@mobile-mechanic/api-client";
import { suggestLaborOperationsInputSchema } from "@mobile-mechanic/validation";

import { getCompanyContextResult } from "../../../../lib/company-context";
import {
  buildLaborGuideContext,
  buildLaborGuideContextFromEstimateDetail
} from "../../../../lib/labor-guide/estimate";
import {
  filterSuggestedOperationsAgainstExistingLineItems,
  suggestLaborOperations
} from "../../../../lib/labor-guide/service";

function applyQueryToContext<T extends ReturnType<typeof buildLaborGuideContext>>(context: T, query?: string | null) {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    return context;
  }

  return {
    ...context,
    description: [context.description, trimmedQuery].filter(Boolean).join("\n"),
    customerConcern: [context.customerConcern, trimmedQuery].filter(Boolean).join("\n")
  };
}

export async function POST(request: Request) {
  try {
    const contextResult = await getCompanyContextResult({ requireOfficeAccess: true });

    if (contextResult.status === "unauthenticated") {
      return Response.json(
        {
          message: "Authentication is required to view labor suggestions."
        },
        {
          status: 401
        }
      );
    }

    if (contextResult.status === "no-company" || contextResult.status === "forbidden") {
      return Response.json(
        {
          message: "Office access is required to view labor suggestions."
        },
        {
          status: 403
        }
      );
    }

    const parsed = suggestLaborOperationsInputSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return Response.json(
        {
          message: parsed.error.issues[0]?.message ?? "A valid job id is required."
        },
        {
          status: 400
        }
      );
    }

    const { jobId, estimateId, query } = parsed.data;

    if (estimateId) {
      const detailResult = await getEstimateDetailById(contextResult.context.supabase, estimateId);

      if (detailResult.error || !detailResult.data) {
        return Response.json(
          {
            message: "Estimate not found."
          },
          {
            status: 404
          }
        );
      }

      if (
        detailResult.data.estimate.companyId !== contextResult.context.companyId ||
        detailResult.data.job.id !== jobId
      ) {
        return Response.json(
          {
            message: "Forbidden"
          },
          {
            status: 403
          }
        );
      }

      const result = filterSuggestedOperationsAgainstExistingLineItems(
        suggestLaborOperations(
          applyQueryToContext(buildLaborGuideContextFromEstimateDetail(detailResult.data), query)
        ),
        detailResult.data.lineItems
      );

      return Response.json(result);
    }

    const jobResult = await getJobById(contextResult.context.supabase, jobId);

    if (jobResult.error || !jobResult.data) {
      return Response.json(
        {
          message: "Visit not found."
        },
        {
          status: 404
        }
      );
    }

    if (jobResult.data.companyId !== contextResult.context.companyId) {
      return Response.json(
        {
          message: "Forbidden"
        },
        {
          status: 403
        }
      );
    }

    const vehicleResult = await getVehicleById(contextResult.context.supabase, jobResult.data.vehicleId);

    if (vehicleResult.error || !vehicleResult.data) {
      return Response.json(
        {
          message: "Vehicle not found."
        },
        {
          status: 404
        }
      );
    }

    if (vehicleResult.data.companyId !== contextResult.context.companyId) {
      return Response.json(
        {
          message: "Forbidden"
        },
        {
          status: 403
        }
      );
    }

    const result = suggestLaborOperations(
      applyQueryToContext(
        buildLaborGuideContext({
          job: jobResult.data,
          vehicle: vehicleResult.data,
          estimateId: estimateId ?? null
        }),
        query
      )
    );

    return Response.json(result);
  } catch {
    return Response.json(
      {
        message: "Labor suggestions could not be loaded right now. Manual estimate line items are still available."
      },
      {
        status: 500
      }
    );
  }
}

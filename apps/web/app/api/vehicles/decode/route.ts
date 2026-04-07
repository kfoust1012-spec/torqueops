import { decodeVinInputSchema } from "@mobile-mechanic/validation";

import { getCompanyContextResult } from "../../../../lib/company-context";
import { decodeVin } from "../../../../lib/vehicles/vin-decoder";

export async function POST(request: Request) {
  try {
    const contextResult = await getCompanyContextResult({ requireOfficeAccess: true });

    if (contextResult.status === "unauthenticated") {
      return Response.json(
        {
          message: "Authentication is required to decode VIN data."
        },
        {
          status: 401
        }
      );
    }

    if (contextResult.status === "no-company" || contextResult.status === "forbidden") {
      return Response.json(
        {
          message: "Office access is required to decode VIN data."
        },
        {
          status: 403
        }
      );
    }

    const parsed = decodeVinInputSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json(
        {
          message:
            parsed.error.issues[0]?.message ?? "VIN must be 17 characters and exclude I, O, and Q."
        },
        {
          status: 400
        }
      );
    }

    const result = await decodeVin(parsed.data.vin);

    return Response.json(result);
  } catch {
    return Response.json(
      {
        message: "Vehicle details could not be fetched right now. Manual entry is still available."
      },
      {
        status: 500
      }
    );
  }
}
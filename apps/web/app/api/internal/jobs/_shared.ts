import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../lib/company-context";

export async function requireVisitsWorkboardApiContext() {
  const result = await getCompanyContextResult({ requireOfficeAccess: true });

  if (result.status === "unauthenticated") {
    return {
      context: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (result.status === "forbidden" || result.status === "no-company") {
    return {
      context: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    context: result.context,
    response: null
  };
}

export const requireJobsWorkboardApiContext = requireVisitsWorkboardApiContext;

export async function parseJsonRequest<T>(request: Request) {
  return (await request.json().catch(() => null)) as T | null;
}

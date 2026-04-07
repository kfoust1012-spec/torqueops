import { NextResponse } from "next/server";

import { getCompanyContextResult } from "../../../../lib/company-context";

export async function requireEstimateWorkspaceApiContext() {
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

export async function parseJsonRequest<T>(request: Request) {
  return (await request.json().catch(() => null)) as T | null;
}

export function createEstimateWorkspaceApiErrorResponse(
  error: unknown,
  fallbackMessage = "Estimate workspace action could not be completed."
) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string" &&
          (error as { message: string }).message.trim()
        ? (error as { message: string }).message
        : fallbackMessage;
  const normalizedMessage = message.toLowerCase();
  const status =
    normalizedMessage === "unauthorized"
      ? 401
      : normalizedMessage === "forbidden"
        ? 403
        : message === fallbackMessage
          ? 500
          : 400;

  return NextResponse.json({ error: message }, { status });
}

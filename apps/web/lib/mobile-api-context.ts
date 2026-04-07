import { createAppSupabaseClient, getProfileById, listMembershipsForUser } from "@mobile-mechanic/api-client";
import { canAccessMobileApp, resolvePreferredMembership } from "@mobile-mechanic/core";
import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "./auth";
import { webEnv } from "./env";

type MobileApiContext = {
  companyId: string;
  currentUserId: string;
  supabase: ReturnType<typeof createAppSupabaseClient>;
};

function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization")?.trim() ?? "";
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function buildMobileCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get("origin")?.trim() ?? "";
  const allowOrigin =
    requestOrigin && /^(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)$/iu.test(requestOrigin)
      ? requestOrigin
      : "*";

  return {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  } as const;
}

export function buildMobileCorsPreflightResponse(request: Request) {
  return new NextResponse(null, {
    headers: buildMobileCorsHeaders(request),
    status: 204
  });
}

export function withMobileCors(request: Request, response: NextResponse) {
  const headers = buildMobileCorsHeaders(request);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export async function requireMobileApiContext(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return {
      context: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const supabase = createAppSupabaseClient({
    supabaseUrl: webEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  });
  const currentUser = await getAuthenticatedUser(supabase);

  if (!currentUser) {
    return {
      context: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const [profileResult, membershipsResult] = await Promise.all([
    getProfileById(supabase, currentUser.id),
    listMembershipsForUser(supabase, currentUser.id)
  ]);

  if (profileResult.error || !profileResult.data) {
    return {
      context: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  if (membershipsResult.error || !membershipsResult.data) {
    return {
      context: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  const membership = resolvePreferredMembership(
    { defaultCompanyId: profileResult.data.default_company_id },
    membershipsResult.data
      .filter((candidate) => canAccessMobileApp(candidate.role))
      .map((candidate) => ({
        companyId: candidate.company_id,
        isActive: candidate.is_active,
        membership: candidate
      }))
  );

  if (!membership) {
    return {
      context: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    context: {
      companyId: membership.company_id,
      currentUserId: currentUser.id,
      supabase
    } satisfies MobileApiContext,
    response: null
  };
}

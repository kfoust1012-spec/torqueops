import { canEditCustomerRecords, resolvePreferredMembership } from "@mobile-mechanic/core";
import { getCompanyById, getProfileById, listMembershipsForUser } from "@mobile-mechanic/api-client";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuthenticatedUser } from "./auth";
import { unwrapServerResult } from "./server-error";
import { createServerSupabaseClient } from "./supabase/server";

type CompanyContextOptions = {
  requireOfficeAccess?: boolean;
};

type CompanyContextSuccess = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  currentUser: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
  currentUserId: string;
  company: NonNullable<Awaited<ReturnType<typeof getCompanyById>>["data"]>;
  companyId: string;
  profile: NonNullable<Awaited<ReturnType<typeof getProfileById>>["data"]>;
  membership: NonNullable<Awaited<ReturnType<typeof listMembershipsForUser>>["data"]>[number];
  canEditRecords: boolean;
};

type CompanyContextResult =
  | { status: "ok"; context: CompanyContextSuccess }
  | { status: "unauthenticated" }
  | { status: "no-company" }
  | { status: "forbidden" };

const resolveCompanyContextCached = cache(
  async (requireOfficeAccess: boolean): Promise<CompanyContextResult> => {
    const supabase = await createServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return { status: "unauthenticated" };
    }

    const [profileResult, membershipsResult] = await Promise.all([
      getProfileById(supabase, user.id),
      listMembershipsForUser(supabase, user.id)
    ]);

    const profile = unwrapServerResult(
      profileResult,
      "Authenticated profile could not be loaded."
    );
    const memberships = unwrapServerResult(
      membershipsResult,
      "Company memberships could not be loaded."
    );

    const currentMembership = resolvePreferredMembership(
      { defaultCompanyId: profile.default_company_id },
      memberships.map((membership) => ({
        companyId: membership.company_id,
        isActive: membership.is_active,
        membership
      }))
    );

    if (!currentMembership) {
      return { status: "no-company" };
    }

    if (requireOfficeAccess && !canEditCustomerRecords(currentMembership.role)) {
      return { status: "forbidden" };
    }

    const companyResult = await getCompanyById(supabase, currentMembership.company_id);

    const company = unwrapServerResult(
      companyResult,
      "Company context could not be loaded."
    );

    return {
      status: "ok",
      context: {
        supabase,
        currentUser: user,
        currentUserId: user.id,
        company,
        companyId: currentMembership.company_id,
        profile,
        membership: currentMembership,
        canEditRecords: canEditCustomerRecords(currentMembership.role)
      }
    };
  }
);

async function resolveCompanyContext(options: CompanyContextOptions = {}): Promise<CompanyContextResult> {
  return resolveCompanyContextCached(Boolean(options.requireOfficeAccess));
}

export async function getCompanyContextResult(options: CompanyContextOptions = {}) {
  return resolveCompanyContext(options);
}

export async function requireCompanyContext(options: CompanyContextOptions = {}) {
  const result = await resolveCompanyContext(options);

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "no-company") {
    redirect("/dashboard");
  }

  if (result.status === "forbidden") {
    redirect("/dashboard");
  }

  return result.context;
}

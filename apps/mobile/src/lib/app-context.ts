import { canAccessMobileApp, resolvePreferredMembership } from "@mobile-mechanic/core";
import type { Database } from "@mobile-mechanic/types";
import { getCompanyById, getProfileById, listMembershipsForUser } from "@mobile-mechanic/api-client";

import type { AppSupabaseClient } from "@mobile-mechanic/api-client";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MembershipRow = Database["public"]["Tables"]["company_memberships"]["Row"];

export type MobileAppContext = {
  company: CompanyRow;
  companyId: string;
  membership: MembershipRow;
  profile: ProfileRow;
  userId: string;
};

export async function loadMobileAppContext(client: AppSupabaseClient, userId: string): Promise<{
  data: MobileAppContext | null;
  error: Error | null;
}> {
  const [profileResult, membershipsResult] = await Promise.all([
    getProfileById(client, userId),
    listMembershipsForUser(client, userId)
  ]);

  if (profileResult.error || !profileResult.data) {
    return {
      data: null,
      error: new Error("Profile not found for the signed-in technician.")
    };
  }

  if (membershipsResult.error || !membershipsResult.data) {
    return {
      data: null,
      error: new Error("Company membership not found for the signed-in technician.")
    };
  }

  const membership = resolvePreferredMembership(
    { defaultCompanyId: profileResult.data.default_company_id },
    membershipsResult.data
      .filter((membership) => canAccessMobileApp(membership.role))
      .map((membership) => ({
        companyId: membership.company_id,
        isActive: membership.is_active,
        membership
      }))
  );

  if (!membership) {
    return {
      data: null,
      error: new Error("This account does not have mobile app access yet.")
    };
  }

  const companyResult = await getCompanyById(client, membership.company_id);

  if (companyResult.error || !companyResult.data) {
    return {
      data: null,
      error: new Error("Default company could not be loaded for this mobile user.")
    };
  }

  return {
    data: {
      company: companyResult.data,
      companyId: membership.company_id,
      membership,
      profile: profileResult.data,
      userId
    },
    error: null
  };
}

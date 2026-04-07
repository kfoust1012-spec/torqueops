import type { CompanyMembership, UserProfile } from "@mobile-mechanic/types";

export function getActiveMemberships(memberships: CompanyMembership[]): CompanyMembership[] {
  return memberships.filter((membership) => membership.isActive);
}

export type MembershipSelectionCandidate<TMembership> = {
  companyId: string;
  isActive: boolean;
  membership: TMembership;
};

export function hasActiveCompanyMembership(
  memberships: CompanyMembership[],
  companyId: string
): boolean {
  return memberships.some(
    (membership) => membership.companyId === companyId && membership.isActive
  );
}

export function resolveDefaultCompanyId(
  profile: Pick<UserProfile, "defaultCompanyId">,
  memberships: CompanyMembership[]
): string | null {
  if (profile.defaultCompanyId && hasActiveCompanyMembership(memberships, profile.defaultCompanyId)) {
    return profile.defaultCompanyId;
  }

  return getActiveMemberships(memberships)[0]?.companyId ?? null;
}

export function resolvePreferredMembership<TMembership>(
  profile: Pick<UserProfile, "defaultCompanyId">,
  memberships: MembershipSelectionCandidate<TMembership>[]
): TMembership | null {
  if (profile.defaultCompanyId) {
    const preferredMembership = memberships.find(
      (membership) =>
        membership.companyId === profile.defaultCompanyId && membership.isActive
    );

    if (preferredMembership) {
      return preferredMembership.membership;
    }
  }

  return memberships.find((membership) => membership.isActive)?.membership ?? null;
}

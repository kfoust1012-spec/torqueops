import type { AppRole } from "./auth";
import type { TimestampFields, UUID } from "./common";

export interface Company extends TimestampFields {
  id: UUID;
  name: string;
  slug: string;
  timezone: string;
  ownerUserId: UUID;
}

export interface CompanyMembership extends TimestampFields {
  id: UUID;
  companyId: UUID;
  userId: UUID;
  role: AppRole;
  isActive: boolean;
}

export interface CreateCompanyInput {
  name: string;
  slug: string;
}

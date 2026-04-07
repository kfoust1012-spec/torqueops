import type { Database } from "@mobile-mechanic/types";
import { createCompanyInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type MembershipRow = Database["public"]["Tables"]["company_memberships"]["Row"];

export async function createCompany(
  client: AppSupabaseClient,
  input: Pick<CompanyInsert, "name" | "slug" | "owner_user_id">
) {
  const company = createCompanyInputSchema.parse({
    name: input.name,
    slug: input.slug
  });

  return client
    .from("companies")
    .insert({
      ...company,
      owner_user_id: input.owner_user_id
    })
    .select("*")
    .single<CompanyRow>();
}

export async function getCompanyById(client: AppSupabaseClient, companyId: string) {
  return client.from("companies").select("*").eq("id", companyId).single<CompanyRow>();
}

export async function listMembershipsForUser(client: AppSupabaseClient, userId: string) {
  return client
    .from("company_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .returns<MembershipRow[]>();
}

export async function listMembershipsByCompany(client: AppSupabaseClient, companyId: string) {
  return client
    .from("company_memberships")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .returns<MembershipRow[]>();
}

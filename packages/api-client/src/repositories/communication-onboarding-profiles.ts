import type {
  CommunicationOnboardingProfile,
  Database,
  UpsertCommunicationOnboardingProfileInput
} from "@mobile-mechanic/types";
import { upsertCommunicationOnboardingProfileInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CommunicationOnboardingProfileRow =
  Database["public"]["Tables"]["communication_onboarding_profiles"]["Row"];

function mapCommunicationOnboardingProfileRow(
  row: CommunicationOnboardingProfileRow
): CommunicationOnboardingProfile {
  return {
    companyId: row.company_id,
    legalBusinessName: row.legal_business_name,
    doingBusinessAs: row.doing_business_as,
    businessAddress: row.business_address,
    businessPhone: row.business_phone,
    websiteUrl: row.website_url,
    privacyPolicyUrl: row.privacy_policy_url,
    termsUrl: row.terms_url,
    supportEmail: row.support_email,
    optInWorkflow: row.opt_in_workflow,
    preferredSenderType:
      row.preferred_sender_type === "local_10dlc" || row.preferred_sender_type === "toll_free"
        ? row.preferred_sender_type
        : null,
    campaignDescription: row.campaign_description,
    sampleOnTheWayMessage: row.sample_on_the_way_message,
    sampleRunningLateMessage: row.sample_running_late_message,
    sampleInvoiceReminderMessage: row.sample_invoice_reminder_message,
    helpReplyText: row.help_reply_text,
    stopReplyText: row.stop_reply_text,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getCommunicationOnboardingProfile(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("communication_onboarding_profiles")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle<CommunicationOnboardingProfileRow>();

  if (result.error) {
    return {
      ...result,
      data: null
    };
  }

  return {
    error: null,
    data: result.data ? mapCommunicationOnboardingProfileRow(result.data) : null
  };
}

export async function upsertCommunicationOnboardingProfile(
  client: AppSupabaseClient,
  input: UpsertCommunicationOnboardingProfileInput
) {
  const parsed = upsertCommunicationOnboardingProfileInputSchema.parse(input);
  const result = await client
    .from("communication_onboarding_profiles")
    .upsert(
      {
        company_id: parsed.companyId,
        legal_business_name: parsed.legalBusinessName ?? null,
        doing_business_as: parsed.doingBusinessAs ?? null,
        business_address: parsed.businessAddress ?? null,
        business_phone: parsed.businessPhone ?? null,
        website_url: parsed.websiteUrl ?? null,
        privacy_policy_url: parsed.privacyPolicyUrl ?? null,
        terms_url: parsed.termsUrl ?? null,
        support_email: parsed.supportEmail ?? null,
        opt_in_workflow: parsed.optInWorkflow ?? null,
        preferred_sender_type: parsed.preferredSenderType ?? null,
        campaign_description: parsed.campaignDescription ?? null,
        sample_on_the_way_message: parsed.sampleOnTheWayMessage ?? null,
        sample_running_late_message: parsed.sampleRunningLateMessage ?? null,
        sample_invoice_reminder_message: parsed.sampleInvoiceReminderMessage ?? null,
        help_reply_text: parsed.helpReplyText ?? null,
        stop_reply_text: parsed.stopReplyText ?? null,
        updated_by_user_id: parsed.updatedByUserId
      },
      { onConflict: "company_id" }
    )
    .select("*")
    .single<CommunicationOnboardingProfileRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationOnboardingProfileRow(result.data) : null
  };
}

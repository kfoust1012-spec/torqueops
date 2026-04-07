import type {
  CommunicationAutomationSettings,
  Database,
  UpdateCommunicationAutomationSettingsInput
} from "@mobile-mechanic/types";
import { updateCommunicationAutomationSettingsInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "../supabase/types";

type CommunicationAutomationSettingsRow =
  Database["public"]["Tables"]["communication_automation_settings"]["Row"];

function mapCommunicationAutomationSettingsRow(
  row: CommunicationAutomationSettingsRow
): CommunicationAutomationSettings {
  return {
    companyId: row.company_id,
    dispatchEnRouteSmsEnabled: row.dispatch_en_route_sms_enabled,
    dispatchRunningLateSmsEnabled: row.dispatch_running_late_sms_enabled,
    invoicePaymentReminderSmsEnabled: row.invoice_payment_reminder_sms_enabled,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getCommunicationAutomationSettings(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await client
    .from("communication_automation_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle<CommunicationAutomationSettingsRow>();

  if (result.error) {
    return {
      ...result,
      data: null
    };
  }

  return {
    error: null,
    data: result.data ? mapCommunicationAutomationSettingsRow(result.data) : null
  };
}

export async function upsertCommunicationAutomationSettings(
  client: AppSupabaseClient,
  input: UpdateCommunicationAutomationSettingsInput
) {
  const parsed = updateCommunicationAutomationSettingsInputSchema.parse(input);
  const result = await client
    .from("communication_automation_settings")
    .upsert(
      {
        company_id: parsed.companyId,
        dispatch_en_route_sms_enabled: parsed.dispatchEnRouteSmsEnabled ?? false,
        dispatch_running_late_sms_enabled: parsed.dispatchRunningLateSmsEnabled ?? false,
        invoice_payment_reminder_sms_enabled: parsed.invoicePaymentReminderSmsEnabled ?? false,
        updated_by_user_id: parsed.updatedByUserId
      },
      {
        onConflict: "company_id"
      }
    )
    .select("*")
    .single<CommunicationAutomationSettingsRow>();

  return {
    ...result,
    data: result.data ? mapCommunicationAutomationSettingsRow(result.data) : null
  };
}

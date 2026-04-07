import type { TimestampFields, UUID } from "./common";

export interface CommunicationAutomationSettings extends TimestampFields {
  companyId: UUID;
  dispatchEnRouteSmsEnabled: boolean;
  dispatchRunningLateSmsEnabled: boolean;
  invoicePaymentReminderSmsEnabled: boolean;
  updatedByUserId: UUID;
}

export interface UpdateCommunicationAutomationSettingsInput {
  companyId: UUID;
  dispatchEnRouteSmsEnabled?: boolean | undefined;
  dispatchRunningLateSmsEnabled?: boolean | undefined;
  invoicePaymentReminderSmsEnabled?: boolean | undefined;
  updatedByUserId: UUID;
}

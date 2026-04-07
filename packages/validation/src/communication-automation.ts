import { z } from "zod";

import { uuidSchema } from "./common";

export const updateCommunicationAutomationSettingsInputSchema = z.object({
  companyId: uuidSchema,
  dispatchEnRouteSmsEnabled: z.boolean().optional(),
  dispatchRunningLateSmsEnabled: z.boolean().optional(),
  invoicePaymentReminderSmsEnabled: z.boolean().optional(),
  updatedByUserId: uuidSchema
});

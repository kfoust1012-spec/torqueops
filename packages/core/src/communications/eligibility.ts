import type {
  CommunicationChannel,
  CommunicationType,
  CustomerCommunicationPreference,
  PaymentReminderStage
} from "@mobile-mechanic/types";
import type { Invoice } from "@mobile-mechanic/types";

type ChannelResolutionInput = {
  requestedChannel?: CommunicationChannel | null | undefined;
  preference?: CustomerCommunicationPreference | null;
  recipientEmail?: string | null | undefined;
  recipientPhone?: string | null | undefined;
};

export function canReceiveCommunicationOnChannel(
  channel: CommunicationChannel,
  recipient: {
    recipientEmail: string | null | undefined;
    recipientPhone: string | null | undefined;
  },
  preference?: CustomerCommunicationPreference | null
): boolean {
  if (channel === "email") {
    return Boolean(recipient.recipientEmail) && (preference?.emailEnabled ?? true);
  }

  return Boolean(recipient.recipientPhone) && (preference?.smsEnabled ?? true);
}

export function canSendCommunicationType(
  type: CommunicationType,
  preference?: CustomerCommunicationPreference | null
): boolean {
  if (!preference) {
    return true;
  }

  switch (type) {
    case "estimate_notification":
      return preference.allowEstimateNotifications;
    case "invoice_notification":
      return preference.allowInvoiceNotifications;
    case "payment_reminder":
      return preference.allowPaymentReminders;
    case "appointment_confirmation":
      return preference.allowAppointmentConfirmations;
    case "dispatch_update":
      return preference.allowDispatchUpdates;
  }
}

export function resolveCommunicationChannel(input: ChannelResolutionInput): CommunicationChannel {
  const { requestedChannel, preference, recipientEmail, recipientPhone } = input;

  if (requestedChannel) {
    if (!canReceiveCommunicationOnChannel(requestedChannel, { recipientEmail, recipientPhone }, preference)) {
      throw new Error(`Customer cannot receive ${requestedChannel} communications.`);
    }

    return requestedChannel;
  }

  const preferredChannel = preference?.preferredChannel;

  if (
    preferredChannel &&
    canReceiveCommunicationOnChannel(preferredChannel, { recipientEmail, recipientPhone }, preference)
  ) {
    return preferredChannel;
  }

  if (canReceiveCommunicationOnChannel("email", { recipientEmail, recipientPhone }, preference)) {
    return "email";
  }

  if (canReceiveCommunicationOnChannel("sms", { recipientEmail, recipientPhone }, preference)) {
    return "sms";
  }

  throw new Error("Customer does not have an enabled email or SMS destination.");
}

export function isInvoiceEligibleForReminder(invoice: Pick<Invoice, "status" | "balanceDueCents" | "dueAt">): boolean {
  return (
    ["issued", "partially_paid"].includes(invoice.status) &&
    invoice.balanceDueCents > 0 &&
    Boolean(invoice.dueAt)
  );
}

export function getPaymentReminderStage(
  invoice: Pick<Invoice, "dueAt">,
  now: Date = new Date()
): PaymentReminderStage {
  if (!invoice.dueAt) {
    return "upcoming";
  }

  const dueTime = new Date(invoice.dueAt).getTime();
  const nowTime = now.getTime();

  if (nowTime > dueTime) {
    return "overdue";
  }

  if (Math.abs(dueTime - nowTime) < 60_000) {
    return "due";
  }

  return "upcoming";
}

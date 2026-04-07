import type {
  AppointmentConfirmationPayload,
  DispatchUpdatePayload,
  EstimateNotificationPayload,
  InvoiceNotificationPayload,
  PaymentReminderPayload
} from "@mobile-mechanic/types";
import { formatDateRange, formatDateTime } from "../dates/formatting";

function formatYearsExperience(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `${value} year${value === 1 ? "" : "s"}`;
}

function buildTechnicianTrustLines(
  payload: Pick<AppointmentConfirmationPayload, "technicianProfile" | "visitUrl"> | Pick<DispatchUpdatePayload, "technicianProfile" | "visitUrl">
) {
  const lines: Array<string | null> = [];
  const technicianProfile = payload.technicianProfile;

  if (technicianProfile) {
    const firstName = technicianProfile.fullName.split(" ")[0] ?? technicianProfile.fullName;
    lines.push(`Meet your mechanic: ${technicianProfile.fullName}`);

    const experience = formatYearsExperience(technicianProfile.yearsExperience);

    if (experience) {
      lines.push(`Experience: ${experience}`);
    }

    if (technicianProfile.certifications.length) {
      lines.push(`Certifications: ${technicianProfile.certifications.join(", ")}`);
    }

    if (technicianProfile.bio) {
      lines.push(`About ${firstName}: ${technicianProfile.bio}`);
    }
  }

  if (payload.visitUrl) {
    lines.push(`Mechanic profile and visit details: ${payload.visitUrl}`);
  }

  return lines;
}

export function buildCommunicationIdempotencyKey(...parts: Array<string | number | null | undefined>): string {
  const normalized = parts
    .map((part) => (part === undefined || part === null ? "" : String(part).trim()))
    .filter(Boolean);

  if (!normalized.length) {
    throw new Error("Communication idempotency key requires at least one non-empty part.");
  }

  return normalized.join(":");
}

export function formatServiceAddressSummary(address: {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
} | null): string | null {
  if (!address) {
    return null;
  }

  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

export function buildEstimateNotificationSubject(payload: EstimateNotificationPayload): string {
  return `Estimate ${payload.estimateNumber} from your mobile mechanic`;
}

export function buildEstimateNotificationBody(payload: EstimateNotificationPayload): string {
  return [
    `Hi ${payload.customerName},`,
    "",
    `Your estimate ${payload.estimateNumber} for ${payload.jobTitle} is ready.`,
    `${payload.estimateTitle}`,
    `Estimated total: $${(payload.totalCents / 100).toFixed(2)}`,
    `Vehicle: ${payload.vehicleLabel}`,
    payload.actionUrl ? "" : null,
    payload.actionUrl ? `View details: ${payload.actionUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInvoiceNotificationSubject(payload: InvoiceNotificationPayload): string {
  return `Invoice ${payload.invoiceNumber} is ready`;
}

export function buildInvoiceNotificationBody(payload: InvoiceNotificationPayload): string {
  return [
    `Hi ${payload.customerName},`,
    "",
    `Invoice ${payload.invoiceNumber} for ${payload.jobTitle} is ready.`,
    `${payload.invoiceTitle}`,
    `Total: $${(payload.totalCents / 100).toFixed(2)}`,
    `Balance due: $${(payload.balanceDueCents / 100).toFixed(2)}`,
    payload.dueAt ? `Due: ${formatDateTime(payload.dueAt, { timeZone: payload.companyTimeZone })}` : null,
    payload.paymentUrl ? `Pay here: ${payload.paymentUrl}` : null,
    payload.actionUrl ? "" : null,
    payload.actionUrl ? `View details: ${payload.actionUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPaymentReminderSubject(payload: PaymentReminderPayload): string {
  return `Payment reminder for invoice ${payload.invoiceNumber}`;
}

export function buildPaymentReminderBody(payload: PaymentReminderPayload): string {
  return [
    `Hi ${payload.customerName},`,
    "",
    `This is a ${payload.reminderStage.replaceAll("_", " ")} reminder for invoice ${payload.invoiceNumber}.`,
    `Balance due: $${(payload.balanceDueCents / 100).toFixed(2)}`,
    `Due: ${formatDateTime(payload.dueAt, { timeZone: payload.companyTimeZone })}`,
    payload.paymentUrl ? `Pay here: ${payload.paymentUrl}` : null,
    payload.actionUrl ? "" : null,
    payload.actionUrl ? `View details: ${payload.actionUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAppointmentConfirmationSubject(): string {
  return "Appointment confirmation";
}

export function buildAppointmentConfirmationBody(payload: AppointmentConfirmationPayload): string {
  return [
    `Hi ${payload.customerName},`,
    "",
    `Your appointment for ${payload.jobTitle} has been confirmed.`,
    `Scheduled start: ${formatDateTime(payload.scheduledStartAt, { timeZone: payload.companyTimeZone })}`,
    payload.scheduledEndAt
      ? `Scheduled end: ${formatDateTime(payload.scheduledEndAt, { timeZone: payload.companyTimeZone })}`
      : null,
    payload.arrivalWindowStartAt
      ? `Arrival window: ${formatDateRange(payload.arrivalWindowStartAt, payload.arrivalWindowEndAt, { timeZone: payload.companyTimeZone })}`
      : null,
    payload.technicianName ? `Technician: ${payload.technicianName}` : null,
    payload.serviceAddress ? `Service address: ${payload.serviceAddress}` : null,
    ...buildTechnicianTrustLines(payload),
    payload.actionUrl ? "" : null,
    payload.actionUrl ? `View details: ${payload.actionUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDispatchUpdateSubject(payload: DispatchUpdatePayload): string {
  if (payload.updateType === "en_route") {
    return "Your technician is on the way";
  }

  if (payload.updateType === "running_late") {
    return "Your technician is running late";
  }

  return "Dispatch update";
}

export function buildDispatchUpdateBody(payload: DispatchUpdatePayload): string {
  return [
    `Hi ${payload.customerName},`,
    "",
    payload.updateType === "en_route"
      ? `Your technician is on the way for ${payload.jobTitle}.`
      : payload.updateType === "running_late"
        ? `Your technician is running late for ${payload.jobTitle}. We will keep you posted as timing shifts.`
        : `Your job ${payload.jobTitle} has been dispatched.`,
    payload.technicianName ? `Technician: ${payload.technicianName}` : null,
    payload.scheduledStartAt
      ? `Scheduled start: ${formatDateTime(payload.scheduledStartAt, { timeZone: payload.companyTimeZone })}`
      : null,
    payload.arrivalWindowStartAt
      ? `Arrival window: ${formatDateRange(payload.arrivalWindowStartAt, payload.arrivalWindowEndAt, { timeZone: payload.companyTimeZone })}`
      : null,
    payload.serviceAddress ? `Service address: ${payload.serviceAddress}` : null,
    ...buildTechnicianTrustLines(payload),
    payload.actionUrl ? "" : null,
    payload.actionUrl ? `View details: ${payload.actionUrl}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

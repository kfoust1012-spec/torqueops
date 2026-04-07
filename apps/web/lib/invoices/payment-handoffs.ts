import type {
  ResolveTechnicianPaymentHandoffInput,
  TechnicianPaymentHandoff
} from "@mobile-mechanic/types";
import {
  formatTechnicianPaymentResolutionDispositionLabel,
  inferTechnicianPaymentHandoffResolutionDisposition,
  summarizeTechnicianPaymentHandoffResolutionDisposition
} from "./payment-handoff-resolution";
export {
  formatTechnicianPaymentResolutionDispositionLabel,
  inferTechnicianPaymentHandoffResolutionDisposition,
  summarizeTechnicianPaymentHandoffResolutionDisposition
} from "./payment-handoff-resolution";

export type TechnicianPaymentHandoffSummary = {
  copy: string;
  label: string;
  resolutionDisposition: ReturnType<typeof summarizeTechnicianPaymentHandoffResolutionDisposition>;
};

type AutoResolveTechnicianPaymentHandoffsAfterPaymentInput = {
  amountCents: number;
  provider: "manual" | "stripe";
};

type TechnicianPaymentHandoffRow = {
  amount_cents: number | null;
  company_id: string;
  created_at: string;
  customer_promise_at: string | null;
  id: string;
  invoice_id: string;
  job_id: string;
  kind: TechnicianPaymentHandoff["kind"];
  note: string | null;
  resolution_disposition: TechnicianPaymentHandoff["resolutionDisposition"];
  resolution_note: TechnicianPaymentHandoff["resolutionNote"];
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  status: TechnicianPaymentHandoff["status"];
  technician_user_id: string;
  tender_type: TechnicianPaymentHandoff["tenderType"];
  updated_at: string;
};

export function mapTechnicianPaymentHandoffRow(
  row: TechnicianPaymentHandoffRow
): TechnicianPaymentHandoff {
  return {
    amountCents: row.amount_cents,
    companyId: row.company_id,
    createdAt: row.created_at,
    customerPromiseAt: row.customer_promise_at,
    id: row.id,
    invoiceId: row.invoice_id,
    jobId: row.job_id,
    kind: row.kind,
    note: row.note,
    resolutionDisposition: row.resolution_disposition,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
    status: row.status,
    technicianUserId: row.technician_user_id,
    tenderType: row.tender_type,
    updatedAt: row.updated_at
  };
}

export async function listTechnicianPaymentHandoffsByInvoice(client: any, invoiceId: string) {
  const result = await client
    .from("technician_payment_handoffs")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as TechnicianPaymentHandoffRow[]).map(
    mapTechnicianPaymentHandoffRow
  );
}

export async function listTechnicianPaymentHandoffsByInvoiceIds(client: any, invoiceIds: string[]) {
  if (!invoiceIds.length) {
    return [] as TechnicianPaymentHandoff[];
  }

  const result = await client
    .from("technician_payment_handoffs")
    .select("*")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return ((result.data ?? []) as TechnicianPaymentHandoffRow[]).map(
    mapTechnicianPaymentHandoffRow
  );
}

export function countOpenTechnicianPaymentHandoffsByJobId(input: {
  handoffs: TechnicianPaymentHandoff[];
  invoiceIdToJobId: ReadonlyMap<string, string>;
}) {
  return input.handoffs.reduce<Map<string, number>>((counts, handoff) => {
    if (handoff.status !== "open") {
      return counts;
    }

    const jobId = input.invoiceIdToJobId.get(handoff.invoiceId);

    if (!jobId) {
      return counts;
    }

    counts.set(jobId, (counts.get(jobId) ?? 0) + 1);
    return counts;
  }, new Map());
}

function formatTechnicianPaymentHandoffKindLabel(handoff: TechnicianPaymentHandoff) {
  switch (handoff.kind) {
    case "manual_tender":
      if (handoff.tenderType === "cash") {
        return "Cash collected in field";
      }

      if (handoff.tenderType === "check") {
        return "Check collected in field";
      }

      return "Manual payment collected";
    case "promised_to_pay_later":
      return "Customer promised to pay later";
    case "resend_link":
      return "Customer needs payment link resent";
    case "follow_up_required":
      return "Customer needs billing follow-up";
    default:
      return "Field billing handoff logged";
  }
}

function formatHandoffAmount(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency"
  }).format(amountCents / 100);
}

function formatTechnicianPaymentHandoffCopy(handoff: TechnicianPaymentHandoff) {
  const noteSuffix = handoff.note?.trim() ? ` ${handoff.note.trim()}` : "";

  switch (handoff.kind) {
    case "manual_tender":
      return handoff.amountCents && handoff.amountCents > 0
        ? `Technician reported a field payment of ${formatHandoffAmount(handoff.amountCents)}. Office still needs to reconcile it.`
        : "Technician reported a manual field payment that office still needs to reconcile.";
    case "promised_to_pay_later":
      return (
        handoff.customerPromiseAt
        ? `Customer promised payment later. Office should follow through on that billing commitment.`
        : "Customer promised payment later and still needs billing follow-through."
      ) + noteSuffix;
    case "resend_link":
      return `Technician could not close payment in the field and asked office to resend or refresh the billing link.${noteSuffix}`;
    case "follow_up_required":
      return `Technician flagged this invoice for office billing follow-through after the visit.${noteSuffix}`;
    default:
      return handoff.note?.trim() || "Technician logged a billing handoff that still needs office review.";
  }
}

export function summarizeOpenTechnicianPaymentHandoffsByJobId(input: {
  handoffs: TechnicianPaymentHandoff[];
  invoiceIdToJobId: ReadonlyMap<string, string>;
}) {
  const openHandoffsByJobId = input.handoffs.reduce<Map<string, TechnicianPaymentHandoff[]>>(
    (grouped, handoff) => {
      if (handoff.status !== "open") {
        return grouped;
      }

      const jobId = input.invoiceIdToJobId.get(handoff.invoiceId);

      if (!jobId) {
        return grouped;
      }

      const current = grouped.get(jobId) ?? [];
      current.push(handoff);
      grouped.set(jobId, current);
      return grouped;
    },
    new Map()
  );

  return new Map(
    [...openHandoffsByJobId.entries()].map(([jobId, handoffs]) => {
      const leadHandoff = [...handoffs].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
      )[0]!;
      const label = formatTechnicianPaymentHandoffKindLabel(leadHandoff);
      const copy = formatTechnicianPaymentHandoffCopy(leadHandoff);
      const additionalCount = Math.max(handoffs.length - 1, 0);

      return [
        jobId,
        {
          copy: additionalCount
            ? `${copy} ${additionalCount} more open billing handoff${additionalCount === 1 ? " is" : "s are"} still attached.`
            : copy,
          label: additionalCount
            ? `${label} +${additionalCount} more`
            : label,
          resolutionDisposition: summarizeTechnicianPaymentHandoffResolutionDisposition(handoffs)
        } satisfies TechnicianPaymentHandoffSummary
      ];
    })
  );
}

export function buildAutoResolvedTechnicianPaymentHandoffNote(
  input: AutoResolveTechnicianPaymentHandoffsAfterPaymentInput
) {
  const amountLabel = formatHandoffAmount(input.amountCents);

  if (input.provider === "manual") {
    return `Auto-resolved after a field payment of ${amountLabel} was posted to the invoice ledger.`;
  }

  return `Auto-resolved after a customer payment of ${amountLabel} cleared the invoice checkout flow.`;
}

export async function resolveTechnicianPaymentHandoff(
  client: any,
  handoffId: string,
  resolvedByUserId: string | null,
  input: ResolveTechnicianPaymentHandoffInput
) {
  const result = await client
    .from("technician_payment_handoffs")
    .update({
      resolution_disposition: input.resolutionDisposition,
      resolution_note: input.resolutionNote?.trim() || null,
      resolved_by_user_id: resolvedByUserId ?? null,
      status: "resolved"
    })
    .eq("id", handoffId)
    .select("*")
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Payment handoff could not be resolved.");
  }

  return mapTechnicianPaymentHandoffRow(result.data as TechnicianPaymentHandoffRow);
}

export async function resolveOpenTechnicianPaymentHandoffsByInvoiceId(
  client: any,
  invoiceId: string,
  resolvedByUserId: string | null,
  input?: Partial<ResolveTechnicianPaymentHandoffInput>
) {
  const openResult = await client
    .from("technician_payment_handoffs")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("status", "open");

  if (openResult.error) {
    throw openResult.error;
  }

  const openHandoffs = ((openResult.data ?? []) as TechnicianPaymentHandoffRow[]).map(
    mapTechnicianPaymentHandoffRow
  );

  if (!openHandoffs.length) {
    return 0;
  }

  await Promise.all(
    openHandoffs.map((handoff) =>
      resolveTechnicianPaymentHandoff(client, handoff.id, resolvedByUserId, {
        resolutionDisposition:
          input?.resolutionDisposition ??
          inferTechnicianPaymentHandoffResolutionDisposition(handoff),
        resolutionNote: input?.resolutionNote?.trim() || null
      })
    )
  );

  return openHandoffs.length;
}

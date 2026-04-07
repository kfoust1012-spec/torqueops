import type {
  TechnicianPaymentHandoff,
  TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";

export function formatTechnicianPaymentResolutionDispositionLabel(
  disposition: TechnicianPaymentResolutionDisposition
) {
  switch (disposition) {
    case "manual_tender_reconciled":
      return "Cash/check reconciled";
    case "promise_accepted":
      return "Promise accepted";
    case "link_resent":
      return "Payment link resent";
    case "follow_up_completed":
      return "Follow-up completed";
    case "escalated_to_billing_owner":
      return "Escalated to billing owner";
    default:
      return "Resolved";
  }
}

export function inferTechnicianPaymentHandoffResolutionDisposition(
  handoff: Pick<TechnicianPaymentHandoff, "kind" | "tenderType">
): TechnicianPaymentResolutionDisposition {
  switch (handoff.kind) {
    case "manual_tender":
      return "manual_tender_reconciled";
    case "promised_to_pay_later":
      return "promise_accepted";
    case "resend_link":
      return "link_resent";
    case "follow_up_required":
      return "follow_up_completed";
    default:
      return "escalated_to_billing_owner";
  }
}

export function summarizeTechnicianPaymentHandoffResolutionDisposition(
  handoffs: Array<Pick<TechnicianPaymentHandoff, "kind" | "tenderType">>
): TechnicianPaymentResolutionDisposition {
  const inferredDispositions = new Set(
    handoffs.map((handoff) => inferTechnicianPaymentHandoffResolutionDisposition(handoff))
  );

  if (inferredDispositions.size === 1) {
    return [...inferredDispositions][0]!;
  }

  return "escalated_to_billing_owner";
}

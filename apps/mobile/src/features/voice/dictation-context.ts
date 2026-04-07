export const mechanicActionPhrases = [
  "diagnostic complete",
  "repair completed",
  "customer approved repair",
  "same-day repair",
  "return visit required",
  "part ordered for follow-up visit"
] as const;

export const estimatePhrases = [
  "diagnostic estimate",
  "return visit estimate",
  "diagnostic labor",
  "repair labor",
  "install labor",
  "replacement part",
  "service kit",
  "mobile service fee"
] as const;

export const sourcingPhrases = [
  "same-day pickup confirmed",
  "fastest ETA selected",
  "best price option selected",
  "core due at pickup",
  "part ordered for follow-up visit",
  "customer approved this source"
] as const;

export const paymentPhrases = [
  "cash collected in field",
  "check received in field",
  "paid in full during visit",
  "customer asked for payment link again",
  "customer will pay later",
  "manual tender collected in field"
] as const;

export const customerCallPhrases = [
  "customer confirmed arrival",
  "no answer left voicemail",
  "customer asked for callback",
  "approval discussed by phone",
  "delay explained to customer",
  "customer requested reschedule"
] as const;

export const billingPhrases = [
  "completed repair invoice",
  "field service invoice",
  "customer-ready billing",
  "payment due on completion",
  "parts and labor warranty",
  "service terms apply"
] as const;

export const inspectionPhrases = [
  "no issues found",
  "monitor condition",
  "service recommended soon",
  "repair required",
  "replace immediately",
  "customer advised of condition"
] as const;

export function mergeDictationContext(
  ...groups: Array<ReadonlyArray<string | null | undefined> | null | undefined>
) {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => (group ? Array.from(group) : []))
        .map((value) => value?.trim() ?? "")
        .filter((value): value is string => Boolean(value))
    )
  );
}

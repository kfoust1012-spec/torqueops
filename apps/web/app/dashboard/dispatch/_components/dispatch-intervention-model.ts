export type DispatchInterventionSummaryItem = {
  count: number;
  href?: string | undefined;
  id:
    | "closeout_risk"
    | "conflicts"
    | "low_confidence"
    | "promise_risk"
    | "queue_waiting"
    | "ready_release"
    | "stale_approval"
    | "stale_return"
    | "supply_blocked";
  label: string;
  onClick?: (() => void) | undefined;
  score: number;
  secondary: string;
  tone: "brand" | "danger" | "neutral" | "success" | "warning";
};

export type DispatchInterventionAction = {
  copy: string;
  href?: string | undefined;
  id:
    | "closeout_risk"
    | "low_confidence"
    | "promise_risk"
    | "ready_release"
    | "stale_approval"
    | "stale_return"
    | "supply_blocked";
  kind: "batch" | "link";
  label: string;
  onClick?: (() => void) | undefined;
  pending?: boolean | undefined;
  score: number;
  title: string;
};

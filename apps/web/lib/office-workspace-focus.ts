export type OfficeOperatorRole = "owner" | "admin" | "dispatcher" | "technician";

export type OfficeVisitFocusScope =
  | "promise_risk"
  | "needs_assignment"
  | "stale_return_visit"
  | "stale_approval"
  | "ready_dispatch"
  | "readiness_risk"
  | "billing_follow_up"
  | "live";

export type OfficeFinanceFocusStage =
  | "ready_release"
  | "collect_now"
  | "reminder_due"
  | "aged_risk"
  | "partial_follow_up";

export type OfficeCustomerFocusSegment =
  | "recent"
  | "needs-contact"
  | "needs-address"
  | "no-vehicle"
  | "multi-vehicle"
  | "inactive";

export type VisitDrawerSection =
  | "promise_readiness"
  | "exception_ownership"
  | "follow_up"
  | "customer_updates"
  | "commercial_state"
  | "recent_activity"
  | "recent_status"
  | "workspace_links";

export type FinanceDetailSection =
  | "next_move"
  | "exception_ownership"
  | "service_thread"
  | "commercial_state"
  | "follow_up"
  | "customer_updates"
  | "recent_activity";

export type CustomerInspectorSection =
  | "quick_actions"
  | "record_health"
  | "service_location"
  | "lifecycle";

type VisitActionLabels = {
  appointment: string;
  dispatched: string;
  enRoute: string;
  estimate: string;
  invoice: string;
  reminder: string;
};

type FinanceActionLabels = {
  invoice: string;
  reminder: string;
  primaryAction: "invoice" | "reminder";
};

type CustomerActionLabels = {
  addAddress: string;
  addVehicle: string;
  editCustomer: string;
  estimate: string;
  visit: string;
};

type FocusEntry<TValue extends string> = {
  label: string;
  value: TValue;
};

type FocusConfig<TValue extends string> = {
  defaultValue: TValue;
  entries: FocusEntry<TValue>[];
  title: string;
};

export function normalizeOfficeOperatorRole(role: string | undefined): OfficeOperatorRole | "office" {
  if (role === "owner" || role === "admin" || role === "dispatcher" || role === "technician") {
    return role;
  }

  return "office";
}

export function getOfficeHomeWorkspace(role: string | undefined): {
  description: string;
  href: string;
  label: string;
} {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        description: "Live routing, recovery, and lane control",
        href: "/dashboard/dispatch",
        label: "Dispatch"
      };
    case "owner":
      return {
        description: "Owner exception brief for route, unblock, and closeout risk",
        href: "/dashboard",
        label: "Today brief"
      };
    case "admin":
      return {
        description: "Live release, routing, and follow-through",
        href: "/dashboard/dispatch",
        label: "Dispatch"
      };
    default:
      return {
        description: "Live release, routing, and follow-through",
        href: "/dashboard/dispatch",
        label: "Dispatch"
      };
  }
}

export function getVisitRoleFocus(role: string | undefined): FocusConfig<OfficeVisitFocusScope> {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        defaultValue: "promise_risk",
        entries: [
          { label: "Promise risk", value: "promise_risk" },
          { label: "Needs assignment", value: "needs_assignment" },
          { label: "Stale return", value: "stale_return_visit" }
        ],
        title: "Dispatcher focus"
      };
    case "admin":
      return {
        defaultValue: "stale_approval",
        entries: [
          { label: "Stale approvals", value: "stale_approval" },
          { label: "Ready dispatch", value: "ready_dispatch" },
          { label: "Readiness risk", value: "readiness_risk" }
        ],
        title: "Admin follow-through"
      };
    case "owner":
      return {
        defaultValue: "readiness_risk",
        entries: [
          { label: "Readiness risk", value: "readiness_risk" },
          { label: "Billing follow-up", value: "billing_follow_up" },
          { label: "Live now", value: "live" }
        ],
        title: "Owner oversight"
      };
    default:
      return {
        defaultValue: "promise_risk",
        entries: [
          { label: "Promise risk", value: "promise_risk" },
          { label: "Needs assignment", value: "needs_assignment" },
          { label: "Stale approvals", value: "stale_approval" }
        ],
        title: "Visits focus"
      };
  }
}

export function getFinanceRoleFocus(role: string | undefined): FocusConfig<OfficeFinanceFocusStage> {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        defaultValue: "ready_release",
        entries: [
          { label: "Ready release", value: "ready_release" },
          { label: "Collect now", value: "collect_now" },
          { label: "Reminder due", value: "reminder_due" }
        ],
        title: "Dispatcher closeout"
      };
    case "admin":
      return {
        defaultValue: "reminder_due",
        entries: [
          { label: "Reminder due", value: "reminder_due" },
          { label: "Collect now", value: "collect_now" },
          { label: "Partial follow-up", value: "partial_follow_up" }
        ],
        title: "Admin collections"
      };
    case "owner":
      return {
        defaultValue: "aged_risk",
        entries: [
          { label: "Aged risk", value: "aged_risk" },
          { label: "Reminder due", value: "reminder_due" },
          { label: "Ready release", value: "ready_release" }
        ],
        title: "Owner revenue risk"
      };
    default:
      return {
        defaultValue: "collect_now",
        entries: [
          { label: "Collect now", value: "collect_now" },
          { label: "Reminder due", value: "reminder_due" },
          { label: "Aged risk", value: "aged_risk" }
        ],
        title: "Finance focus"
      };
  }
}

export function getCustomerRoleFocus(role: string | undefined): FocusConfig<OfficeCustomerFocusSegment> {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        defaultValue: "recent",
        entries: [
          { label: "Recent activity", value: "recent" },
          { label: "Needs location", value: "needs-address" },
          { label: "No vehicle", value: "no-vehicle" }
        ],
        title: "Dispatcher relationship focus"
      };
    case "admin":
      return {
        defaultValue: "needs-contact",
        entries: [
          { label: "Needs contact", value: "needs-contact" },
          { label: "Needs location", value: "needs-address" },
          { label: "No vehicle", value: "no-vehicle" }
        ],
        title: "Admin record cleanup"
      };
    case "owner":
      return {
        defaultValue: "recent",
        entries: [
          { label: "Recent activity", value: "recent" },
          { label: "Multi-vehicle", value: "multi-vehicle" },
          { label: "Inactive", value: "inactive" }
        ],
        title: "Owner relationship view"
      };
    default:
      return {
        defaultValue: "recent",
        entries: [
          { label: "Recent activity", value: "recent" },
          { label: "Needs contact", value: "needs-contact" },
          { label: "No vehicle", value: "no-vehicle" }
        ],
        title: "Customer focus"
      };
  }
}

export function getVisitDrawerRoleFocus(role: string | undefined): {
  sectionOrder: VisitDrawerSection[];
  title: string;
} {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        sectionOrder: [
          "customer_updates",
          "promise_readiness",
          "exception_ownership",
          "follow_up",
          "recent_status",
          "commercial_state",
          "recent_activity",
          "workspace_links"
        ],
        title: "Dispatcher drawer"
      };
    case "admin":
      return {
        sectionOrder: [
          "commercial_state",
          "exception_ownership",
          "customer_updates",
          "follow_up",
          "promise_readiness",
          "recent_activity",
          "recent_status",
          "workspace_links"
        ],
        title: "Admin follow-through"
      };
    case "owner":
      return {
        sectionOrder: [
          "exception_ownership",
          "promise_readiness",
          "commercial_state",
          "follow_up",
          "recent_activity",
          "customer_updates",
          "recent_status",
          "workspace_links"
        ],
        title: "Owner oversight"
      };
    default:
      return {
        sectionOrder: [
          "promise_readiness",
          "customer_updates",
          "commercial_state",
          "exception_ownership",
          "follow_up",
          "recent_activity",
          "recent_status",
          "workspace_links"
        ],
        title: "Visit drawer"
      };
  }
}

export function getFinanceDetailRoleFocus(role: string | undefined): {
  sectionOrder: FinanceDetailSection[];
  title: string;
} {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        sectionOrder: [
          "next_move",
          "customer_updates",
          "service_thread",
          "follow_up",
          "exception_ownership",
          "commercial_state",
          "recent_activity"
        ],
        title: "Dispatcher closeout"
      };
    case "admin":
      return {
        sectionOrder: [
          "next_move",
          "exception_ownership",
          "service_thread",
          "customer_updates",
          "follow_up",
          "commercial_state",
          "recent_activity"
        ],
        title: "Admin collections"
      };
    case "owner":
      return {
        sectionOrder: [
          "exception_ownership",
          "next_move",
          "service_thread",
          "commercial_state",
          "recent_activity",
          "follow_up",
          "customer_updates"
        ],
        title: "Owner revenue risk"
      };
    default:
      return {
        sectionOrder: [
          "next_move",
          "exception_ownership",
          "service_thread",
          "commercial_state",
          "customer_updates",
          "recent_activity",
          "follow_up"
        ],
        title: "Collections file"
      };
  }
}

export function getCustomerInspectorRoleFocus(role: string | undefined): {
  sectionOrder: CustomerInspectorSection[];
  title: string;
} {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        sectionOrder: ["quick_actions", "service_location", "record_health", "lifecycle"],
        title: "Dispatcher support rail"
      };
    case "admin":
      return {
        sectionOrder: ["record_health", "quick_actions", "service_location", "lifecycle"],
        title: "Admin cleanup rail"
      };
    case "owner":
      return {
        sectionOrder: ["quick_actions", "record_health", "service_location", "lifecycle"],
        title: "Owner relationship rail"
      };
    default:
      return {
        sectionOrder: ["quick_actions", "service_location", "record_health", "lifecycle"],
        title: "Customer inspector"
      };
  }
}

export function getVisitActionLabels(role: string | undefined): VisitActionLabels {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        appointment: "Confirm timing",
        dispatched: "Send dispatch notice",
        enRoute: "Send en-route notice",
        estimate: "Send approval chase",
        invoice: "Send billing notice",
        reminder: "Send payment nudge"
      };
    case "admin":
      return {
        appointment: "Send appointment confirmation",
        dispatched: "Send dispatched update",
        enRoute: "Send en-route update",
        estimate: "Chase approval",
        invoice: "Send billing notice",
        reminder: "Push payment follow-up"
      };
    case "owner":
      return {
        appointment: "Confirm promise",
        dispatched: "Send dispatch update",
        enRoute: "Send arrival update",
        estimate: "Review approval notice",
        invoice: "Send invoice notice",
        reminder: "Escalate payment follow-up"
      };
    default:
      return {
        appointment: "Send appointment confirmation",
        dispatched: "Send dispatched update",
        enRoute: "Send en-route update",
        estimate: "Send estimate notification",
        invoice: "Send invoice notification",
        reminder: "Send payment reminder"
      };
  }
}

export function getFinanceActionLabels(role: string | undefined): FinanceActionLabels {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        invoice: "Send release notice",
        reminder: "Send payment nudge",
        primaryAction: "invoice"
      };
    case "admin":
      return {
        invoice: "Resend invoice",
        reminder: "Send reminder now",
        primaryAction: "reminder"
      };
    case "owner":
      return {
        invoice: "Resend invoice",
        reminder: "Escalate reminder",
        primaryAction: "reminder"
      };
    default:
      return {
        invoice: "Send invoice",
        reminder: "Send reminder",
        primaryAction: "reminder"
      };
  }
}

export function getCustomerActionLabels(role: string | undefined): CustomerActionLabels {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return {
        addAddress: "Add service location",
        addVehicle: "Add customer vehicle",
        editCustomer: "Update contact",
        estimate: "Draft quote",
        visit: "Start routed visit"
      };
    case "admin":
      return {
        addAddress: "Fix service location",
        addVehicle: "Add missing customer vehicle",
        editCustomer: "Fix customer record",
        estimate: "Start approval thread",
        visit: "Start service visit"
      };
    case "owner":
      return {
        addAddress: "Add service location",
        addVehicle: "Add customer vehicle",
        editCustomer: "Review customer record",
        estimate: "Create revenue quote",
        visit: "Start new visit"
      };
    default:
      return {
        addAddress: "Add service location",
        addVehicle: "Add customer vehicle",
        editCustomer: "Edit customer",
        estimate: "New estimate",
        visit: "New visit"
      };
  }
}

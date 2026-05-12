export type DashboardWalkthroughStep = {
  body: string;
  ctaLabel?: string;
  href: string;
  id: string;
  label: string;
  title: string;
};

export const dashboardWalkthroughSteps: readonly DashboardWalkthroughStep[] = [
  {
    body: "Start on the owner home view. This is the quickest place to see what needs attention first.",
    href: "/dashboard",
    id: "today-brief",
    label: "Dashboard",
    title: "Open Today brief"
  },
  {
    body: "Review the exception summary before opening individual jobs. It points to overdue, blocked, or high-value work.",
    href: "/dashboard",
    id: "exceptions",
    label: "Dashboard",
    title: "Read the priority signals"
  },
  {
    body: "Use the live work columns to understand which visits need dispatch, which are in progress, and which need billing.",
    href: "/dashboard",
    id: "work-columns",
    label: "Dashboard",
    title: "Scan live work"
  },
  {
    body: "Use the left sidebar as the main map. Dispatch, Visits, Customers, Fleet, Supply, Finance, Reports, and Settings each own a clear job.",
    href: "/dashboard",
    id: "sidebar",
    label: "Navigation",
    title: "Use the sidebar"
  },
  {
    body: "Focus on the Today brief page title, date badge, and owner summary. This step is about the dashboard home view, not a quick action shortcut.",
    ctaLabel: "Open Today brief",
    href: "/dashboard",
    id: "return-home",
    label: "Dashboard",
    title: "Read Today brief"
  },
  {
    body: "Open Dispatch when you need to schedule, assign, or rebalance technician work.",
    href: "/dashboard/dispatch",
    id: "dispatch-open",
    label: "Dispatch",
    title: "Open Dispatch"
  },
  {
    body: "Use the date, view, and worker filters to narrow the board before making schedule changes.",
    href: "/dashboard/dispatch",
    id: "dispatch-filters",
    label: "Dispatch",
    title: "Filter the schedule"
  },
  {
    body: "Click a job to open its drawer. The top of the drawer focuses on customer, vehicle, estimate, schedule, and assignment.",
    href: "/dashboard/dispatch",
    id: "dispatch-drawer",
    label: "Dispatch",
    title: "Open a job drawer"
  },
  {
    body: "Adjust technician, start time, and arrival window from the schedule area, then save the assignment.",
    href: "/dashboard/dispatch",
    id: "dispatch-schedule",
    label: "Dispatch",
    title: "Schedule and assign"
  },
  {
    body: "Open advanced dispatch details only when you need route confidence, follow-up lifecycle, invoices, inspections, or history.",
    href: "/dashboard/dispatch",
    id: "dispatch-advanced",
    label: "Dispatch",
    title: "Use advanced details"
  },
  {
    body: "Open Visits to see the service queue, estimates, approvals, and work that needs follow-through.",
    href: "/dashboard/visits",
    id: "visits-open",
    label: "Visits",
    title: "Open Visits"
  },
  {
    body: "Use New Visit when a customer needs a new estimate, appointment, or service record.",
    href: "/dashboard/visits/new",
    id: "new-visit",
    label: "Visits",
    title: "Start a visit"
  },
  {
    body: "Enter or select the customer first so vehicle, service history, and contact context stay attached.",
    href: "/dashboard/visits/new",
    id: "customer-info",
    label: "Intake",
    title: "Add customer info"
  },
  {
    body: "Select the vehicle next. Confirm year, make, model, VIN, and any available history before building the estimate.",
    href: "/dashboard/visits/new",
    id: "vehicle-info",
    label: "Intake",
    title: "Add vehicle info"
  },
  {
    body: "Capture the customer concern in plain language. This becomes the anchor for the estimate and technician handoff.",
    href: "/dashboard/visits/new",
    id: "concern",
    label: "Intake",
    title: "Record the concern"
  },
  {
    body: "Choose or save the service location so scheduling and route context have the correct address.",
    href: "/dashboard/visits/new",
    id: "service-location",
    label: "Intake",
    title: "Save service location"
  },
  {
    body: "Use schedule later if the estimate should be created before the appointment is confirmed.",
    href: "/dashboard/visits/new",
    id: "schedule-later",
    label: "Intake",
    title: "Schedule later when needed"
  },
  {
    body: "Use assign later if the office needs to build and send the estimate before choosing a technician.",
    href: "/dashboard/visits/new",
    id: "assign-later",
    label: "Intake",
    title: "Assign later when needed"
  },
  {
    body: "Open the estimate workspace from the visit when you are ready to add repair lines and pricing.",
    href: "/dashboard/estimates",
    id: "estimate-workspace",
    label: "Estimate",
    title: "Open the estimate"
  },
  {
    body: "Group work into clear repair sections so the customer can understand what is being recommended.",
    href: "/dashboard/estimates",
    id: "estimate-sections",
    label: "Estimate",
    title: "Create repair sections"
  },
  {
    body: "Add labor and parts lines with prices before sending. Keep customer-facing descriptions direct.",
    href: "/dashboard/estimates",
    id: "estimate-lines",
    label: "Estimate",
    title: "Add labor and parts"
  },
  {
    body: "Review totals, taxes, and any notes before sending the estimate link to the customer.",
    href: "/dashboard/estimates",
    id: "estimate-review",
    label: "Estimate",
    title: "Review estimate totals"
  },
  {
    body: "Use Send estimate when the customer needs the approval link. The estimate can also be opened directly when a link exists.",
    href: "/dashboard/estimates",
    id: "estimate-send",
    label: "Estimate",
    title: "Send the estimate"
  },
  {
    body: "Watch estimate status so approved, declined, and waiting states are visible without digging through the job.",
    href: "/dashboard/estimates",
    id: "estimate-status",
    label: "Estimate",
    title: "Track approval status"
  },
  {
    body: "Open Customers when you need relationship history, saved addresses, vehicles, or contact details.",
    href: "/dashboard/customers",
    id: "customers",
    label: "Customers",
    title: "Open Customers"
  },
  {
    body: "Use the customer workspace to review vehicles, past visits, service history, and current open work.",
    href: "/dashboard/customers",
    id: "customer-workspace",
    label: "Customers",
    title: "Review customer context"
  },
  {
    body: "Open Fleet to review technician readiness, route capacity, and active vehicle availability.",
    href: "/dashboard/fleet",
    id: "fleet",
    label: "Fleet",
    title: "Review fleet readiness"
  },
  {
    body: "Open Supply when parts requests, carts, purchase orders, or inventory blockers need attention.",
    href: "/dashboard/supply",
    id: "supply",
    label: "Supply",
    title: "Review supply work"
  },
  {
    body: "Open Finance to follow invoices, payment reminders, and closeout work after service is complete.",
    href: "/dashboard/finance",
    id: "finance",
    label: "Finance",
    title: "Review finance follow-through"
  },
  {
    body: "Use invoice actions to send payment links, track payment status, and keep closeout moving.",
    href: "/dashboard/invoices",
    id: "invoices",
    label: "Finance",
    title: "Handle invoices"
  },
  {
    body: "Open Reports when you need throughput, revenue, and operating signal instead of individual job details.",
    href: "/dashboard/reports",
    id: "reports",
    label: "Reports",
    title: "Review reports"
  },
  {
    body: "Open Settings for communications, integrations, data imports, and company setup.",
    href: "/dashboard/settings",
    id: "settings",
    label: "Settings",
    title: "Review settings"
  },
  {
    body: "When unsure, return to Today brief, then choose the next workspace based on the job: schedule in Dispatch, build in Visits or Estimates, collect in Finance.",
    href: "/dashboard",
    id: "finish",
    label: "Finish",
    title: "Complete the walkthrough"
  }
] as const;

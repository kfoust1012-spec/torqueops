import { Badge, Page, PageHeader } from "../../../components/ui";
import { dashboardWalkthroughSteps } from "../../../lib/dashboard/walkthrough";
import { DashboardWalkthrough } from "./_components/dashboard-walkthrough";

export default function DashboardWalkthroughPage() {
  return (
    <Page>
      <PageHeader
        description="Move through the core office workflow one step at a time. The walkthrough always allows manual next, back, and direct step selection."
        eyebrow="Product walkthrough"
        status={<Badge tone="brand">{dashboardWalkthroughSteps.length} steps</Badge>}
        title="TorqueOps walkthrough"
      />

      <DashboardWalkthrough steps={dashboardWalkthroughSteps} />
    </Page>
  );
}

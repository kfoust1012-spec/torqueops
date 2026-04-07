import Link from "next/link";

import { EmptyState, Page, buttonClassName } from "../../components/ui";

export default function DashboardNotFoundPage() {
  return (
    <Page className="ui-route-state-page">
      <EmptyState
        actions={
          <Link className={buttonClassName()} href="/dashboard">
            Back to overview
          </Link>
        }
        className="ui-route-state"
        description="The requested dashboard record or desk route could not be found. It may have been removed, renamed, or never created."
        eyebrow="Not found"
        title="This desk route is unavailable"
        tone="info"
      />
    </Page>
  );
}

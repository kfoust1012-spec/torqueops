import Link from "next/link";

import { EmptyState, buttonClassName } from "../components/ui";

export default function AppNotFoundPage() {
  return (
    <main className="page-shell">
      <EmptyState
        actions={
          <Link className={buttonClassName()} href="/login">
            Back to login
          </Link>
        }
        className="ui-route-state"
        description="The page you requested does not exist or is no longer available from this session."
        eyebrow="Not found"
        title="This route could not be located"
        tone="info"
      />
    </main>
  );
}

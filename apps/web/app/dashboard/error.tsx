"use client";

import Link from "next/link";

import { Button, ErrorState, Page, buttonClassName } from "../../components/ui";

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ reset }: DashboardErrorPageProps) {
  return (
    <Page className="ui-route-state-page">
      <ErrorState
        actions={
          <>
            <Button onClick={reset} type="button">
              Try again
            </Button>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard">
              Back to overview
            </Link>
          </>
        }
        className="ui-route-state ui-route-state--error"
        description="The current desk could not finish loading. Try again or return to the operating overview."
        eyebrow="Desk error"
        title="This desk failed to load"
      />
    </Page>
  );
}

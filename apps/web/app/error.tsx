"use client";

import Link from "next/link";

import { Button, ErrorState, buttonClassName } from "../components/ui";

type AppErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppErrorPage({ reset }: AppErrorPageProps) {
  return (
    <main className="page-shell">
      <ErrorState
        actions={
          <>
            <Button onClick={reset} type="button">
              Try again
            </Button>
            <Link className={buttonClassName({ tone: "secondary" })} href="/login">
              Go to login
            </Link>
          </>
        }
        className="ui-route-state ui-route-state--error"
        description="This route could not finish loading. Try again or reopen the session from login."
        eyebrow="Application error"
        title="This view hit an unexpected failure"
      />
    </main>
  );
}

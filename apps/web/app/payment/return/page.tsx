import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonClassName } from "../../../components/ui";
import { getAuthenticatedUser } from "../../../lib/auth";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { buildVisitInvoiceHref } from "../../../lib/visits/workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Payment return"
};

type PaymentReturnPageProps = {
  searchParams: Promise<{
    checkout?: string;
    jobId?: string;
    surface?: string;
    token?: string;
  }>;
};

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const { checkout, jobId, surface, token } = await searchParams;
  const checkoutState = checkout === "success" ? "success" : "canceled";
  const title = checkoutState === "success" ? "Payment submitted" : "Payment canceled";
  const followUpCopy =
    checkoutState === "success"
      ? "If the invoice still shows a balance due after a short delay, reopen the original invoice link and refresh there before attempting another payment."
      : "You can safely return to the invoice link when you are ready. No payment was recorded from this attempt.";

  if (surface === "public" && token) {
    redirect(`/invoice/${token}?checkout=${checkoutState}`);
  }

  if (surface === "office") {
    const supabase = await createServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);

    if (user && jobId) {
      redirect(buildVisitInvoiceHref(jobId, { checkout: checkoutState }));
    }

    return (
      <main className="page-shell">
        <section className="panel customer-document-panel">
          <p className="eyebrow">Payment</p>
          <h1 className="title">{title}</h1>
          <p className="copy">
            {checkoutState === "success"
              ? "Your payment was submitted. Sign in to the dashboard to confirm the final reconciled status."
              : "No payment was completed. Sign in to the dashboard when you are ready to try again."}
          </p>
          <p className="copy">{followUpCopy}</p>
          <div className="header-actions">
            <Link className={buttonClassName()} href="/login">
              Sign in to dashboard
            </Link>
            {token ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={`/invoice/${token}`}>
                Open invoice link
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (token) {
    redirect(`/invoice/${token}?checkout=${checkoutState}`);
  }

  const supabase = await createServerSupabaseClient();
  const user = await getAuthenticatedUser(supabase);

  if (user && jobId) {
    redirect(buildVisitInvoiceHref(jobId, { checkout: checkoutState }));
  }

  return (
    <main className="page-shell">
      <section className="panel customer-document-panel">
        <p className="eyebrow">Payment</p>
        <h1 className="title">{title}</h1>
        <p className="copy">
          {checkoutState === "success"
            ? "Your payment was submitted. Return to the invoice link or dashboard to confirm the final reconciled status."
            : "No payment was completed. Return to the invoice link or dashboard when you are ready to try again."}
        </p>
        <p className="copy">{followUpCopy}</p>
        <div className="header-actions">
          {token ? (
            <Link className={buttonClassName()} href={`/invoice/${token}`}>
              Return to invoice
            </Link>
          ) : null}
          <Link className={buttonClassName({ tone: token ? "secondary" : "primary" })} href="/login">
            Sign in to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatDesignLabel } from "@mobile-mechanic/core";

import { DashboardMobileNav } from "../../components/dashboard-mobile-nav";
import { DashboardShellNav } from "../../components/dashboard-shell-nav";
import { AdminShell, Badge, EmptyState, buttonClassName } from "../../components/ui";
import { getCompanyContextResult } from "../../lib/company-context";
import { getOfficeHomeWorkspace } from "../../lib/office-workspace-focus";
import { createServerSupabaseClient } from "../../lib/supabase/server";

type DashboardLayoutProps = {
  children: ReactNode;
};

function getCompanyInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");

  return initials || "MM";
}

function getCompanyTimeZoneLabel(timeZone: string | null) {
  if (!timeZone) {
    return "Time zone not set";
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short"
    });
    const timeZoneName = formatter.formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;

    if (timeZoneName) {
      return timeZoneName;
    }
  } catch {
    // Fall back to a readable zone label if Intl cannot format the provided zone.
  }

  return timeZone.split("/").at(-1)?.replace(/_/g, " ") ?? timeZone;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const result = await getCompanyContextResult({ requireOfficeAccess: true });

  async function signOutAction() {
    "use server";

    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "no-company") {
    return (
      <main className="page-shell">
        <EmptyState
          actions={
            <form action={signOutAction}>
              <button className={buttonClassName({ tone: "tertiary" })} type="submit">
                Sign out
              </button>
            </form>
          }
          className="ui-route-state"
          description="Your account is authenticated, but it does not have an active office membership yet."
          eyebrow="Setup required"
          title="No company access yet"
          tone="warning"
        />
      </main>
    );
  }

  if (result.status === "forbidden") {
    return (
      <main className="page-shell">
        <EmptyState
          actions={
            <form action={signOutAction}>
              <button className={buttonClassName({ tone: "secondary" })} type="submit">
                Sign out
              </button>
            </form>
          }
          className="ui-route-state"
          description="The web dashboard is limited to owners, admins, and dispatchers. Mobile field workflows stay in the mobile app."
          eyebrow="Office access required"
          title="Use the technician mobile app"
          tone="warning"
        />
      </main>
    );
  }

  const { company, currentUser, membership, profile } = result.context;
  const companyInitials = getCompanyInitials(company.name);
  const operatorName = profile.full_name ?? profile.email ?? currentUser.email ?? "Office user";
  const membershipLabel = formatDesignLabel(membership.role);
  const operatorEmail = profile.email ?? currentUser.email ?? "No email on file";
  const companyTimeZone = getCompanyTimeZoneLabel(company.timezone);
  const homeWorkspace = getOfficeHomeWorkspace(membership.role);

  return (
    <AdminShell
      mobileNav={<DashboardMobileNav operatorRole={membership.role} />}
      operatorRole={membership.role}
      sidebar={
        <>
          <div className="ui-admin-sidebar__top">
            <Link aria-label={company.name} className="ui-admin-brand" href={homeWorkspace.href} title={company.name}>
              <span aria-hidden className="ui-admin-brand__mark">
                {companyInitials}
              </span>
              <span className="ui-admin-brand__copy">
                <span className="ui-admin-brand__eyebrow">Mobile mechanic ops</span>
                <span className="ui-admin-brand__title" title={company.name}>
                  {company.name}
                </span>
              </span>
            </Link>

            <div className="ui-admin-sidebar__utility">
              <p className="ui-admin-sidebar__caption">Home: {homeWorkspace.label}</p>
              <div className="ui-admin-sidebar__utility-badges">
                <Badge tone="brand">{membershipLabel}</Badge>
                <Badge tone="neutral">{companyTimeZone}</Badge>
              </div>
            </div>
          </div>

          <div className="ui-admin-sidebar__nav-block">
            <DashboardShellNav operatorRole={membership.role} />
          </div>

          <div className="ui-admin-sidebar__footer">
            <div className="ui-admin-sidebar__account" title={`${operatorName} · ${operatorEmail}`}>
              <p className="ui-admin-sidebar__account-label">Signed in</p>
              <p className="ui-admin-sidebar__account-value" title={operatorName}>
                {operatorName}
              </p>
              <p className="ui-admin-sidebar__account-meta" title={operatorEmail}>
                {operatorEmail}
              </p>
            </div>
            <form action={signOutAction} className="ui-admin-sidebar__utility-action">
              <button className={buttonClassName({ size: "sm", tone: "ghost" })} type="submit">
                Sign out
              </button>
            </form>
          </div>
        </>
      }
    >
      {children}
    </AdminShell>
  );
}

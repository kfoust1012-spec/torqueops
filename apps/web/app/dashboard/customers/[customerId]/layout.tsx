import { getCustomerById } from "@mobile-mechanic/api-client";
import { formatDesignLabel, getCustomerDisplayName } from "@mobile-mechanic/core";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { requireCompanyContext } from "../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { CustomerRecordShell } from "./_components/customer-record-shell";

type CustomerRecordLayoutProps = {
  children: ReactNode;
  params: Promise<{
    customerId: string;
  }>;
};

export default async function CustomerRecordLayout({ children, params }: CustomerRecordLayoutProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { customerId } = await params;
  const customerResult = await getCustomerById(context.supabase, customerId);

  if (customerResult.error || !customerResult.data || customerResult.data.companyId !== context.companyId) {
    notFound();
  }

  const customer = customerResult.data;
  const customerName = getCustomerDisplayName(customer);

  return (
    <>
      <CustomerRecordShell
        customerName={customerName}
        historyHref={buildCustomerWorkspaceHref(customer.id, { mode: "workspace", tab: "history" })}
        promiseRiskHref={`/dashboard/visits?scope=promise_risk&query=${encodeURIComponent(customerName)}`}
        statusLabel={formatDesignLabel(customer.isActive ? "active" : "archived")}
        workspaceHref={buildCustomerWorkspaceHref(customer.id, { mode: "workspace", tab: "summary" })}
      />
      {children}
    </>
  );
}
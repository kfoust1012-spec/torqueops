import { redirect } from "next/navigation";

import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";

type EditCustomerPageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { customerId } = await params;

  redirect(buildCustomerWorkspaceHref(customerId, { mode: "workspace", editCustomer: true }));
}

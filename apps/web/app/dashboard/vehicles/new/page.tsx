import { redirect } from "next/navigation";

import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";

type NewVehiclePageProps = {
  searchParams?: Promise<{
    customerId?: string | string[];
  }>;
};

export default async function NewVehiclePage({ searchParams }: NewVehiclePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const customerId =
    typeof resolvedSearchParams.customerId === "string"
      ? resolvedSearchParams.customerId
      : null;

  if (customerId) {
    redirect(
      buildCustomerWorkspaceHref(customerId, {
        mode: "workspace",
        newVehicle: true,
        tab: "vehicles"
      })
    );
  }

  redirect("/dashboard/customers");
}

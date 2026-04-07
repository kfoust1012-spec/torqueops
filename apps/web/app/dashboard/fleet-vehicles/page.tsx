import { redirect } from "next/navigation";

type FleetVehiclesPageProps = {
  searchParams?: Promise<{
    date?: string | string[];
    query?: string | string[];
    status?: string | string[];
    technicianId?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function FleetVehiclesPage({ searchParams }: FleetVehiclesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = new URLSearchParams({ panel: "units" });
  const date = readSearchParam(resolvedSearchParams.date);
  const query = readSearchParam(resolvedSearchParams.query);
  const status = readSearchParam(resolvedSearchParams.status);
  const technicianId = readSearchParam(resolvedSearchParams.technicianId);

  if (date) {
    params.set("date", date);
  }

  if (query) {
    params.set("query", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (technicianId) {
    params.set("technicianId", technicianId);
  }

  redirect(`/dashboard/fleet?${params.toString()}`);
}

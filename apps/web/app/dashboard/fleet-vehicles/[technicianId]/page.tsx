import { redirect } from "next/navigation";

type FleetVehicleProfilePageProps = {
  params: Promise<{
    technicianId: string;
  }>;
  searchParams?: Promise<{
    date?: string | string[];
    query?: string | string[];
    status?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function FleetVehicleProfilePage({
  params,
  searchParams
}: FleetVehicleProfilePageProps) {
  const { technicianId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams({
    panel: "units",
    technicianId
  });
  const date = readSearchParam(resolvedSearchParams.date);
  const filterQuery = readSearchParam(resolvedSearchParams.query);
  const status = readSearchParam(resolvedSearchParams.status);

  if (date) {
    query.set("date", date);
  }

  if (filterQuery) {
    query.set("query", filterQuery);
  }

  if (status) {
    query.set("status", status);
  }

  redirect(`/dashboard/fleet?${query.toString()}`);
}

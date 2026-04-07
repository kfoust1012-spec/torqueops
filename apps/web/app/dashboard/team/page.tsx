import { redirect } from "next/navigation";

type TeamPageProps = {
  searchParams?: Promise<{
    query?: string | string[];
    status?: string | string[];
    technicianId?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = new URLSearchParams({ panel: "team" });
  const query = readSearchParam(resolvedSearchParams.query);
  const status = readSearchParam(resolvedSearchParams.status);
  const technicianId = readSearchParam(resolvedSearchParams.technicianId);

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

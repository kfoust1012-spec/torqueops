export const procurementWorkspaceViews = [
  "requests",
  "attention",
  "carts",
  "orders",
  "setup"
] as const;

export type ProcurementWorkspaceView = (typeof procurementWorkspaceViews)[number];

type SearchParamValue = string | string[] | undefined;

export function readSingleSearchParam(value: SearchParamValue) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

export function resolveProcurementWorkspaceView(
  value: SearchParamValue,
  fallback: ProcurementWorkspaceView
): ProcurementWorkspaceView {
  const resolved = readSingleSearchParam(value);

  return procurementWorkspaceViews.includes(resolved as ProcurementWorkspaceView)
    ? (resolved as ProcurementWorkspaceView)
    : fallback;
}

export function buildProcurementWorkspaceHref(options: {
  view?: ProcurementWorkspaceView | undefined;
} = {}) {
  const searchParams = new URLSearchParams();

  if (options.view) {
    searchParams.set("view", options.view);
  }

  const serialized = searchParams.toString();
  const basePath = "/dashboard/supply";

  return serialized ? `${basePath}?${serialized}` : basePath;
}

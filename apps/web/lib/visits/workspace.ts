type VisitSearchParamValue = string | number | boolean | null | undefined;

export type VisitWorkspaceLinkOptions = {
  returnLabel?: string | null;
  returnScope?: string | null;
  returnTo?: string | null;
};

type VisitThreadLinkOptions = VisitWorkspaceLinkOptions & {
  scope?: string;
};

export function normalizeVisitReturnTo(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (
    !trimmed ||
    (!trimmed.startsWith("/dashboard/") &&
      !trimmed.startsWith("/dashboard?") &&
      trimmed !== "/dashboard")
  ) {
    return null;
  }

  return trimmed;
}

function normalizeVisitReturnLabel(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function buildVisitReturnSearchParams(options?: VisitWorkspaceLinkOptions) {
  return {
    returnLabel: normalizeVisitReturnLabel(options?.returnLabel),
    returnScope: options?.returnScope,
    returnTo: normalizeVisitReturnTo(options?.returnTo)
  };
}

function buildVisitWorkspaceHref(
  jobId: string,
  suffix = "",
  searchParams?: Record<string, VisitSearchParamValue>
) {
  const basePath = `/dashboard/visits/${jobId}${suffix}`;

  if (!searchParams) {
    return basePath;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === null || value === undefined || value === false || value === "") {
      continue;
    }

    params.set(key, value === true ? "1" : String(value));
  }

  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function buildVisitDetailHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitThreadHref(
  jobId: string,
  options?: VisitThreadLinkOptions
) {
  const params = new URLSearchParams();
  params.set("jobId", jobId);

  const nextScope = options?.scope?.trim();
  if (nextScope) {
    params.set("scope", nextScope);
  }

  const returnTo = normalizeVisitReturnTo(options?.returnTo);
  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  const returnLabel = normalizeVisitReturnLabel(options?.returnLabel);
  if (returnLabel) {
    params.set("returnLabel", returnLabel);
  }

  return `/dashboard/visits?${params.toString()}`;
}

export function buildVisitReturnThreadHref(
  jobId: string,
  returnScope?: string | null,
  options?: VisitWorkspaceLinkOptions
) {
  return returnScope
    ? buildVisitThreadHref(jobId, { ...options, scope: returnScope })
    : buildVisitThreadHref(jobId, options);
}

export function buildVisitEstimateThreadHref(
  jobId: string,
  scope: "approved_release" | "awaiting_approval" | "estimate_drafting" | "stale_approval" = "estimate_drafting"
) {
  return buildVisitThreadHref(jobId, { scope });
}

export function buildVisitBillingThreadHref(jobId: string) {
  return buildVisitThreadHref(jobId, { scope: "billing_follow_up" });
}

export function buildVisitEditHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/edit", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitInspectionHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/inspection", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitEstimateHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions & {
    autostart?: boolean;
    workspace?: boolean;
  }
) {
  if (options?.workspace) {
    return buildVisitWorkspaceHref(jobId, "/estimate/workspace", {
      autostart: options.autostart,
      ...buildVisitReturnSearchParams(options)
    });
  }

  return buildVisitWorkspaceHref(jobId, "/estimate", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitInvoiceHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions & {
    checkout?: string;
  }
) {
  return buildVisitWorkspaceHref(jobId, "/invoice", {
    checkout: options?.checkout,
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitInvoiceEditHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/invoice/edit", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitInventoryHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/inventory", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitPartsHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/parts", {
    ...buildVisitReturnSearchParams(options)
  });
}

export function buildVisitPhotosHref(
  jobId: string,
  options?: VisitWorkspaceLinkOptions
) {
  return buildVisitWorkspaceHref(jobId, "/photos", {
    ...buildVisitReturnSearchParams(options)
  });
}

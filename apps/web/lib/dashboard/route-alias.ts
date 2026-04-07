type AliasSearchParamValue = string | string[] | undefined;

export function buildDashboardAliasHref(
  basePath: string,
  searchParams: Record<string, AliasSearchParamValue> = {},
  overrides: Record<string, AliasSearchParamValue | null> = {}
) {
  const params = new URLSearchParams();
  const mergedSearchParams = { ...searchParams, ...overrides };

  for (const [key, value] of Object.entries(mergedSearchParams)) {
    if (typeof value === "string") {
      if (value.length > 0) {
        params.append(key, value);
      }

      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry.length > 0) {
          params.append(key, entry);
        }
      }

      continue;
    }
  }

  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}
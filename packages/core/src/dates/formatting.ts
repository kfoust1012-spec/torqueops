type FormatDateTimeOptions = {
  fallback?: string;
  timeZone?: string | undefined;
  includeTimeZoneName?: boolean;
};

export function formatDateTime(
  value: string | null | undefined,
  options: FormatDateTimeOptions = {}
): string {
  const fallback = options.fallback ?? "Not set";

  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(options.includeTimeZoneName === false ? {} : { timeZoneName: "short" })
  }).format(new Date(value));
}

export function formatDateRange(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  options: FormatDateTimeOptions = {}
): string {
  const startLabel = formatDateTime(startAt, options);

  if (!startAt || !endAt) {
    return startLabel;
  }

  return `${startLabel} to ${formatDateTime(endAt, options)}`;
}

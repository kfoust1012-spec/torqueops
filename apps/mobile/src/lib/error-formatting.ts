type StructuredIssue = {
  message?: unknown;
  path?: unknown;
};

function formatIssuePath(path: string) {
  switch (path) {
    case "postalCode":
      return "ZIP";
    case "line1":
      return "Street address";
    default:
      return path;
  }
}

function normalizeIssueMessage(issue: StructuredIssue) {
  const rawMessage = typeof issue.message === "string" ? issue.message.trim() : "";

  if (!rawMessage) {
    return null;
  }

  const path =
    Array.isArray(issue.path) && issue.path.length
      ? issue.path
          .filter((segment): segment is string | number => typeof segment === "string" || typeof segment === "number")
          .join(".")
      : null;

  if (!path) {
    return rawMessage;
  }

  return `${formatIssuePath(path)}: ${rawMessage}`;
}

function parseStructuredIssues(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    const messages = parsed
      .map((issue) => normalizeIssueMessage((issue ?? {}) as StructuredIssue))
      .filter((message): message is string => Boolean(message));

    return messages.length ? messages.join("\n") : null;
  } catch {
    return null;
  }
}

export function formatErrorMessage(error: unknown, fallback: string) {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return parseStructuredIssues(error) ?? error;
  }

  if (error instanceof Error) {
    return parseStructuredIssues(error.message) ?? (error.message || fallback);
  }

  return fallback;
}

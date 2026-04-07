type ServerErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function normalizePart(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sentence(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

export function formatServerErrorMessage(value: unknown, fallbackMessage: string) {
  const parts: string[] = [];

  if (value instanceof Error) {
    const message = normalizePart(value.message);

    if (message && message !== fallbackMessage) {
      parts.push(`Reason: ${sentence(message)}`);
    }
  } else if (value && typeof value === "object") {
    const candidate = value as ServerErrorLike;
    const message = normalizePart(candidate.message);
    const details = normalizePart(candidate.details);
    const hint = normalizePart(candidate.hint);
    const code =
      typeof candidate.code === "string" || typeof candidate.code === "number"
        ? String(candidate.code).trim()
        : null;

    if (message && message !== fallbackMessage) {
      parts.push(`Reason: ${sentence(message)}`);
    }

    if (details) {
      parts.push(`Details: ${sentence(details)}`);
    }

    if (hint) {
      parts.push(`Hint: ${sentence(hint)}`);
    }

    if (code) {
      parts.push(`Code: ${code}.`);
    }
  } else {
    const message = normalizePart(value);

    if (message && message !== fallbackMessage) {
      parts.push(`Reason: ${sentence(message)}`);
    }
  }

  return parts.length ? `${sentence(fallbackMessage)} ${parts.join(" ")}` : sentence(fallbackMessage);
}

export function toServerError(value: unknown, fallbackMessage: string) {
  const error = new Error(formatServerErrorMessage(value, fallbackMessage));
  Object.defineProperty(error, "cause", {
    configurable: true,
    enumerable: false,
    value,
    writable: true
  });
  return error;
}

export function unwrapServerResult<T>(
  result: { error: unknown; data: T | null | undefined },
  fallbackMessage: string
) {
  if (result.error || result.data == null) {
    throw toServerError(result.error, fallbackMessage);
  }

  return result.data;
}

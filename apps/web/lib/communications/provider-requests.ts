const COMMUNICATION_PROVIDER_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMMUNICATION_PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readProviderPayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => null)) as Record<string, unknown> | null;
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text.trim() } : null;
}

export function getProviderRequestError(provider: "email" | "sms", error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(
      provider === "email"
        ? "Email delivery request timed out."
        : "SMS delivery request timed out."
    );
  }

  return error instanceof Error ? error : new Error("Communication delivery failed.");
}

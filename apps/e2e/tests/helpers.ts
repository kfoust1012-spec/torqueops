import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const officeCredentials = {
  email: process.env.E2E_OFFICE_EMAIL ?? "dispatch@northloopauto.com",
  password: process.env.E2E_OFFICE_PASSWORD ?? "Password123!"
};

export const technicianCredentials = {
  email: process.env.E2E_TECHNICIAN_EMAIL ?? "sam.tech@northloopauto.com",
  password: process.env.E2E_TECHNICIAN_PASSWORD ?? "Password123!"
};

export const alexTechnicianCredentials = {
  email: process.env.E2E_TECHNICIAN_ALEX_EMAIL ?? "alex.tech@northloopauto.com",
  password: process.env.E2E_TECHNICIAN_ALEX_PASSWORD ?? "Password123!"
};

export const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "http://127.0.0.1:3000";
export const mobileWebBaseUrl = process.env.E2E_MOBILE_BASE_URL ?? "http://127.0.0.1:19016";
const localWebEnvPath = path.resolve(process.cwd(), "..", "web", ".env.local");

const commandPalettePlaceholder =
  "Go to a visit, customer, VIN, plate, service site, invoice, or desk...";
const commandPaletteName = /Go to a visit, customer, VIN, plate, service site, invoice, or desk/i;

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readLocalWebEnvValue(key: string) {
  const envFile = fs.readFileSync(localWebEnvPath, "utf8");
  const line = envFile
    .split(/\r?\n/u)
    .find((currentLine) => currentLine.startsWith(`${key}=`));

  return line ? line.slice(`${key}=`.length).trim() : "";
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || readLocalWebEnvValue("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  readLocalWebEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || readLocalWebEnvValue("SUPABASE_SERVICE_ROLE_KEY");

type SupabaseSessionPayload = {
  access_token: string;
  user?: {
    id?: string;
  } | null;
};

type StoredSupabaseSessionValue = {
  rawValue: string;
  storageKey: string;
};

type SupabaseRestListOptions = {
  filters?: Record<string, string>;
  limit?: number;
  order?: string;
  select?: string;
};

function buildSupabaseServiceHeaders() {
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for e2e Supabase assertions.");
  }

  return {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`
  };
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildSupabaseAuthCookieName(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname;
  const hostPrefix = hostname === "localhost" ? "localhost" : hostname.split(".")[0] ?? hostname;

  return `sb-${hostPrefix}-auth-token`;
}

function encodeSupabaseSessionCookie(session: unknown) {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64")}`;
}

function normalizeSupabaseSessionPayload(value: unknown): SupabaseSessionPayload | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const session = normalizeSupabaseSessionPayload(entry);

      if (session) {
        return session;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.access_token === "string") {
    return {
      access_token: record.access_token,
      user:
        record.user && typeof record.user === "object"
          ? {
              id:
                typeof (record.user as Record<string, unknown>).id === "string"
                  ? ((record.user as Record<string, unknown>).id as string)
                  : undefined
            }
          : null
    };
  }

  if ("currentSession" in record) {
    return normalizeSupabaseSessionPayload(record.currentSession);
  }

  if ("session" in record) {
    return normalizeSupabaseSessionPayload(record.session);
  }

  return null;
}

function parseStoredSupabaseSession(rawValue: string) {
  try {
    const decodedValue = rawValue.startsWith("base64-")
      ? Buffer.from(rawValue.slice("base64-".length), "base64").toString("utf8")
      : rawValue;

    return normalizeSupabaseSessionPayload(JSON.parse(decodedValue));
  } catch {
    return null;
  }
}

export async function getAuthenticatedUserIdFromAuthCookie(page: Page, baseUrl: string = webBaseUrl) {
  const cookieName = buildSupabaseAuthCookieName(baseUrl);
  const cookies = await page.context().cookies(baseUrl);
  const authCookie = cookies.find((cookie) => cookie.name === cookieName);

  if (!authCookie) {
    throw new Error(`Missing Supabase auth cookie ${cookieName}.`);
  }

  const session = parseStoredSupabaseSession(authCookie.value);
  const userId =
    session?.user?.id ??
    (session?.access_token ? decodeJwtPayload(session.access_token)?.sub : null);

  if (typeof userId !== "string" || !userId) {
    throw new Error(`Could not resolve the authenticated user id from auth cookie ${cookieName}.`);
  }

  return userId;
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as
      | Record<string, unknown>
      | null;
  } catch {
    return null;
  }
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readStoredSupabaseSession(page: Page) {
  const storedValue = await page.evaluate(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    const authTokenKey = Object.keys(window.localStorage).find((key) =>
      /auth-token$/i.test(key)
    );

    if (!authTokenKey) {
      return null;
    }

    const rawValue = window.localStorage.getItem(authTokenKey);

    if (!rawValue) {
      return null;
    }

    return {
      rawValue,
      storageKey: authTokenKey
    };
  }) as StoredSupabaseSessionValue | null;

  if (!storedValue) {
    return null;
  }

  const session = parseStoredSupabaseSession(storedValue.rawValue);

  if (!session) {
    throw new Error(
      `Could not parse stored Supabase session from browser storage key ${storedValue.storageKey}.`
    );
  }

  return session;
}

async function waitForSupabaseSessionReadiness(session: SupabaseSessionPayload) {
  const jwtPayload = decodeJwtPayload(session.access_token);
  const issuedAtSeconds = typeof jwtPayload?.iat === "number" ? jwtPayload.iat : null;

  if (issuedAtSeconds) {
    const issuedAtMilliseconds = issuedAtSeconds * 1_000;
    const waitMilliseconds = issuedAtMilliseconds - Date.now();

    if (waitMilliseconds > 0) {
      await sleep(waitMilliseconds + 1_000);
    }
  }

  const userId =
    typeof jwtPayload?.sub === "string"
      ? jwtPayload.sub
      : typeof session.user?.id === "string"
        ? session.user.id
        : null;
  const query = new URLSearchParams({ limit: "1", select: "id" });

  if (userId) {
    query.set("id", `eq.${userId}`);
  }

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey
      },
      method: "GET"
    });
    const payload = await readJson(response);

    if (response.ok) {
      return;
    }

    const rejectionSummary = JSON.stringify(payload);

    if (/PGRST303|JWT issued at future/i.test(rejectionSummary)) {
      await sleep(500);
      continue;
    }

    throw new Error(
      `Supabase session was rejected by PostgREST: ${response.status} ${rejectionSummary}`
    );
  }

  throw new Error("Supabase session was still not accepted by PostgREST after waiting for clock skew.");
}

async function waitForStoredSupabaseSessionReadiness(page: Page) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const session = await readStoredSupabaseSession(page);

    if (session?.access_token) {
      await waitForSupabaseSessionReadiness(session);
      return;
    }

    await sleep(250);
  }

  throw new Error("Timed out waiting for the browser to persist a Supabase session.");
}

async function createSupabaseSession(credentials: { email: string; password: string }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify(credentials),
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        error_description?: string;
        msg?: string;
      }
    | null;

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error_description ?? payload?.msg ?? "Could not create Supabase session for e2e."
    );
  }

  const session = payload as SupabaseSessionPayload;
  await waitForSupabaseSessionReadiness(session);
  return session;
}

export function getUrlSearchParam(url: string, key: string) {
  return new URL(url).searchParams.get(key);
}

export async function listSupabaseRows<T extends Record<string, unknown>>(
  table: string,
  options: SupabaseRestListOptions = {}
) {
  const query = new URLSearchParams({
    select: options.select ?? "*"
  });

  if (options.order) {
    query.set("order", options.order);
  }

  if (typeof options.limit === "number") {
    query.set("limit", String(options.limit));
  }

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    query.set(key, value);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
    headers: buildSupabaseServiceHeaders(),
    method: "GET"
  });
  const payload = await readJson(response);

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(
      `Failed to read ${table} from Supabase: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload as T[];
}

export async function getSingleSupabaseRow<T extends Record<string, unknown>>(
  table: string,
  options: SupabaseRestListOptions & { label: string }
) {
  const rows = await listSupabaseRows<T>(table, {
    ...options,
    limit: options.limit ?? 1
  });

  if (rows.length !== 1) {
    throw new Error(`${options.label} expected 1 row in ${table}, found ${rows.length}.`);
  }

  return rows[0];
}

export async function patchSupabaseRows<T extends Record<string, unknown>>(
  table: string,
  options: {
    filters: Record<string, string>;
    payload: Record<string, unknown>;
  }
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(options.filters)) {
    query.set(key, value);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
    body: JSON.stringify(options.payload),
    headers: {
      ...buildSupabaseServiceHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    method: "PATCH"
  });
  const payload = await readJson(response);

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(
      `Failed to patch ${table} in Supabase: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload as T[];
}

export async function insertSupabaseRows<T extends Record<string, unknown>>(
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[]
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    body: JSON.stringify(payload),
    headers: {
      ...buildSupabaseServiceHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    method: "POST"
  });
  const inserted = await readJson(response);

  if (!response.ok || !Array.isArray(inserted)) {
    throw new Error(
      `Failed to insert ${table} in Supabase: ${response.status} ${JSON.stringify(inserted)}`
    );
  }

  return inserted as T[];
}

export async function loginOffice(page: Page) {
  const session = await createSupabaseSession(officeCredentials);

  await page.context().addCookies([
    {
      name: buildSupabaseAuthCookieName(webBaseUrl),
      sameSite: "Lax",
      url: webBaseUrl,
      value: encodeSupabaseSessionCookie(session)
    }
  ]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${webBaseUrl}/dashboard/dispatch`, { waitUntil: "domcontentloaded" });

    const workspaceError = page.getByText("The workspace hit an unexpected failure");

    try {
      await workspaceError.waitFor({ state: "visible", timeout: 2_000 });
    } catch {
      break;
    }

    if (attempt < 2) {
      const retryButton = page.getByRole("button", { name: "Try again" });
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
      }
    }
  }

  await expect(page).toHaveURL(/\/dashboard\/dispatch(?:\?.*)?$/);
}

export async function loginTechnician(
  page: Page,
  credentials: { email: string; password: string } = technicianCredentials
) {
  await page.goto(`${mobileWebBaseUrl}/login`);
  await page.getByPlaceholder("tech@shop.com").fill(credentials.email);
  await page.getByPlaceholder("Enter your password").fill(credentials.password);
  await page.getByText(/^Sign in$/).click();
  await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
  await waitForStoredSupabaseSessionReadiness(page);
}

export async function openCommandPalette(page: Page) {
  const commandButtons = page.getByRole("button", { name: /^Command$/ });
  const commandInput = page.getByRole("searchbox", { name: commandPaletteName });

  async function waitForPalette(timeout: number) {
    try {
      await commandInput.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }

  if (await waitForPalette(500)) {
    return commandInput;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (let index = 0; index < (await commandButtons.count()); index += 1) {
      const commandButton = commandButtons.nth(index);

      if (await commandButton.isVisible()) {
        await commandButton.click();

        if (await waitForPalette(2_000)) {
          return commandInput;
        }
      }
    }
  }

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");

  if (await waitForPalette(2_000)) {
    return commandInput;
  }

  await expect(commandInput).toBeVisible();
  return commandInput;
}

export async function chooseCommandResult(page: Page, text: string | RegExp) {
  const optionName =
    typeof text === "string" ? new RegExp(escapeForRegExp(text), "i") : text;
  const matchingResults = page.getByRole("option", { name: optionName });

  await expect
    .poll(async () => await matchingResults.count(), {
      message: `Waiting for command result matching ${String(text)}`,
      timeout: 30_000
    })
    .toBeGreaterThan(0);

  const result = matchingResults.first();
  await expect(result).toBeVisible();
  await result.click();
}

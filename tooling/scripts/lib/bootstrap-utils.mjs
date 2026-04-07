import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();
export const webEnvPath = path.join(repoRoot, "apps", "web", ".env.local");
const transientStorageErrorPattern =
  /\b502\b|upstream server|econnreset|fetch failed|networkerror|network error|aborted/i;
const storageReadyCache = new Set();

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

export function getBootstrapEnv() {
  const fileEnv = loadEnvFile(webEnvPath);

  return {
    ...fileEnv,
    ...process.env
  };
}

export function required(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required value: ${name}`);
  }

  return value.trim();
}

export function toSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extra
  };
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function readJson(response) {
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

export async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${url} failed: ${response.status} ${JSON.stringify(body)}`
    );
  }

  return body;
}

export function isTransientStorageError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return transientStorageErrorPattern.test(message);
}

function getStorageReadyCacheKey({ supabaseUrl, serviceRoleKey }) {
  return `${supabaseUrl}::${serviceRoleKey}`;
}

export async function waitForStorageReady({
  supabaseUrl,
  serviceRoleKey,
  attempts = 40,
  delayMs = 2_000,
  force = false
}) {
  const cacheKey = getStorageReadyCacheKey({ supabaseUrl, serviceRoleKey });

  if (!force && storageReadyCache.has(cacheKey)) {
    return;
  }

  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await requestJson(`${supabaseUrl}/storage/v1/bucket`, {
        method: "GET",
        headers: buildHeaders(serviceRoleKey)
      });
      storageReadyCache.add(cacheKey);
      return;
    } catch (error) {
      lastError = error;

      if (!isTransientStorageError(error)) {
        throw error;
      }

      await sleep(delayMs);
    }
  }

  throw new Error(
    `Supabase storage did not become ready after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error")
    }`
  );
}

export async function listRows({ supabaseUrl, serviceRoleKey, table, filters = {}, select = "*" }) {
  const query = new URLSearchParams({
    select
  });

  for (const [key, value] of Object.entries(filters)) {
    query.set(key, value);
  }

  return requestJson(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders(serviceRoleKey)
  });
}

export async function findSingle(args) {
  const rows = await listRows(args);
  return rows[0] ?? null;
}

export async function insertRow({ supabaseUrl, serviceRoleKey, table, payload }) {
  const rows = await requestJson(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...buildHeaders(serviceRoleKey, {
        Prefer: "return=representation"
      }),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

export async function patchRows({ supabaseUrl, serviceRoleKey, table, filters, payload }) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    query.set(key, value);
  }

  return requestJson(`${supabaseUrl}/rest/v1/${table}?${query.toString()}`, {
    method: "PATCH",
    headers: {
      ...buildHeaders(serviceRoleKey, {
        Prefer: "return=representation"
      }),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function upsertRestRow({ supabaseUrl, serviceRoleKey, table, payload, onConflict }) {
  const headers = {
    ...buildHeaders(serviceRoleKey, {
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    "Content-Type": "application/json"
  };

  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const rows = await requestJson(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: "POST",
    headers,
    body: JSON.stringify(Array.isArray(payload) ? payload : [payload])
  });

  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

export async function rpc({ supabaseUrl, serviceRoleKey, fn, payload }) {
  return requestJson(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      ...buildHeaders(serviceRoleKey),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function upsertAuthUser({ supabaseUrl, serviceRoleKey, email, password }) {
  const existingUsers = await requestJson(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: buildHeaders(serviceRoleKey)
    }
  );

  const existingUser = existingUsers?.users?.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    await requestJson(`${supabaseUrl}/auth/v1/admin/users/${existingUser.id}`, {
      method: "PUT",
      headers: {
        ...buildHeaders(serviceRoleKey),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true
      })
    });

    return existingUser.id;
  }

  const createdUser = await requestJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      ...buildHeaders(serviceRoleKey),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true
    })
  });

  return createdUser.id;
}

export async function getUserIdByEmail({ supabaseUrl, serviceRoleKey, email }) {
  const users = await requestJson(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: buildHeaders(serviceRoleKey)
    }
  );

  const user = users?.users?.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    throw new Error(`Auth user not found for email: ${email}. Run pnpm bootstrap:dev-users first.`);
  }

  return user.id;
}

export async function getCompanyBySlug({ supabaseUrl, serviceRoleKey, slug }) {
  return findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "companies",
    filters: {
      slug: `eq.${slug}`
    }
  });
}

export async function ensureCompany({ supabaseUrl, serviceRoleKey, name, slug, ownerUserId }) {
  const existingCompany = await getCompanyBySlug({
    supabaseUrl,
    serviceRoleKey,
    slug
  });

  if (existingCompany) {
    return existingCompany;
  }

  return insertRow({
    supabaseUrl,
    serviceRoleKey,
    table: "companies",
    payload: {
      name,
      slug,
      owner_user_id: ownerUserId
    }
  });
}

export async function upsertMembership({ supabaseUrl, serviceRoleKey, companyId, userId, role }) {
  return upsertRestRow({
    supabaseUrl,
    serviceRoleKey,
    table: "company_memberships",
    onConflict: "company_id,user_id",
    payload: {
      company_id: companyId,
      user_id: userId,
      role,
      is_active: true
    }
  });
}

export async function updateProfileByEmail({ supabaseUrl, serviceRoleKey, email, payload }) {
  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "profiles",
    filters: {
      email: `eq.${email}`
    },
    payload
  });

  return rows[0] ?? null;
}

export async function uploadStorageObject({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  objectPath,
  body,
  contentType
}) {
  const cacheKey = getStorageReadyCacheKey({ supabaseUrl, serviceRoleKey });

  await waitForStorageReady({ supabaseUrl, serviceRoleKey });

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await requestJson(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
        method: "POST",
        headers: {
          ...buildHeaders(serviceRoleKey, {
            "x-upsert": "true"
          }),
          "Content-Type": contentType
        },
        body
      });
    } catch (error) {
      if (!isTransientStorageError(error) || attempt === 6) {
        throw error;
      }

      storageReadyCache.delete(cacheKey);
      await sleep(750 * attempt);
      await waitForStorageReady({
        supabaseUrl,
        serviceRoleKey,
        attempts: 6,
        delayMs: 1_000,
        force: true
      });
    }
  }
}

export function createTinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9VE3CyAAAAAASUVORK5CYII=",
    "base64"
  );
}

export function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function formatCurrencyCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function isoAtOffsetDays(days, hour = 9, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function isoAtOffsetHours(hours) {
  const date = new Date();
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
}

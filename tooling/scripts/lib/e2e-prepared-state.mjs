import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getLocalE2eSnapshotState } from "./local-e2e-snapshot.mjs";
import { getBootstrapEnv, listRows, required } from "./bootstrap-utils.mjs";

const preparedStateFileRelative = path.join(".artifacts", "e2e", "prepared-state.json");

function getEnvFilePaths(repoRoot) {
  return [
    path.join(repoRoot, "apps", "web", ".env.local"),
    path.join(repoRoot, "apps", "mobile", ".env.local")
  ];
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, normalizeValue(value[key])])
    );
  }

  return value ?? null;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizeValue(value))).digest("hex");
}

function sortRows(rows, fields) {
  return [...rows].sort((left, right) => {
    for (const field of fields) {
      const leftValue = String(left[field] ?? "");
      const rightValue = String(right[field] ?? "");
      const comparison = leftValue.localeCompare(rightValue);

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });
}

function readEnvFileFingerprint(repoRoot) {
  const hash = crypto.createHash("sha256");

  for (const envFilePath of getEnvFilePaths(repoRoot)) {
    const relativePath = path.relative(repoRoot, envFilePath);
    hash.update(`${relativePath}\n`);

    if (!fs.existsSync(envFilePath)) {
      hash.update("__missing__\n");
      continue;
    }

    hash.update(fs.readFileSync(envFilePath));
    hash.update("\n");
  }

  return hash.digest("hex");
}

export function computePreparedStateEnvFingerprint(repoRoot = process.cwd()) {
  return readEnvFileFingerprint(repoRoot);
}

function getPreparedStateFilePath(repoRoot = process.cwd()) {
  return path.join(repoRoot, preparedStateFileRelative);
}

export function loadPreparedStateStamp(repoRoot = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(getPreparedStateFilePath(repoRoot), "utf8"));
  } catch {
    return null;
  }
}

export function savePreparedStateStamp(stamp, repoRoot = process.cwd()) {
  const targetPath = getPreparedStateFilePath(repoRoot);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
}

export function clearPreparedStateStamp(repoRoot = process.cwd()) {
  fs.rmSync(getPreparedStateFilePath(repoRoot), { force: true });
}

export function shouldUsePreparedStateStamp() {
  if (process.env.CI) {
    return false;
  }

  if (process.env.MM_E2E_PREPARED_STATE_DISABLED === "1") {
    return false;
  }

  return true;
}

export async function collectPreparedStateData({ serviceRoleKey, supabaseUrl }) {
  const [customers, addresses, jobs, invoices, payments, jobNotes, communicationEvents, customerCommunications, deliveryAttempts] = await Promise.all([
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "customers",
      select: "id,email"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_addresses",
      select:
        "id,customer_id,label,site_name,line1,city,state,postal_code,service_contact_name,access_window_notes,gate_code,parking_notes,is_active,is_primary"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "jobs",
      select:
        "id,title,status,service_site_id,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "invoices",
      select: "id,invoice_number,job_id,status,amount_paid_cents,balance_due_cents"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "payments",
      select: "id,invoice_id,amount_cents,receipt_url,stripe_checkout_session_id"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "job_notes",
      select: "id,job_id,body,author_user_id,is_internal"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_events",
      select: "id,job_id,invoice_id,event_type,communication_type,trigger_source,payload,idempotency_key"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_communications",
      select:
        "id,event_id,job_id,invoice_id,communication_type,channel,status,recipient_email,recipient_phone"
    }),
    listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_delivery_attempts",
      select: "id,communication_id,attempt_number,succeeded,error_message"
    })
  ]);

  return {
    addresses: sortRows(addresses, ["customer_id", "site_name", "line1", "id"]),
    communicationDeliveryAttempts: sortRows(deliveryAttempts, ["communication_id", "attempt_number", "id"]),
    communicationEvents: sortRows(communicationEvents, ["job_id", "invoice_id", "event_type", "id"]),
    customerCommunications: sortRows(customerCommunications, ["job_id", "invoice_id", "communication_type", "id"]),
    customers: sortRows(customers, ["email", "id"]),
    invoices: sortRows(invoices, ["invoice_number", "id"]),
    jobNotes: sortRows(jobNotes, ["job_id", "id"]),
    jobs: sortRows(jobs, ["title", "id"]),
    payments: sortRows(payments, ["invoice_id", "id"])
  };
}

export function computePreparedStateFingerprint(data) {
  return stableHash(data);
}

export async function computeCurrentPreparedStateStamp(repoRoot = process.cwd()) {
  const env = getBootstrapEnv();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);
  const stateData = await collectPreparedStateData({
    serviceRoleKey,
    supabaseUrl
  });

  return {
    createdAt: new Date().toISOString(),
    envFingerprint: computePreparedStateEnvFingerprint(repoRoot),
    seedFingerprint: computePreparedStateFingerprint(stateData),
    snapshotFingerprint: getLocalE2eSnapshotState(repoRoot).fingerprint
  };
}

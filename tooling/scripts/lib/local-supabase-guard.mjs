import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { formatListener, inspectPortChecks } from "./local-port-guard.mjs";

const supportedSections = {
  api: "Supabase API",
  db: "Supabase Postgres",
  inbucket: "Supabase Mailpit",
  studio: "Supabase Studio"
};

function extractPortFromUrl(value) {
  if (!value) {
    return null;
  }

  try {
    return Number(new URL(value).port);
  } catch {
    return null;
  }
}

function getSupabaseStatusSummary({ repoRoot }) {
  try {
    const output = execSync("pnpm exec supabase status -o json", {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      error: null,
      status: JSON.parse(output)
    };
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    const message =
      stdout || stderr || (error instanceof Error ? error.message : String(error ?? "unknown error"));

    return {
      error: message,
      status: null
    };
  }
}

export function getConfiguredSupabasePortChecks({
  configText,
  repoRoot = process.cwd()
} = {}) {
  const source =
    configText ??
    fs.readFileSync(path.join(repoRoot, "supabase", "config.toml"), "utf8");
  const checks = [];
  let currentSection = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);

    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    if (!currentSection || !(currentSection in supportedSections)) {
      continue;
    }

    const portMatch = line.match(/^port\s*=\s*(\d+)$/);

    if (!portMatch) {
      continue;
    }

    checks.push({
      port: Number.parseInt(portMatch[1], 10),
      purpose: supportedSections[currentSection],
      section: currentSection
    });
  }

  return checks;
}

export function isHealthySupabaseStatus(status, portChecks) {
  if (!status) {
    return false;
  }

  const expectedPorts = new Set(portChecks.map((portCheck) => portCheck.port));
  const statusPorts = [
    extractPortFromUrl(status.API_URL),
    extractPortFromUrl(status.DB_URL),
    extractPortFromUrl(status.STUDIO_URL),
    extractPortFromUrl(status.INBUCKET_URL ?? status.MAILPIT_URL)
  ].filter(Boolean);

  if (statusPorts.length === 0) {
    return false;
  }

  return statusPorts.every((port) => expectedPorts.has(port));
}

export async function assertLocalSupabasePortsReady(options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const portChecks =
    options.portChecks ?? getConfiguredSupabasePortChecks({ repoRoot });
  const occupied =
    options.inspectPortChecks
      ? await options.inspectPortChecks(portChecks)
      : await inspectPortChecks(portChecks);

  if (occupied.length === 0) {
    return;
  }

  const statusSummary = options.getSupabaseStatusSummary
    ? await options.getSupabaseStatusSummary()
    : getSupabaseStatusSummary({ repoRoot });

  if (isHealthySupabaseStatus(statusSummary.status, portChecks)) {
    return;
  }

  const lines = [
    "Local Supabase preflight failed because required Supabase ports are already in use but the expected project stack is not healthy.",
    "Stop the conflicting services or run `pnpm db:stop` before rerunning."
  ];

  for (const portCheck of occupied) {
    const ownerSummary =
      portCheck.listeners.length > 0
        ? portCheck.listeners.map((listener) => formatListener(listener)).join("; ")
        : "occupied by another local process";

    lines.push(`- Port ${portCheck.port} for ${portCheck.purpose}: ${ownerSummary}`);
  }

  if (statusSummary.error) {
    lines.push(`Supabase CLI status check: ${statusSummary.error}`);
  } else {
    lines.push("Supabase CLI status check: no healthy local project status was returned.");
  }

  throw new Error(lines.join("\n"));
}

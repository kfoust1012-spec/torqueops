import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearPreparedStateStamp,
  computePreparedStateEnvFingerprint,
  computePreparedStateFingerprint,
  loadPreparedStateStamp,
  savePreparedStateStamp
} from "./e2e-prepared-state.mjs";

const tempDirs = [];

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-prepared-state-"));
  tempDirs.push(repoRoot);
  fs.mkdirSync(path.join(repoRoot, "apps", "web"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "apps", "mobile"), { recursive: true });
  return repoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("computePreparedStateEnvFingerprint", () => {
  it("changes when either local env file changes", () => {
    const repoRoot = createTempRepo();
    const webEnvPath = path.join(repoRoot, "apps", "web", ".env.local");
    const mobileEnvPath = path.join(repoRoot, "apps", "mobile", ".env.local");

    fs.writeFileSync(webEnvPath, "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n", "utf8");
    fs.writeFileSync(mobileEnvPath, "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n", "utf8");
    const initialFingerprint = computePreparedStateEnvFingerprint(repoRoot);

    fs.writeFileSync(mobileEnvPath, "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54322\n", "utf8");

    expect(computePreparedStateEnvFingerprint(repoRoot)).not.toBe(initialFingerprint);
  });
});

describe("prepared-state stamp storage", () => {
  it("round-trips the prepared-state stamp to disk", () => {
    const repoRoot = createTempRepo();
    const stamp = {
      createdAt: "2026-03-28T00:00:00.000Z",
      envFingerprint: "env",
      seedFingerprint: "seed",
      snapshotFingerprint: "snapshot"
    };

    savePreparedStateStamp(stamp, repoRoot);

    expect(loadPreparedStateStamp(repoRoot)).toEqual(stamp);

    clearPreparedStateStamp(repoRoot);

    expect(loadPreparedStateStamp(repoRoot)).toBeNull();
  });
});

describe("computePreparedStateFingerprint", () => {
  it("is stable for equal data regardless of key order", () => {
    const left = {
      jobs: [{ id: "1", title: "Cooling system diagnosis" }],
      invoices: [{ invoice_number: "INV-1003", status: "draft" }]
    };
    const right = {
      invoices: [{ status: "draft", invoice_number: "INV-1003" }],
      jobs: [{ title: "Cooling system diagnosis", id: "1" }]
    };

    expect(computePreparedStateFingerprint(left)).toBe(computePreparedStateFingerprint(right));
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearLocalE2eSnapshot,
  computeLocalE2eSnapshotFingerprint,
  getLocalE2eSnapshotState
} from "./local-e2e-snapshot.mjs";

const tempDirs = [];

function writeFile(targetPath, contents) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents, "utf8");
}

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-e2e-snapshot-"));
  tempDirs.push(repoRoot);

  writeFile(path.join(repoRoot, "package.json"), JSON.stringify({ name: "test-repo" }));
  writeFile(path.join(repoRoot, "supabase", "config.toml"), 'project_id = "test-project"\n');
  writeFile(path.join(repoRoot, "supabase", "migrations", "0001_test.sql"), "select 1;\n");
  writeFile(path.join(repoRoot, "tooling", "scripts", "assert-e2e-seed-integrity.mjs"), "export {};\n");
  writeFile(path.join(repoRoot, "tooling", "scripts", "bootstrap-demo-data.mjs"), "export {};\n");
  writeFile(path.join(repoRoot, "tooling", "scripts", "bootstrap-dev-users.mjs"), "export {};\n");
  writeFile(path.join(repoRoot, "tooling", "scripts", "bootstrap-dispatch-stress.mjs"), "export {};\n");
  writeFile(path.join(repoRoot, "tooling", "scripts", "lib", "bootstrap-utils.mjs"), "export {};\n");

  return repoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("computeLocalE2eSnapshotFingerprint", () => {
  it("changes when snapshot input files change", () => {
    const repoRoot = createTempRepo();
    const initial = computeLocalE2eSnapshotFingerprint(repoRoot);

    writeFile(path.join(repoRoot, "supabase", "migrations", "0002_test.sql"), "select 2;\n");

    const updated = computeLocalE2eSnapshotFingerprint(repoRoot);

    expect(updated.fingerprint).not.toBe(initial.fingerprint);
    expect(updated.inputFiles).toContain(path.join("supabase", "migrations", "0002_test.sql"));
  });
});

describe("getLocalE2eSnapshotState", () => {
  it("marks a matching snapshot as usable", () => {
    const repoRoot = createTempRepo();
    const snapshotState = computeLocalE2eSnapshotFingerprint(repoRoot);
    const snapshotDir = path.join(repoRoot, ".artifacts", "e2e", "local-snapshot");
    fs.mkdirSync(path.join(snapshotDir, "db"), { recursive: true });
    fs.mkdirSync(path.join(snapshotDir, "storage"), { recursive: true });
    fs.writeFileSync(
      path.join(snapshotDir, "meta.json"),
      JSON.stringify(
        {
          createdAt: "2026-03-28T00:00:00.000Z",
          fingerprint: snapshotState.fingerprint,
          inputFiles: snapshotState.inputFiles,
          projectId: "test-project",
          version: 1
        },
        null,
        2
      )
    );

    const resolvedState = getLocalE2eSnapshotState(repoRoot);

    expect(resolvedState.isUsable).toBe(true);
    expect(resolvedState.meta?.projectId).toBe("test-project");
  });

  it("becomes unusable after the local snapshot is cleared", () => {
    const repoRoot = createTempRepo();
    const snapshotState = computeLocalE2eSnapshotFingerprint(repoRoot);
    const snapshotDir = path.join(repoRoot, ".artifacts", "e2e", "local-snapshot");
    fs.mkdirSync(path.join(snapshotDir, "db"), { recursive: true });
    fs.mkdirSync(path.join(snapshotDir, "storage"), { recursive: true });
    fs.writeFileSync(
      path.join(snapshotDir, "meta.json"),
      JSON.stringify(
        {
          createdAt: "2026-03-28T00:00:00.000Z",
          fingerprint: snapshotState.fingerprint,
          inputFiles: snapshotState.inputFiles,
          projectId: "test-project",
          version: 1
        },
        null,
        2
      )
    );

    clearLocalE2eSnapshot(repoRoot);

    const resolvedState = getLocalE2eSnapshotState(repoRoot);

    expect(resolvedState.isUsable).toBe(false);
    expect(fs.existsSync(snapshotDir)).toBe(false);
  });
});

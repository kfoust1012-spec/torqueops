import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireLocalLock, releaseLocalLock } from "./local-lock.mjs";

const tempDirs = [];

function createTempRepoRoot() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-local-lock-"));
  tempDirs.push(repoRoot);
  return repoRoot;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe("acquireLocalLock", () => {
  it("removes a stale lock file and acquires the lock", async () => {
    const repoRoot = createTempRepoRoot();
    const lockDir = path.join(repoRoot, ".artifacts", "locks");
    const lockPath = path.join(lockDir, "stale.lock");
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(
      lockPath,
      JSON.stringify(
        {
          createdAt: "2026-03-27T00:00:00.000Z",
          owner: "stale-owner",
          pid: 999999
        },
        null,
        2
      )
    );

    const result = await acquireLocalLock({
      lockFileName: "stale.lock",
      lockLabel: "test lock",
      owner: "new-owner",
      repoRoot,
      timeoutMs: 250,
      waitIntervalMs: 10,
      waitNoticeIntervalMs: 10
    });

    try {
      expect(result.metadata.owner).toBe("new-owner");
      expect(result.metadata.pid).toBe(process.pid);
      const storedMetadata = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      expect(storedMetadata.owner).toBe("new-owner");
    } finally {
      releaseLocalLock(result.lockPath);
    }
  });

  it("times out with owner diagnostics when the lock stays held", async () => {
    const repoRoot = createTempRepoRoot();
    const lockDir = path.join(repoRoot, ".artifacts", "locks");
    const lockPath = path.join(lockDir, "busy.lock");
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(
      lockPath,
      JSON.stringify(
        {
          createdAt: "2026-03-27T00:00:00.000Z",
          owner: "busy-owner",
          pid: process.pid
        },
        null,
        2
      )
    );

    const error = await acquireLocalLock({
      lockFileName: "busy.lock",
      lockLabel: "test lock",
      owner: "another-owner",
      repoRoot,
      timeoutMs: 50,
      waitIntervalMs: 10,
      waitNoticeIntervalMs: 10
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Timed out after waiting .* for the test lock\./);
    expect(error.message).toMatch(/Current owner: busy-owner, pid /);
    expect(error.message).toMatch(/If that process is no longer healthy, stop it and delete/);
    await expect(
      acquireLocalLock({
        lockFileName: "busy.lock",
        lockLabel: "test lock",
        owner: "another-owner",
        repoRoot,
        timeoutMs: 25,
        waitIntervalMs: 10,
        waitNoticeIntervalMs: 10
      })
    ).rejects.toThrow(/Lock file: .*[\\/]?\.artifacts[\\/]+locks[\\/]busy\.lock/i);
  });
});

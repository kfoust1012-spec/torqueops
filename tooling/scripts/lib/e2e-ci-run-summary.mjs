import fs from "node:fs";
import path from "node:path";

const allowedTargets = new Set(["full", "mobile", "web"]);

function assertTarget(target) {
  if (!allowedTargets.has(target)) {
    throw new Error(`Unknown e2e CI summary target: ${target}`);
  }
}

export function getE2eCiRunSummaryPath(target, repoRoot = process.cwd()) {
  assertTarget(target);
  return path.join(repoRoot, ".artifacts", "e2e", `${target}-e2e-ci-summary.json`);
}

export function loadE2eCiRunSummary(target, repoRoot = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(getE2eCiRunSummaryPath(target, repoRoot), "utf8"));
  } catch {
    return null;
  }
}

export function saveE2eCiRunSummary(target, summary, repoRoot = process.cwd()) {
  const targetPath = getE2eCiRunSummaryPath(target, repoRoot);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

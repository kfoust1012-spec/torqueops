import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  getE2eExecutionSummaryPath,
  loadE2eExecutionSummary
} from "./lib/e2e-execution-summary.mjs";

const blockedSetupPatterns = [
  {
    label: "Supabase reset container-removal race",
    pattern: /failed to remove container: .*already in progress/i
  },
  {
    label: "Supabase reset command failure",
    pattern: /Command failed: pnpm exec supabase db reset/i
  },
  {
    label: "Supabase storage readiness failure after reset",
    pattern: /Supabase storage did not become ready after reset:/i
  },
  {
    label: "Supabase storage readiness failure during bootstrap",
    pattern: /Supabase storage did not become ready after \d+ attempts:/i
  },
  {
    label: "Supabase storage API failure during bootstrap",
    pattern: /GET .*\/storage\/v1\/bucket failed:/i
  },
  {
    label: "Bootstrap upload/storage request failure",
    pattern: /(?:POST|PUT|DELETE) .*\/storage\/v1\/object\/.* failed:/i
  },
  {
    label: "Supabase CLI upgrade notice",
    pattern: /A new version of Supabase CLI is available:/i
  },
  {
    label: "pnpm blocked build scripts warning",
    pattern: /Ignored build scripts:/i
  },
  {
    label: "Supabase bin link warning",
    pattern: /Failed to create bin .*supabase/i
  }
];

function readBudgetMs(name, defaultValue) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const summaryBudgets = {
  browserInstallInstallMs: readBudgetMs("MM_E2E_BROWSER_INSTALL_BUDGET_MS", 300_000),
  browserInstallRefreshMetadataMs: readBudgetMs("MM_E2E_BROWSER_REFRESH_BUDGET_MS", 15_000),
  browserInstallSkipMs: readBudgetMs("MM_E2E_BROWSER_SKIP_BUDGET_MS", 5_000),
  fullPreparePhaseMs: readBudgetMs("MM_E2E_FULL_PREPARE_BUDGET_MS", 480_000),
  fullRebuildTotalMs: readBudgetMs("MM_E2E_FULL_REBUILD_BUDGET_MS", 600_000),
  preparedStateCheckMs: readBudgetMs("MM_E2E_PREPARED_STATE_CHECK_BUDGET_MS", 5_000),
  preparedStateSkipTotalMs: readBudgetMs("MM_E2E_PREPARED_STATE_SKIP_BUDGET_MS", 10_000),
  snapshotRestorePhaseMs: readBudgetMs("MM_E2E_SNAPSHOT_RESTORE_BUDGET_MS", 120_000),
  snapshotRestoreTotalMs: readBudgetMs("MM_E2E_SNAPSHOT_TOTAL_BUDGET_MS", 120_000)
};

function getSectionText(log, sectionLabel) {
  const marker = `== ${sectionLabel} ==`;
  const startIndex = log.indexOf(marker);

  if (startIndex === -1) {
    return null;
  }

  const afterMarker = startIndex + marker.length;
  const nextSectionIndex = log.indexOf("\n== ", afterMarker);
  return log.slice(startIndex, nextSectionIndex === -1 ? undefined : nextSectionIndex).trim();
}

function findMissingSummaryFields(sectionText, requiredLabels) {
  return requiredLabels.filter((label) => !sectionText.includes(`${label}:`));
}

function summarizeShapeProblems(summary, requiredKeys, label) {
  if (!summary || typeof summary !== "object") {
    return [`${label} JSON summary is missing or invalid.`];
  }

  return requiredKeys
    .filter((key) => !(key in summary))
    .map((key) => `${label} JSON summary is missing ${key}.`);
}

export function findBlockedSetupLogMatches(log) {
  return blockedSetupPatterns
    .map(({ label, pattern }) => {
      const match = log.match(pattern);

      if (!match) {
        return null;
      }

      const hitIndex = match.index ?? 0;
      const lineStart = log.lastIndexOf("\n", hitIndex) + 1;
      const lineEnd = log.indexOf("\n", hitIndex);
      const excerpt = log.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

      return { excerpt, label };
    })
    .filter(Boolean);
}

export function findMissingSetupSummaryProblems({ log, repoRoot = process.cwd() }) {
  const problems = [];
  const bootstrapSection = getSectionText(log, "Bootstrap Summary");

  if (!bootstrapSection) {
    problems.push("Bootstrap Summary block is missing from the setup log.");
  } else {
    const missingBootstrapFields = findMissingSummaryFields(bootstrapSection, [
      "Outcome",
      "Reason",
      "Total",
      "Prepared-state check",
      "Browser install",
      "Browser install outcome"
    ]);

    for (const field of missingBootstrapFields) {
      problems.push(`Bootstrap Summary block is missing ${field}.`);
    }
  }

  const ranPrepare =
    log.includes("> mobile-mechanic-software@ test:e2e:prepare ") ||
    log.includes("== Restore Snapshot ==") ||
    log.includes("== Full Prepare ==");

  if (ranPrepare) {
    const prepareSection = getSectionText(log, "Prepare Summary");

    if (!prepareSection) {
      problems.push("Prepare Summary block is missing from the setup log even though prepare ran.");
    } else {
      const missingPrepareFields = findMissingSummaryFields(prepareSection, [
        "Outcome",
        "Reason",
        "Total"
      ]);

      for (const field of missingPrepareFields) {
        problems.push(`Prepare Summary block is missing ${field}.`);
      }
    }
  }

  const bootstrapSummaryPath = getE2eExecutionSummaryPath("bootstrap", repoRoot);
  const browserInstallSummaryPath = getE2eExecutionSummaryPath("browserInstall", repoRoot);
  const bootstrapSummary = loadE2eExecutionSummary("bootstrap", repoRoot);
  const browserInstallSummary = loadE2eExecutionSummary("browserInstall", repoRoot);

  if (!fs.existsSync(bootstrapSummaryPath)) {
    problems.push(`Bootstrap JSON summary is missing: ${path.relative(repoRoot, bootstrapSummaryPath)}`);
  }

  if (!fs.existsSync(browserInstallSummaryPath)) {
    problems.push(`Browser install JSON summary is missing: ${path.relative(repoRoot, browserInstallSummaryPath)}`);
  }

  problems.push(
    ...summarizeShapeProblems(bootstrapSummary, ["mode", "reason", "timings"], "Bootstrap")
  );
  problems.push(
    ...summarizeShapeProblems(browserInstallSummary, ["mode", "reason", "timings"], "Browser install")
  );

  const prepareSummaryPath = getE2eExecutionSummaryPath("prepare", repoRoot);
  const prepareSummary = loadE2eExecutionSummary("prepare", repoRoot);

  if (ranPrepare) {
    if (!fs.existsSync(prepareSummaryPath)) {
      problems.push(`Prepare JSON summary is missing: ${path.relative(repoRoot, prepareSummaryPath)}`);
    }

    problems.push(
      ...summarizeShapeProblems(prepareSummary, ["mode", "reason", "timings"], "Prepare")
    );
  }

  if (bootstrapSummary?.browserInstallMode && browserInstallSummary?.mode && bootstrapSummary.browserInstallMode !== browserInstallSummary.mode) {
    problems.push(
      `Bootstrap Summary browser install outcome ${bootstrapSummary.browserInstallMode} does not match browser install JSON summary mode ${browserInstallSummary.mode}.`
    );
  }

  if (bootstrapSummary?.mode === "prepared_state_skip") {
    if ((bootstrapSummary.timings?.totalMs ?? 0) > summaryBudgets.preparedStateSkipTotalMs) {
      problems.push(
        `prepared_state_skip exceeded ${summaryBudgets.preparedStateSkipTotalMs}ms (saw ${bootstrapSummary.timings.totalMs}ms).`
      );
    }

    if ((bootstrapSummary.timings?.preparedStateCheckMs ?? 0) > summaryBudgets.preparedStateCheckMs) {
      problems.push(
        `Prepared-state check exceeded ${summaryBudgets.preparedStateCheckMs}ms (saw ${bootstrapSummary.timings.preparedStateCheckMs}ms).`
      );
    }

    if (browserInstallSummary?.mode === "install") {
      problems.push("prepared_state_skip unexpectedly fell back to a full Playwright browser install.");
    }
  }

  if (bootstrapSummary?.mode === "snapshot_restore") {
    if ((bootstrapSummary.timings?.totalMs ?? 0) > summaryBudgets.snapshotRestoreTotalMs) {
      problems.push(
        `snapshot_restore exceeded ${summaryBudgets.snapshotRestoreTotalMs}ms (saw ${bootstrapSummary.timings.totalMs}ms).`
      );
    }

    if ((prepareSummary?.timings?.restorePhaseMs ?? 0) > summaryBudgets.snapshotRestorePhaseMs) {
      problems.push(
        `Snapshot restore phase exceeded ${summaryBudgets.snapshotRestorePhaseMs}ms (saw ${prepareSummary.timings.restorePhaseMs}ms).`
      );
    }
  }

  if (bootstrapSummary?.mode === "full_rebuild") {
    if ((bootstrapSummary.timings?.totalMs ?? 0) > summaryBudgets.fullRebuildTotalMs) {
      problems.push(
        `full_rebuild exceeded ${summaryBudgets.fullRebuildTotalMs}ms (saw ${bootstrapSummary.timings.totalMs}ms).`
      );
    }

    if ((prepareSummary?.timings?.fullPreparePhaseMs ?? 0) > summaryBudgets.fullPreparePhaseMs) {
      problems.push(
        `Full prepare phase exceeded ${summaryBudgets.fullPreparePhaseMs}ms (saw ${prepareSummary.timings.fullPreparePhaseMs}ms).`
      );
    }
  }

  if (browserInstallSummary?.mode === "skip" && (browserInstallSummary.timings?.totalMs ?? 0) > summaryBudgets.browserInstallSkipMs) {
    problems.push(
      `Browser install skip exceeded ${summaryBudgets.browserInstallSkipMs}ms (saw ${browserInstallSummary.timings.totalMs}ms).`
    );
  }

  if (browserInstallSummary?.mode === "refresh_metadata" && (browserInstallSummary.timings?.totalMs ?? 0) > summaryBudgets.browserInstallRefreshMetadataMs) {
    problems.push(
      `Browser install metadata refresh exceeded ${summaryBudgets.browserInstallRefreshMetadataMs}ms (saw ${browserInstallSummary.timings.totalMs}ms).`
    );
  }

  if (browserInstallSummary?.mode === "install" && (browserInstallSummary.timings?.totalMs ?? 0) > summaryBudgets.browserInstallInstallMs) {
    problems.push(
      `Browser install exceeded ${summaryBudgets.browserInstallInstallMs}ms (saw ${browserInstallSummary.timings.totalMs}ms).`
    );
  }

  return problems;
}

function main() {
  const logPathArg = process.argv[2];

  if (!logPathArg) {
    console.error("Usage: node tooling/scripts/assert-clean-e2e-setup-log.mjs <log-file>");
    process.exit(1);
  }

  const logPath = path.resolve(process.cwd(), logPathArg);

  if (!fs.existsSync(logPath)) {
    console.error(`E2E setup log file not found: ${logPath}`);
    process.exit(1);
  }

  const log = fs.readFileSync(logPath, "utf8");
  const blockedMatches = findBlockedSetupLogMatches(log);

  if (blockedMatches.length > 0) {
    console.error("Blocked setup regressions detected in e2e bootstrap log:");

    for (const match of blockedMatches) {
      console.error(`- ${match.label}: ${match.excerpt}`);
    }

    process.exit(1);
  }

  const summaryProblems = findMissingSetupSummaryProblems({
    log,
    repoRoot: process.cwd()
  });

  if (summaryProblems.length > 0) {
    console.error("E2E setup summary regressions detected:");

    for (const problem of summaryProblems) {
      console.error(`- ${problem}`);
    }

    process.exit(1);
  }

  console.log(`E2E setup log is clean: ${path.relative(process.cwd(), logPath)}`);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main();
}

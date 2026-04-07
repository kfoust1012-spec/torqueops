import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildE2eTimingAnalysis } from "./lib/e2e-timing-analysis.mjs";
import { parseE2eTimingCliArgs } from "./lib/e2e-timing-cli.mjs";
import { emitGitHubAnnotations } from "./lib/github-annotations.mjs";
import {
  loadE2eTimingContext
} from "./lib/e2e-timing-context.mjs";
import {
  buildE2eTimingDecisionArtifact,
  formatGitHubTimingAnnotations
} from "./emit-e2e-timing-decision.mjs";
import {
  renderE2eTimingSummary
} from "./render-e2e-timing-summary.mjs";

function writeTextFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function appendTextFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.appendFileSync(targetPath, content, "utf8");
}

export function createE2eTimingReportRunner(dependencies = {}) {
  const {
    appendSummary = appendTextFile,
    analyzeTiming = buildE2eTimingAnalysis,
    buildDecision = buildE2eTimingDecisionArtifact,
    emitAnnotations = emitGitHubAnnotations,
    formatAnnotations = formatGitHubTimingAnnotations,
    loadTimingContext = loadE2eTimingContext,
    renderSummary = renderE2eTimingSummary,
    writeDecision = writeTextFile,
    repoRoot = process.cwd()
  } = dependencies;

  return {
    run(options) {
      const {
        baselinePath,
        baselineSummaryPath,
        decisionOutputPath,
        enforce = false,
        githubAnnotations = false,
        historyDir,
        requireMainBaseline = false,
        requireSustainedRegression = false,
        outputPath,
        summaryOutputPath = outputPath ?? null,
        target,
        timingRulesPath
      } = options;

      const {
        baseline,
        historySummary,
        runSummary,
        target: resolvedTarget,
        timingConfig
      } = loadTimingContext({
        baselinePath,
        baselineSummaryPath,
        historyDir,
        repoRoot,
        target,
        timingRulesPath
      });
      const analysis = analyzeTiming({
        baseline,
        historySummary,
        requireMainBaseline,
        requireSustainedRegression,
        runSummary,
        target: resolvedTarget,
        timingConfig
      });
      const decision = buildDecision({ analysis });
      const markdown = renderSummary({ analysis });

      writeDecision(decisionOutputPath, `${JSON.stringify(decision, null, 2)}\n`);

      if (summaryOutputPath) {
        appendSummary(summaryOutputPath, `${markdown}\n`);
      }

      if (githubAnnotations) {
        emitAnnotations(formatAnnotations(decision));
      }

      return {
        decision,
        exitCode: enforce ? analysis.exitCode : 0,
        markdown
      };
    }
  };
}

function main() {
  const options = parseE2eTimingCliArgs(process.argv.slice(2), {
    defaultDecisionOutputPath: ({ repoRoot, target }) =>
      path.join(repoRoot, ".artifacts", "e2e", `${target}-timing-decision.json`),
    defaultOutputPath: process.env.GITHUB_STEP_SUMMARY ?? null,
    includeDecisionOutputPath: true,
    includeEnforce: true,
    includeGithubAnnotations: true,
    includeOutputPath: true,
    includeRequireMainBaseline: true,
    includeRequireSustainedRegression: true
  });
  const report = createE2eTimingReportRunner().run(options);
  console.log(`Saved timing decision artifact: ${path.relative(process.cwd(), options.decisionOutputPath) || path.basename(options.decisionOutputPath)}`);

  if (options.outputPath) {
    console.log(`Updated timing summary output: ${path.relative(process.cwd(), options.outputPath) || path.basename(options.outputPath)}`);
  }

  process.exit(report.exitCode);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main();
}

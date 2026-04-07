import fs from "node:fs";
import path from "node:path";

const defaultTimingRulePath = path.join(process.cwd(), "tooling", "e2e-timing-rules.json");

function loadJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function getDefaultE2eTimingRulePath(repoRoot = process.cwd()) {
  return path.join(repoRoot, "tooling", "e2e-timing-rules.json");
}

export function loadE2eTimingRuleConfig(configPath = defaultTimingRulePath) {
  return loadJsonFile(configPath);
}

export function resolveTimingEvaluationConfig({
  config = null,
  configPath = defaultTimingRulePath,
  repoRoot = process.cwd(),
  target = "full"
}) {
  const loadedConfig = config ?? loadE2eTimingRuleConfig(configPath);
  const targetOverrides = loadedConfig?.targets?.[target] ?? {};
  const baseRows = Array.isArray(loadedConfig?.rows) ? loadedConfig.rows : [];
  const overrideRows = targetOverrides?.rows ?? {};
  const seenKeys = new Set();
  const rows = [];

  for (const row of baseRows) {
    const mergedRow = {
      ...row,
      ...(overrideRows?.[row.key] ?? {})
    };
    seenKeys.add(mergedRow.key);
    rows.push(mergedRow);
  }

  for (const [key, overrideRow] of Object.entries(overrideRows)) {
    if (seenKeys.has(key)) {
      continue;
    }

    rows.push({
      key,
      label: overrideRow.label ?? key,
      ...overrideRow
    });
  }

  const specialCases = {
    ...(loadedConfig?.specialCases ?? {}),
    ...(targetOverrides?.specialCases ?? {})
  };

  return {
    configPath: path.relative(repoRoot, configPath) || path.basename(configPath),
    rows,
    specialCases
  };
}

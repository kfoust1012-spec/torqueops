import fs from "node:fs";
import path from "node:path";

const logPathArg = process.argv[2];

if (!logPathArg) {
  console.error("Usage: node tooling/scripts/assert-clean-e2e-log.mjs <log-file>");
  process.exit(1);
}

const logPath = path.resolve(process.cwd(), logPathArg);

if (!fs.existsSync(logPath)) {
  console.error(`E2E log file not found: ${logPath}`);
  process.exit(1);
}

const log = fs.readFileSync(logPath, "utf8");

const blockedWarningPatterns = [
  {
    label: "Next allowedDevOrigins regression",
    pattern: /Cross origin request detected .*allowedDevOrigins/i
  },
  {
    label: "Expo router Babel deprecation",
    pattern: /expo-router\/babel is deprecated/i
  },
  {
    label: "Expo SDK compatibility mismatch",
    pattern: /The following packages should be updated for best compatibility with the installed expo version:/i
  },
  {
    label: "Expo outdated dependency summary",
    pattern: /Found outdated dependencies/i
  },
  {
    label: "Expo compatibility warning",
    pattern: /Your project may not work correctly until you install the expected versions of the packages\./i
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
  },
  {
    label: "Next web uncaught exception",
    pattern: /\[NextWeb\].*uncaughtException:/i
  },
  {
    label: "Expo web uncaught exception",
    pattern: /\[ExpoWeb\].*uncaughtException:/i
  },
  {
    label: "Next web unhandled rejection",
    pattern: /\[NextWeb\].*unhandledRejection/i
  },
  {
    label: "Expo web unhandled rejection",
    pattern: /\[ExpoWeb\].*unhandledRejection/i
  },
  {
    label: "Next web aborted request exception",
    pattern: /\[NextWeb\].*Error:\s*aborted/i
  },
  {
    label: "Next web connection reset exception",
    pattern: /\[NextWeb\].*ECONNRESET/i
  },
  {
    label: "Expo web aborted request exception",
    pattern: /\[ExpoWeb\].*Error:\s*aborted/i
  },
  {
    label: "Expo web connection reset exception",
    pattern: /\[ExpoWeb\].*ECONNRESET/i
  },
  {
    label: "Supabase auth rejection code",
    pattern: /"code":"PGRST30\d"/i
  },
  {
    label: "Supabase JWT rejection message",
    pattern: /"message":"[^"]*JWT[^"]*"/i
  },
  {
    label: "Supabase auth token rejection",
    pattern: /(?:invalid|expired)\s+jwt|jwterror|jwt issued at future/i
  }
];

const matches = blockedWarningPatterns
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

if (matches.length > 0) {
  console.error("Blocked startup warning regressions detected in e2e log:");

  for (const match of matches) {
    console.error(`- ${match.label}: ${match.excerpt}`);
  }

  process.exit(1);
}

console.log(`E2E startup log is clean: ${path.relative(process.cwd(), logPath)}`);

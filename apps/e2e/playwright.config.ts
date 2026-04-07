import { defineConfig } from "@playwright/test";

const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "http://127.0.0.1:3000";
const mobileWebBaseUrl = process.env.E2E_MOBILE_BASE_URL ?? "http://127.0.0.1:19016";
const requestedSpecs = process.argv
  .slice(2)
  .filter((arg) => arg && !arg.startsWith("-"));
const runWebSpecs =
  requestedSpecs.length === 0 ||
  requestedSpecs.some((arg) => arg.includes("web-") || arg.includes("web/") || arg.includes("web\\"));
const runMobileSpecs =
  requestedSpecs.length === 0 ||
  requestedSpecs.some(
    (arg) =>
      arg.includes("mobile-") ||
      arg.includes("mobile/") ||
      arg.includes("mobile\\") ||
      arg.includes("office-to-field")
  );
const needsWebServer = runWebSpecs || runMobileSpecs;

export default defineConfig({
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : [["list"]],
  testDir: "./tests",
  timeout: 90_000,
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure"
  },
  webServer: [
    ...(needsWebServer
      ? [
          {
            command: "pnpm --filter @mobile-mechanic/web e2e:start",
            gracefulShutdown: {
              signal: "SIGTERM",
              timeout: 15_000
            },
            name: "NextWeb",
            reuseExistingServer: true,
            timeout: 180_000,
            url: `${webBaseUrl}/login`
          }
        ]
      : []),
    ...(runMobileSpecs
      ? [
          {
            command:
              `powershell -NoProfile -Command "$connections = Get-NetTCPConnection -LocalPort 19016 -State Listen -ErrorAction SilentlyContinue; foreach ($connection in $connections) { Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue }; $env:CI='1'; $env:EXPO_PUBLIC_WEB_APP_URL='${webBaseUrl}'; pnpm --filter @mobile-mechanic/mobile exec expo start --web --port 19016 --clear"`,
            gracefulShutdown: {
              signal: "SIGTERM",
              timeout: 15_000
            },
            name: "ExpoWeb",
            reuseExistingServer: false,
            timeout: 240_000,
            url: `${mobileWebBaseUrl}/login`
          }
        ]
      : [])
  ]
});

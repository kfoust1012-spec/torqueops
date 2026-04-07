import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webEnvPath = path.join(repoRoot, "apps", "web", ".env.local");
const mobileEnvPath = path.join(repoRoot, "apps", "mobile", ".env.local");
const supabaseCli = "pnpm exec supabase";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function writeEnvFileIfMissing(filePath, contents) {
  if (fs.existsSync(filePath)) {
    console.log(`Keeping existing env file: ${path.relative(repoRoot, filePath)}`);
    return;
  }

  fs.writeFileSync(filePath, `${contents.trim()}\n`, "utf8");
  console.log(`Created ${path.relative(repoRoot, filePath)}`);
}

function getSupabaseStatus() {
  const output = execSync(
    `${supabaseCli} status -o json`,
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  return JSON.parse(output);
}

function buildWebEnv(status) {
  const appUrl = process.env.E2E_WEB_BASE_URL ?? "http://127.0.0.1:3000";

  return `
NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.PUBLISHABLE_KEY}
NEXT_PUBLIC_TOMTOM_API_KEY=
TOMTOM_API_KEY=
APP_URL=${appUrl}
SUPABASE_SERVICE_ROLE_KEY=${status.SECRET_KEY}
CUSTOMER_DOCUMENT_TOKEN_SECRET=e2e-customer-document-token-secret
PROCUREMENT_PROVIDER_CREDENTIAL_SECRET=e2e-procurement-provider-secret
SMS_PROVIDER_CREDENTIAL_SECRET=e2e-sms-provider-secret
STRIPE_SECRET_KEY=stripe_test_e2e_placeholder
STRIPE_WEBHOOK_SECRET=whsec_e2e_placeholder
COMMUNICATIONS_PROCESS_SECRET=e2e-communications-process-secret
COMMUNICATIONS_FROM_EMAIL=
COMMUNICATIONS_REPLY_TO_EMAIL=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
COMMUNICATIONS_FROM_PHONE=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
CARFAX_API_KEY=
CARFAX_API_BASE_URL=
`;
}

function buildMobileEnv(status) {
  return `
EXPO_PUBLIC_SUPABASE_URL=${status.API_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${status.PUBLISHABLE_KEY}
`;
}

function main() {
  const status = getSupabaseStatus();
  writeEnvFileIfMissing(webEnvPath, buildWebEnv(status));
  writeEnvFileIfMissing(mobileEnvPath, buildMobileEnv(status));

  const webEnv = loadEnvFile(webEnvPath);
  const mobileEnv = loadEnvFile(mobileEnvPath);

  if (!webEnv || !mobileEnv) {
    throw new Error("Failed to prepare local env files for e2e.");
  }
}

main();

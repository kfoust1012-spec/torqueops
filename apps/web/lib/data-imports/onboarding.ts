import type {
  DataImportRun,
  Json,
  MigrationSourceAccount,
  ShopmonkeyMigrationSourceSettings
} from "@mobile-mechanic/types";

export const shopmonkeyOnboardingStepIds = [
  "connect",
  "verify",
  "import",
  "review",
  "webhook"
] as const;

export type ShopmonkeyOnboardingStepId = (typeof shopmonkeyOnboardingStepIds)[number];
export type ShopmonkeyOnboardingStepStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete";

export type ShopmonkeyOnboardingStep = {
  description: string;
  href: string;
  id: ShopmonkeyOnboardingStepId;
  label: string;
  status: ShopmonkeyOnboardingStepStatus;
};

export type ShopmonkeyOnboardingReadinessState =
  | "not_started"
  | "needs_verification"
  | "ready_to_import"
  | "import_in_progress"
  | "review_results"
  | "cutover_sync_pending"
  | "cutover_ready";

export type ShopmonkeyOnboardingReadiness = {
  state: ShopmonkeyOnboardingReadinessState;
  summary: string;
};

type ShopmonkeyOnboardingInput = {
  account: MigrationSourceAccount | null;
  latestRun: DataImportRun | null;
};

const SHOPMONKEY_SETTINGS_HREF = "/dashboard/settings/data-imports/shopmonkey";
const SHOPMONKEY_ONBOARDING_HREF = "/dashboard/settings/data-imports/shopmonkey/onboarding";

function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function toOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getShopmonkeyMigrationSourceSettings(
  settingsJson: Json | null | undefined
): ShopmonkeyMigrationSourceSettings {
  const settings = toJsonObject(settingsJson);

  return {
    apiKeyHint: toOptionalString(settings.apiKeyHint),
    lastWebhookId: toOptionalString(settings.lastWebhookId),
    lastWebhookOperation: toOptionalString(settings.lastWebhookOperation),
    lastWebhookReceivedAt: toOptionalString(settings.lastWebhookReceivedAt),
    lastWebhookTable: toOptionalString(settings.lastWebhookTable),
    webhookUrl: toOptionalString(settings.webhookUrl)
  };
}

function hasConfiguredAccount(input: ShopmonkeyOnboardingInput) {
  return Boolean(
    input.account &&
      input.account.status !== "disconnected" &&
      input.account.credentialHint
  );
}

function hasVerifiedConnection(input: ShopmonkeyOnboardingInput) {
  return Boolean(
    input.account &&
      input.account.status === "connected" &&
      input.account.lastVerifiedAt
  );
}

function isImportActive(run: DataImportRun | null) {
  return Boolean(run && ["queued", "processing", "paused"].includes(run.status));
}

function hasCompletedImport(run: DataImportRun | null) {
  return run?.status === "completed";
}

function hasReceivedWebhook(input: ShopmonkeyOnboardingInput) {
  const settings = getShopmonkeyMigrationSourceSettings(input.account?.settingsJson);
  return Boolean(settings.lastWebhookReceivedAt);
}

function buildReviewHref(run: DataImportRun | null) {
  return run
    ? `/dashboard/settings/data-imports/shopmonkey/runs/${run.id}`
    : `${SHOPMONKEY_SETTINGS_HREF}#history-step`;
}

function resolveConnectStepStatus(input: ShopmonkeyOnboardingInput): ShopmonkeyOnboardingStepStatus {
  return hasConfiguredAccount(input) ? "complete" : "in_progress";
}

function resolveVerifyStepStatus(input: ShopmonkeyOnboardingInput): ShopmonkeyOnboardingStepStatus {
  if (!hasConfiguredAccount(input)) {
    return "not_started";
  }

  return hasVerifiedConnection(input) ? "complete" : "in_progress";
}

function resolveImportStepStatus(input: ShopmonkeyOnboardingInput): ShopmonkeyOnboardingStepStatus {
  if (!hasConfiguredAccount(input)) {
    return "not_started";
  }

  if (!hasVerifiedConnection(input)) {
    return "blocked";
  }

  if (hasCompletedImport(input.latestRun)) {
    return "complete";
  }

  return "in_progress";
}

function resolveReviewStepStatus(input: ShopmonkeyOnboardingInput): ShopmonkeyOnboardingStepStatus {
  if (!input.latestRun) {
    return "not_started";
  }

  if (isImportActive(input.latestRun)) {
    return "blocked";
  }

  if (hasCompletedImport(input.latestRun)) {
    return "complete";
  }

  return "in_progress";
}

function resolveWebhookStepStatus(input: ShopmonkeyOnboardingInput): ShopmonkeyOnboardingStepStatus {
  const settings = getShopmonkeyMigrationSourceSettings(input.account?.settingsJson);

  if (!hasCompletedImport(input.latestRun)) {
    return input.latestRun ? "blocked" : "not_started";
  }

  if (hasReceivedWebhook(input)) {
    return "complete";
  }

  return settings.webhookUrl ? "in_progress" : "blocked";
}

export function buildShopmonkeyOnboardingSteps(
  input: ShopmonkeyOnboardingInput
): ShopmonkeyOnboardingStep[] {
  return [
    {
      id: "connect",
      label: "Save API key",
      description:
        "Store the Shopmonkey API key and display name in the company migration account record.",
      href: `${SHOPMONKEY_SETTINGS_HREF}#connect-step`,
      status: resolveConnectStepStatus(input)
    },
    {
      id: "verify",
      label: "Verify access",
      description:
        "Confirm the saved Shopmonkey credential can reach the source account before any import runs start.",
      href: `${SHOPMONKEY_SETTINGS_HREF}#connect-step`,
      status: resolveVerifyStepStatus(input)
    },
    {
      id: "import",
      label: "Run initial import",
      description:
        "Kick off the first full-history import for customers, vehicles, jobs, estimates, invoices, inspections, and attachments.",
      href: `${SHOPMONKEY_SETTINGS_HREF}#import-step`,
      status: resolveImportStepStatus(input)
    },
    {
      id: "review",
      label: "Review results",
      description:
        "Open the latest run, inspect entity counts, and resolve any migration failures before cutover.",
      href: buildReviewHref(input.latestRun),
      status: resolveReviewStepStatus(input)
    },
    {
      id: "webhook",
      label: "Enable cutover sync",
      description:
        "Paste the generated webhook URL into Shopmonkey so customer, vehicle, and order changes continue syncing during cutover.",
      href: `${SHOPMONKEY_SETTINGS_HREF}#webhook-step`,
      status: resolveWebhookStepStatus(input)
    }
  ];
}

export function getShopmonkeyOnboardingPrimaryAction(input: ShopmonkeyOnboardingInput) {
  const firstIncomplete = buildShopmonkeyOnboardingSteps(input).find(
    (step) => step.status !== "complete"
  );

  return {
    href: firstIncomplete?.href ?? SHOPMONKEY_ONBOARDING_HREF,
    label: firstIncomplete ? `Continue: ${firstIncomplete.label}` : "Review migration readiness"
  };
}

export function getShopmonkeyOnboardingReadiness(
  input: ShopmonkeyOnboardingInput
): ShopmonkeyOnboardingReadiness {
  if (!hasConfiguredAccount(input)) {
    return {
      state: "not_started",
      summary: "Save a Shopmonkey API key to start the migration flow."
    };
  }

  if (!hasVerifiedConnection(input)) {
    return {
      state: "needs_verification",
      summary: "Verify the saved Shopmonkey connection before starting the initial import."
    };
  }

  if (!input.latestRun) {
    return {
      state: "ready_to_import",
      summary: "The connection is verified. Start the initial import run to pull historical shop data."
    };
  }

  if (isImportActive(input.latestRun)) {
    return {
      state: "import_in_progress",
      summary: "The initial import is still running. Wait for it to finish, then review the run details."
    };
  }

  if (input.latestRun.status === "failed") {
    return {
      state: "review_results",
      summary: "The latest import run failed. Open the run details, resolve the blocking issue, and rerun the import."
    };
  }

  if (hasCompletedImport(input.latestRun) && !hasReceivedWebhook(input)) {
    return {
      state: "cutover_sync_pending",
      summary:
        "The initial import finished. Review the imported records and add the webhook URL in Shopmonkey so delta sync can keep data current during cutover."
    };
  }

  return {
    state: "cutover_ready",
    summary:
      "Initial import finished and webhook traffic has been recorded. Spot-check imported data and coordinate the final cutover from Shopmonkey."
  };
}

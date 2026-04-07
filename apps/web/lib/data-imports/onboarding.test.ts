import { describe, expect, it } from "vitest";

import type { DataImportRun, MigrationSourceAccount } from "@mobile-mechanic/types";

import {
  buildShopmonkeyOnboardingSteps,
  getShopmonkeyMigrationSourceSettings,
  getShopmonkeyOnboardingPrimaryAction,
  getShopmonkeyOnboardingReadiness
} from "./onboarding";

function createAccount(
  overrides: Partial<MigrationSourceAccount> = {}
): MigrationSourceAccount {
  return {
    capabilitiesJson: {},
    companyId: "company-1",
    createdAt: "2026-03-24T10:00:00.000Z",
    credentialHint: "ab••••12",
    displayName: "Shopmonkey",
    id: "account-1",
    lastErrorMessage: null,
    lastVerifiedAt: null,
    provider: "shopmonkey",
    settingsJson: {
      apiKeyHint: "ab••••12",
      webhookUrl: "https://example.com/api/webhooks/imports/shopmonkey/account-1"
    },
    status: "action_required",
    updatedAt: "2026-03-24T10:00:00.000Z",
    ...overrides
  };
}

function createRun(overrides: Partial<DataImportRun> = {}): DataImportRun {
  return {
    companyId: "company-1",
    createdAt: "2026-03-24T10:00:00.000Z",
    finishedAt: null,
    id: "run-1",
    lastErrorMessage: null,
    lastHeartbeatAt: "2026-03-24T10:05:00.000Z",
    optionsJson: {},
    provider: "shopmonkey",
    sourceAccountId: "account-1",
    startedAt: "2026-03-24T10:00:00.000Z",
    startedByUserId: "user-1",
    status: "queued",
    summaryJson: {},
    updatedAt: "2026-03-24T10:00:00.000Z",
    ...overrides
  };
}

describe("shopmonkey onboarding helpers", () => {
  it("starts with the API key step when no account has been configured", () => {
    const readiness = getShopmonkeyOnboardingReadiness({
      account: null,
      latestRun: null
    });
    const primaryAction = getShopmonkeyOnboardingPrimaryAction({
      account: null,
      latestRun: null
    });

    expect(readiness.state).toBe("not_started");
    expect(primaryAction.label).toContain("Save API key");
    expect(buildShopmonkeyOnboardingSteps({ account: null, latestRun: null })[0]?.status).toBe(
      "in_progress"
    );
  });

  it("moves a verified company into import and review states", () => {
    const verifiedAccount = createAccount({
      lastVerifiedAt: "2026-03-24T10:01:00.000Z",
      status: "connected"
    });
    const completedRun = createRun({
      finishedAt: "2026-03-24T10:15:00.000Z",
      status: "completed"
    });
    const input = {
      account: verifiedAccount,
      latestRun: completedRun
    };
    const steps = buildShopmonkeyOnboardingSteps(input);

    expect(getShopmonkeyOnboardingReadiness(input).state).toBe("cutover_sync_pending");
    expect(steps.find((step) => step.id === "import")?.status).toBe("complete");
    expect(steps.find((step) => step.id === "review")?.status).toBe("complete");
    expect(steps.find((step) => step.id === "webhook")?.status).toBe("in_progress");
    expect(getShopmonkeyOnboardingPrimaryAction(input).label).toContain("Enable cutover sync");
  });

  it("marks webhook sync complete once webhook traffic has been recorded", () => {
    const account = createAccount({
      lastVerifiedAt: "2026-03-24T10:01:00.000Z",
      settingsJson: {
        apiKeyHint: "ab••••12",
        lastWebhookReceivedAt: "2026-03-24T11:00:00.000Z",
        webhookUrl: "https://example.com/api/webhooks/imports/shopmonkey/account-1"
      },
      status: "connected"
    });
    const run = createRun({
      finishedAt: "2026-03-24T10:15:00.000Z",
      status: "completed"
    });

    expect(getShopmonkeyMigrationSourceSettings(account.settingsJson).lastWebhookReceivedAt).toBe(
      "2026-03-24T11:00:00.000Z"
    );
    expect(
      getShopmonkeyOnboardingReadiness({
        account,
        latestRun: run
      }).state
    ).toBe("cutover_ready");
    expect(
      buildShopmonkeyOnboardingSteps({
        account,
        latestRun: run
      }).find((step) => step.id === "webhook")?.status
    ).toBe("complete");
  });
});

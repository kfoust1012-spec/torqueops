import { existsSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { chromium, type BrowserContext, type Page } from "playwright-core";

const RETAILER_BROWSER_ENV_KEYS = [
  "RETAILER_LOOKUP_BROWSER_PATH",
  "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
  "CHROME_EXECUTABLE_PATH",
  "EDGE_EXECUTABLE_PATH"
] as const;
const DEFAULT_RETAILER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type LaunchRetailerBrowserContextInput = {
  persistentProfileKey?: string | null | undefined;
  resetProfile?: boolean | undefined;
  visible?: boolean | undefined;
};

type LaunchRetailerBrowserContextResult = {
  close: () => Promise<void>;
  context: BrowserContext;
  page: Page;
  profileDir: string | null;
};

function getPreferredBrowserPaths() {
  if (process.platform === "win32") {
    return [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
  }

  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ];
}

function getRetailerBrowserHeadlessMode() {
  const configuredValue = process.env.RETAILER_LOOKUP_BROWSER_MODE?.trim().toLowerCase();

  if (configuredValue === "headless") {
    return true;
  }

  if (configuredValue === "headed") {
    return false;
  }

  return process.platform !== "win32";
}

function getRetailerBrowserArgs(visible: boolean) {
  const args = ["--disable-dev-shm-usage", "--no-sandbox"];

  if (!getRetailerBrowserHeadlessMode() && visible) {
    args.push("--new-window");
  }

  return args;
}

function sanitizeRetailerProfileKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "default";
}

export function resolveRetailBrowserExecutablePath() {
  for (const envKey of RETAILER_BROWSER_ENV_KEYS) {
    const configuredPath = process.env[envKey];

    if (configuredPath && existsSync(configuredPath)) {
      return configuredPath;
    }
  }

  return getPreferredBrowserPaths().find((candidate) => existsSync(candidate)) ?? null;
}

export function getRetailerBrowserProfileDir(profileKey: string) {
  return join(process.cwd(), ".retailer-browser", sanitizeRetailerProfileKey(profileKey));
}

async function ensureRetailerBrowserProfileDir(profileDir: string, resetProfile: boolean) {
  if (resetProfile && existsSync(profileDir)) {
    rmSync(profileDir, { force: true, recursive: true });
  }

  await mkdir(profileDir, { recursive: true });
}

export async function launchRetailerBrowserContext(
  input: LaunchRetailerBrowserContextInput = {}
): Promise<LaunchRetailerBrowserContextResult> {
  const executablePath = resolveRetailBrowserExecutablePath();

  if (!executablePath) {
    throw new Error(
      "Retailer automation needs a local Chrome or Edge install. Set RETAILER_LOOKUP_BROWSER_PATH if the browser lives elsewhere."
    );
  }

  const headless = getRetailerBrowserHeadlessMode();
  const visible = Boolean(input.visible);
  const launchOptions = {
    executablePath,
    headless,
    args: getRetailerBrowserArgs(visible)
  };

  if (input.persistentProfileKey) {
    const profileDir = getRetailerBrowserProfileDir(input.persistentProfileKey);
    await ensureRetailerBrowserProfileDir(profileDir, Boolean(input.resetProfile));

    const context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions,
      locale: "en-US",
      userAgent: DEFAULT_RETAILER_USER_AGENT,
      viewport: {
        height: 1200,
        width: 1440
      }
    });
    const page = context.pages()[0] ?? (await context.newPage());

    return {
      close: async () => {
        await context.close();
      },
      context,
      page,
      profileDir
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    locale: "en-US",
    userAgent: DEFAULT_RETAILER_USER_AGENT,
    viewport: {
      height: 1200,
      width: 1440
    }
  });
  const page = await context.newPage();

  return {
    close: async () => {
      await context.close();
      await browser.close();
    },
    context,
    page,
    profileDir: null
  };
}

export async function acceptRetailerCookieBanner(page: Page) {
  const acceptButton = page.getByRole("button", { name: /^Accept$/i }).first();

  try {
    if (await acceptButton.isVisible({ timeout: 1_500 })) {
      await acceptButton.click({ timeout: 3_000 });
    }
  } catch {
    // Cookie banners are optional and should never fail retailer automation.
  }
}

export function openRetailerProfileWindow(input: { profileDir: string; url: string }) {
  const executablePath = resolveRetailBrowserExecutablePath();

  if (!executablePath) {
    throw new Error(
      "Retailer automation needs a local Chrome or Edge install. Set RETAILER_LOOKUP_BROWSER_PATH if the browser lives elsewhere."
    );
  }

  const launchedProcess = spawn(
    executablePath,
    [`--user-data-dir=${input.profileDir}`, "--new-window", input.url],
    {
      detached: true,
      stdio: "ignore"
    }
  );

  launchedProcess.unref();
}

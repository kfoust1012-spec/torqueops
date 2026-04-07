import { existsSync, statSync } from "node:fs";

import {
  getPurchaseOrderById,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import type {
  PurchaseOrderDetail,
  PurchaseOrderLine,
  SupplierAccount,
  SupplierCartDetail
} from "@mobile-mechanic/types";

import {
  acceptRetailerCookieBanner,
  getRetailerBrowserProfileDir,
  launchRetailerBrowserContext,
  openRetailerProfileWindow
} from "../retailer-browser";

const OREILLY_CART_URL = "https://www.oreillyauto.com/cart";
const OREILLY_SUPPLIER_LABEL = "O'Reilly Auto Parts";

type RetailerCartLineCandidate = {
  description: string;
  partNumber: string | null;
  quantity: number;
};

export type RetailerCartSupport = {
  eligibleLineCount: number;
  provider: "oreilly";
  providerLabel: string;
  reason: string | null;
  supported: boolean;
};

export type PreparedRetailerCartState = {
  cartUrl: string;
  preparedAt: string | null;
  profileDir: string;
  provider: "oreilly";
  providerLabel: string;
  ready: boolean;
};

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function isOReillySupplierAccount(supplierAccount: Pick<SupplierAccount, "externalUrl" | "name">) {
  const normalizedName = normalizeWhitespace(supplierAccount.name).toLowerCase();

  if (normalizedName.includes("oreilly") || normalizedName.includes("o'reilly")) {
    return true;
  }

  if (!supplierAccount.externalUrl) {
    return false;
  }

  try {
    return new URL(supplierAccount.externalUrl).hostname.toLowerCase().includes("oreillyauto.com");
  } catch {
    return supplierAccount.externalUrl.toLowerCase().includes("oreillyauto.com");
  }
}

function buildRetailerCartLineCandidates(
  lines: Array<
    | Pick<PurchaseOrderLine, "description" | "partNumber" | "quantityOrdered" | "supplierPartNumber">
    | {
        description: string;
        partNumber: string | null;
        quantity: number;
        supplierPartNumber: string | null;
      }
  >
) {
  return lines.map((line) => ({
    description: normalizeWhitespace(line.description),
    partNumber: normalizeWhitespace(line.supplierPartNumber ?? line.partNumber) || null,
    quantity:
      "quantityOrdered" in line
        ? Number(line.quantityOrdered)
        : Number(line.quantity)
  }));
}

function validateRetailerCartLines(lines: RetailerCartLineCandidate[]) {
  if (!lines.length) {
    return "At least one priced part line is required before retailer cart prep can run.";
  }

  const missingPartNumberLine = lines.find((line) => !line.partNumber);

  if (missingPartNumberLine) {
    return `Retailer cart prep needs an exact supplier part number for ${missingPartNumberLine.description || "each line"}.`;
  }

  const fractionalQuantityLine = lines.find(
    (line) => Math.abs(line.quantity - Math.round(line.quantity)) > 0.001 || line.quantity <= 0
  );

  if (fractionalQuantityLine) {
    return `Retailer cart prep currently supports whole-number quantities only. Adjust ${fractionalQuantityLine.description || "this line"} before ordering.`;
  }

  return null;
}

function getRetailerCartSupportFromLines(
  supplierAccount: Pick<SupplierAccount, "externalUrl" | "name">,
  lines: RetailerCartLineCandidate[]
): RetailerCartSupport {
  if (!isOReillySupplierAccount(supplierAccount)) {
    return {
      eligibleLineCount: 0,
      provider: "oreilly",
      providerLabel: OREILLY_SUPPLIER_LABEL,
      reason: "One-click retailer cart prep is currently available for O'Reilly lines only.",
      supported: false
    };
  }

  const invalidReason = validateRetailerCartLines(lines);

  if (invalidReason) {
    return {
      eligibleLineCount: 0,
      provider: "oreilly",
      providerLabel: OREILLY_SUPPLIER_LABEL,
      reason: invalidReason,
      supported: false
    };
  }

  return {
    eligibleLineCount: lines.length,
    provider: "oreilly",
    providerLabel: OREILLY_SUPPLIER_LABEL,
    reason: null,
    supported: true
  };
}

function buildPurchaseOrderRetailerProfileKey(purchaseOrderId: string) {
  return `oreilly-po-${purchaseOrderId}`;
}

function buildOReillySearchUrl(query: string) {
  return `https://www.oreillyauto.com/search?q=${encodeURIComponent(query)}`;
}

async function ensureOReillySearchResults(page: Awaited<ReturnType<typeof launchRetailerBrowserContext>>["page"], query: string) {
  await page.goto(buildOReillySearchUrl(query), {
    timeout: 25_000,
    waitUntil: "domcontentloaded"
  });
  await acceptRetailerCookieBanner(page);

  const pageTitle = normalizeWhitespace(await page.title()).toLowerCase();

  if (pageTitle.includes("access denied")) {
    throw new Error("O'Reilly blocked the retailer lookup request. Try again in a moment.");
  }

  try {
    await page.waitForSelector("article button", { timeout: 15_000 });
  } catch {
    throw new Error("O'Reilly search did not return products in a usable format.");
  }
}

async function findOReillySearchArticle(
  page: Awaited<ReturnType<typeof launchRetailerBrowserContext>>["page"],
  partNumber: string
) {
  const matchingArticles = page.locator("article").filter({ hasText: partNumber });
  const articleCount = await matchingArticles.count();

  for (let index = 0; index < articleCount; index += 1) {
    const article = matchingArticles.nth(index);
    const addToCartButton = article.getByRole("button", { name: /Add To Cart/i }).first();

    if (await addToCartButton.count()) {
      return article;
    }
  }

  return null;
}

async function addOReillyLineToCart(
  page: Awaited<ReturnType<typeof launchRetailerBrowserContext>>["page"],
  line: RetailerCartLineCandidate
) {
  const partNumber = line.partNumber;

  if (!partNumber) {
    throw new Error("Retailer cart prep requires an exact supplier part number.");
  }

  await ensureOReillySearchResults(page, partNumber);

  const article = await findOReillySearchArticle(page, partNumber);

  if (!article) {
    throw new Error(`O'Reilly could not find part ${partNumber} during cart prep.`);
  }

  const addToCartButton = article.getByRole("button", { name: /Add To Cart/i }).first();
  await addToCartButton.click({ timeout: 10_000 });
  await page.waitForSelector("text=Item has been added to your cart", { timeout: 15_000 });

  const continueShoppingButton = page.getByRole("button", { name: /Continue Shopping/i }).first();

  try {
    if (await continueShoppingButton.isVisible({ timeout: 2_000 })) {
      await continueShoppingButton.click({ timeout: 5_000 });
    }
  } catch {
    // The add-to-cart modal is inconsistent across result layouts. Proceed if it does not appear.
  }
}

async function adjustOReillyCartQuantity(
  page: Awaited<ReturnType<typeof launchRetailerBrowserContext>>["page"],
  partNumber: string,
  targetQuantity: number
) {
  if (targetQuantity <= 1) {
    return;
  }

  const article = page.locator("article").filter({ hasText: partNumber }).first();
  await article.waitFor({ state: "visible", timeout: 15_000 });

  const quantityInput = article.getByRole("textbox", { name: /Item Quantity/i }).first();
  const increaseButton = article.getByRole("button", { name: /Add One Quantity/i }).first();
  const decreaseButton = article.getByRole("button", { name: /Decrease One Quantity/i }).first();

  let currentQuantity = Number(await quantityInput.inputValue());

  while (currentQuantity < targetQuantity) {
    await increaseButton.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    currentQuantity = Number(await quantityInput.inputValue());
  }

  while (currentQuantity > targetQuantity) {
    await decreaseButton.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    currentQuantity = Number(await quantityInput.inputValue());
  }
}

export function getRetailerCartSupportForSupplierCart(detail: SupplierCartDetail): RetailerCartSupport {
  return getRetailerCartSupportFromLines(
    detail.supplierAccount,
    buildRetailerCartLineCandidates(
      detail.lines.map(({ cartLine, requestLine }) => ({
        description: requestLine.description,
        partNumber: requestLine.partNumber,
        quantity: cartLine.quantity,
        supplierPartNumber: cartLine.supplierPartNumber
      }))
    )
  );
}

export function getRetailerCartSupportForPurchaseOrder(
  detail: PurchaseOrderDetail
): RetailerCartSupport {
  return getRetailerCartSupportFromLines(
    detail.supplierAccount,
    buildRetailerCartLineCandidates(detail.lines)
  );
}

export function getPreparedPurchaseOrderRetailerCartState(
  purchaseOrderId: string
): PreparedRetailerCartState {
  const profileDir = getRetailerBrowserProfileDir(buildPurchaseOrderRetailerProfileKey(purchaseOrderId));

  if (!existsSync(profileDir)) {
    return {
      cartUrl: OREILLY_CART_URL,
      preparedAt: null,
      profileDir,
      provider: "oreilly",
      providerLabel: OREILLY_SUPPLIER_LABEL,
      ready: false
    };
  }

  return {
    cartUrl: OREILLY_CART_URL,
    preparedAt: statSync(profileDir).mtime.toISOString(),
    profileDir,
    provider: "oreilly",
    providerLabel: OREILLY_SUPPLIER_LABEL,
    ready: true
  };
}

export async function preparePurchaseOrderRetailerCart(
  client: AppSupabaseClient,
  purchaseOrderId: string
) {
  const detailResult = await getPurchaseOrderById(client, purchaseOrderId);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Purchase order could not be loaded.");
  }

  const detail = detailResult.data;
  const support = getRetailerCartSupportForPurchaseOrder(detail);

  if (!support.supported) {
    throw new Error(support.reason ?? "This purchase order is not eligible for retailer cart prep.");
  }

  const retailerLines = buildRetailerCartLineCandidates(detail.lines);
  const browserSession = await launchRetailerBrowserContext({
    persistentProfileKey: buildPurchaseOrderRetailerProfileKey(purchaseOrderId),
    resetProfile: true
  });

  try {
    for (const line of retailerLines) {
      await addOReillyLineToCart(browserSession.page, line);
    }

    await browserSession.page.goto(OREILLY_CART_URL, {
      timeout: 25_000,
      waitUntil: "domcontentloaded"
    });

    for (const line of retailerLines) {
      if (!line.partNumber) {
        continue;
      }

      await adjustOReillyCartQuantity(
        browserSession.page,
        line.partNumber,
        Math.max(1, Math.round(line.quantity))
      );
    }
  } finally {
    await browserSession.close();
  }

  return getPreparedPurchaseOrderRetailerCartState(purchaseOrderId);
}

export function openPreparedPurchaseOrderRetailerCart(purchaseOrderId: string) {
  const preparedState = getPreparedPurchaseOrderRetailerCartState(purchaseOrderId);

  if (!preparedState.ready) {
    throw new Error("Prepare the retailer cart first before trying to open it.");
  }

  openRetailerProfileWindow({
    profileDir: preparedState.profileDir,
    url: preparedState.cartUrl
  });

  return preparedState;
}

import {
  buildEstimateSupplierBrowserSearchUrl,
  getEstimateLiveRetailerConnector
} from "@mobile-mechanic/core";
import type {
  EstimateLiveRetailerPartOffer,
  EstimateVehicleContextSnapshot
} from "@mobile-mechanic/types";

import {
  acceptRetailerCookieBanner,
  launchRetailerBrowserContext
} from "../../retailer-browser";
import {
  buildVehicleAwareRetailerSearchQuery,
  normalizeRetailerSearchWhitespace,
  parseRetailerCurrencyTextToCents
} from "./retailer-search-helpers";

export {
  buildVehicleAwareRetailerSearchQuery,
  parseRetailerCurrencyTextToCents
} from "./retailer-search-helpers";

const OREILLY_PROVIDER = "oreilly" as const;
const DEFAULT_RESULT_LIMIT = 4;
const OREILLY_LIVE_SEARCH_PROFILE_KEY = "oreilly-live-search";
const OREILLY_CONNECTOR = getEstimateLiveRetailerConnector(OREILLY_PROVIDER);

type OReillyDomOffer = {
  availabilityText: string | null;
  description: string;
  manufacturer: string | null;
  partNumber: string;
  quotedCoreChargeText: string | null;
  quotedUnitCostText: string | null;
  supplierUrl: string | null;
};

function buildOReillySearchUrl(query: string) {
  return (
    buildEstimateSupplierBrowserSearchUrl({
      connectorId: OREILLY_CONNECTOR.id,
      query
    }) ?? `https://www.oreillyauto.com/search?q=${encodeURIComponent(query)}`
  );
}

function normalizeOReillyDomOffer(
  offer: OReillyDomOffer,
  searchQuery: string,
  position: number
): EstimateLiveRetailerPartOffer | null {
  const description = normalizeRetailerSearchWhitespace(offer.description);
  const partNumber = normalizeRetailerSearchWhitespace(offer.partNumber);
  const quotedUnitCostCents = parseRetailerCurrencyTextToCents(offer.quotedUnitCostText);

  if (!description || !partNumber || quotedUnitCostCents === null) {
    return null;
  }

  return {
    id: `${OREILLY_PROVIDER}:${partNumber}:${position}`,
    provider: OREILLY_PROVIDER,
    supplierLabel: OREILLY_CONNECTOR.label,
    supplierUrl: offer.supplierUrl,
    manufacturer: normalizeRetailerSearchWhitespace(offer.manufacturer) || null,
    partNumber,
    description,
    quotedUnitCostCents,
    quotedCoreChargeCents: parseRetailerCurrencyTextToCents(offer.quotedCoreChargeText) ?? 0,
    availabilityText: normalizeRetailerSearchWhitespace(offer.availabilityText) || null,
    fitmentNotes:
      "Live O'Reilly site result captured inside the estimate builder. Confirm final fit on the retailer product page if prompted.",
    searchQuery
  };
}

export async function searchOReillyRetailerOffers(input: {
  limit?: number | undefined;
  query: string;
}) {
  const browserSession = await launchRetailerBrowserContext({
    persistentProfileKey: OREILLY_LIVE_SEARCH_PROFILE_KEY
  });

  try {
    const { page } = browserSession;
    const searchQuery = normalizeRetailerSearchWhitespace(input.query);

    if (!searchQuery) {
      throw new Error("Enter a part search before retailer lookup can run.");
    }

    await page.goto(buildOReillySearchUrl(searchQuery), {
      timeout: 25_000,
      waitUntil: "domcontentloaded"
    });
    await acceptRetailerCookieBanner(page);

    const pageTitle = normalizeRetailerSearchWhitespace(await page.title());

    if (pageTitle.toLowerCase().includes("access denied")) {
      throw new Error("O'Reilly blocked the live lookup request. Try again in a moment.");
    }

    try {
      await page.waitForSelector("article a[href*='/detail/']", { timeout: 15_000 });
    } catch {
      const bodyText = normalizeRetailerSearchWhitespace(
        await page.textContent("body").catch(() => "")
      );

      if (
        bodyText.toLowerCase().includes("0 results") ||
        bodyText.toLowerCase().includes("no results")
      ) {
        return [];
      }

      throw new Error("O'Reilly live search did not return products in a usable format.");
    }

    const domOffers = await page.$$eval(
      "article",
      (articles, limit) => {
        const normalize = (value: string | null | undefined) =>
          value?.replace(/\s+/g, " ").trim() ?? "";
        const maxResults =
          typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.min(limit, 8)) : 4;

        const findDefinitionValue = (article: Element, label: string) => {
          const terms = Array.from(article.querySelectorAll("dt"));

          for (const term of terms) {
            if (normalize(term.textContent).toLowerCase() !== label.toLowerCase()) {
              continue;
            }

            return normalize(term.nextElementSibling?.textContent);
          }

          return "";
        };

        const findAvailabilityText = (article: Element) => {
          const checkedRadio = Array.from(article.querySelectorAll("input[type='radio']")).find(
            (candidate) => (candidate as HTMLInputElement).checked
          );

          if (checkedRadio) {
            const candidateText = normalize(
              checkedRadio.parentElement?.parentElement?.textContent ??
                checkedRadio.parentElement?.textContent
            );
            const stockMatch = candidateText.match(
              /(In Stock\s*-\s*ready in [^.]+|Available within \d+\s*-\s*\d+ hours\.?|Delivery not available|Shipping restricted item|Deliver by [A-Za-z]{3}, [A-Za-z]{3,9} \d{1,2})/i
            );

            if (stockMatch?.[0]) {
              return normalize(stockMatch[0]);
            }
          }

          const articleText = normalize(article.textContent);
          const fallbackMatch = articleText.match(
            /(In Stock\s*-\s*ready in [^.]+|Available within \d+\s*-\s*\d+ hours\.?|Delivery not available|Shipping restricted item|Deliver by [A-Za-z]{3}, [A-Za-z]{3,9} \d{1,2})/i
          );

          return fallbackMatch?.[0] ? normalize(fallbackMatch[0]) : "";
        };

        return articles
          .map((article) => {
            const productLink = article.querySelector<HTMLAnchorElement>("a[href*='/detail/']");

            if (!productLink) {
              return null;
            }

            const supplierUrl = productLink.href || null;
            const description = normalize(productLink.textContent);
            const priceCandidates = Array.from(article.querySelectorAll("strong"))
              .map((element) => normalize(element.textContent))
              .filter((value) => /\$\s*[\d,]+(?:\.\d{2})?/.test(value));
            const articleText = normalize(article.textContent);
            const coreChargeMatch = articleText.match(
              /Refundable Core\s+\$[\d,]+(?:\.\d{2})?/i
            );

            return {
              availabilityText: findAvailabilityText(article) || null,
              description,
              manufacturer: findDefinitionValue(article, "Line:") || null,
              partNumber: findDefinitionValue(article, "Part #:"),
              quotedCoreChargeText: coreChargeMatch?.[0] ?? null,
              quotedUnitCostText: priceCandidates[0] ?? null,
              supplierUrl
            };
          })
          .filter((offer): offer is OReillyDomOffer => Boolean(offer))
          .slice(0, maxResults);
      },
      input.limit ?? DEFAULT_RESULT_LIMIT
    );

    return domOffers
      .map((offer, index) => normalizeOReillyDomOffer(offer, searchQuery, index))
      .filter((offer): offer is EstimateLiveRetailerPartOffer => Boolean(offer));
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      throw error;
    }

    throw new Error("Live O'Reilly lookup could not be completed.");
  } finally {
    await browserSession.close();
  }
}

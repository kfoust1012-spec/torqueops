const OREILLY_SUPPLIER_LABEL = "O'Reilly Auto Parts";
const OREILLY_SEARCH_URL = "https://www.oreillyauto.com/search?q=";
const OREILLY_CART_URL = "https://www.oreillyauto.com/cart";

function normalizeWhitespace(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseRetailerCurrencyTextToCents(value) {
  const match = normalizeWhitespace(value).match(/\$?\s*([\d,]+(?:\.\d{2})?)/);

  if (!match) {
    return null;
  }

  const numericValue = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(numericValue) ? Math.round(numericValue * 100) : null;
}

function encodeSessionPayload(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeSessionPayload(value) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  } catch {
    return null;
  }
}

function withSessionHash(url, payload) {
  return `${url}#mm-session=${encodeURIComponent(encodeSessionPayload(payload))}`;
}

function buildCartPrepSearchUrl(partNumber, sessionId) {
  return withSessionHash(`${OREILLY_SEARCH_URL}${encodeURIComponent(partNumber)}`, {
    mode: "cart-prep",
    provider: "oreilly",
    sessionId
  });
}

function buildCartPrepCartUrl(sessionId) {
  return withSessionHash(OREILLY_CART_URL, {
    mode: "cart-prep",
    provider: "oreilly",
    sessionId
  });
}

function getSessionFromLocation() {
  const hashValue = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const encodedPayload = new URLSearchParams(hashValue).get("mm-session");

  if (!encodedPayload) {
    return null;
  }

  return decodeSessionPayload(encodedPayload);
}

function readDefinitionValue(root, label) {
  const terms = Array.from(root.querySelectorAll("dt"));

  for (const term of terms) {
    if (normalizeWhitespace(term.textContent).toLowerCase() !== label.toLowerCase()) {
      continue;
    }

    return normalizeWhitespace(term.nextElementSibling?.textContent);
  }

  return "";
}

function readAvailabilityText(root) {
  const selectedDeliveryOption = Array.from(root.querySelectorAll("input[type='radio']")).find(
    (candidate) => candidate.checked
  );

  if (selectedDeliveryOption) {
    const candidateText = normalizeWhitespace(
      selectedDeliveryOption.parentElement?.parentElement?.textContent ??
        selectedDeliveryOption.parentElement?.textContent
    );
    const availabilityMatch = candidateText.match(
      /(In Stock\s*-\s*ready in [^.]+|Available within \d+\s*-\s*\d+ hours\.?|Delivery not available|Shipping restricted item|Deliver by [A-Za-z]{3}, [A-Za-z]{3,9} \d{1,2})/i
    );

    if (availabilityMatch?.[0]) {
      return normalizeWhitespace(availabilityMatch[0]);
    }
  }

  const bodyText = normalizeWhitespace(root.textContent);
  const availabilityMatch = bodyText.match(
    /(In Stock\s*-\s*ready in [^.]+|Available within \d+\s*-\s*\d+ hours\.?|Delivery not available|Shipping restricted item|Deliver by [A-Za-z]{3}, [A-Za-z]{3,9} \d{1,2})/i
  );

  return availabilityMatch?.[0] ? normalizeWhitespace(availabilityMatch[0]) : "";
}

function extractCoreChargeText(root) {
  const text = normalizeWhitespace(root.textContent);
  const match = text.match(/Refundable Core\s+\$[\d,]+(?:\.\d{2})?/i);
  return match?.[0] ?? null;
}

function buildOfferFromSearchArticle(article, session) {
  const productLink = article.querySelector("a[href*='/detail/']");

  if (!productLink) {
    return null;
  }

  const priceText = Array.from(article.querySelectorAll("strong"))
    .map((element) => normalizeWhitespace(element.textContent))
    .find((value) => /\$\s*[\d,]+(?:\.\d{2})?/.test(value));
  const description = normalizeWhitespace(productLink.textContent);
  const partNumber = readDefinitionValue(article, "Part #:");
  const unitCostCents = parseRetailerCurrencyTextToCents(priceText);

  if (!description || !partNumber || unitCostCents === null) {
    return null;
  }

  return {
    availabilityText: readAvailabilityText(article) || null,
    description,
    fitmentNotes:
      "Captured from a live O'Reilly browser session inside the estimate workflow. Confirm final fitment before checkout.",
    id: `oreilly:${partNumber}`,
    manufacturer: readDefinitionValue(article, "Line:") || null,
    partNumber,
    provider: "oreilly",
    quotedCoreChargeCents: parseRetailerCurrencyTextToCents(extractCoreChargeText(article)) ?? 0,
    quotedUnitCostCents: unitCostCents,
    searchQuery: session.query,
    supplierLabel: OREILLY_SUPPLIER_LABEL,
    supplierUrl: productLink.href || null
  };
}

function buildOfferFromProductPage(session) {
  const pageTitle = normalizeWhitespace(document.querySelector("h1")?.textContent);
  const bodyText = normalizeWhitespace(document.body.textContent);
  const partNumberMatch = bodyText.match(/Part #:\s*([A-Z0-9-]+)/i);
  const priceText = Array.from(document.querySelectorAll("strong"))
    .map((element) => normalizeWhitespace(element.textContent))
    .find((value) => /\$\s*[\d,]+(?:\.\d{2})?/.test(value));
  const unitCostCents = parseRetailerCurrencyTextToCents(priceText);

  if (!pageTitle || !partNumberMatch?.[1] || unitCostCents === null) {
    return null;
  }

  const manufacturerMatch = bodyText.match(/Line:\s*([A-Za-z0-9'&(). -]+)/i);

  return {
    availabilityText: readAvailabilityText(document.body) || null,
    description: pageTitle,
    fitmentNotes:
      "Captured from a live O'Reilly product page inside the estimate workflow. Confirm final fitment before checkout.",
    id: `oreilly:${partNumberMatch[1]}`,
    manufacturer: manufacturerMatch?.[1] ? normalizeWhitespace(manufacturerMatch[1]) : null,
    partNumber: normalizeWhitespace(partNumberMatch[1]),
    provider: "oreilly",
    quotedCoreChargeCents:
      parseRetailerCurrencyTextToCents(extractCoreChargeText(document.body)) ?? 0,
    quotedUnitCostCents: unitCostCents,
    searchQuery: session.query,
    supplierLabel: OREILLY_SUPPLIER_LABEL,
    supplierUrl: window.location.href
  };
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && typeof response.error === "string" && response.error.trim()) {
        reject(new Error(response.error));
        return;
      }

      resolve(response ?? {});
    });
  });
}

function buildCaptureButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.border = "none";
  button.style.borderRadius = "999px";
  button.style.background = "#24354c";
  button.style.color = "#ffffff";
  button.style.cursor = "pointer";
  button.style.fontSize = "12px";
  button.style.fontWeight = "700";
  button.style.letterSpacing = "0.04em";
  button.style.lineHeight = "1";
  button.style.padding = "10px 14px";
  button.style.textTransform = "uppercase";
  return button;
}

async function captureOfferForEstimate(session, offer, button) {
  button.disabled = true;
  button.textContent = "Capturing...";

  try {
    await sendRuntimeMessage({
      payload: {
        appTabId: session.appTabId,
        estimateId: session.estimateId,
        lineItemId: session.lineItemId,
        offer,
        sessionId: session.sessionId
      },
      type: "MM_EXTENSION_OREILLY_OFFER_CAPTURED"
    });
    button.textContent = "Captured";
    button.style.background = "#217042";
  } catch {
    button.disabled = false;
    button.textContent = "Capture failed";
    button.style.background = "#9c3f1e";
  }
}

function findButtonByPattern(root, pattern) {
  return Array.from(root.querySelectorAll("button")).find((button) =>
    pattern.test(
      normalizeWhitespace(button.getAttribute("aria-label") || button.textContent || "")
    )
  );
}

function detectAccessDenied() {
  const titleText = normalizeWhitespace(document.title).toLowerCase();
  const bodyText = normalizeWhitespace(document.body?.textContent).toLowerCase();

  return (
    titleText.includes("access denied") ||
    bodyText.includes("access denied") ||
    bodyText.includes("you don't have permission to access")
  );
}

async function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForCondition(predicate, options) {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const intervalMs = options?.intervalMs ?? 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const value = predicate();

    if (value) {
      return value;
    }

    await sleep(intervalMs);
  }

  return null;
}

async function maybeAcceptCookieBanner() {
  const button = findButtonByPattern(document, /accept|agree|continue/i);

  if (!button) {
    return;
  }

  try {
    button.click();
    await sleep(600);
  } catch {
    // Ignore cookie/banner failures and keep moving.
  }
}

function injectEstimateBadge(session) {
  if (document.getElementById("mm-oreilly-estimate-badge")) {
    return;
  }

  const badge = document.createElement("div");
  badge.id = "mm-oreilly-estimate-badge";
  badge.style.position = "fixed";
  badge.style.right = "20px";
  badge.style.bottom = "20px";
  badge.style.zIndex = "2147483647";
  badge.style.maxWidth = "320px";
  badge.style.padding = "12px 14px";
  badge.style.borderRadius = "16px";
  badge.style.background = "rgba(36, 53, 76, 0.96)";
  badge.style.boxShadow = "0 18px 40px rgba(12, 20, 36, 0.28)";
  badge.style.color = "#ffffff";
  badge.style.fontFamily = "Arial, sans-serif";
  badge.innerHTML = `
    <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.72;">Estimate connected</div>
    <div style="margin-top:4px; font-size:15px; font-weight:700;">${session.lineItemName || "Estimate part line"}</div>
    <div style="margin-top:6px; font-size:12px; line-height:1.45; opacity:0.8;">Use the injected <strong>Use in estimate</strong> buttons on this page to push the exact website part back into the estimate.</div>
  `;
  document.body.appendChild(badge);
}

function injectCartPrepBadge(session) {
  if (document.getElementById("mm-oreilly-cart-badge")) {
    return;
  }

  const badge = document.createElement("div");
  badge.id = "mm-oreilly-cart-badge";
  badge.style.position = "fixed";
  badge.style.right = "20px";
  badge.style.bottom = "20px";
  badge.style.zIndex = "2147483647";
  badge.style.maxWidth = "360px";
  badge.style.padding = "12px 14px";
  badge.style.borderRadius = "16px";
  badge.style.background = "rgba(36, 53, 76, 0.96)";
  badge.style.boxShadow = "0 18px 40px rgba(12, 20, 36, 0.28)";
  badge.style.color = "#ffffff";
  badge.style.fontFamily = "Arial, sans-serif";
  badge.innerHTML = `
    <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.72;">Purchase order connected</div>
    <div style="margin-top:4px; font-size:15px; font-weight:700;">${session.poNumber || "O'Reilly cart prep"}</div>
    <div style="margin-top:6px; font-size:12px; line-height:1.45; opacity:0.8;">This tab is being used by Mobile Mechanic to stage the live retailer cart. Test mode stops before checkout.</div>
  `;
  document.body.appendChild(badge);
}

function injectSearchResultButtons(session) {
  const articles = Array.from(document.querySelectorAll("article"));

  for (const article of articles) {
    if (article.getAttribute("data-mm-estimate-capture") === "ready") {
      continue;
    }

    const productLink = article.querySelector("a[href*='/detail/']");

    if (!productLink) {
      continue;
    }

    const captureButton = buildCaptureButton("Use in estimate");
    captureButton.addEventListener("click", () => {
      const offer = buildOfferFromSearchArticle(article, session);

      if (!offer) {
        captureButton.textContent = "Unavailable";
        captureButton.style.background = "#9c3f1e";
        captureButton.disabled = true;
        return;
      }

      void captureOfferForEstimate(session, offer, captureButton);
    });

    const buttonHost = document.createElement("div");
    buttonHost.style.marginTop = "10px";
    buttonHost.style.display = "flex";
    buttonHost.style.justifyContent = "flex-start";
    buttonHost.appendChild(captureButton);

    article.appendChild(buttonHost);
    article.setAttribute("data-mm-estimate-capture", "ready");
  }
}

function injectProductPageCaptureButton(session) {
  if (!window.location.pathname.includes("/detail/")) {
    return;
  }

  if (document.getElementById("mm-oreilly-product-capture")) {
    return;
  }

  const floatingAction = buildCaptureButton("Use this product in estimate");
  floatingAction.id = "mm-oreilly-product-capture";
  floatingAction.style.position = "fixed";
  floatingAction.style.right = "20px";
  floatingAction.style.bottom = "122px";
  floatingAction.style.zIndex = "2147483647";

  floatingAction.addEventListener("click", () => {
    const offer = buildOfferFromProductPage(session);

    if (!offer) {
      floatingAction.textContent = "Capture unavailable";
      floatingAction.style.background = "#9c3f1e";
      floatingAction.disabled = true;
      return;
    }

    void captureOfferForEstimate(session, offer, floatingAction);
  });

  document.body.appendChild(floatingAction);
}

function findSearchArticleForPartNumber(partNumber) {
  const normalizedPartNumber = normalizeWhitespace(partNumber);

  return Array.from(document.querySelectorAll("article")).find((article) => {
    const text = normalizeWhitespace(article.textContent);
    return (
      text.includes(normalizedPartNumber) && Boolean(findButtonByPattern(article, /Add To Cart/i))
    );
  });
}

async function waitForSearchArticle(partNumber) {
  return waitForCondition(() => findSearchArticleForPartNumber(partNumber), {
    timeoutMs: 15_000,
    intervalMs: 300
  });
}

async function continueShoppingIfPrompted() {
  const continueButton = await waitForCondition(
    () => findButtonByPattern(document, /Continue Shopping/i),
    {
      timeoutMs: 3_000,
      intervalMs: 250
    }
  );

  if (!continueButton) {
    return;
  }

  try {
    continueButton.click();
    await sleep(900);
  } catch {
    // The modal is inconsistent; keep moving if it does not respond.
  }
}

async function findCartContainerForPartNumber(partNumber) {
  return waitForCondition(() => {
    const normalizedPartNumber = normalizeWhitespace(partNumber);
    const candidates = Array.from(document.querySelectorAll("article, section, div"));

    return (
      candidates.find((candidate) => {
        const text = normalizeWhitespace(candidate.textContent);

        if (!text.includes(normalizedPartNumber)) {
          return false;
        }

        return (
          candidate.querySelector("input[aria-label*='Quantity']") ||
          findButtonByPattern(candidate, /Add One Quantity|Increase/i)
        );
      }) ?? null
    );
  });
}

async function adjustCartQuantity(partNumber, targetQuantity) {
  if (targetQuantity <= 1) {
    return;
  }

  const container = await findCartContainerForPartNumber(partNumber);

  if (!container) {
    throw new Error(`Cart item ${partNumber} could not be found for quantity adjustment.`);
  }

  const quantityInput =
    container.querySelector("input[aria-label*='Quantity']") ||
    container.querySelector("input[name*='quantity']") ||
    container.querySelector("input[id*='quantity']");
  const increaseButton = findButtonByPattern(container, /Add One Quantity|Increase/i);
  const decreaseButton = findButtonByPattern(container, /Decrease One Quantity|Decrease/i);

  if (!quantityInput || !increaseButton || !decreaseButton) {
    throw new Error(`Quantity controls for ${partNumber} are not available on the cart page.`);
  }

  let currentQuantity = Number(quantityInput.value);

  while (currentQuantity < targetQuantity) {
    increaseButton.click();
    await sleep(600);
    currentQuantity = Number(quantityInput.value);
  }

  while (currentQuantity > targetQuantity) {
    decreaseButton.click();
    await sleep(600);
    currentQuantity = Number(quantityInput.value);
  }
}

async function getCartPrepSession(sessionId) {
  return sendRuntimeMessage({
    payload: { sessionId },
    type: "MM_EXTENSION_OREILLY_CART_GET_SESSION"
  });
}

async function updateCartPrepSession(sessionId, patch) {
  return sendRuntimeMessage({
    payload: {
      patch,
      sessionId
    },
    type: "MM_EXTENSION_OREILLY_CART_UPDATE_SESSION"
  });
}

async function postCartStatus(session, payload) {
  return sendRuntimeMessage({
    payload: {
      ...payload,
      sessionId: session.sessionId
    },
    type: "MM_EXTENSION_OREILLY_CART_STATUS"
  });
}

async function failCartPrep(session, message, completedLineCount) {
  await postCartStatus(session, {
    completedLineCount,
    message,
    stage: "failed"
  }).catch(() => {});
}

async function ensureSearchMatchesLine(session, line) {
  const pageText = normalizeWhitespace(document.body.textContent);
  const encodedPartNumber = encodeURIComponent(line.partNumber);

  if (
    pageText.includes(line.partNumber) ||
    window.location.search.includes(encodedPartNumber)
  ) {
    return;
  }

  window.location.assign(buildCartPrepSearchUrl(line.partNumber, session.sessionId));
}

async function addCurrentLineToCart(session) {
  const currentLine = session.lines[session.currentLineIndex];

  if (!currentLine) {
    window.location.assign(buildCartPrepCartUrl(session.sessionId));
    return;
  }

  await ensureSearchMatchesLine(session, currentLine);
  await maybeAcceptCookieBanner();

  if (detectAccessDenied()) {
    await failCartPrep(
      session,
      "O'Reilly blocked the live cart-prep session. Check the real browser tab and try again.",
      session.currentLineIndex
    );
    return;
  }

  await postCartStatus(session, {
    completedLineCount: session.currentLineIndex,
    message: `Adding ${currentLine.partNumber} to the O'Reilly cart (${session.currentLineIndex + 1}/${session.lines.length}).`,
    stage: "preparing",
    totalLines: session.lines.length
  }).catch(() => {});

  const article = await waitForSearchArticle(currentLine.partNumber);

  if (!article) {
    await failCartPrep(
      session,
      `O'Reilly could not find part ${currentLine.partNumber} during cart prep.`,
      session.currentLineIndex
    );
    return;
  }

  const addToCartButton = findButtonByPattern(article, /Add To Cart/i);

  if (!addToCartButton) {
    await failCartPrep(
      session,
      `O'Reilly did not expose an Add To Cart button for ${currentLine.partNumber}.`,
      session.currentLineIndex
    );
    return;
  }

  addToCartButton.click();
  await sleep(1_200);
  await continueShoppingIfPrompted();

  const completedLineCount = session.currentLineIndex + 1;
  await updateCartPrepSession(session.sessionId, {
    currentLineIndex: completedLineCount
  });

  await postCartStatus(session, {
    completedLineCount,
    message:
      completedLineCount < session.lines.length
        ? `Added ${currentLine.partNumber}. Moving to the next retailer line.`
        : "All purchase-order lines were added. Opening the O'Reilly cart.",
    stage: completedLineCount < session.lines.length ? "line_added" : "preparing",
    totalLines: session.lines.length
  }).catch(() => {});

  if (completedLineCount < session.lines.length) {
    window.location.assign(
      buildCartPrepSearchUrl(session.lines[completedLineCount].partNumber, session.sessionId)
    );
    return;
  }

  window.location.assign(buildCartPrepCartUrl(session.sessionId));
}

async function finalizeCartPrep(session) {
  if (session.preparedAt) {
    return;
  }

  await maybeAcceptCookieBanner();

  if (detectAccessDenied()) {
    await failCartPrep(
      session,
      "O'Reilly blocked the staged cart page. Refresh the retailer tab and try again.",
      session.lines.length
    );
    return;
  }

  await postCartStatus(session, {
    completedLineCount: session.lines.length,
    message: "Verifying cart quantities in the live O'Reilly cart.",
    stage: "preparing",
    totalLines: session.lines.length
  }).catch(() => {});

  for (const line of session.lines) {
    try {
      await adjustCartQuantity(line.partNumber, line.quantity);
    } catch (error) {
      await failCartPrep(
        session,
        error instanceof Error && error.message
          ? error.message
          : `Cart quantity adjustment for ${line.partNumber} did not complete.`,
        session.lines.length
      );
      return;
    }
  }

  const preparedAt = new Date().toISOString();
  await updateCartPrepSession(session.sessionId, {
    currentLineIndex: session.lines.length,
    preparedAt
  });

  await postCartStatus(session, {
    cartUrl: window.location.href.split("#")[0],
    completedLineCount: session.lines.length,
    message: session.openCartAfterPrep
      ? "The staged O'Reilly cart is open in the real browser. Test mode stops before checkout."
      : "O'Reilly cart staged in this browser. Open it from the app when the customer approves.",
    preparedAt,
    stage: session.openCartAfterPrep ? "opened" : "cart_ready",
    totalLines: session.lines.length
  }).catch(() => {});
}

async function runCartPrepSession(sessionRef) {
  if (window.__mmOReillyCartPrepSession === sessionRef.sessionId) {
    return;
  }

  window.__mmOReillyCartPrepSession = sessionRef.sessionId;

  const session = await getCartPrepSession(sessionRef.sessionId).catch(() => null);

  if (!session) {
    return;
  }

  injectCartPrepBadge(session);

  if (window.location.pathname.includes("/cart")) {
    await finalizeCartPrep(session);
    return;
  }

  await addCurrentLineToCart(session);
}

function startEstimateCaptureSession(session) {
  injectEstimateBadge(session);
  injectSearchResultButtons(session);
  injectProductPageCaptureButton(session);

  const observer = new MutationObserver(() => {
    injectSearchResultButtons(session);
    injectProductPageCaptureButton(session);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  void sendRuntimeMessage({
    payload: {
      appTabId: session.appTabId,
      estimateId: session.estimateId,
      lineItemId: session.lineItemId,
      message: "O'Reilly is connected to this estimate. Capture any exact result directly from the website.",
      provider: "oreilly",
      query: session.query,
      sessionId: session.sessionId,
      stage: "ready"
    },
    type: "MM_EXTENSION_OREILLY_SESSION_STATUS"
  }).catch(() => {});
}

const session = getSessionFromLocation();

if (session?.mode === "cart-prep" && session.sessionId) {
  void runCartPrepSession(session);
} else if (session?.estimateId && session?.lineItemId) {
  startEstimateCaptureSession(session);
}

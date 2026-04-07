const OREILLY_PROVIDER = "oreilly";
const OREILLY_SEARCH_URL = "https://www.oreillyauto.com/search?q=";
const OREILLY_CART_URL = "https://www.oreillyauto.com/cart";
const OREILLY_CART_STATE_PREFIX = "mm-oreilly-cart-state:";
const OREILLY_CART_SESSION_PREFIX = "mm-oreilly-cart-session:";

function buildSessionId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `oreilly-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWhitespace(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function encodeSessionPayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function withSessionHash(url, payload) {
  return `${url}#mm-session=${encodeURIComponent(encodeSessionPayload(payload))}`;
}

function buildOReillySourcingSessionUrl(session) {
  return withSessionHash(
    `${OREILLY_SEARCH_URL}${encodeURIComponent(session.query)}`,
    session
  );
}

function buildOReillyCartPrepUrl(partNumber, sessionId) {
  return withSessionHash(
    `${OREILLY_SEARCH_URL}${encodeURIComponent(partNumber)}`,
    {
      mode: "cart-prep",
      provider: OREILLY_PROVIDER,
      sessionId
    }
  );
}

function buildCartStateStorageKey(purchaseOrderId) {
  return `${OREILLY_CART_STATE_PREFIX}${purchaseOrderId}`;
}

function buildCartSessionStorageKey(sessionId) {
  return `${OREILLY_CART_SESSION_PREFIX}${sessionId}`;
}

function buildDefaultCartState(purchaseOrderId, poNumber = null) {
  return {
    cartUrl: OREILLY_CART_URL,
    completedLineCount: 0,
    message: null,
    poNumber,
    preparedAt: null,
    provider: OREILLY_PROVIDER,
    purchaseOrderId,
    ready: false,
    retailerTabId: null,
    sessionId: null,
    stage: "idle",
    totalLines: 0
  };
}

function normalizeCartLines(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line) => ({
      description: normalizeWhitespace(line?.description),
      partNumber: normalizeWhitespace(line?.partNumber),
      quantity: Number(line?.quantity)
    }))
    .filter(
      (line) =>
        line.partNumber &&
        Number.isFinite(line.quantity) &&
        Math.round(line.quantity) > 0
    )
    .map((line) => ({
      ...line,
      quantity: Math.max(1, Math.round(line.quantity))
    }));
}

async function relayToAppTab(appTabId, message) {
  if (typeof appTabId !== "number") {
    return;
  }

  try {
    await chrome.tabs.sendMessage(appTabId, message);
  } catch {
    // Ignore closed tabs or app pages without the bridge script loaded.
  }
}

async function getStorageValue(key) {
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? null;
}

async function setStorageValue(key, value) {
  await chrome.storage.local.set({
    [key]: value
  });
}

async function getStoredCartState(purchaseOrderId, poNumber = null) {
  return (
    (await getStorageValue(buildCartStateStorageKey(purchaseOrderId))) ??
    buildDefaultCartState(purchaseOrderId, poNumber)
  );
}

async function setStoredCartState(state) {
  await setStorageValue(buildCartStateStorageKey(state.purchaseOrderId), state);
}

async function getStoredCartSession(sessionId) {
  return getStorageValue(buildCartSessionStorageKey(sessionId));
}

async function setStoredCartSession(session) {
  await setStorageValue(buildCartSessionStorageKey(session.sessionId), session);
}

async function updateStoredCartSession(sessionId, patch) {
  const current = await getStoredCartSession(sessionId);

  if (!current) {
    throw new Error("O'Reilly cart session could not be found.");
  }

  const next = {
    ...current,
    ...patch
  };
  await setStoredCartSession(next);
  return next;
}

async function mergeCartStateFromSession(session, patch) {
  const current = await getStoredCartState(session.purchaseOrderId, session.poNumber);
  const nextStage = patch.stage ?? current.stage;
  const ready = nextStage === "cart_ready" || nextStage === "opened";

  const nextState = {
    ...current,
    cartUrl: patch.cartUrl ?? current.cartUrl ?? OREILLY_CART_URL,
    completedLineCount: patch.completedLineCount ?? current.completedLineCount,
    message:
      patch.message === undefined ? current.message : patch.message,
    poNumber: current.poNumber ?? session.poNumber ?? null,
    preparedAt:
      patch.preparedAt ??
      (ready ? new Date().toISOString() : current.preparedAt),
    provider: OREILLY_PROVIDER,
    purchaseOrderId: session.purchaseOrderId,
    ready,
    retailerTabId:
      patch.retailerTabId ??
      current.retailerTabId ??
      session.retailerTabId ??
      null,
    sessionId: session.sessionId,
    stage: nextStage,
    totalLines: patch.totalLines ?? current.totalLines ?? session.lines.length
  };

  await setStoredCartState(nextState);
  return nextState;
}

async function relayCartStatus(session, patch) {
  const nextState = await mergeCartStateFromSession(session, patch);
  await relayToAppTab(session.appTabId, {
    payload: nextState,
    type: "MM_EXTENSION_OREILLY_CART_STATUS"
  });
  return nextState;
}

async function launchOReillySourcingSession(sender, payload) {
  const appTabId = sender.tab?.id;

  if (typeof appTabId !== "number") {
    throw new Error("Retailer sourcing must be launched from an estimate tab.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Retailer sourcing needs estimate context before it can launch.");
  }

  const session = {
    appOrigin: String(payload.appOrigin ?? ""),
    appTabId,
    estimateId: String(payload.estimateId ?? ""),
    lineItemId: String(payload.lineItemId ?? ""),
    lineItemName: String(payload.lineItemName ?? ""),
    provider: OREILLY_PROVIDER,
    query: String(payload.query ?? ""),
    sessionId: buildSessionId(),
    vehicleDisplayName: String(payload.vehicleDisplayName ?? "")
  };

  if (!session.estimateId || !session.lineItemId || !session.query) {
    throw new Error("Retailer sourcing needs an estimate, part line, and search term.");
  }

  const retailerTab = await chrome.tabs.create({
    active: true,
    url: buildOReillySourcingSessionUrl(session)
  });

  await relayToAppTab(appTabId, {
    payload: {
      estimateId: session.estimateId,
      lineItemId: session.lineItemId,
      message: "O'Reilly sourcing opened in a real browser tab.",
      provider: OREILLY_PROVIDER,
      query: session.query,
      retailerTabId: retailerTab.id ?? null,
      sessionId: session.sessionId,
      stage: "launched"
    },
    type: "MM_EXTENSION_OREILLY_SESSION_STATUS"
  });

  return {
    retailerTabId: retailerTab.id ?? null,
    sessionId: session.sessionId
  };
}

async function prepareOReillyCart(sender, payload) {
  const appTabId = sender.tab?.id;

  if (typeof appTabId !== "number") {
    throw new Error("Retailer cart prep must be launched from a purchase order tab.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Retailer cart prep needs purchase order context before it can launch.");
  }

  const purchaseOrderId = normalizeWhitespace(payload.purchaseOrderId);
  const poNumber = normalizeWhitespace(payload.poNumber);
  const lines = normalizeCartLines(payload.lines);

  if (!purchaseOrderId || !poNumber || lines.length === 0) {
    throw new Error("Retailer cart prep needs a purchase order number and exact supplier part numbers.");
  }

  const session = {
    appOrigin: String(payload.appOrigin ?? ""),
    appTabId,
    currentLineIndex: 0,
    lines,
    openCartAfterPrep: Boolean(payload.openCartAfterPrep),
    poNumber,
    provider: OREILLY_PROVIDER,
    purchaseOrderId,
    retailerTabId: null,
    sessionId: buildSessionId()
  };

  await setStoredCartSession(session);

  const retailerTab = await chrome.tabs.create({
    active: true,
    url: buildOReillyCartPrepUrl(lines[0].partNumber, session.sessionId)
  });

  const sessionWithTab = {
    ...session,
    retailerTabId: retailerTab.id ?? null
  };

  await setStoredCartSession(sessionWithTab);

  return relayCartStatus(sessionWithTab, {
    completedLineCount: 0,
    message: "O'Reilly cart prep started in a real browser tab.",
    preparedAt: null,
    retailerTabId: retailerTab.id ?? null,
    stage: "launched",
    totalLines: lines.length
  });
}

async function getOReillyCartState(payload) {
  const purchaseOrderId = normalizeWhitespace(payload?.purchaseOrderId);

  if (!purchaseOrderId) {
    throw new Error("Select a purchase order before checking retailer cart state.");
  }

  return getStoredCartState(purchaseOrderId);
}

async function openOReillyCart(payload) {
  const purchaseOrderId = normalizeWhitespace(payload?.purchaseOrderId);

  if (!purchaseOrderId) {
    throw new Error("Select a purchase order before opening the retailer cart.");
  }

  const currentState = await getStoredCartState(purchaseOrderId);

  if (!currentState.ready) {
    throw new Error("Prepare the retailer cart before opening it.");
  }

  let retailerTab = null;

  if (typeof currentState.retailerTabId === "number") {
    try {
      retailerTab = await chrome.tabs.update(currentState.retailerTabId, {
        active: true,
        url: currentState.cartUrl ?? OREILLY_CART_URL
      });
    } catch {
      retailerTab = null;
    }
  }

  if (!retailerTab) {
    retailerTab = await chrome.tabs.create({
      active: true,
      url: currentState.cartUrl ?? OREILLY_CART_URL
    });
  }

  const nextState = {
    ...currentState,
    message: "The staged O'Reilly cart is open in the real browser. Test mode stops before checkout.",
    retailerTabId: retailerTab.id ?? null,
    stage: "opened"
  };

  await setStoredCartState(nextState);

  const session = currentState.sessionId
    ? await getStoredCartSession(currentState.sessionId).catch(() => null)
    : null;

  if (session) {
    await setStoredCartSession({
      ...session,
      retailerTabId: retailerTab.id ?? null
    });
    await relayToAppTab(session.appTabId, {
      payload: nextState,
      type: "MM_EXTENSION_OREILLY_CART_STATUS"
    });
  }

  return nextState;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== "string") {
      throw new Error("Unknown extension command.");
    }

    switch (message.type) {
      case "MM_EXTENSION_GET_OREILLY_CART_STATE":
        return getOReillyCartState(message.payload);
      case "MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION":
        return launchOReillySourcingSession(sender, message.payload);
      case "MM_EXTENSION_OPEN_OREILLY_CART":
        return openOReillyCart(message.payload);
      case "MM_EXTENSION_PREPARE_OREILLY_CART":
        return prepareOReillyCart(sender, message.payload);
      case "MM_EXTENSION_OREILLY_CART_GET_SESSION": {
        const sessionId = normalizeWhitespace(message.payload?.sessionId);

        if (!sessionId) {
          throw new Error("O'Reilly cart prep session id is required.");
        }

        const session = await getStoredCartSession(sessionId);

        if (!session) {
          throw new Error("O'Reilly cart prep session could not be found.");
        }

        return session;
      }
      case "MM_EXTENSION_OREILLY_CART_UPDATE_SESSION": {
        const sessionId = normalizeWhitespace(message.payload?.sessionId);

        if (!sessionId) {
          throw new Error("O'Reilly cart prep session id is required.");
        }

        return updateStoredCartSession(sessionId, message.payload?.patch ?? {});
      }
      case "MM_EXTENSION_OREILLY_CART_STATUS": {
        const sessionId = normalizeWhitespace(message.payload?.sessionId);

        if (!sessionId) {
          throw new Error("O'Reilly cart prep session id is required.");
        }

        const session = await getStoredCartSession(sessionId);

        if (!session) {
          throw new Error("O'Reilly cart prep session could not be found.");
        }

        const nextSession = await updateStoredCartSession(sessionId, {
          currentLineIndex:
            typeof message.payload?.completedLineCount === "number"
              ? Math.max(
                  session.currentLineIndex,
                  Math.min(session.lines.length, message.payload.completedLineCount)
                )
              : session.currentLineIndex,
          retailerTabId: sender.tab?.id ?? session.retailerTabId ?? null
        });

        await relayCartStatus(nextSession, {
          cartUrl: message.payload?.cartUrl ?? OREILLY_CART_URL,
          completedLineCount:
            typeof message.payload?.completedLineCount === "number"
              ? message.payload.completedLineCount
              : nextSession.currentLineIndex,
          message: message.payload?.message,
          preparedAt: message.payload?.preparedAt ?? null,
          retailerTabId: sender.tab?.id ?? message.payload?.retailerTabId ?? null,
          stage: message.payload?.stage ?? "preparing",
          totalLines: nextSession.lines.length
        });

        return { ok: true };
      }
      case "MM_EXTENSION_OREILLY_SESSION_STATUS": {
        const payload = message.payload ?? {};

        await relayToAppTab(payload.appTabId, {
          payload: {
            ...payload,
            retailerTabId: sender.tab?.id ?? payload.retailerTabId ?? null
          },
          type: "MM_EXTENSION_OREILLY_SESSION_STATUS"
        });
        return { ok: true };
      }
      case "MM_EXTENSION_OREILLY_OFFER_CAPTURED": {
        const payload = message.payload ?? {};

        await relayToAppTab(payload.appTabId, {
          payload: {
            estimateId: payload.estimateId,
            lineItemId: payload.lineItemId,
            offer: payload.offer,
            provider: OREILLY_PROVIDER,
            sessionId: payload.sessionId
          },
          type: "MM_EXTENSION_OREILLY_OFFER_CAPTURED"
        });
        return { ok: true };
      }
      default:
        throw new Error("Unknown extension command.");
    }
  })()
    .then((payload) => sendResponse(payload ?? { ok: true }))
    .catch((error) =>
      sendResponse({
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Extension command failed."
      })
    );

  return true;
});

"use client";

import { formatDateTime } from "@mobile-mechanic/core";
import { startTransition, useEffect, useState } from "react";

import {
  Button,
  Callout,
  EmptyState
} from "../../../../../../components/ui";
import {
  getOReillyRetailerCartState,
  openOReillyRetailerCart,
  prepareOReillyRetailerCart,
  probeRetailerExtension,
  subscribeToRetailerExtensionEvents,
  type RetailerExtensionCartLineInput,
  type RetailerExtensionOReillyCartState
} from "../../../../../../lib/retailer-extension";

type RetailerCartPanelProps = {
  companyTimeZone: string;
  lines: RetailerExtensionCartLineInput[];
  poNumber: string;
  providerLabel: string;
  purchaseOrderId: string;
  reason: string | null;
  supported: boolean;
};

function buildIdleCartState(purchaseOrderId: string): RetailerExtensionOReillyCartState {
  return {
    cartUrl: null,
    completedLineCount: 0,
    message: null,
    poNumber: null,
    preparedAt: null,
    provider: "oreilly",
    purchaseOrderId,
    ready: false,
    retailerTabId: null,
    sessionId: null,
    stage: "idle",
    totalLines: 0
  };
}

export function RetailerCartPanel({
  companyTimeZone,
  lines,
  poNumber,
  providerLabel,
  purchaseOrderId,
  reason,
  supported
}: RetailerCartPanelProps) {
  const [extensionState, setExtensionState] = useState<"checking" | "missing" | "ready">(
    "checking"
  );
  const [cartState, setCartState] = useState<RetailerExtensionOReillyCartState>(() =>
    buildIdleCartState(purchaseOrderId)
  );
  const [busyAction, setBusyAction] = useState<"open" | "prepare" | "purchase" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRetailerExtensionEvents((event) => {
      if (event.type !== "oreilly-cart-status" || event.payload.purchaseOrderId !== purchaseOrderId) {
        return;
      }

      setCartState(event.payload);

      if (event.payload.stage === "failed" && event.payload.message) {
        setError(event.payload.message);
      }
    });

    let cancelled = false;

    void (async () => {
      const isReady = await probeRetailerExtension();

      if (cancelled) {
        return;
      }

      if (!isReady) {
        setExtensionState("missing");
        return;
      }

      setExtensionState("ready");

      try {
        const state = await getOReillyRetailerCartState(purchaseOrderId);

        if (!cancelled) {
          setCartState(state);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error && nextError.message.trim()
              ? nextError.message
              : "Retailer cart state could not be loaded."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [purchaseOrderId]);

  function ensureExtensionReady() {
    if (extensionState === "ready") {
      return true;
    }

    setError(
      "Load the browser-assisted procurement extension from apps/browser-extension, then refresh this purchase order."
    );
    return false;
  }

  function runPrepare(openCartAfterPrep: boolean, action: "prepare" | "purchase") {
    if (!ensureExtensionReady()) {
      return;
    }

    setBusyAction(action);
    setError(null);

    startTransition(() => {
      void prepareOReillyRetailerCart({
        appOrigin: window.location.origin,
        lines,
        openCartAfterPrep,
        poNumber,
        purchaseOrderId
      })
        .then((state) => {
          setCartState(state);
        })
        .catch((nextError) => {
          setError(
            nextError instanceof Error && nextError.message.trim()
              ? nextError.message
              : "Retailer cart prep could not be started."
          );
        })
        .finally(() => {
          setBusyAction(null);
        });
    });
  }

  function handleOpen() {
    if (!ensureExtensionReady()) {
      return;
    }

    setBusyAction("open");
    setError(null);

    startTransition(() => {
      void openOReillyRetailerCart(purchaseOrderId)
        .then((state) => {
          setCartState(state);
        })
        .catch((nextError) => {
          setError(
            nextError instanceof Error && nextError.message.trim()
              ? nextError.message
              : "The staged retailer cart could not be opened."
          );
        })
        .finally(() => {
          setBusyAction(null);
        });
    });
  }

  function handlePurchase() {
    if (cartState.ready) {
      handleOpen();
      return;
    }

    runPrepare(true, "purchase");
  }

  const stagedAtLabel =
    cartState.preparedAt && cartState.ready
      ? formatDateTime(cartState.preparedAt, { timeZone: companyTimeZone })
      : null;

  let statusTone: "default" | "success" | "warning" = "default";
  let statusTitle = "Retailer session idle";
  let statusDescription =
    extensionState === "ready"
      ? `${lines.length} PO line(s) are ready for live ${providerLabel} cart staging.`
      : "Waiting for the browser-assisted procurement extension.";

  if (cartState.stage === "failed") {
    statusTone = "warning";
    statusTitle = "Retailer cart prep needs attention";
    statusDescription =
      cartState.message ??
      "Verify the exact supplier part numbers on each line and try the real-browser cart handoff again.";
  } else if (cartState.stage === "opened") {
    statusTone = "success";
    statusTitle = "Retailer cart open";
    statusDescription =
      cartState.message ??
      "The staged O'Reilly cart is open in the real browser. Test mode stops before checkout.";
  } else if (cartState.stage === "cart_ready") {
    statusTone = "success";
    statusTitle = "Retailer cart staged";
    statusDescription =
      cartState.message ??
      "The live O'Reilly cart has been staged in the browser and is ready to reopen.";
  } else if (
    cartState.stage === "launched" ||
    cartState.stage === "preparing" ||
    cartState.stage === "line_added"
  ) {
    statusTitle = "Retailer cart in progress";
    statusDescription =
      cartState.message ??
      `Working through ${cartState.completedLineCount} of ${Math.max(
        cartState.totalLines,
        lines.length
      )} line(s) in the live O'Reilly tab.`;
  }

  return supported ? (
    <>
      {extensionState === "missing" ? (
        <Callout tone="warning" title="Browser extension required">
          Load the unpacked extension from `apps/browser-extension`, refresh this purchase order,
          and this panel will drive the real O&apos;Reilly cart inside the mechanic&apos;s browser.
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="warning" title="Retailer handoff blocked">
          {error}
        </Callout>
      ) : null}

      <Callout tone={statusTone} title={statusTitle}>
        {statusDescription}
      </Callout>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <div>
          <p className="ui-card__eyebrow">Status</p>
          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
            {cartState.ready ? "Prepared in the real browser session" : "Ready for live cart prep"}
          </h3>
          <p className="ui-card__description" style={{ marginBottom: 0 }}>
            {stagedAtLabel
              ? `Last staged ${stagedAtLabel}.`
              : `${lines.length} PO line(s) will be staged into the live ${providerLabel} cart.`}
          </p>
        </div>
        <div className="ui-page-actions" style={{ justifyContent: "flex-end" }}>
          <Button
            loading={busyAction === "purchase" || busyAction === "open"}
            onClick={handlePurchase}
          >
            Purchase parts
          </Button>
          <Button
            loading={busyAction === "prepare"}
            onClick={() => runPrepare(false, "prepare")}
            tone="secondary"
          >
            {cartState.ready ? "Refresh staged cart" : "Prepare staged cart"}
          </Button>
        </div>
      </div>
    </>
  ) : (
    <EmptyState
      description={reason ?? "This purchase order needs manual supplier ordering."}
      eyebrow="Not ready"
      title="Retailer cart prep is unavailable"
    />
  );
}

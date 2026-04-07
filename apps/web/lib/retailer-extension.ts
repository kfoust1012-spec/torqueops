import type { EstimateLiveRetailerPartOffer } from "@mobile-mechanic/types";

const APP_MESSAGE_SOURCE = "mobile-mechanic-app";
const EXTENSION_MESSAGE_SOURCE = "mobile-mechanic-extension";

type RetailerExtensionRequestType =
  | "MM_EXTENSION_PING"
  | "MM_EXTENSION_GET_OREILLY_CART_STATE"
  | "MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION"
  | "MM_EXTENSION_OPEN_OREILLY_CART"
  | "MM_EXTENSION_PREPARE_OREILLY_CART";

type RetailerExtensionResponseType =
  | "MM_EXTENSION_GET_OREILLY_CART_STATE_RESULT"
  | "MM_EXTENSION_PONG"
  | "MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION_RESULT"
  | "MM_EXTENSION_OPEN_OREILLY_CART_RESULT"
  | "MM_EXTENSION_PREPARE_OREILLY_CART_RESULT";

type RetailerExtensionStatusEventPayload = {
  estimateId: string;
  lineItemId: string;
  message?: string | null | undefined;
  provider: "oreilly";
  query: string;
  retailerTabId?: number | null | undefined;
  sessionId: string;
  stage: "launched" | "ready";
};

type RetailerExtensionCapturedOfferEventPayload = {
  estimateId: string;
  lineItemId: string;
  offer: EstimateLiveRetailerPartOffer;
  provider: "oreilly";
  sessionId: string;
};

export type RetailerExtensionCartLineInput = {
  description: string;
  partNumber: string;
  quantity: number;
};

export type RetailerExtensionOReillyCartState = {
  cartUrl: string | null;
  completedLineCount: number;
  message: string | null;
  poNumber: string | null;
  preparedAt: string | null;
  provider: "oreilly";
  purchaseOrderId: string;
  ready: boolean;
  retailerTabId: number | null;
  sessionId: string | null;
  stage: "idle" | "launched" | "preparing" | "line_added" | "cart_ready" | "opened" | "failed";
  totalLines: number;
};

type RetailerExtensionCartStatusEventPayload = RetailerExtensionOReillyCartState;

type ExtensionWindowEnvelope<TType extends string, TPayload = undefined> = {
  error?: string | undefined;
  payload?: TPayload | undefined;
  requestId?: string | undefined;
  source: typeof APP_MESSAGE_SOURCE | typeof EXTENSION_MESSAGE_SOURCE;
  type: TType;
};

type ExtensionWindowResponseMap = {
  MM_EXTENSION_GET_OREILLY_CART_STATE_RESULT: RetailerExtensionOReillyCartState;
  MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION_RESULT: {
    retailerTabId?: number | null | undefined;
    sessionId: string;
  };
  MM_EXTENSION_OPEN_OREILLY_CART_RESULT: RetailerExtensionOReillyCartState;
  MM_EXTENSION_PONG: {
    capabilities: string[];
  };
  MM_EXTENSION_PREPARE_OREILLY_CART_RESULT: RetailerExtensionOReillyCartState;
};

export type RetailerExtensionLaunchOReillySessionInput = {
  appOrigin: string;
  estimateId: string;
  lineItemId: string;
  lineItemName: string;
  query: string;
  vehicleDisplayName: string;
};

export type RetailerExtensionPrepareOReillyCartInput = {
  appOrigin: string;
  lines: RetailerExtensionCartLineInput[];
  openCartAfterPrep?: boolean | undefined;
  poNumber: string;
  purchaseOrderId: string;
};

export type RetailerExtensionEvent =
  | {
      type: "extension-ready";
    }
  | {
      payload: RetailerExtensionStatusEventPayload;
      type: "oreilly-session-status";
    }
  | {
      payload: RetailerExtensionCapturedOfferEventPayload;
      type: "oreilly-offer-captured";
    }
  | {
      payload: RetailerExtensionCartStatusEventPayload;
      type: "oreilly-cart-status";
    };

function isBrowserWindowMessage(
  value: unknown
): value is ExtensionWindowEnvelope<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "source" in value &&
    (value as { source?: unknown }).source === EXTENSION_MESSAGE_SOURCE &&
    "type" in value &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function buildRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `retailer-extension-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function requestRetailerExtensionMessage<
  TResponseType extends keyof ExtensionWindowResponseMap
>(
  type: RetailerExtensionRequestType,
  payload?: object,
  input?: {
    responseType: TResponseType;
    timeoutMs?: number | undefined;
  }
) {
  if (typeof window === "undefined") {
    throw new Error("Retailer extension is only available in the browser.");
  }

  const requestId = buildRequestId();

  return new Promise<ExtensionWindowResponseMap[TResponseType]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Retailer browser extension did not respond."));
    }, input?.timeoutMs ?? 1_500);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window || !isBrowserWindowMessage(event.data)) {
        return;
      }

      if (event.data.requestId !== requestId || event.data.type !== input?.responseType) {
        return;
      }

      cleanup();

      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }

      resolve((event.data.payload ?? {}) as ExtensionWindowResponseMap[TResponseType]);
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        payload,
        requestId,
        source: APP_MESSAGE_SOURCE,
        type
      } satisfies ExtensionWindowEnvelope<RetailerExtensionRequestType, object | undefined>,
      window.location.origin
    );
  });
}

export async function probeRetailerExtension() {
  try {
    await requestRetailerExtensionMessage("MM_EXTENSION_PING", undefined, {
      responseType: "MM_EXTENSION_PONG",
      timeoutMs: 900
    });
    return true;
  } catch {
    return false;
  }
}

export async function launchOReillyRetailerSourcingSession(
  input: RetailerExtensionLaunchOReillySessionInput
) {
  return requestRetailerExtensionMessage(
    "MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION",
    input,
    {
      responseType: "MM_EXTENSION_LAUNCH_OREILLY_SOURCING_SESSION_RESULT",
      timeoutMs: 2_500
    }
  );
}

export async function getOReillyRetailerCartState(purchaseOrderId: string) {
  return requestRetailerExtensionMessage("MM_EXTENSION_GET_OREILLY_CART_STATE", { purchaseOrderId }, {
    responseType: "MM_EXTENSION_GET_OREILLY_CART_STATE_RESULT",
    timeoutMs: 1_500
  });
}

export async function prepareOReillyRetailerCart(input: RetailerExtensionPrepareOReillyCartInput) {
  return requestRetailerExtensionMessage("MM_EXTENSION_PREPARE_OREILLY_CART", input, {
    responseType: "MM_EXTENSION_PREPARE_OREILLY_CART_RESULT",
    timeoutMs: 2_500
  });
}

export async function openOReillyRetailerCart(purchaseOrderId: string) {
  return requestRetailerExtensionMessage("MM_EXTENSION_OPEN_OREILLY_CART", { purchaseOrderId }, {
    responseType: "MM_EXTENSION_OPEN_OREILLY_CART_RESULT",
    timeoutMs: 2_500
  });
}

export function subscribeToRetailerExtensionEvents(
  onEvent: (event: RetailerExtensionEvent) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window || !isBrowserWindowMessage(event.data)) {
      return;
    }

    switch (event.data.type) {
      case "MM_EXTENSION_READY":
        onEvent({ type: "extension-ready" });
        return;
      case "MM_EXTENSION_OREILLY_SESSION_STATUS":
        onEvent({
          payload: event.data.payload as RetailerExtensionStatusEventPayload,
          type: "oreilly-session-status"
        });
        return;
      case "MM_EXTENSION_OREILLY_OFFER_CAPTURED":
        onEvent({
          payload: event.data.payload as RetailerExtensionCapturedOfferEventPayload,
          type: "oreilly-offer-captured"
        });
        return;
      case "MM_EXTENSION_OREILLY_CART_STATUS":
        onEvent({
          payload: event.data.payload as RetailerExtensionCartStatusEventPayload,
          type: "oreilly-cart-status"
        });
        return;
      default:
        return;
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}

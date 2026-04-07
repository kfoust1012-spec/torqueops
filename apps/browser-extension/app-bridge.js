const APP_MESSAGE_SOURCE = "mobile-mechanic-app";
const EXTENSION_MESSAGE_SOURCE = "mobile-mechanic-extension";

function postToPage(message) {
  window.postMessage(
    {
      source: EXTENSION_MESSAGE_SOURCE,
      ...message
    },
    window.location.origin
  );
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

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;

  if (!data || data.source !== APP_MESSAGE_SOURCE || typeof data.type !== "string") {
    return;
  }

  if (data.type === "MM_EXTENSION_PING") {
    postToPage({
      payload: {
        capabilities: ["oreilly-live-sourcing", "oreilly-cart-prep"]
      },
      requestId: data.requestId,
      type: "MM_EXTENSION_PONG"
    });
    return;
  }

  void sendRuntimeMessage({
    payload: data.payload,
    type: data.type
  })
    .then((payload) => {
      postToPage({
        payload,
        requestId: data.requestId,
        type: `${data.type}_RESULT`
      });
    })
    .catch((error) => {
      postToPage({
        error: error instanceof Error && error.message.trim() ? error.message : "Extension request failed.",
        requestId: data.requestId,
        type: `${data.type}_RESULT`
      });
    });
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  postToPage(message);
});

postToPage({ type: "MM_EXTENSION_READY" });

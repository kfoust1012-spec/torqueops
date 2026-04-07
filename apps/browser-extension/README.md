# Browser-Assisted Procurement Bridge

This extension keeps live retailer sourcing inside the app workflow without relying on blocked backend scraping.

## Load it in Chrome or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable `Developer mode`.
3. Choose `Load unpacked`.
4. Select `apps/browser-extension`.
5. Refresh the estimate workspace tab.

## Current scope

- Bridges the estimate workspace on `http://127.0.0.1:3000` and `http://localhost:3000`
- Launches a real O'Reilly search tab from the estimate
- Injects `Use in estimate` buttons into O'Reilly search results and product pages
- Pushes the captured website result back into the estimate without placing an order

## Next step

Use the same bridge pattern for purchase-order cart staging so `Purchase parts` can reopen and hand off the live retailer cart from the app workflow.

import { describe, expect, it } from "vitest";

import type { PurchaseOrderDetail, SupplierCartDetail } from "@mobile-mechanic/types";

import {
  getRetailerCartSupportForPurchaseOrder,
  getRetailerCartSupportForSupplierCart
} from "./retailer-cart";

function buildPurchaseOrderDetail(
  overrides: Partial<PurchaseOrderDetail> = {}
): PurchaseOrderDetail {
  return {
    purchaseOrder: {
      companyId: "company-1",
      createdAt: "2026-03-13T00:00:00.000Z",
      expectedAt: null,
      externalReference: null,
      id: "po-1",
      manualOrderUrl: null,
      notes: null,
      orderedAt: null,
      orderedByUserId: "user-1",
      poNumber: "PO-1001",
      status: "draft",
      supplierAccountId: "supplier-1",
      supplierCartId: null,
      updatedAt: "2026-03-13T00:00:00.000Z"
    },
    supplierAccount: {
      companyId: "company-1",
      contactEmail: null,
      contactName: null,
      contactPhone: null,
      createdAt: "2026-03-13T00:00:00.000Z",
      externalUrl: "https://www.oreillyauto.com",
      id: "supplier-1",
      isActive: true,
      mode: "manual",
      name: "O'Reilly Auto Parts",
      notes: null,
      slug: "oreilly-auto-parts",
      sortOrder: 0,
      updatedAt: "2026-03-13T00:00:00.000Z"
    },
    lines: [
      {
        companyId: "company-1",
        coreChargeCents: 0,
        createdAt: "2026-03-13T00:00:00.000Z",
        id: "po-line-1",
        inventoryItemId: null,
        isCoreReturnable: false,
        jobId: "job-1",
        manufacturer: "Super Start",
        partNumber: "94RPLT",
        partRequestLineId: "request-line-1",
        purchaseOrderId: "po-1",
        quantityCoreDue: 0,
        quantityCoreReturned: 0,
        quantityInstalled: 0,
        quantityOrdered: 1,
        quantityReceived: 0,
        quantityReturned: 0,
        status: "quoted",
        stockLocationId: null,
        supplierAccountId: "supplier-1",
        supplierCartLineId: "cart-line-1",
        supplierPartNumber: "94RPLT",
        unitActualCostCents: null,
        unitOrderedCostCents: 25_999,
        updatedAt: "2026-03-13T00:00:00.000Z",
        description: "Battery"
      }
    ],
    receipts: [],
    returns: [],
    ...overrides
  };
}

function buildSupplierCartDetail(
  overrides: Partial<SupplierCartDetail> = {}
): SupplierCartDetail {
  return {
    cart: {
      companyId: "company-1",
      convertedPurchaseOrderId: null,
      createdAt: "2026-03-13T00:00:00.000Z",
      createdByUserId: "user-1",
      id: "cart-1",
      sourceBucketKey: "estimate-manual:req-1",
      status: "open",
      submittedAt: null,
      submittedByUserId: null,
      supplierAccountId: "supplier-1",
      updatedAt: "2026-03-13T00:00:00.000Z"
    },
    supplierAccount: buildPurchaseOrderDetail().supplierAccount,
    lines: [
      {
        cartLine: {
          availabilityText: "In stock",
          cartId: "cart-1",
          companyId: "company-1",
          createdAt: "2026-03-13T00:00:00.000Z",
          id: "cart-line-1",
          jobId: "job-1",
          notes: null,
          partRequestLineId: "request-line-1",
          providerQuoteLineId: null,
          quantity: 1,
          quotedCoreChargeCents: 0,
          quotedUnitCostCents: 25_999,
          supplierAccountId: "supplier-1",
          supplierPartNumber: "94RPLT",
          supplierUrl: "https://www.oreillyauto.com",
          updatedAt: "2026-03-13T00:00:00.000Z"
        },
        requestLine: {
          actualUnitCostCents: null,
          companyId: "company-1",
          coreChargeCents: 0,
          createdAt: "2026-03-13T00:00:00.000Z",
          createdByUserId: "user-1",
          description: "Battery",
          estimateId: null,
          estimateLineItemId: null,
          estimatedUnitCostCents: 25_999,
          id: "request-line-1",
          inventoryItemId: null,
          jobId: "job-1",
          lastSupplierAccountId: "supplier-1",
          manufacturer: "Super Start",
          needsCore: false,
          notes: null,
          partNumber: "94RPLT",
          partRequestId: "req-1",
          quantityConsumedFromStock: 0,
          quantityCoreDue: 0,
          quantityCoreReturned: 0,
          quantityIssuedFromInventory: 0,
          quantityInstalled: 0,
          quantityOrdered: 0,
          quantityRequested: 1,
          quantityReceived: 0,
          quantityReservedFromStock: 0,
          quantityReturned: 0,
          quantityReturnedToInventory: 0,
          quotedUnitCostCents: 25_999,
          status: "quoted",
          supplierSku: null,
          updatedAt: "2026-03-13T00:00:00.000Z"
        }
      }
    ],
    ...overrides
  };
}

describe("retailer cart support", () => {
  it("marks O'Reilly purchase orders with supplier part numbers as supported", () => {
    const support = getRetailerCartSupportForPurchaseOrder(buildPurchaseOrderDetail());

    expect(support.supported).toBe(true);
    expect(support.eligibleLineCount).toBe(1);
  });

  it("requires exact part numbers before purchase-order cart prep", () => {
    const support = getRetailerCartSupportForPurchaseOrder(
      buildPurchaseOrderDetail({
        lines: [
          {
            ...buildPurchaseOrderDetail().lines[0]!,
            partNumber: null,
            supplierPartNumber: null
          }
        ]
      })
    );

    expect(support.supported).toBe(false);
    expect(support.reason).toContain("exact supplier part number");
  });

  it("rejects fractional quantities for supplier cart prep", () => {
    const support = getRetailerCartSupportForSupplierCart(
      buildSupplierCartDetail({
        lines: [
          {
            ...buildSupplierCartDetail().lines[0]!,
            cartLine: {
              ...buildSupplierCartDetail().lines[0]!.cartLine,
              quantity: 1.5
            }
          }
        ]
      })
    );

    expect(support.supported).toBe(false);
    expect(support.reason).toContain("whole-number quantities");
  });
});

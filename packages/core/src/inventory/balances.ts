import type {
  InventoryBalance,
  InventoryReorderStatus,
  InventoryReservation,
  InventoryStockSetting,
  InventoryTransaction
} from "@mobile-mechanic/types";

export function sumOnHandFromTransactions(
  transactions: Array<Pick<InventoryTransaction, "quantityDelta">>
) {
  return transactions.reduce((total, transaction) => total + transaction.quantityDelta, 0);
}

export function sumReservedQuantity(
  reservations: Array<
    Pick<InventoryReservation, "quantityReserved" | "quantityReleased" | "quantityConsumed">
  >
) {
  return reservations.reduce(
    (total, reservation) =>
      total +
      Math.max(
        reservation.quantityReserved - reservation.quantityReleased - reservation.quantityConsumed,
        0
      ),
    0
  );
}

export function calculateAvailableQuantity(onHandQuantity: number, reservedQuantity: number) {
  return onHandQuantity - reservedQuantity;
}

export function calculateInventoryBalance(input: {
  inventoryItemId: string;
  stockLocationId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  stockSetting?: Pick<
    InventoryStockSetting,
    "reorderPointQuantity" | "lowStockThresholdQuantity" | "preferredReorderQuantity"
  > | null;
  reorderStatus: InventoryReorderStatus;
}): InventoryBalance {
  return {
    inventoryItemId: input.inventoryItemId,
    stockLocationId: input.stockLocationId,
    onHandQuantity: input.onHandQuantity,
    reservedQuantity: input.reservedQuantity,
    availableQuantity: calculateAvailableQuantity(input.onHandQuantity, input.reservedQuantity),
    reorderPointQuantity: input.stockSetting?.reorderPointQuantity ?? null,
    lowStockThresholdQuantity: input.stockSetting?.lowStockThresholdQuantity ?? null,
    preferredReorderQuantity: input.stockSetting?.preferredReorderQuantity ?? null,
    reorderStatus: input.reorderStatus
  };
}

export function calculateInventoryBalancesByLocation(input: {
  inventoryItemId: string;
  stockLocationIds: string[];
  onHandByLocationId: ReadonlyMap<string, number>;
  reservedByLocationId: ReadonlyMap<string, number>;
  stockSettingsByLocationId?: ReadonlyMap<
    string,
    Pick<
      InventoryStockSetting,
      "reorderPointQuantity" | "lowStockThresholdQuantity" | "preferredReorderQuantity" | "isStockedHere"
    >
  >;
  reorderStatusResolver: (args: {
    availableQuantity: number;
    lowStockThresholdQuantity: number | null;
    reorderPointQuantity: number | null;
  }) => InventoryReorderStatus;
}) {
  return input.stockLocationIds.map((stockLocationId) => {
    const onHandQuantity = input.onHandByLocationId.get(stockLocationId) ?? 0;
    const reservedQuantity = input.reservedByLocationId.get(stockLocationId) ?? 0;
    const stockSetting = input.stockSettingsByLocationId?.get(stockLocationId) ?? null;
    const isStockedHere = stockSetting?.isStockedHere ?? true;

    return calculateInventoryBalance({
      inventoryItemId: input.inventoryItemId,
      stockLocationId,
      onHandQuantity,
      reservedQuantity,
      stockSetting,
      reorderStatus: isStockedHere
        ? input.reorderStatusResolver({
            availableQuantity: calculateAvailableQuantity(onHandQuantity, reservedQuantity),
            lowStockThresholdQuantity: stockSetting?.lowStockThresholdQuantity ?? null,
            reorderPointQuantity: stockSetting?.reorderPointQuantity ?? null
          })
        : "ok"
    });
  });
}

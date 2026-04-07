import type { InventoryBalance, StockLocation } from "@mobile-mechanic/types";

export function groupBalancesByLocation(
  locations: StockLocation[],
  balances: InventoryBalance[]
) {
  return locations.map((location) => {
    const locationBalances = balances.filter((balance) => balance.stockLocationId === location.id);

    return {
      location,
      balances: locationBalances,
      totalOnHandQuantity: locationBalances.reduce(
        (total, balance) => total + balance.onHandQuantity,
        0
      ),
      totalReservedQuantity: locationBalances.reduce(
        (total, balance) => total + balance.reservedQuantity,
        0
      ),
      totalAvailableQuantity: locationBalances.reduce(
        (total, balance) => total + balance.availableQuantity,
        0
      ),
      lowStockCount: locationBalances.filter((balance) => balance.reorderStatus !== "ok").length
    };
  });
}

export function buildVanStockSummary(
  locations: StockLocation[],
  balances: InventoryBalance[]
) {
  return groupBalancesByLocation(
    locations.filter((location) => location.locationType === "van"),
    balances
  );
}

export function buildLocationLowStockRows(
  locations: StockLocation[],
  balances: InventoryBalance[]
) {
  return locations
    .map((location) => ({
      location,
      rowCount: balances.filter(
        (balance) =>
          balance.stockLocationId === location.id && balance.reorderStatus !== "ok"
      ).length
    }))
    .filter((row) => row.rowCount > 0);
}

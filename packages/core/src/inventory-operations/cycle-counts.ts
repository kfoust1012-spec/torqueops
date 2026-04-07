export function calculateCycleCountVariance(input: {
  expectedQuantity: number;
  countedQuantity: number;
}) {
  return input.countedQuantity - input.expectedQuantity;
}

export function resolveCycleCountTransactionType(varianceQuantity: number) {
  if (varianceQuantity > 0) {
    return "cycle_count_gain" as const;
  }

  return "cycle_count_loss" as const;
}

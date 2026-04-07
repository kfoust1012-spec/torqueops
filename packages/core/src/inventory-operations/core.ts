export function calculateOutstandingCoreHoldQuantity(input: {
  quantity: number;
  status: string;
}) {
  return input.status === "held" ? input.quantity : 0;
}

export function canReturnCoreFromInventory(input: { status: string; quantity: number }) {
  return input.status === "held" && input.quantity > 0;
}

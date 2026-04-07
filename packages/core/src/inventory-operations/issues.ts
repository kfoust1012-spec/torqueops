export function calculateJobIssueOpenQuantity(input: {
  quantityIssued: number;
  quantityConsumed: number;
  quantityReturned: number;
}) {
  return Math.max(input.quantityIssued - input.quantityConsumed - input.quantityReturned, 0);
}

export function canIssueInventoryToJob(input: { openReservedQuantity: number; quantityRequested: number }) {
  return input.openReservedQuantity > 0 && input.quantityRequested > 0;
}

export function canReturnIssuedInventory(input: {
  quantityIssued: number;
  quantityConsumed: number;
  quantityReturned: number;
}) {
  return calculateJobIssueOpenQuantity(input) > 0;
}

export function canConsumeIssuedInventory(input: {
  quantityIssued: number;
  quantityConsumed: number;
  quantityReturned: number;
}) {
  return calculateJobIssueOpenQuantity(input) > 0;
}

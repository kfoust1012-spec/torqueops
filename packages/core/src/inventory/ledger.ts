export function assertTransactionLocationConsistency(input: {
  itemCompanyId: string;
  locationCompanyId: string;
}) {
  return input.itemCompanyId === input.locationCompanyId;
}

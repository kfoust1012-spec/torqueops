export function calculateTransferLineRemainingToShip(input: {
  quantityRequested: number;
  quantityShipped: number;
}) {
  return Math.max(input.quantityRequested - input.quantityShipped, 0);
}

export function calculateTransferLineRemainingToReceive(input: {
  quantityShipped: number;
  quantityReceived: number;
}) {
  return Math.max(input.quantityShipped - input.quantityReceived, 0);
}

export function canShipTransfer(input: {
  status: string;
  quantityRequested: number;
  quantityShipped: number;
}) {
  return input.status === "draft" && calculateTransferLineRemainingToShip(input) > 0;
}

export function canReceiveTransfer(input: {
  status: string;
  quantityShipped: number;
  quantityReceived: number;
}) {
  return input.status === "in_transit" && calculateTransferLineRemainingToReceive(input) > 0;
}

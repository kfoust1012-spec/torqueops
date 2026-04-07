export const vinDecodeStatuses = [
  "success",
  "invalid_format",
  "partial",
  "not_found",
  "provider_error"
] as const;

export type VinDecodeStatus = (typeof vinDecodeStatuses)[number];

export interface VinDecodedVehicleFields {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
}

export interface DecodeVinInput {
  vin: string;
}

export interface VinDecodeResult {
  vin: string;
  status: VinDecodeStatus;
  decoded: VinDecodedVehicleFields;
  warnings: string[];
  source: "nhtsa";
}
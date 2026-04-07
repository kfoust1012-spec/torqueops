import type {
  PartRequestLine,
  PartsTechVehicleContext,
  ProcurementProviderAccount
} from "@mobile-mechanic/types";

export function buildPartsTechDisplayName(account?: Pick<ProcurementProviderAccount, "displayName"> | null) {
  return account?.displayName?.trim() || "PartsTech";
}

export function buildPartsTechVehicleContext(input: {
  engine?: string | null | undefined;
  licensePlate?: string | null | undefined;
  make?: string | null | undefined;
  model?: string | null | undefined;
  vin?: string | null | undefined;
  year?: number | null | undefined;
}): PartsTechVehicleContext {
  return {
    year: input.year ?? null,
    make: input.make ?? null,
    model: input.model ?? null,
    engine: input.engine ?? null,
    vin: input.vin ?? null,
    licensePlate: input.licensePlate ?? null
  };
}

export function buildPartsTechSearchTerms(lines: Array<Pick<PartRequestLine, "description" | "partNumber">>) {
  const terms = new Set<string>();

  for (const line of lines) {
    const description = line.description.trim();
    if (description) {
      terms.add(description);
    }

    const partNumber = line.partNumber?.trim();
    if (partNumber) {
      terms.add(partNumber);
    }
  }

  return [...terms];
}

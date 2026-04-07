import type {
  EstimateCatalogPartOfferSummary,
  EstimateVehicleContextSnapshot,
  SupplierAccount
} from "@mobile-mechanic/types";

type CatalogPartFamily =
  | "battery"
  | "front_brake_kit"
  | "front_wheel_bearing_hub"
  | "oil_service_kit"
  | "spark_plug_set";

type CatalogVehicleMatcher = {
  engineIncludes?: string[];
  make: string;
  model: string;
  year: number;
};

type CatalogOfferTemplate = {
  availabilityText: string | null;
  description: string;
  fitmentNotes: string | null;
  manufacturer: string | null;
  partNumber: string;
  quotedUnitCostCents: number;
  supplierLabel: string;
  supplierUrl: string | null;
};

type CatalogEntry = {
  family: CatalogPartFamily;
  id: string;
  offers: CatalogOfferTemplate[];
  vehicle: CatalogVehicleMatcher;
};

const INTERNAL_PARTS_CATALOG: CatalogEntry[] = [
  {
    family: "front_brake_kit",
    id: "toyota-rav4-2022-front-brakes",
    vehicle: {
      engineIncludes: ["2.5l"],
      make: "Toyota",
      model: "RAV4",
      year: 2022
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "Front brake pad and rotor kit",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L brake profile.",
        manufacturer: "Duralast Gold",
        partNumber: "AZ-RAV4-FBK-22",
        quotedUnitCostCents: 34_250,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Front brake pad and rotor kit",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L brake profile.",
        manufacturer: "BrakeBest Select",
        partNumber: "OR-RAV4-FBK-22",
        quotedUnitCostCents: 32_995,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      },
      {
        availabilityText: "Warehouse by 3 PM",
        description: "Front brake pad and rotor kit",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L brake profile.",
        manufacturer: "Adaptive One",
        partNumber: "NAPA-RAV4-FBK-22",
        quotedUnitCostCents: 35_675,
        supplierLabel: "NAPA Auto Parts",
        supplierUrl: "https://www.napaonline.com/"
      }
    ]
  },
  {
    family: "battery",
    id: "toyota-rav4-2022-battery",
    vehicle: {
      engineIncludes: ["2.5l"],
      make: "Toyota",
      model: "RAV4",
      year: 2022
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L battery profile.",
        manufacturer: "Duralast Platinum AGM",
        partNumber: "AZ-RAV4-AGM-22",
        quotedUnitCostCents: 20_995,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L battery profile.",
        manufacturer: "Super Start Platinum AGM",
        partNumber: "OR-RAV4-AGM-22",
        quotedUnitCostCents: 19_750,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "oil_service_kit",
    id: "toyota-rav4-2022-oil-service",
    vehicle: {
      engineIncludes: ["2.5l"],
      make: "Toyota",
      model: "RAV4",
      year: 2022
    },
    offers: [
      {
        availabilityText: "On shelf",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L oil-service profile.",
        manufacturer: "Mobil 1 / STP",
        partNumber: "AZ-RAV4-OIL-22",
        quotedUnitCostCents: 4_595,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L oil-service profile.",
        manufacturer: "Castrol Edge / MicroGard",
        partNumber: "OR-RAV4-OIL-22",
        quotedUnitCostCents: 4_295,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "spark_plug_set",
    id: "toyota-rav4-2022-spark-plugs",
    vehicle: {
      engineIncludes: ["2.5l"],
      make: "Toyota",
      model: "RAV4",
      year: 2022
    },
    offers: [
      {
        availabilityText: "Next route truck",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L ignition-service profile.",
        manufacturer: "NGK",
        partNumber: "AZ-RAV4-PLUG-22",
        quotedUnitCostCents: 5_995,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2022 Toyota RAV4 2.5L ignition-service profile.",
        manufacturer: "NGK Iridium IX",
        partNumber: "OR-RAV4-PLUG-22",
        quotedUnitCostCents: 5_695,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "battery",
    id: "ford-f150-2019-battery",
    vehicle: {
      engineIncludes: ["5.0l"],
      make: "Ford",
      model: "F-150",
      year: 2019
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L battery profile.",
        manufacturer: "Duralast Platinum AGM",
        partNumber: "AZ-94R-AGM-F150",
        quotedUnitCostCents: 21_995,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L battery profile.",
        manufacturer: "Super Start Platinum AGM",
        partNumber: "OR-94R-AGM-F150",
        quotedUnitCostCents: 20_995,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      },
      {
        availabilityText: "Next route truck",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L battery profile.",
        manufacturer: "Legend Premium AGM",
        partNumber: "NAPA-94R-F150",
        quotedUnitCostCents: 22_850,
        supplierLabel: "NAPA Auto Parts",
        supplierUrl: "https://www.napaonline.com/"
      }
    ]
  },
  {
    family: "front_brake_kit",
    id: "ford-f150-2019-front-brakes",
    vehicle: {
      engineIncludes: ["5.0l"],
      make: "Ford",
      model: "F-150",
      year: 2019
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "Front brake pad and rotor kit",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L brake profile.",
        manufacturer: "Duralast Gold",
        partNumber: "AZ-F150-FBK-19",
        quotedUnitCostCents: 38_450,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Front brake pad and rotor kit",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L brake profile.",
        manufacturer: "BrakeBest Select",
        partNumber: "OR-F150-FBK-19",
        quotedUnitCostCents: 37_125,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "oil_service_kit",
    id: "ford-f150-2019-oil-service",
    vehicle: {
      engineIncludes: ["5.0l"],
      make: "Ford",
      model: "F-150",
      year: 2019
    },
    offers: [
      {
        availabilityText: "On shelf",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L oil-service profile.",
        manufacturer: "Mobil 1 / Motorcraft",
        partNumber: "AZ-F150-OIL-19",
        quotedUnitCostCents: 6_895,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L oil-service profile.",
        manufacturer: "Castrol Edge / MicroGard",
        partNumber: "OR-F150-OIL-19",
        quotedUnitCostCents: 6_595,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "spark_plug_set",
    id: "ford-f150-2019-spark-plugs",
    vehicle: {
      engineIncludes: ["5.0l"],
      make: "Ford",
      model: "F-150",
      year: 2019
    },
    offers: [
      {
        availabilityText: "Warehouse by noon",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L ignition-service profile.",
        manufacturer: "Motorcraft",
        partNumber: "AZ-F150-PLUG-19",
        quotedUnitCostCents: 7_895,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2019 Ford F-150 5.0L ignition-service profile.",
        manufacturer: "NGK Iridium IX",
        partNumber: "OR-F150-PLUG-19",
        quotedUnitCostCents: 7_495,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "battery",
    id: "honda-crv-2020-battery",
    vehicle: {
      engineIncludes: ["1.5l"],
      make: "Honda",
      model: "CR-V",
      year: 2020
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L battery profile.",
        manufacturer: "Duralast Platinum AGM",
        partNumber: "AZ-CRV-AGM-20",
        quotedUnitCostCents: 19_995,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "AGM battery",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L battery profile.",
        manufacturer: "Super Start Platinum AGM",
        partNumber: "OR-CRV-AGM-20",
        quotedUnitCostCents: 18_995,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "oil_service_kit",
    id: "honda-crv-2020-oil-service",
    vehicle: {
      engineIncludes: ["1.5l"],
      make: "Honda",
      model: "CR-V",
      year: 2020
    },
    offers: [
      {
        availabilityText: "On shelf",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L oil-service profile.",
        manufacturer: "Mobil 1 / STP",
        partNumber: "AZ-CRV-OIL-20",
        quotedUnitCostCents: 4_795,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Oil and filter kit",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L oil-service profile.",
        manufacturer: "Castrol Edge / MicroGard",
        partNumber: "OR-CRV-OIL-20",
        quotedUnitCostCents: 4_495,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "spark_plug_set",
    id: "honda-crv-2020-spark-plugs",
    vehicle: {
      engineIncludes: ["1.5l"],
      make: "Honda",
      model: "CR-V",
      year: 2020
    },
    offers: [
      {
        availabilityText: "Next route truck",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L ignition-service profile.",
        manufacturer: "NGK Laser Iridium",
        partNumber: "AZ-CRV-PLUG-20",
        quotedUnitCostCents: 7_495,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Spark plug set",
        fitmentNotes: "Matched to the internal 2020 Honda CR-V 1.5L ignition-service profile.",
        manufacturer: "NGK Iridium IX",
        partNumber: "OR-CRV-PLUG-20",
        quotedUnitCostCents: 7_195,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  },
  {
    family: "front_wheel_bearing_hub",
    id: "chevrolet-silverado-2017-wheel-bearing",
    vehicle: {
      engineIncludes: ["5.3l"],
      make: "Chevrolet",
      model: "Silverado 1500",
      year: 2017
    },
    offers: [
      {
        availabilityText: "In stock today",
        description: "Front wheel bearing and hub assembly",
        fitmentNotes: "Matched to the internal 2017 Chevrolet Silverado 1500 5.3L hub profile.",
        manufacturer: "Duralast Gold",
        partNumber: "AZ-SIL-HUB-17",
        quotedUnitCostCents: 18_595,
        supplierLabel: "AutoZone",
        supplierUrl: "https://www.autozone.com/"
      },
      {
        availabilityText: "Counter pickup today",
        description: "Front wheel bearing and hub assembly",
        fitmentNotes: "Matched to the internal 2017 Chevrolet Silverado 1500 5.3L hub profile.",
        manufacturer: "Precision",
        partNumber: "OR-SIL-HUB-17",
        quotedUnitCostCents: 17_650,
        supplierLabel: "O'Reilly Auto Parts",
        supplierUrl: "https://www.oreillyauto.com/"
      }
    ]
  }
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function slugifySupplierName(name: string) {
  const normalizedSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedSlug || "supplier";
}

function resolveCatalogPartFamily(input: {
  description?: string | null;
  name: string;
}): CatalogPartFamily | null {
  const searchText = normalizeText(`${input.name} ${input.description ?? ""}`);

  if (searchText.includes("battery")) {
    return "battery";
  }

  if (
    searchText.includes("brake") &&
    (searchText.includes("pad") || searchText.includes("rotor"))
  ) {
    return "front_brake_kit";
  }

  if (searchText.includes("oil") && searchText.includes("filter")) {
    return "oil_service_kit";
  }

  if (searchText.includes("spark plug")) {
    return "spark_plug_set";
  }

  if (searchText.includes("wheel bearing") || searchText.includes("hub")) {
    return "front_wheel_bearing_hub";
  }

  return null;
}

function matchesVehicle(
  vehicleContext: EstimateVehicleContextSnapshot,
  matcher: CatalogVehicleMatcher
) {
  if (vehicleContext.year !== matcher.year) {
    return false;
  }

  if (normalizeText(vehicleContext.make) !== normalizeText(matcher.make)) {
    return false;
  }

  if (normalizeText(vehicleContext.model) !== normalizeText(matcher.model)) {
    return false;
  }

  if (!matcher.engineIncludes?.length) {
    return true;
  }

  const normalizedEngine = normalizeText(vehicleContext.engine);

  return matcher.engineIncludes.some((engineSnippet) =>
    normalizedEngine.includes(normalizeText(engineSnippet))
  );
}

export function resolveEstimateCatalogPartOffers(input: {
  lineItem: {
    description?: string | null;
    name: string;
  };
  supplierAccounts: SupplierAccount[];
  vehicleContext: EstimateVehicleContextSnapshot;
}): EstimateCatalogPartOfferSummary[] {
  const family = resolveCatalogPartFamily(input.lineItem);

  if (!family) {
    return [];
  }

  const entry = INTERNAL_PARTS_CATALOG.find(
    (candidate) =>
      candidate.family === family && matchesVehicle(input.vehicleContext, candidate.vehicle)
  );

  if (!entry) {
    return [];
  }

  return entry.offers
    .map((offer) => {
      const supplierAccount =
        input.supplierAccounts.find(
          (supplierAccount) =>
            slugifySupplierName(supplierAccount.name) ===
            slugifySupplierName(offer.supplierLabel)
        ) ?? null;

      return {
        id: `${entry.id}:${slugifySupplierName(offer.supplierLabel)}`,
        supplierLabel: offer.supplierLabel,
        supplierAccountId: supplierAccount?.id ?? null,
        supplierUrl: offer.supplierUrl,
        manufacturer: offer.manufacturer,
        partNumber: offer.partNumber,
        description: offer.description,
        quotedUnitCostCents: offer.quotedUnitCostCents,
        availabilityText: offer.availabilityText,
        fitmentNotes: offer.fitmentNotes
      } satisfies EstimateCatalogPartOfferSummary;
    })
    .sort((left, right) => left.quotedUnitCostCents - right.quotedUnitCostCents);
}

import {
  addPartRequestLine,
  type AppSupabaseClient,
  createProcurementSupplyList,
  deleteProcurementSupplyList,
  deleteProcurementSupplyListLine,
  getPartRequestById,
  getProcurementSupplyListById,
  listProcurementSupplyListsByCompany,
  upsertProcurementSupplyListLine,
  updatePartRequestLine,
  updateProcurementSupplyList
} from "@mobile-mechanic/api-client";
import type {
  ApplyProcurementSupplyListToRequestInput,
  CreateProcurementSupplyListInput,
  PartRequestLine,
  ProcurementSupplyListLine,
  UpsertProcurementSupplyListLineInput,
  UpdateProcurementSupplyListInput
} from "@mobile-mechanic/types";
import { applyProcurementSupplyListToRequestInputSchema } from "@mobile-mechanic/validation";

const SUPPLY_SEARCH_NOTE_PREFIX = "Supply search: ";
const AMAZON_PRODUCT_NOTE_PREFIX = "Amazon product key: ";
const AMAZON_OFFER_NOTE_PREFIX = "Amazon offer key: ";

function normalizeSupplyText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function splitNoteLines(notes: string | null | undefined) {
  if (!notes) {
    return [];
  }

  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSupplyListMetadataLines(line: ProcurementSupplyListLine) {
  return [
    line.searchQuery ? `${SUPPLY_SEARCH_NOTE_PREFIX}${line.searchQuery}` : null,
    line.providerProductKey ? `${AMAZON_PRODUCT_NOTE_PREFIX}${line.providerProductKey}` : null,
    line.providerOfferKey ? `${AMAZON_OFFER_NOTE_PREFIX}${line.providerOfferKey}` : null
  ].filter((value): value is string => Boolean(value));
}

function buildSupplyListRequestNotes(
  line: ProcurementSupplyListLine,
  existingNotes?: string | null
) {
  const noteLines = splitNoteLines(existingNotes);
  const existingLineSet = new Set(noteLines.map((noteLine) => noteLine.toLowerCase()));

  for (const desiredLine of [line.notes?.trim() || null, ...buildSupplyListMetadataLines(line)]) {
    if (!desiredLine) {
      continue;
    }

    const normalizedLine = desiredLine.toLowerCase();

    if (!existingLineSet.has(normalizedLine)) {
      noteLines.push(desiredLine);
      existingLineSet.add(normalizedLine);
    }
  }

  return noteLines.length ? noteLines.join("\n") : null;
}

function isOpenSupplyRequestLine(line: PartRequestLine) {
  return line.quantityRequested > line.quantityInstalled && line.status !== "core_returned";
}

function matchesSupplyListLine(existingLine: PartRequestLine, supplyListLine: ProcurementSupplyListLine) {
  if (!isOpenSupplyRequestLine(existingLine)) {
    return false;
  }

  if ((existingLine.inventoryItemId ?? null) !== (supplyListLine.inventoryItemId ?? null)) {
    return false;
  }

  if (
    normalizeSupplyText(existingLine.description) !== normalizeSupplyText(supplyListLine.description)
  ) {
    return false;
  }

  if (supplyListLine.notes) {
    const existingNotes = existingLine.notes ?? "";

    if (!existingNotes.toLowerCase().includes(supplyListLine.notes.trim().toLowerCase())) {
      return false;
    }
  }

  const existingNoteLineSet = new Set(
    splitNoteLines(existingLine.notes).map((noteLine) => noteLine.toLowerCase())
  );

  return buildSupplyListMetadataLines(supplyListLine).every((metadataLine) =>
    existingNoteLineSet.has(metadataLine.toLowerCase())
  );
}

export async function getSupplyListsWorkspace(
  client: AppSupabaseClient,
  companyId: string
) {
  const result = await listProcurementSupplyListsByCompany(client, companyId);

  if (result.error) {
    throw result.error;
  }

  return {
    lists: result.data ?? []
  };
}

export async function getSupplyListDetail(
  client: AppSupabaseClient,
  supplyListId: string
) {
  const result = await getProcurementSupplyListById(client, supplyListId);

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function saveSupplyList(
  client: AppSupabaseClient,
  input:
    | CreateProcurementSupplyListInput
    | { supplyListId: string; update: UpdateProcurementSupplyListInput }
 ) {
  if ("supplyListId" in input) {
    const result = await updateProcurementSupplyList(client, input.supplyListId, input.update);

    if (result.error || !result.data) {
      throw result.error ?? new Error("Supply list could not be updated.");
    }

    return result.data;
  }

  const result = await createProcurementSupplyList(client, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Supply list could not be created.");
  }

  return result.data;
}

export async function deleteSupplyList(
  client: AppSupabaseClient,
  supplyListId: string
) {
  const result = await deleteProcurementSupplyList(client, supplyListId);

  if (result.error) {
    throw result.error;
  }
}

export async function saveSupplyListLine(
  client: AppSupabaseClient,
  input: UpsertProcurementSupplyListLineInput
) {
  const result = await upsertProcurementSupplyListLine(client, input);

  if (result.error || !result.data) {
    throw result.error ?? new Error("Supply list line could not be saved.");
  }

  return result.data;
}

export async function removeSupplyListLine(
  client: AppSupabaseClient,
  supplyListLineId: string
) {
  const result = await deleteProcurementSupplyListLine(client, supplyListLineId);

  if (result.error) {
    throw result.error;
  }
}

export async function applySupplyListToRequest(
  client: AppSupabaseClient,
  input: ApplyProcurementSupplyListToRequestInput
) {
  const parsed = applyProcurementSupplyListToRequestInputSchema.parse(input);
  const [requestResult, supplyListResult] = await Promise.all([
    getPartRequestById(client, parsed.requestId),
    getProcurementSupplyListById(client, parsed.supplyListId)
  ]);

  if (requestResult.error || !requestResult.data) {
    throw requestResult.error ?? new Error("Part request could not be loaded.");
  }

  if (supplyListResult.error || !supplyListResult.data) {
    throw supplyListResult.error ?? new Error("Supply list could not be loaded.");
  }

  const createdLineIds: string[] = [];

  for (const line of supplyListResult.data.lines) {
    const existingRequestLine = requestResult.data.lines.find((requestLine) =>
      matchesSupplyListLine(requestLine, line)
    );

    if (existingRequestLine) {
      const updatedResult = await updatePartRequestLine(client, existingRequestLine.id, {
        description: existingRequestLine.description,
        inventoryItemId: line.inventoryItemId ?? existingRequestLine.inventoryItemId ?? null,
        manufacturer: existingRequestLine.manufacturer,
        partNumber: existingRequestLine.partNumber,
        supplierSku: existingRequestLine.supplierSku,
        quantityRequested: existingRequestLine.quantityRequested + line.defaultQuantity,
        estimatedUnitCostCents:
          line.expectedUnitCostCents ?? existingRequestLine.estimatedUnitCostCents ?? undefined,
        needsCore: existingRequestLine.needsCore,
        coreChargeCents: existingRequestLine.coreChargeCents,
        lastSupplierAccountId: existingRequestLine.lastSupplierAccountId,
        notes: buildSupplyListRequestNotes(line, existingRequestLine.notes)
      });

      if (updatedResult.error || !updatedResult.data) {
        throw (
          updatedResult.error ?? new Error("Supply list line could not be updated on the request.")
        );
      }

      const existingLineIndex = requestResult.data.lines.findIndex(
        (requestLine) => requestLine.id === existingRequestLine.id
      );

      if (existingLineIndex >= 0) {
        requestResult.data.lines[existingLineIndex] = updatedResult.data;
      }

      continue;
    }

    const createdResult = await addPartRequestLine(client, parsed.requestId, {
      companyId: parsed.companyId,
      jobId: requestResult.data.request.jobId,
      estimateId: requestResult.data.request.estimateId,
      inventoryItemId: line.inventoryItemId ?? null,
      description: line.description,
      manufacturer: null,
      partNumber: null,
      supplierSku: null,
      quantityRequested: line.defaultQuantity,
      quotedUnitCostCents: null,
      estimatedUnitCostCents: line.expectedUnitCostCents,
      needsCore: false,
      coreChargeCents: 0,
      notes: buildSupplyListRequestNotes(line),
      createdByUserId: parsed.actorUserId
    });

    if (createdResult.error || !createdResult.data) {
      throw createdResult.error ?? new Error("Supply list line could not be applied to the request.");
    }

    requestResult.data.lines.push(createdResult.data);
    createdLineIds.push(createdResult.data.id);
  }

  return {
    createdLineIds,
    supplyList: supplyListResult.data.list
  };
}

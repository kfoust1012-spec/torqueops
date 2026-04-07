import { createHash, randomUUID } from "node:crypto";

import {
  claimDataImportRunForProcessing,
  createAndUploadJobAttachment,
  createCustomer,
  createCustomerAddress,
  createVehicle,
  getDataImportRunById,
  listAddressesByCustomer,
  updateCustomer,
  updateCustomerAddress,
  updateDataImportRun,
  updateVehicle
} from "@mobile-mechanic/api-client";
import {
  isSupportedAttachmentMimeType,
  normalizeLicensePlate,
  normalizeVin,
  sanitizeAttachmentFileName
} from "@mobile-mechanic/core";
import {
  maxAttachmentFileSizeBytes,
  type AttachmentMimeType,
  type DataImportRun,
  type Database,
  type Json
} from "@mobile-mechanic/types";

import { createServiceRoleSupabaseClient } from "../supabase/service-role";
import { deriveShopmonkeyImportedJobLifecycle } from "./job-lifecycle";
import { decryptProviderCredential } from "./credentials";
import {
  getShopmonkeyCustomerById,
  listShopmonkeyCustomerOrders,
  listShopmonkeyCustomerVehicles,
  listShopmonkeyOrderSharedInspections,
  requestShopmonkeyCompanyExport,
  searchShopmonkeyCustomers,
  type ShopmonkeyCustomerRecord,
  type ShopmonkeyInspectionFileRecord,
  type ShopmonkeyInspectionItemRecord,
  type ShopmonkeyOrderRecord,
  type ShopmonkeyVehicleRecord
} from "./shopmonkey-client";

type Client = ReturnType<typeof createServiceRoleSupabaseClient>;
type SourceAccountRow = Database["public"]["Tables"]["migration_source_accounts"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InspectionRow = Database["public"]["Tables"]["inspections"]["Row"];
type InspectionItemRow = Database["public"]["Tables"]["inspection_items"]["Row"];
type MappingRow = Database["public"]["Tables"]["external_record_mappings"]["Row"];
type Counts = {
  attachmentsCreated: number;
  customerAddressesCreated: number;
  customerAddressesUpdated: number;
  customersCreated: number;
  customersUpdated: number;
  estimatesCreated: number;
  inspectionsCreated: number;
  invoicesCreated: number;
  jobsCreated: number;
  jobsUpdated: number;
  vehiclesCreated: number;
  vehiclesUpdated: number;
};

type RunOptions = {
  customerId?: string;
  mode?: "delta" | "full";
  orderId?: string;
  requestPresignedUrl?: boolean;
  tables?: string[];
  vehicleId?: string;
};

const PAGE_SIZE = 100;
const EMPTY_COUNTS: Counts = {
  attachmentsCreated: 0,
  customerAddressesCreated: 0,
  customerAddressesUpdated: 0,
  customersCreated: 0,
  customersUpdated: 0,
  estimatesCreated: 0,
  inspectionsCreated: 0,
  invoicesCreated: 0,
  jobsCreated: 0,
  jobsUpdated: 0,
  vehiclesCreated: 0,
  vehiclesUpdated: 0
};

function asJson(value: unknown): Json { return (value ?? null) as Json; }
function toObject(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}
function toTrimmedString(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function normalizeEmail(value: string | null | undefined) { return value && value.trim() ? value.trim().toLowerCase() : null; }
function normalizePhone(value: string | null | undefined) { const digits = value ? value.replace(/\D+/g, "") : ""; return digits.length >= 7 ? digits : null; }
function normalizeState(value: string | null | undefined) { const state = value?.trim().toUpperCase() ?? ""; return state.length === 2 ? state : null; }
function normalizePostalCode(value: string | null | undefined) { const postalCode = value?.trim() ?? ""; return /^\d{5}(?:-\d{4})?$/.test(postalCode) ? postalCode : null; }
function hashPayload(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function readCounts(summaryJson: Json | null | undefined): Counts { const counts = toObject(toObject(summaryJson).counts); return { attachmentsCreated: Number(counts.attachmentsCreated ?? 0), customerAddressesCreated: Number(counts.customerAddressesCreated ?? 0), customerAddressesUpdated: Number(counts.customerAddressesUpdated ?? 0), customersCreated: Number(counts.customersCreated ?? 0), customersUpdated: Number(counts.customersUpdated ?? 0), estimatesCreated: Number(counts.estimatesCreated ?? 0), inspectionsCreated: Number(counts.inspectionsCreated ?? 0), invoicesCreated: Number(counts.invoicesCreated ?? 0), jobsCreated: Number(counts.jobsCreated ?? 0), jobsUpdated: Number(counts.jobsUpdated ?? 0), vehiclesCreated: Number(counts.vehiclesCreated ?? 0), vehiclesUpdated: Number(counts.vehiclesUpdated ?? 0) }; }
function addCounts(base: Counts, delta: Partial<Counts>) { return { attachmentsCreated: base.attachmentsCreated + (delta.attachmentsCreated ?? 0), customerAddressesCreated: base.customerAddressesCreated + (delta.customerAddressesCreated ?? 0), customerAddressesUpdated: base.customerAddressesUpdated + (delta.customerAddressesUpdated ?? 0), customersCreated: base.customersCreated + (delta.customersCreated ?? 0), customersUpdated: base.customersUpdated + (delta.customersUpdated ?? 0), estimatesCreated: base.estimatesCreated + (delta.estimatesCreated ?? 0), inspectionsCreated: base.inspectionsCreated + (delta.inspectionsCreated ?? 0), invoicesCreated: base.invoicesCreated + (delta.invoicesCreated ?? 0), jobsCreated: base.jobsCreated + (delta.jobsCreated ?? 0), jobsUpdated: base.jobsUpdated + (delta.jobsUpdated ?? 0), vehiclesCreated: base.vehiclesCreated + (delta.vehiclesCreated ?? 0), vehiclesUpdated: base.vehiclesUpdated + (delta.vehiclesUpdated ?? 0) }; }
function parseOptions(run: DataImportRun): RunOptions {
  const options = toObject(run.optionsJson);
  const parsed: RunOptions = {
    mode: options.mode === "delta" ? "delta" : "full",
    requestPresignedUrl: options.requestPresignedUrl !== false,
    tables: Array.isArray(options.tables)
      ? options.tables.filter((value): value is string => typeof value === "string")
      : []
  };
  const customerId = toTrimmedString(options.customerId);
  const orderId = toTrimmedString(options.orderId);
  const vehicleId = toTrimmedString(options.vehicleId);

  if (customerId) parsed.customerId = customerId;
  if (orderId) parsed.orderId = orderId;
  if (vehicleId) parsed.vehicleId = vehicleId;

  return parsed;
}
function buildSummary(run: DataImportRun, counts: Counts, extras: Record<string, Json | undefined>) { return asJson({ ...toObject(run.summaryJson), ...extras, counts }); }

function deriveCustomerName(source: ShopmonkeyCustomerRecord) {
  const firstName = toTrimmedString(source.firstName);
  const lastName = toTrimmedString(source.lastName);
  const companyName = toTrimmedString(source.companyName);
  if (firstName && lastName) return { firstName, lastName };
  if (firstName) return { firstName, lastName: "Customer" };
  if (lastName) return { firstName: "Shop", lastName };
  if (companyName) {
    const parts = companyName.split(/\s+/).filter(Boolean);
    return { firstName: parts[0]?.slice(0, 100) ?? "Business", lastName: parts.slice(1).join(" ").slice(0, 100) || "Business" };
  }
  return { firstName: "Shopmonkey", lastName: "Customer" };
}
function buildCustomerNotes(source: ShopmonkeyCustomerRecord) { return [source.companyName?.trim() ? `Company: ${source.companyName.trim()}` : null, source.note?.trim() ?? null].filter(Boolean).join("\n\n") || null; }
function getPrimaryEmail(source: ShopmonkeyCustomerRecord) { const entry = (source.emails ?? []).find((value) => value?.primary && value.email) ?? source.emails?.[0]; return normalizeEmail(entry?.email ?? null); }
function getPrimaryPhone(source: ShopmonkeyCustomerRecord) { const entry = (source.phoneNumbers ?? []).find((value) => value?.primary && value.number) ?? source.phoneNumbers?.[0]; return entry?.number?.trim() ?? null; }
function parseAppointments(value: string | string[] | null | undefined) {
  const dates = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean).sort();
  return {
    scheduledEndAt: dates.length > 1 ? dates[dates.length - 1] ?? null : null,
    scheduledStartAt: dates[0] ?? null
  };
}
function buildOrderPricing(order: ShopmonkeyOrderRecord) { const totalCents = Math.max(Math.round(order.totalCostCents ?? 0), 0); const taxCents = Math.max(Math.round(order.taxCents ?? 0), 0); const subtotalCents = Math.max(totalCents - taxCents, 0); const lines = [{ amountCents: Math.max(Math.round(order.partsCents ?? 0), 0), itemType: "part", name: "Parts" }, { amountCents: Math.max(Math.round(order.tiresCents ?? 0), 0), itemType: "part", name: "Tires" }, { amountCents: Math.max(Math.round(order.laborCents ?? 0), 0), itemType: "labor", name: "Labor" }, { amountCents: Math.max(Math.round(order.shopSuppliesCents ?? 0), 0), itemType: "fee", name: "Shop supplies" }, { amountCents: Math.max(Math.round(order.subcontractsCents ?? 0), 0), itemType: "fee", name: "Subcontracts" }, { amountCents: Math.max(Math.round(order.transactionalFeeTotalCents ?? order.transactionalFeeSubtotalCents ?? 0), 0), itemType: "fee", name: "Transactional fee" }].filter((line) => line.amountCents > 0); const knownSubtotal = lines.reduce((sum, line) => sum + line.amountCents, 0); if (subtotalCents > knownSubtotal) lines.push({ amountCents: subtotalCents - knownSubtotal, itemType: "fee", name: "Other charges" }); return { amountPaidCents: Math.max(Math.round(order.paidCostCents ?? 0), 0), balanceDueCents: order.remainingCostCents === null || order.remainingCostCents === undefined ? Math.max(totalCents - Math.max(Math.round(order.paidCostCents ?? 0), 0), 0) : Math.max(Math.round(order.remainingCostCents), 0), lines, subtotalCents, taxCents, taxRateBasisPoints: subtotalCents > 0 && taxCents > 0 ? Math.round((taxCents / subtotalCents) * 10000) : 0, totalCents }; }
function shouldImportEstimate(order: ShopmonkeyOrderRecord) { return Boolean(order.status) || order.authorized === true || order.invoiced === true || order.paid === true || Math.max(Math.round(order.totalCostCents ?? 0), 0) > 0; }
function shouldImportInvoice(order: ShopmonkeyOrderRecord) { const status = order.status?.trim().toLowerCase() ?? ""; return order.invoiced === true || order.paid === true || Math.max(Math.round(order.paidCostCents ?? 0), 0) > 0 || status === "invoice"; }
function inferMimeType(fileName: string | null, rawMimeType: string | null) { const candidates = [rawMimeType, fileName?.toLowerCase().endsWith(".png") ? "image/png" : null, fileName?.toLowerCase().endsWith(".webp") ? "image/webp" : null, fileName?.toLowerCase().endsWith(".jpg") || fileName?.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : null].filter((value): value is string => Boolean(value)); const supported = candidates.find((candidate) => isSupportedAttachmentMimeType(candidate)); return supported ? (supported as AttachmentMimeType) : null; }
async function getSourceAccount(client: Client, sourceAccountId: string) { const result = await client.from("migration_source_accounts").select("*").eq("id", sourceAccountId).maybeSingle<SourceAccountRow>(); if (result.error) throw result.error; return result.data ?? null; }
async function getMapping(client: Client, companyId: string, entityType: Database["public"]["Enums"]["data_import_entity_type"], externalId: string) { const result = await client.from("external_record_mappings").select("*").eq("company_id", companyId).eq("provider", "shopmonkey").eq("entity_type", entityType).eq("external_id", externalId).maybeSingle<MappingRow>(); if (result.error) throw result.error; return result.data ?? null; }
async function upsertMapping(client: Client, input: { companyId: string; entityType: string; externalId: string; internalId: string; internalTable: string; lastImportRunId: string; payloadHash: string; sourceUpdatedAt: string | null; }) { const result = await client.from("external_record_mappings").upsert({ company_id: input.companyId, entity_type: input.entityType as never, external_id: input.externalId, internal_id: input.internalId, internal_table: input.internalTable, last_import_run_id: input.lastImportRunId, payload_hash: input.payloadHash, provider: "shopmonkey", source_updated_at: input.sourceUpdatedAt, updated_at: new Date().toISOString() }, { onConflict: "company_id,provider,entity_type,external_id" }).select("id").single(); if (result.error) throw result.error; }
async function getCustomerById(client: Client, customerId: string) { const result = await client.from("customers").select("*").eq("id", customerId).maybeSingle<CustomerRow>(); if (result.error) throw result.error; return result.data ?? null; }
async function getVehicleById(client: Client, vehicleId: string) { const result = await client.from("vehicles").select("*").eq("id", vehicleId).maybeSingle<VehicleRow>(); if (result.error) throw result.error; return result.data ?? null; }
async function getJobById(client: Client, jobId: string) { const result = await client.from("jobs").select("*").eq("id", jobId).maybeSingle<JobRow>(); if (result.error) throw result.error; return result.data ?? null; }
async function findCustomerMatch(client: Client, companyId: string, email: string | null, phone: string | null) { if (email) { const result = await client.from("customers").select("*").eq("company_id", companyId).ilike("email", email).returns<CustomerRow[]>(); if (result.error) throw result.error; if ((result.data ?? []).length === 1) return result.data?.[0] ?? null; } const normalized = normalizePhone(phone); if (!normalized) return null; const result = await client.from("customers").select("*").eq("company_id", companyId).ilike("phone", `%${normalized.slice(-7)}%`).returns<CustomerRow[]>(); if (result.error) throw result.error; const matches = (result.data ?? []).filter((row) => normalizePhone(row.phone) === normalized); return matches.length === 1 ? matches[0] ?? null : null; }
async function findVehicleMatch(client: Client, companyId: string, vin: string | null, plate: string | null, state: string | null) { if (vin) { const result = await client.from("vehicles").select("*").eq("company_id", companyId).eq("vin", vin).returns<VehicleRow[]>(); if (result.error) throw result.error; if ((result.data ?? []).length === 1) return result.data?.[0] ?? null; } if (!plate || !state) return null; const result = await client.from("vehicles").select("*").eq("company_id", companyId).eq("license_plate", plate).eq("license_state", state).returns<VehicleRow[]>(); if (result.error) throw result.error; return (result.data ?? []).length === 1 ? result.data?.[0] ?? null : null; }
async function listAllVehicles(apiKey: string, customerId: string) { const records: ShopmonkeyVehicleRecord[] = []; let skip = 0; while (true) { const page = await listShopmonkeyCustomerVehicles(apiKey, customerId, { limit: PAGE_SIZE, skip }); records.push(...page.records); if (!page.hasMore || page.records.length < PAGE_SIZE) break; skip += page.records.length; } return records; }
async function listAllOrders(apiKey: string, customerId: string) { const records: ShopmonkeyOrderRecord[] = []; let skip = 0; while (true) { const page = await listShopmonkeyCustomerOrders(apiKey, customerId, { limit: PAGE_SIZE, skip }); records.push(...page.records); if (!page.hasMore || page.records.length < PAGE_SIZE) break; skip += page.records.length; } return records; }

export async function processDataImportRunById(runId: string) {
  const client = createServiceRoleSupabaseClient();
  const runResult = await getDataImportRunById(client, runId);
  if (runResult.error || !runResult.data) throw runResult.error ?? new Error("Data import run was not found.");
  let run = runResult.data;
  if (run.status === "completed" || run.status === "canceled") return run;
  if (run.status === "queued" || run.status === "failed") {
    const claim = await claimDataImportRunForProcessing(client, run.id);
    if (claim.error || !claim.data) throw claim.error ?? new Error("Import run could not be claimed.");
    run = claim.data;
  }

  const sourceAccount = await getSourceAccount(client, run.sourceAccountId);
  if (!sourceAccount) throw new Error("Migration source account not found.");
  const apiKey = decryptProviderCredential(sourceAccount.credential_ciphertext);
  if (!apiKey) throw new Error("Shopmonkey credential is not available.");

  const options = parseOptions(run);
  let counts = readCounts(run.summaryJson);
  const failures: string[] = [];
  const requestedTables = options.tables?.length ? options.tables : ["customer", "vehicle", "order", "inspection"];
  let exportFileName = toTrimmedString(toObject(run.summaryJson).exportFileName);
  let exportRequestError = toTrimmedString(toObject(run.summaryJson).exportRequestError);
  const persist = async (status: DataImportRun["status"], lastErrorMessage: string | null, finishedAt?: string | null) => {
    const result = await updateDataImportRun(client, run.id, {
      finishedAt,
      lastErrorMessage,
      lastHeartbeatAt: new Date().toISOString(),
      status,
      summaryJson: buildSummary(run, counts, { exportFileName, exportRequestError, failures: asJson(failures), requestedTables: asJson(requestedTables) })
    });
    if (result.error || !result.data) throw result.error ?? new Error("Import run update failed.");
    run = result.data;
  };

  try {
    if (options.mode !== "delta" && options.requestPresignedUrl !== false && !exportFileName) {
      try {
        const exportResult = await requestShopmonkeyCompanyExport(apiKey, requestedTables);
        exportFileName = exportResult.exportFileName;
      } catch (error) {
        exportRequestError = error instanceof Error ? error.message : "Shopmonkey export request failed.";
      }
    }

    const customers = options.customerId
      ? [await getShopmonkeyCustomerById(apiKey, options.customerId)]
      : await (async () => {
          const all: ShopmonkeyCustomerRecord[] = [];
          let skip = 0;
          while (true) {
            const page = await searchShopmonkeyCustomers(apiKey, { limit: PAGE_SIZE, skip });
            all.push(...page.records);
            if (!page.hasMore || page.records.length < PAGE_SIZE) break;
            skip += page.records.length;
          }
          return all;
        })();

    for (const sourceCustomer of customers) {
      try {
        const customerPayload = {
          ...deriveCustomerName(sourceCustomer),
          companyId: run.companyId,
          email: getPrimaryEmail(sourceCustomer),
          isActive: !sourceCustomer.deleted,
          notes: buildCustomerNotes(sourceCustomer),
          phone: getPrimaryPhone(sourceCustomer)
        };
        const customerHash = hashPayload(customerPayload);
        const customerMapping = await getMapping(client, run.companyId, "customer", sourceCustomer.id);
        const matchedCustomer = customerMapping
          ? await getCustomerById(client, customerMapping.internal_id)
          : await findCustomerMatch(client, run.companyId, customerPayload.email, customerPayload.phone);
        const customerResult = matchedCustomer
          ? await updateCustomer(client, matchedCustomer.id, customerPayload)
          : await createCustomer(client, customerPayload);
        if (customerResult.error || !customerResult.data) throw customerResult.error ?? new Error("Customer import failed.");
        const customer = await getCustomerById(client, customerResult.data.id);
        if (!customer) throw new Error("Imported customer could not be reloaded.");
        await upsertMapping(client, { companyId: run.companyId, entityType: "customer", externalId: sourceCustomer.id, internalId: customer.id, internalTable: "customers", lastImportRunId: run.id, payloadHash: customerHash, sourceUpdatedAt: sourceCustomer.updatedDate ?? sourceCustomer.createdDate });
        counts = addCounts(counts, matchedCustomer ? { customersUpdated: 1 } : { customersCreated: 1 });

        const addressState = normalizeState(sourceCustomer.state);
        const addressPostal = normalizePostalCode(sourceCustomer.postalCode);
        if (sourceCustomer.address1?.trim() && sourceCustomer.city?.trim() && addressState && addressPostal) {
          const addressPayload = { city: sourceCustomer.city.trim(), country: "US", customerId: customer.id, companyId: run.companyId, gateCode: null, isPrimary: true, label: "service" as const, line1: sourceCustomer.address1.trim(), line2: toTrimmedString(sourceCustomer.address2), parkingNotes: null, postalCode: addressPostal, state: addressState };
          const existingAddresses = await listAddressesByCustomer(client, customer.id);
          if (existingAddresses.error) throw existingAddresses.error;
          const addressMapping = await getMapping(client, run.companyId, "customer_address", `${sourceCustomer.id}:primary`);
          const matchedAddress = addressMapping ? (existingAddresses.data ?? []).find((address) => address.id === addressMapping.internal_id) ?? null : null;
          await client.from("customer_addresses").update({ is_primary: false }).eq("customer_id", customer.id);
          const addressResult = matchedAddress ? await updateCustomerAddress(client, matchedAddress.id, addressPayload) : await createCustomerAddress(client, addressPayload);
          if (addressResult.error || !addressResult.data) throw addressResult.error ?? new Error("Customer address import failed.");
          await upsertMapping(client, { companyId: run.companyId, entityType: "customer_address", externalId: `${sourceCustomer.id}:primary`, internalId: addressResult.data.id, internalTable: "customer_addresses", lastImportRunId: run.id, payloadHash: hashPayload(addressPayload), sourceUpdatedAt: sourceCustomer.updatedDate ?? sourceCustomer.createdDate });
          counts = addCounts(counts, matchedAddress ? { customerAddressesUpdated: 1 } : { customerAddressesCreated: 1 });
        }

        const vehicles = await listAllVehicles(apiKey, sourceCustomer.id);
        const vehicleRows = new Map<string, VehicleRow>();
        for (const sourceVehicle of vehicles) {
          const vehiclePayload = { color: toTrimmedString(sourceVehicle.color), companyId: run.companyId, customerId: customer.id, engine: toTrimmedString(sourceVehicle.engine), isActive: !sourceVehicle.deleted, licensePlate: normalizeLicensePlate(sourceVehicle.licensePlate), licenseState: normalizeState(sourceVehicle.licensePlateState), make: toTrimmedString(sourceVehicle.make) ?? "Unknown", model: toTrimmedString(sourceVehicle.model) ?? toTrimmedString(sourceVehicle.name) ?? "Vehicle", notes: toTrimmedString(sourceVehicle.note), odometer: typeof sourceVehicle.mileage === "number" ? Math.max(Math.round(sourceVehicle.mileage), 0) : null, trim: toTrimmedString(sourceVehicle.submodel), vin: normalizeVin(sourceVehicle.vin), year: typeof sourceVehicle.year === "number" && sourceVehicle.year >= 1900 && sourceVehicle.year <= 2100 ? sourceVehicle.year : null };
          const vehicleMapping = await getMapping(client, run.companyId, "vehicle", sourceVehicle.id);
          const matchedVehicle = vehicleMapping ? await getVehicleById(client, vehicleMapping.internal_id) : await findVehicleMatch(client, run.companyId, vehiclePayload.vin, vehiclePayload.licensePlate, vehiclePayload.licenseState);
          const vehicleResult = matchedVehicle ? await updateVehicle(client, matchedVehicle.id, vehiclePayload) : await createVehicle(client, vehiclePayload);
          if (vehicleResult.error || !vehicleResult.data) throw vehicleResult.error ?? new Error("Vehicle import failed.");
          const vehicle = await getVehicleById(client, vehicleResult.data.id);
          if (!vehicle) throw new Error("Imported vehicle could not be reloaded.");
          vehicleRows.set(sourceVehicle.id, vehicle);
          await upsertMapping(client, { companyId: run.companyId, entityType: "vehicle", externalId: sourceVehicle.id, internalId: vehicle.id, internalTable: "vehicles", lastImportRunId: run.id, payloadHash: hashPayload(vehiclePayload), sourceUpdatedAt: sourceVehicle.updatedDate ?? sourceVehicle.createdDate });
          counts = addCounts(counts, matchedVehicle ? { vehiclesUpdated: 1 } : { vehiclesCreated: 1 });
        }

        const orders = (await listAllOrders(apiKey, sourceCustomer.id)).filter((order) => (!options.orderId || order.id === options.orderId) && (!options.vehicleId || !order.vehicleId || order.vehicleId === options.vehicleId));
        for (const order of orders) {
          const vehicle = (order.vehicleId ? vehicleRows.get(order.vehicleId) : null) ?? vehicleRows.values().next().value ?? null;
          if (!vehicle) continue;
          const appointment = parseAppointments(order.appointmentDates);
          const jobLifecycle = deriveShopmonkeyImportedJobLifecycle({
            authorized: order.authorized === true,
            authorizedDate: order.authorizedDate,
            completedDate: order.completedDate,
            createdDate: order.createdDate,
            deleted: Boolean(order.deleted),
            fullyPaidDate: order.fullyPaidDate,
            invoiced: order.invoiced === true,
            orderCreatedDate: order.orderCreatedDate,
            paid: order.paid === true,
            scheduledStartAt: appointment.scheduledStartAt,
            updatedDate: order.updatedDate
          });
          const jobPayload = {
            arrival_window_end_at: appointment.scheduledEndAt,
            arrival_window_start_at: appointment.scheduledStartAt,
            completed_at: jobLifecycle.completedAt,
            customer_concern: toTrimmedString(order.complaint),
            customer_id: customer.id,
            description: toTrimmedString(order.recommendation),
            internal_summary: toTrimmedString(order.purchaseOrderNumber),
            scheduled_end_at: appointment.scheduledEndAt,
            scheduled_start_at: appointment.scheduledStartAt,
            title:
              toTrimmedString(order.coalescedName) ??
              toTrimmedString(order.generatedName) ??
              toTrimmedString(order.name) ??
              `Shopmonkey order ${order.number ?? order.publicId ?? order.id}`,
            updated_at: order.updatedDate ?? order.createdDate,
            vehicle_id: vehicle.id
          };
          const jobMapping = await getMapping(client, run.companyId, "order", order.id);
          let job = jobMapping ? await getJobById(client, jobMapping.internal_id) : null;
          if (!job) {
            const created = await client.from("jobs").insert({ company_id: run.companyId, created_at: order.orderCreatedDate ?? order.createdDate, created_by_user_id: run.startedByUserId, is_active: true, source: "office", started_at: jobLifecycle.startedAt, status: jobLifecycle.status, ...jobPayload }).select("*").single<JobRow>();
            if (created.error) throw created.error;
            job = created.data;
            counts = addCounts(counts, { jobsCreated: 1 });
          } else if (job.is_active) {
            const updated = await client.from("jobs").update(jobPayload).eq("id", job.id).select("*").single<JobRow>();
            if (updated.error) throw updated.error;
            job = updated.data;
            counts = addCounts(counts, { jobsUpdated: 1 });
          }
          await upsertMapping(client, { companyId: run.companyId, entityType: "order", externalId: order.id, internalId: job.id, internalTable: "jobs", lastImportRunId: run.id, payloadHash: hashPayload({ ...jobPayload, archived: Boolean(order.archived), status: jobLifecycle.status }), sourceUpdatedAt: order.updatedDate ?? order.createdDate });

          const pricing = buildOrderPricing(order);
          if (shouldImportEstimate(order)) {
            const estimateMapping = await getMapping(client, run.companyId, "estimate", order.id);
            if (!estimateMapping) {
              const estimate = await client.from("estimates").insert({ company_id: run.companyId, created_at: order.orderCreatedDate ?? order.createdDate, created_by_user_id: run.startedByUserId, discount_cents: 0, estimate_number: `SM-E-${order.number ?? order.publicId ?? order.id}`, job_id: job.id, notes: toTrimmedString(order.recommendation), sent_at: order.orderCreatedDate ?? order.createdDate, status: "sent", subtotal_cents: pricing.subtotalCents, tax_cents: pricing.taxCents, tax_rate_basis_points: pricing.taxRateBasisPoints, title: toTrimmedString(order.coalescedName) ?? toTrimmedString(order.generatedName) ?? toTrimmedString(order.name) ?? `Estimate ${order.number ?? order.publicId ?? order.id}`, total_cents: pricing.totalCents, updated_at: order.updatedDate ?? order.createdDate }).select("*").single<EstimateRow>();
              if (estimate.error) throw estimate.error;
              if (pricing.lines.length) {
                const lineInsert = await client.from("estimate_line_items").insert(pricing.lines.map((line, index) => ({ company_id: run.companyId, created_at: order.orderCreatedDate ?? order.createdDate, description: null, estimate_id: estimate.data.id, item_type: line.itemType, job_id: job.id, line_subtotal_cents: line.amountCents, name: line.name, position: index, quantity: 1, taxable: true, unit_price_cents: line.amountCents, updated_at: order.updatedDate ?? order.createdDate })));
                if (lineInsert.error) throw lineInsert.error;
              }
              await upsertMapping(client, { companyId: run.companyId, entityType: "estimate", externalId: order.id, internalId: estimate.data.id, internalTable: "estimates", lastImportRunId: run.id, payloadHash: hashPayload({ pricing, type: "estimate" }), sourceUpdatedAt: order.updatedDate ?? order.createdDate });
              counts = addCounts(counts, { estimatesCreated: 1 });
            }
          }
          if (shouldImportInvoice(order)) {
            const invoiceMapping = await getMapping(client, run.companyId, "invoice", order.id);
            if (!invoiceMapping) {
              const invoice = await client.from("invoices").insert({ amount_paid_cents: 0, balance_due_cents: pricing.totalCents, company_id: run.companyId, created_at: order.orderCreatedDate ?? order.createdDate, created_by_user_id: run.startedByUserId, discount_cents: 0, due_at: order.paymentDueDate ?? null, invoice_number: `SM-I-${order.number ?? order.publicId ?? order.id}`, job_id: job.id, notes: toTrimmedString(order.recommendation), status: "draft", subtotal_cents: pricing.subtotalCents, tax_cents: pricing.taxCents, tax_rate_basis_points: pricing.taxRateBasisPoints, title: toTrimmedString(order.coalescedName) ?? toTrimmedString(order.generatedName) ?? toTrimmedString(order.name) ?? `Invoice ${order.number ?? order.publicId ?? order.id}`, total_cents: pricing.totalCents, updated_at: order.updatedDate ?? order.createdDate }).select("*").single<InvoiceRow>();
              if (invoice.error) throw invoice.error;
              if (pricing.lines.length) {
                const lineInsert = await client.from("invoice_line_items").insert(pricing.lines.map((line, index) => ({ company_id: run.companyId, created_at: order.orderCreatedDate ?? order.createdDate, description: null, invoice_id: invoice.data.id, item_type: line.itemType, job_id: job.id, line_subtotal_cents: line.amountCents, name: line.name, position: index, quantity: 1, taxable: true, unit_price_cents: line.amountCents, updated_at: order.updatedDate ?? order.createdDate })));
                if (lineInsert.error) throw lineInsert.error;
              }
              await upsertMapping(client, { companyId: run.companyId, entityType: "invoice", externalId: order.id, internalId: invoice.data.id, internalTable: "invoices", lastImportRunId: run.id, payloadHash: hashPayload({ pricing, type: "invoice" }), sourceUpdatedAt: order.updatedDate ?? order.createdDate });
              counts = addCounts(counts, { invoicesCreated: 1 });
            }
          }
          if (order.publicId) {
            const inspections = await listShopmonkeyOrderSharedInspections(apiKey, order.publicId);
            const latest = [...inspections].sort((a, b) => (b.completedDate ?? b.updatedDate ?? b.createdDate).localeCompare(a.completedDate ?? a.updatedDate ?? a.createdDate))[0];
            if (latest) {
              const inspectionMapping = await getMapping(client, run.companyId, "inspection", latest.id);
              if (!inspectionMapping) {
                const inspection = await client.from("inspections").insert({ company_id: run.companyId, created_at: latest.createdDate, job_id: job.id, started_at: latest.createdDate, started_by_user_id: run.startedByUserId, status: "in_progress", template_version: "shopmonkey-v1", updated_at: latest.updatedDate ?? latest.createdDate }).select("*").single<InspectionRow>();
                if (inspection.error) throw inspection.error;
                for (const [index, item] of (latest.items ?? []).entries()) {
                  const itemStatus = item.status?.trim().toLowerCase() === "fail" ? "fail" : item.status?.trim().toLowerCase() === "attention" ? "attention" : item.status?.trim().toLowerCase() === "pass" ? "pass" : "not_checked";
                  const inspectionItem = await client.from("inspection_items").insert({ company_id: run.companyId, created_at: item.createdDate, finding_severity: itemStatus === "fail" ? "high" : itemStatus === "attention" ? "medium" : null, inspection_id: inspection.data.id, is_required: false, item_key: `shopmonkey:${item.id}`, job_id: job.id, label: toTrimmedString(item.name) ?? `Inspection item ${index + 1}`, position: Math.max(item.ordinal ?? index, 0), recommendation: null, section_key: "shopmonkey", status: itemStatus as never, technician_notes: toTrimmedString(item.message), updated_at: item.updatedDate ?? item.createdDate }).select("*").single<InspectionItemRow>();
                  if (inspectionItem.error) throw inspectionItem.error;
                  for (const file of item.files ?? []) {
                    const attachmentExternalId = file.id || `${item.id}:${file.fileName ?? "attachment"}`;
                    const existingAttachment = await getMapping(client, run.companyId, "attachment", attachmentExternalId);
                    if (existingAttachment || !file.url) continue;
                    const response = await fetch(file.url, { cache: "no-store" }).catch(() => null);
                    if (!response?.ok) continue;
                    const mimeType = inferMimeType(toTrimmedString(file.fileName), toTrimmedString(response.headers.get("content-type"))?.split(";")[0] ?? toTrimmedString(file.fileType));
                    if (!mimeType) continue;
                    const blob = await response.blob();
                    if (blob.size <= 0 || blob.size > maxAttachmentFileSizeBytes) continue;
                    const fileName = sanitizeAttachmentFileName(toTrimmedString(file.fileName) ?? `${file.id || randomUUID()}.jpg`) || `${file.id || randomUUID()}.jpg`;
                    const attachment = await createAndUploadJobAttachment(client, blob, { caption: toTrimmedString(item.name), category: "inspection", companyId: run.companyId, fileName, fileSizeBytes: blob.size, id: randomUUID(), inspectionId: inspection.data.id, inspectionItemId: inspectionItem.data.id, jobId: job.id, mimeType: mimeType as AttachmentMimeType, uploadedByUserId: run.startedByUserId });
                    if (attachment.error || !attachment.data) throw attachment.error ?? new Error("Inspection attachment import failed.");
                    await upsertMapping(client, { companyId: run.companyId, entityType: "attachment", externalId: attachmentExternalId, internalId: attachment.data.id, internalTable: "attachments", lastImportRunId: run.id, payloadHash: hashPayload({ fileName, size: blob.size }), sourceUpdatedAt: null });
                    counts = addCounts(counts, { attachmentsCreated: 1 });
                  }
                }
                if (latest.completed) {
                  const completeResult = await client.from("inspections").update({ completed_at: latest.completedDate ?? latest.updatedDate ?? latest.createdDate, completed_by_user_id: run.startedByUserId, status: "completed" }).eq("id", inspection.data.id).select("*").single<InspectionRow>();
                  if (completeResult.error) throw completeResult.error;
                }
                await upsertMapping(client, { companyId: run.companyId, entityType: "inspection", externalId: latest.id, internalId: inspection.data.id, internalTable: "inspections", lastImportRunId: run.id, payloadHash: hashPayload({ latest }), sourceUpdatedAt: latest.updatedDate ?? latest.createdDate });
                counts = addCounts(counts, { inspectionsCreated: 1 });
              }
            }
          }
          if (order.archived && job.is_active) {
            await client.from("jobs").update({ is_active: false, updated_at: order.updatedDate ?? order.createdDate }).eq("id", job.id);
          }
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Import failed.");
      }
      await persist("processing", failures[0] ?? null);
    }

    const finalResult = await updateDataImportRun(client, run.id, { finishedAt: new Date().toISOString(), lastErrorMessage: failures[0] ?? null, lastHeartbeatAt: new Date().toISOString(), status: failures.length ? "failed" : "completed", summaryJson: buildSummary(run, counts, { exportFileName, exportRequestError, failures: asJson(failures), requestedTables: asJson(requestedTables) }) });
    if (finalResult.error || !finalResult.data) throw finalResult.error ?? new Error("Import run update failed.");
    return finalResult.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopmonkey import processing failed.";
    const failedResult = await updateDataImportRun(client, run.id, { finishedAt: new Date().toISOString(), lastErrorMessage: message, lastHeartbeatAt: new Date().toISOString(), status: "failed", summaryJson: buildSummary(run, counts, { exportFileName, exportRequestError, failures: asJson([...failures, message]), requestedTables: asJson(requestedTables) }) });
    if (failedResult.error || !failedResult.data) throw failedResult.error ?? new Error("Import run update failed.");
    return failedResult.data;
  }
}

import {
	enqueueInvoiceNotification,
	enqueuePaymentReminder,
	getEstimateByJobId,
	getInvoiceDetailById,
	getJobById,
	listAddressesByCustomer,
	listServiceHistoryEstimatesByJobIds,
	listJobCommunications,
	listJobNotesByJob,
	listInvoicesByCompany
} from "@mobile-mechanic/api-client";
import {
	formatCurrencyFromCents,
	formatDateTime,
	getCustomerDisplayName,
	isTechnicianActiveFieldJobStatus,
	isInvoiceEligibleForReminder,
	isTechnicianOnSiteJobStatus,
	isTechnicianTravelJobStatus,
	isTechnicianUpcomingJobStatus
} from "@mobile-mechanic/core";
import type { Database, InvoiceSummary, JobStatus } from "@mobile-mechanic/types";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import {
	Badge,
	Card,
	CardContent,
	CardDescription,
	CardEyebrow,
	CardHeader,
	CardHeaderContent,
	CardTitle,
	EmptyState,
	Form,
	FormField,
	Input,
	Page,
	PageGrid,
	Select,
	StatusBadge,
	type BadgeTone,
	buttonClassName,
	cx
} from "../../../components/ui";
import { processCommunicationMutationResult } from "../../../lib/communications/actions";
import { requireCompanyContext } from "../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../lib/customers/workspace";
import {
	ensureInvoiceAccessLink,
	markInvoiceAccessLinkSent
} from "../../../lib/customer-documents/service";
import {
	getCollectionNextMove,
	getCollectionStage,
	getCollectionStageCopy,
	getCollectionStageLabel,
	getCollectionStageRank,
	getCollectionStageTone,
	getFinancePriorityAction,
	getFinanceThreadNextMove,
	getInvoiceActionLabel,
	resolveCollectionStage,
	type CollectionStage
} from "../../../lib/invoices/collections";
import { listTechnicianPaymentHandoffsByInvoiceIds } from "../../../lib/invoices/payment-handoffs";
import { getCollectionsExceptionOwnershipSummary } from "../../../lib/jobs/exception-ownership";
import { getVisitFollowUpSummary } from "../../../lib/jobs/follow-up";
import {
	getVisitPromiseSummary,
	getVisitReadinessSummary,
	getVisitTrustSummary
} from "../../../lib/jobs/operational-health";
import {
	getServiceThreadActionIntent,
	getServiceThreadPressureScore,
	getServiceThreadSummary
} from "../../../lib/jobs/service-thread";
import {
	buildServiceSiteThreadSummary,
	derivePromiseConfidenceSnapshot,
	deriveReleaseRunwayState,
	deriveRouteConfidenceSnapshot,
	hasServiceSitePlaybook
} from "../../../lib/service-thread/continuity";
import {
	getFinanceActionLabels,
	getFinanceDetailRoleFocus,
	getFinanceRoleFocus
} from "../../../lib/office-workspace-focus";
import { toServerError } from "../../../lib/server-error";
import { getVehicleServiceHistory } from "../../../lib/service-history/service";
import {
	buildVisitDetailHref,
	buildVisitEstimateHref,
	buildVisitInvoiceEditHref,
	buildVisitInvoiceHref,
	type VisitWorkspaceLinkOptions
} from "../../../lib/visits/workspace";

type FinancePageProps = {
	searchParams?: Promise<{
		invoiceId?: string | string[];
		query?: string | string[];
		stage?: string | string[];
	}>;
};

type InvoiceFilterState = {
	invoiceId: string;
	query: string;
	stage: string;
};

type FinanceSiteVisitRow = Pick<
	Database["public"]["Tables"]["jobs"]["Row"],
	| "id"
	| "status"
	| "service_site_id"
	| "scheduled_start_at"
	| "arrival_window_start_at"
	| "updated_at"
>;

function readSearchParam(value: string | string[] | undefined) {
	return typeof value === "string" ? value.trim() : "";
}

function buildFinanceHref(current: InvoiceFilterState, patch: Partial<InvoiceFilterState>) {
	const next = { ...current, ...patch };
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(next)) {
		if (value) {
			params.set(key, value);
		}
	}

	const search = params.toString();

	return search ? `/dashboard/finance?${search}` : "/dashboard/finance";
}

function getInvoiceWorkspaceHref(invoice: InvoiceSummary, returnLinkOptions?: VisitWorkspaceLinkOptions) {
	if (invoice.status === "draft") {
		return buildVisitInvoiceEditHref(invoice.jobId, returnLinkOptions);
	}

	return buildVisitInvoiceHref(invoice.jobId, returnLinkOptions);
}

function isLiveSiteVisitStatus(status: string | null | undefined) {
	return (
		status === "new" ||
		(status !== null &&
			status !== undefined &&
			(isTechnicianUpcomingJobStatus(status as JobStatus) ||
				isTechnicianActiveFieldJobStatus(status as JobStatus)))
	);
}

function formatServiceSiteAddress(input: {
	city?: string | null;
	country?: string | null;
	line1?: string | null;
	line2?: string | null;
	postalCode?: string | null;
	state?: string | null;
}) {
	return [input.line1, input.line2, input.city, input.state, input.postalCode, input.country]
		.filter((value): value is string => Boolean(value))
		.join(", ");
}

export async function FinanceWorkspacePageImpl({ searchParams }: FinancePageProps) {
	const context = await requireCompanyContext();
	const resolvedSearchParams = searchParams ? await searchParams : {};
	const financeRoleFocus = getFinanceRoleFocus(context.membership.role);
	const financeDetailRoleFocus = getFinanceDetailRoleFocus(context.membership.role);
	const financeActionLabels = getFinanceActionLabels(context.membership.role);
	const rawQuery = readSearchParam(resolvedSearchParams.query);
	const rawStage = readSearchParam(resolvedSearchParams.stage);
	const useRoleDefaultStage = Boolean(!rawQuery && !rawStage);
	const filters: InvoiceFilterState = {
		invoiceId: readSearchParam(resolvedSearchParams.invoiceId),
		query: rawQuery,
		stage: useRoleDefaultStage ? financeRoleFocus.defaultValue : rawStage
	};
	const financeDeskHref = buildFinanceHref(filters, {});
	const financeVisitLinkOptions: VisitWorkspaceLinkOptions = {
		returnLabel: "Back to finance",
		returnTo: financeDeskHref
	};

	const allInvoicesResult = await listInvoicesByCompany(context.supabase, context.companyId, {
		query: filters.query || undefined
	});

	if (allInvoicesResult.error) {
		throw toServerError(allInvoicesResult.error, "Finance could not load invoices.");
	}

	const allInvoices = allInvoicesResult.data ?? [];
	const allInvoiceIds = [...new Set(allInvoices.map((invoice) => invoice.invoiceId))];
	const allInvoiceJobIds = [...new Set(allInvoices.map((invoice) => invoice.jobId))];
	const [invoiceJobsResult, invoiceEstimatesResult, paymentHandoffs] = await Promise.all([
		allInvoiceJobIds.length
			? context.supabase
					.from("jobs")
					.select("id, status")
					.eq("company_id", context.companyId)
					.in("id", allInvoiceJobIds)
			: Promise.resolve({ data: [], error: null }),
		listServiceHistoryEstimatesByJobIds(context.supabase, context.companyId, allInvoiceJobIds, {}),
		listTechnicianPaymentHandoffsByInvoiceIds(context.supabase as any, allInvoiceIds)
	]);

	if (invoiceJobsResult.error) {
		throw toServerError(invoiceJobsResult.error, "Finance could not load linked visits.");
	}

	if (invoiceEstimatesResult.error) {
		throw toServerError(invoiceEstimatesResult.error, "Finance could not load estimates.");
	}

	const invoiceJobStatusByJobId = new Map(
		(invoiceJobsResult.data ?? []).map((job) => [job.id, job.status])
	);
	const invoiceEstimateByJobId = new Map<
		string,
		{
			estimateNumber: string;
			status: string;
			totalCents: number;
			updatedAt: string;
		}
	>();

	for (const estimate of invoiceEstimatesResult.data ?? []) {
		const current = invoiceEstimateByJobId.get(estimate.jobId);

		if (!current || Date.parse(estimate.updatedAt) >= Date.parse(current.updatedAt)) {
			invoiceEstimateByJobId.set(estimate.jobId, {
				estimateNumber: estimate.estimateNumber,
				status: estimate.status,
				totalCents: estimate.totalCents,
				updatedAt: estimate.updatedAt
			});
		}
	}

	const invoiceThreadSummaryByInvoiceId = new Map(
		allInvoices.map((invoice) => [
			invoice.invoiceId,
			getServiceThreadSummary({
				estimate: invoiceEstimateByJobId.get(invoice.jobId)
					? {
							estimateNumber: invoiceEstimateByJobId.get(invoice.jobId)?.estimateNumber ?? null,
							status: invoiceEstimateByJobId.get(invoice.jobId)?.status ?? "draft",
							totalCents: invoiceEstimateByJobId.get(invoice.jobId)?.totalCents ?? null
						}
					: null,
				invoice: {
					balanceDueCents: invoice.balanceDueCents,
					invoiceNumber: invoice.invoiceNumber,
					status: invoice.status,
					totalCents: invoice.totalCents
				},
				job: {
					status: invoiceJobStatusByJobId.get(invoice.jobId) ?? "scheduled"
				}
			})
		])
	);
	const openPaymentHandoffCountByInvoiceId = paymentHandoffs.reduce<Map<string, number>>(
		(counts, handoff) => {
			if (handoff.status !== "open") {
				return counts;
			}

			counts.set(handoff.invoiceId, (counts.get(handoff.invoiceId) ?? 0) + 1);
			return counts;
		},
		new Map()
	);
	const getInvoiceCollectionStage = (invoice: InvoiceSummary) =>
		getCollectionStage(invoice, {
			openPaymentHandoffCount: openPaymentHandoffCountByInvoiceId.get(invoice.invoiceId) ?? 0
		});
	const selectedStage = resolveCollectionStage(filters.stage);
	const visibleInvoices = [...allInvoices]
		.filter((invoice) => (selectedStage ? getInvoiceCollectionStage(invoice) === selectedStage : true))
		.sort((left, right) => {
			const stageDelta =
				getCollectionStageRank(getInvoiceCollectionStage(left)) -
				getCollectionStageRank(getInvoiceCollectionStage(right));

			if (stageDelta !== 0) {
				return stageDelta;
			}

			const threadPressureDelta =
				getServiceThreadPressureScore(invoiceThreadSummaryByInvoiceId.get(right.invoiceId) ?? {
					copy: "",
					label: "Thread visible",
					nextActionLabel: "Monitor only",
					segments: [],
					tone: "neutral"
				}) -
				getServiceThreadPressureScore(invoiceThreadSummaryByInvoiceId.get(left.invoiceId) ?? {
					copy: "",
					label: "Thread visible",
					nextActionLabel: "Monitor only",
					segments: [],
					tone: "neutral"
				});

			if (threadPressureDelta !== 0) {
				return threadPressureDelta;
			}

			if (right.balanceDueCents !== left.balanceDueCents) {
				return right.balanceDueCents - left.balanceDueCents;
			}

			return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
		});
	const selectedInvoice =
		visibleInvoices.find((invoice) => invoice.invoiceId === filters.invoiceId) ??
		visibleInvoices[0] ??
		null;
	const [selectedDetailResult, selectedJobResult, selectedEstimateResult, selectedNotesResult, selectedCommunicationsResult] = selectedInvoice
		? await Promise.all([
				getInvoiceDetailById(context.supabase, selectedInvoice.invoiceId),
				getJobById(context.supabase, selectedInvoice.jobId),
				getEstimateByJobId(context.supabase, selectedInvoice.jobId),
				listJobNotesByJob(context.supabase, selectedInvoice.jobId),
				listJobCommunications(context.supabase, selectedInvoice.jobId, { limit: 6 })
			])
		: [null, null, null, null, null];

	if (selectedDetailResult?.error) {
		throw toServerError(
			selectedDetailResult.error,
			"Finance could not load the selected invoice detail."
		);
	}

	if (selectedJobResult?.error) {
		throw toServerError(
			selectedJobResult.error,
			"Finance could not load the selected visit thread."
		);
	}

	if (selectedEstimateResult?.error) {
		throw toServerError(
			selectedEstimateResult.error,
			"Finance could not load the selected estimate."
		);
	}

	if (selectedNotesResult?.error) {
		throw toServerError(
			selectedNotesResult.error,
			"Finance could not load visit notes."
		);
	}

	if (selectedCommunicationsResult?.error) {
		throw toServerError(
			selectedCommunicationsResult.error,
			"Finance could not load customer communications."
		);
	}

	const selectedDetail = selectedDetailResult?.data ?? null;
	const selectedJob =
		selectedJobResult?.data && selectedJobResult.data.companyId === context.companyId
			? selectedJobResult.data
			: null;
	const selectedEstimate = selectedEstimateResult?.data ?? null;
	const selectedCommunications = selectedCommunicationsResult?.data ?? [];
	const [selectedCustomerSitesResult, selectedCustomerSiteVisitsResult] =
		selectedJob && selectedDetail
			? await Promise.all([
					listAddressesByCustomer(context.supabase, selectedDetail.customer.id),
					context.supabase
						.from("jobs")
						.select(
							"id, status, service_site_id, scheduled_start_at, arrival_window_start_at, updated_at"
						)
						.eq("company_id", context.companyId)
						.eq("customer_id", selectedDetail.customer.id)
						.returns<FinanceSiteVisitRow[]>()
				])
			: [null, null];
	const selectedVehicleHistory = selectedJob
		? await getVehicleServiceHistory(context.supabase, context.companyId, selectedJob.vehicleId, {})
		: null;

	if (selectedCustomerSitesResult?.error) {
		throw toServerError(
			selectedCustomerSitesResult.error,
			"Finance could not load the selected service sites."
		);
	}

	if (selectedCustomerSiteVisitsResult?.error) {
		throw toServerError(
			selectedCustomerSiteVisitsResult.error,
			"Finance could not load site-linked visits for the selected thread."
		);
	}

	const selectedCustomerSites = selectedCustomerSitesResult?.data ?? [];
	const selectedPrimaryServiceSite =
		selectedCustomerSites.find((site) => site.isPrimary) ?? selectedCustomerSites[0] ?? null;
	const selectedExplicitServiceSite =
		selectedJob?.serviceSiteId && selectedCustomerSites.length
			? selectedCustomerSites.find((site) => site.id === selectedJob.serviceSiteId) ?? null
			: null;
	const selectedServiceSite = selectedExplicitServiceSite ?? selectedPrimaryServiceSite;
	const selectedServiceSiteVisits = selectedServiceSite
		? (selectedCustomerSiteVisitsResult?.data ?? []).filter(
				(visit) =>
					visit.service_site_id === selectedServiceSite.id ||
					(!visit.service_site_id && selectedPrimaryServiceSite?.id === selectedServiceSite.id)
			)
		: [];
	const selectedServiceSiteActiveVisitCount = selectedServiceSiteVisits.filter((visit) =>
		isLiveSiteVisitStatus(visit.status)
	).length;
	const selectedServiceSitePlaybookReady = hasServiceSitePlaybook(selectedServiceSite);
	const selectedFollowUpSummary = selectedJob
		? getVisitFollowUpSummary({
				assignedTechnicianUserId: selectedJob.assignedTechnicianUserId,
				createdAt: selectedJob.createdAt,
				invoiceStarted: true,
				job: selectedJob,
				notes: selectedNotesResult?.data ?? [],
				promisedAt: selectedJob.arrivalWindowStartAt ?? selectedJob.scheduledStartAt ?? null,
				relatedVisits: selectedVehicleHistory?.visits ?? []
			})
		: null;
	const selectedFollowUpCommunications = selectedCommunications.filter((entry) =>
		entry.communicationType.startsWith("follow_up_")
	);
	const selectedPromiseSummary = selectedJob
		? getVisitPromiseSummary({
				communications: selectedCommunications,
				job: selectedJob
			})
		: null;
	const selectedReadinessSummary = selectedJob
		? getVisitReadinessSummary({
				communications: selectedCommunications,
				estimate: selectedEstimate,
				invoice: selectedInvoice
					? {
							status: selectedInvoice.status
						}
					: null,
				job: selectedJob,
				noteCount: selectedNotesResult?.data?.length ?? 0
			})
		: null;
	const selectedReleaseRunwayState =
		selectedJob && selectedReadinessSummary
			? deriveReleaseRunwayState({
					estimateStatus: selectedEstimate?.status ?? null,
					hasBlockingIssues: false,
					hasOwner: Boolean(selectedJob.assignedTechnicianUserId),
					hasPromise: Boolean(selectedJob.arrivalWindowStartAt ?? selectedJob.scheduledStartAt),
					readinessReadyCount: selectedReadinessSummary.readyCount,
					readinessTotalCount: selectedReadinessSummary.totalCount,
					visitStatus: selectedJob.status
				})
			: null;
	const selectedTrustSummary =
		selectedJob && selectedInvoice
			? getVisitTrustSummary({
					communications: selectedCommunications,
					estimate: selectedEstimate,
					followUpActive: Boolean(selectedFollowUpSummary?.isFollowUpVisit),
					invoice: {
						balanceDueCents: selectedInvoice.balanceDueCents,
						status: selectedInvoice.status
					},
					job: selectedJob
				})
			: null;
	const selectedPromiseConfidence =
		selectedPromiseSummary && selectedReadinessSummary && selectedTrustSummary
			? derivePromiseConfidenceSnapshot({
					hasServiceSitePlaybook: selectedServiceSitePlaybookReady,
					hasSupplyRisk: false,
					promiseSummary: selectedPromiseSummary,
					readinessSummary: selectedReadinessSummary,
					releaseRunwayState: selectedReleaseRunwayState,
					trustSummary: selectedTrustSummary
				})
			: null;
	const selectedRouteConfidence =
		selectedJob && selectedPromiseConfidence
			? deriveRouteConfidenceSnapshot({
					hasLiveGps:
						isTechnicianActiveFieldJobStatus(selectedJob.status) ||
						selectedJob.status === "completed",
					hasPartsConfidence: true,
					hasServiceSitePlaybook: selectedServiceSitePlaybookReady,
					hasTechnicianReadiness:
						Boolean(selectedJob.assignedTechnicianUserId) &&
						selectedJob.status !== "new",
					laneSlackMinutes:
						selectedJob.status === "scheduled"
							? 45
							: isTechnicianTravelJobStatus(selectedJob.status)
								? 30
								: isTechnicianOnSiteJobStatus(selectedJob.status) || selectedJob.status === "completed"
									? 60
									: 15,
					promiseConfidencePercent: selectedPromiseConfidence.confidencePercent,
					routeIssueCount:
						Number(!selectedServiceSitePlaybookReady) +
						Number(!selectedJob.assignedTechnicianUserId)
				})
			: null;
	const selectedServiceSiteThreadSummary = buildServiceSiteThreadSummary({
		activeVisitCount: selectedServiceSiteActiveVisitCount,
		commercialAccountMode:
			selectedDetail?.customer.relationshipType === "fleet_account"
				? "fleet_account"
				: "retail_customer",
		linkedAssetCount: 0,
		linkedVisitCount: selectedServiceSiteVisits.length,
		site: selectedServiceSite
	});
	const selectedCollectionStage = selectedInvoice ? getInvoiceCollectionStage(selectedInvoice) : null;
	const selectedOpenPaymentHandoffCount = selectedInvoice
		? openPaymentHandoffCountByInvoiceId.get(selectedInvoice.invoiceId) ?? 0
		: 0;
	const selectedCollectionsOwnership = selectedInvoice
		? getCollectionsExceptionOwnershipSummary({
				balanceDueCents: selectedInvoice.balanceDueCents,
				status: selectedInvoice.status,
				updatedAt: selectedInvoice.updatedAt
			})
		: null;
	const selectedServiceThreadSummary =
		selectedJob && selectedDetail
			? getServiceThreadSummary({
					estimate: selectedEstimate
						? {
								estimateNumber: selectedEstimate.estimateNumber,
								status: selectedEstimate.status,
								totalCents: selectedEstimate.totalCents
							}
						: null,
					followUpSummary: selectedFollowUpSummary ?? null,
					invoice: {
						amountPaidCents: selectedDetail.invoice.amountPaidCents,
						balanceDueCents: selectedDetail.totals.balanceDueCents,
						invoiceNumber: selectedDetail.invoice.invoiceNumber,
						status: selectedDetail.invoice.status,
						totalCents: selectedDetail.totals.totalCents
					},
					job: {
						status: selectedJob.status
					}
				})
			: null;
	const selectedCollectionsNextMove =
		selectedCollectionStage === "field_handoff"
			? getCollectionNextMove(selectedCollectionStage)
			: selectedCollectionStage && selectedInvoice && selectedServiceThreadSummary
			? getFinanceThreadNextMove({
					customerName: selectedDetail ? getCustomerDisplayName(selectedDetail.customer) : "",
					jobId: selectedInvoice.jobId,
					summary: selectedServiceThreadSummary,
					threadIntent: getServiceThreadActionIntent(selectedServiceThreadSummary)
				}) ?? getCollectionNextMove(selectedCollectionStage)
			: selectedCollectionStage
				? getCollectionNextMove(selectedCollectionStage)
				: null;
	const readyReleaseCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "ready_release"
	).length;
	const fieldHandoffCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "field_handoff"
	).length;
	const collectNowCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "collect_now"
	).length;
	const reminderDueCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "reminder_due"
	).length;
	const agedRiskCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "aged_risk"
	).length;
	const partialFollowUpCount = allInvoices.filter(
		(invoice) => getInvoiceCollectionStage(invoice) === "partial_follow_up"
	).length;
	const outstandingBalance = allInvoices.reduce(
		(total, invoice) => total + invoice.balanceDueCents,
		0
	);
	const selectedCustomerName = selectedDetail ? getCustomerDisplayName(selectedDetail.customer) : "";
	const financePriorityAction = getFinancePriorityAction({
		agedRiskCount,
		collectNowCount,
		fieldHandoffCount,
		outstandingBalance,
		partialFollowUpCount,
		readyReleaseCount,
		reminderDueCount
	});
	const filtersApplied = Boolean(filters.query || (filters.stage && !useRoleDefaultStage));
	const selectedInvoiceReturnHref = selectedInvoice
		? buildFinanceHref(filters, { invoiceId: selectedInvoice.invoiceId })
		: "/dashboard/finance";
	const selectedVisitThreadHref = selectedInvoice
		? buildVisitDetailHref(selectedInvoice.jobId, financeVisitLinkOptions)
		: "/dashboard/visits";
	const selectedCustomerThreadHref =
		selectedDetail?.customer.id
			? buildCustomerWorkspaceHref(selectedDetail.customer.id)
			: "/dashboard/customers";
	const selectedSiteThreadHref =
		selectedDetail?.customer.id && selectedServiceSite
			? buildCustomerWorkspaceHref(selectedDetail.customer.id, { tab: "addresses" })
			: selectedCustomerThreadHref;
	const selectedEstimateThreadHref =
		selectedInvoice && selectedEstimate
			? buildVisitEstimateHref(selectedInvoice.jobId, financeVisitLinkOptions)
			: "/dashboard/visits";
	const selectedEstimateThreadLabel = selectedEstimate
		? selectedEstimate.status === "accepted"
			? "Open release runway"
			: "Open quote thread"
		: "Open quote thread";
	const financePrimaryThreadItems = [
		{
			label: "Visit thread",
			value: selectedServiceThreadSummary?.label ?? "Visit in file"
		},
		{
			label: "Promise confidence",
			value: selectedPromiseConfidence
				? `${selectedPromiseConfidence.label} · ${selectedPromiseConfidence.confidencePercent}%`
				: "Thread stable"
		},
		{
			label: selectedReleaseRunwayState ? "Release runway" : "Route confidence",
			value: selectedReleaseRunwayState
				? selectedReleaseRunwayState.label
				: selectedRouteConfidence
					? `${selectedRouteConfidence.label} · ${selectedRouteConfidence.confidencePercent}%`
					: "No live route cue"
		},
		{
			label: "Site thread",
			value: selectedServiceSiteThreadSummary.siteLabel
		}
	];
	const financeSecondaryThreadItems = [
		selectedOpenPaymentHandoffCount
			? {
					label: "Field handoffs",
					value: `${selectedOpenPaymentHandoffCount} unresolved`
			  }
			: null,
		selectedEstimate
			? {
					label: "Quote thread",
					value:
						selectedEstimate.status === "accepted"
							? "Release runway"
							: formatCurrencyFromCents(selectedEstimate.totalCents)
			  }
			: null,
		{
			label: "Closeout owner",
			value: selectedCollectionsOwnership?.owner ?? "Finance"
		},
		{
			label: "Next thread move",
			value: selectedServiceThreadSummary?.nextActionLabel ?? "Monitor"
		}
	].filter((item): item is { label: string; value: string } => Boolean(item));
	const dominantThreadInvoice = visibleInvoices.find((invoice) => {
		if ((openPaymentHandoffCountByInvoiceId.get(invoice.invoiceId) ?? 0) > 0) {
			return true;
		}

		const summary = invoiceThreadSummaryByInvoiceId.get(invoice.invoiceId);
		return summary ? getServiceThreadPressureScore(summary) > 0 : false;
	}) ?? null;
	const dominantThreadNextMove = dominantThreadInvoice
		? getInvoiceCollectionStage(dominantThreadInvoice) === "field_handoff"
			? {
					...getCollectionNextMove("field_handoff"),
					href: "/dashboard/finance?stage=field_handoff"
			  }
			: getFinanceThreadNextMove({
				customerName: dominantThreadInvoice.title,
				jobId: dominantThreadInvoice.jobId,
				summary:
					invoiceThreadSummaryByInvoiceId.get(dominantThreadInvoice.invoiceId) ??
					getServiceThreadSummary({
						invoice: {
							balanceDueCents: dominantThreadInvoice.balanceDueCents,
							invoiceNumber: dominantThreadInvoice.invoiceNumber,
							status: dominantThreadInvoice.status,
							totalCents: dominantThreadInvoice.totalCents
						},
						job: {
							status: invoiceJobStatusByJobId.get(dominantThreadInvoice.jobId) ?? "scheduled"
						}
					}),
				threadIntent: getServiceThreadActionIntent(
					invoiceThreadSummaryByInvoiceId.get(dominantThreadInvoice.invoiceId) ??
						getServiceThreadSummary({
							invoice: {
								balanceDueCents: dominantThreadInvoice.balanceDueCents,
								invoiceNumber: dominantThreadInvoice.invoiceNumber,
								status: dominantThreadInvoice.status,
								totalCents: dominantThreadInvoice.totalCents
							},
							job: {
								status: invoiceJobStatusByJobId.get(dominantThreadInvoice.jobId) ?? "scheduled"
							}
						})
				)
			})
		: null;
	const dominantThreadSummary = dominantThreadInvoice
		? invoiceThreadSummaryByInvoiceId.get(dominantThreadInvoice.invoiceId) ?? null
		: null;
	const financeThreadSummaryCopy =
		dominantThreadNextMove?.copy ??
		dominantThreadSummary?.copy ??
		"Finance owns closeout, collections, and field billing handoffs after the live service thread is done.";
	const financeThreadSummaryLabel =
		dominantThreadNextMove?.label ??
		(agedRiskCount
			? "Escalate aging balances"
			: fieldHandoffCount
				? "Resolve field handoffs"
			: reminderDueCount
				? "Touch reminder-due customers"
				: readyReleaseCount
					? "Finish invoice release"
					: "Keep closeout moving");
	const showFinanceFile = Boolean(selectedDetail && selectedInvoice);
	const showFinanceQueueOnly = !showFinanceFile;
	const financeThreadMetrics = [
		{
			label: "Next closeout",
			tone: financePriorityAction.tone as BadgeTone,
			value: financePriorityAction.title
		},
		{
			label: "Open balance",
			tone: outstandingBalance > 0 ? ("brand" as BadgeTone) : ("success" as BadgeTone),
			value: outstandingBalance > 0 ? formatCurrencyFromCents(outstandingBalance) : "Balanced"
		},
		{
			label: agedRiskCount
				? "Aged risk"
				: fieldHandoffCount
					? "Field handoff"
				: reminderDueCount
					? "Reminder queue"
					: readyReleaseCount
						? "Release blocked"
						: "Thread pressure",
			tone: agedRiskCount
				? ("danger" as BadgeTone)
				: fieldHandoffCount || reminderDueCount || readyReleaseCount
					? ("warning" as BadgeTone)
					: ((dominantThreadSummary?.tone ?? "success") as BadgeTone),
			value: agedRiskCount
				? `${agedRiskCount} aging`
				: fieldHandoffCount
					? `${fieldHandoffCount} open`
				: reminderDueCount
					? `${reminderDueCount} due`
					: readyReleaseCount
						? `${readyReleaseCount} ready`
						: (dominantThreadSummary?.label ?? "Steady")
		}
	];
	const visibleFinanceThreadMetrics = showFinanceQueueOnly ? [] : financeThreadMetrics.slice(0, 1);
	const financeQueueCaption = filtersApplied
		? `${[
				filters.query ? `Search: ${filters.query}` : null,
				selectedStage ? getCollectionStageLabel(selectedStage) : null,
				`${visibleInvoices.length} record${visibleInvoices.length === 1 ? "" : "s"}`
			]
				.filter(Boolean)
				.join(" · ")}`
		: `${visibleInvoices.length} closeout thread${visibleInvoices.length === 1 ? "" : "s"} · ${financeRoleFocus.title}`;
	const financeQueuePanelSummary = filtersApplied
		? financeQueueCaption
		: "Open filters only when a closeout thread truly needs a narrower slice.";
	const showFinanceSidebar = showFinanceFile;
	const showFinanceFileFirst = showFinanceFile && visibleInvoices.length <= 2;
	const showFinanceQueueClearCompact =
		showFinanceQueueOnly && visibleInvoices.length === 0 && !filtersApplied;
	const financeQueueClearMetrics = financeThreadMetrics.slice(0, 3);
	const queueInvoices = showFinanceFileFirst ? visibleInvoices.slice(0, 2) : visibleInvoices;
	const hideFinanceQueueCard = showFinanceFileFirst && queueInvoices.length <= 1;

	async function sendInvoiceNotificationAction(formData: FormData) {
		"use server";

		const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
		const invoiceId = typeof formData.get("invoiceId") === "string" ? String(formData.get("invoiceId")) : "";
		const returnHref =
			typeof formData.get("returnHref") === "string" ? String(formData.get("returnHref")) : "/dashboard/finance";
		const detailResult = await getInvoiceDetailById(actionContext.supabase, invoiceId);

		if (detailResult.error || !detailResult.data || detailResult.data.invoice.companyId !== actionContext.companyId) {
			redirect(returnHref);
		}

		const linkSummary = await ensureInvoiceAccessLink({
			invoiceId,
			actorUserId: actionContext.currentUserId,
			rotate: true
		});
		const result = await enqueueInvoiceNotification(actionContext.supabase, {
			invoiceId,
			actorUserId: actionContext.currentUserId,
			actionUrl: linkSummary.publicUrl,
			resend: true
		});

		await processCommunicationMutationResult(result, "Failed to queue invoice notification.");
		await markInvoiceAccessLinkSent(
			linkSummary.linkId,
			result.data?.id ?? null,
			actionContext.currentUserId
		);

		revalidatePath("/dashboard/finance");
		revalidatePath(`/dashboard/visits/${detailResult.data.job.id}`);
		revalidatePath(`/dashboard/visits/${detailResult.data.job.id}/invoice`);
		redirect(returnHref);
	}

	async function sendPaymentReminderAction(formData: FormData) {
		"use server";

		const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
		const invoiceId = typeof formData.get("invoiceId") === "string" ? String(formData.get("invoiceId")) : "";
		const returnHref =
			typeof formData.get("returnHref") === "string" ? String(formData.get("returnHref")) : "/dashboard/finance";
		const detailResult = await getInvoiceDetailById(actionContext.supabase, invoiceId);

		if (detailResult.error || !detailResult.data || detailResult.data.invoice.companyId !== actionContext.companyId) {
			redirect(returnHref);
		}

		const linkSummary = await ensureInvoiceAccessLink({
			invoiceId,
			actorUserId: actionContext.currentUserId
		});
		const result = await enqueuePaymentReminder(actionContext.supabase, {
			invoiceId,
			actorUserId: actionContext.currentUserId,
			actionUrl: linkSummary.publicUrl,
			resend: true
		});

		await processCommunicationMutationResult(result, "Failed to queue payment reminder.");
		await markInvoiceAccessLinkSent(
			linkSummary.linkId,
			result.data?.id ?? null,
			actionContext.currentUserId
		);

		revalidatePath("/dashboard/finance");
		revalidatePath(`/dashboard/visits/${detailResult.data.job.id}`);
		revalidatePath(`/dashboard/visits/${detailResult.data.job.id}/invoice`);
		redirect(returnHref);
	}

	const financeDetailSections =
		selectedDetail && selectedInvoice
			? {
					next_move: selectedCollectionsNextMove ? (
						null
					) : null,
					exception_ownership: selectedCollectionsOwnership ? (
						<div className="ops-hub__detail-section">
							<p className="ops-hub__detail-section-label">Thread ownership</p>
							<div className="ops-hub__detail-grid">
								<div className="ops-hub__detail-item">
									<span>Owning role</span>
									<strong>{selectedCollectionsOwnership.owner}</strong>
								</div>
								<div className="ops-hub__detail-item">
									<span>Active exception</span>
									<strong>{selectedCollectionsOwnership.label}</strong>
								</div>
							</div>
							<p className="ops-hub__empty-copy">{selectedCollectionsOwnership.copy}</p>
						</div>
					) : null,
					commercial_state: selectedCollectionStage ? (
						<div className="ops-hub__detail-section">
							<p className="ops-hub__detail-section-label">Collection lane</p>
							<div className="ops-hub__detail-grid">
								<div className="ops-hub__detail-item">
									<span>Current stage</span>
									<strong>{getCollectionStageLabel(selectedCollectionStage)}</strong>
								</div>
								<div className="ops-hub__detail-item">
									<span>Why it is here</span>
									<strong>{getCollectionStageCopy(selectedCollectionStage)}</strong>
								</div>
							</div>
						</div>
					) : null,
					service_thread: selectedServiceThreadSummary ? (
						<div className="ops-hub__detail-section">
							<p className="ops-hub__detail-section-label">Service-thread continuity</p>
							<p className="ops-hub__empty-copy">{selectedServiceThreadSummary.copy}</p>
							<div className="ops-hub__detail-grid">
								<div className="ops-hub__detail-item">
									<span>Thread state</span>
									<strong>{selectedServiceThreadSummary.label}</strong>
								</div>
								<div className="ops-hub__detail-item">
									<span>Next thread move</span>
									<strong>{selectedServiceThreadSummary.nextActionLabel}</strong>
								</div>
							</div>
							<div className="ops-hub__detail-grid">
								{selectedServiceThreadSummary.segments.map((segment) => (
									<div className="ops-hub__detail-item" key={segment.key}>
										<span>{segment.label}</span>
										<strong>{segment.value}</strong>
									</div>
								))}
							</div>
						</div>
					) : null,
					follow_up: selectedFollowUpSummary?.hasChainContext ? (
						<div className="ops-hub__detail-section">
							<p className="ops-hub__detail-section-label">Return-work recovery</p>
							<p className="ops-hub__empty-copy">{selectedFollowUpSummary.copy}</p>
							<div className="ops-hub__detail-grid">
								<div className="ops-hub__detail-item">
									<span>Recovery owner</span>
									<strong>{selectedFollowUpSummary.recoveryOwner}</strong>
								</div>
								<div className="ops-hub__detail-item">
									<span>Customer status</span>
									<strong>
										{selectedFollowUpSummary.customerStatus
											? selectedFollowUpSummary.customerStatus.replaceAll("_", " ")
											: "No update prompt"}
									</strong>
								</div>
							</div>
							{selectedFollowUpSummary.staleFollowUp ? (
								<p className="ops-hub__empty-copy">{selectedFollowUpSummary.staleCopy}</p>
							) : null}
							<div className="ui-button-grid">
								{selectedFollowUpSummary.sourceJobId ? (
									<Link
										className={buttonClassName({ size: "sm", tone: "secondary" })}
										href={`/dashboard/visits?jobId=${selectedFollowUpSummary.sourceJobId}`}
									>
										Open source visit
									</Link>
								) : null}
								{selectedFollowUpSummary.childJobId ? (
									<Link
										className={buttonClassName({ size: "sm", tone: "secondary" })}
										href={`/dashboard/visits?jobId=${selectedFollowUpSummary.childJobId}`}
									>
										Open return visit
									</Link>
								) : null}
								<Link
									className={buttonClassName({ size: "sm", tone: "ghost" })}
									href="/dashboard/visits?scope=return_visit"
								>
									Open return-visit queue
								</Link>
							</div>
						</div>
					) : null,
					customer_updates: null,
					recent_activity: (
						<div className="ops-hub__detail-section">
							<p className="ops-hub__detail-section-label">Payment activity</p>
							<div className="ops-hub__queue">
								{selectedDetail.payments.length ? (
									selectedDetail.payments.map((payment) => (
										<div className="ops-hub__queue-item" key={payment.id}>
											<div>
												<p className="ops-hub__queue-title">
													{formatCurrencyFromCents(payment.amountCents)}
												</p>
												<p className="ops-hub__queue-meta">
													{formatDateTime(payment.paidAt, {
														fallback: "No payment date",
														timeZone: context.company.timezone
													})}
												</p>
											</div>
											<StatusBadge status={payment.status} />
										</div>
									))
								) : (
									<p className="ops-hub__empty-copy">No payments have landed on this thread yet.</p>
								)}
							</div>
						</div>
					)
				}
			: null;
	const financeExpandedDetailSections = financeDetailSections
		? financeDetailRoleFocus.sectionOrder
				.map((sectionKey) => financeDetailSections[sectionKey])
				.filter(Boolean)
		: [];
	const selectedFinanceCommunications = selectedFollowUpCommunications.length
		? selectedFollowUpCommunications
		: selectedCommunications;

	return (
		<Page
			className={cx(
				"ops-hub finance-desk-page",
				visibleInvoices.length <= 2 && "finance-desk-page--focused",
				showFinanceQueueOnly && "finance-desk-page--queue-only",
				showFinanceFileFirst && "finance-desk-page--file-first"
			)}
			layout="command"
		>
			<section
				className={cx(
					"finance-desk-page__thread-bar",
					showFinanceQueueClearCompact && "finance-desk-page__thread-bar--compact-clear"
				)}
			>
				<div className="finance-desk-page__thread-copy">
					<div className="finance-desk-page__thread-heading">
						{useRoleDefaultStage ? (
							<Badge tone={getCollectionStageTone(financeRoleFocus.defaultValue)}>
								{financeRoleFocus.title}
							</Badge>
						) : null}
					</div>
					<p className="finance-desk-page__thread-summary">
						<strong>{financeThreadSummaryLabel}</strong> {financeThreadSummaryCopy}
					</p>
					{!showFinanceQueueClearCompact ? (
					<div className="finance-desk-page__thread-metrics">
						{visibleFinanceThreadMetrics.map((metric) => (
							<div className={cx("finance-desk-page__thread-metric", `finance-desk-page__thread-metric--${metric.tone}`)} key={metric.label}>
								<span>{metric.label}</span>
								<strong>{metric.value}</strong>
							</div>
						))}
					</div>
					) : null}
				</div>
				<div className="finance-desk-page__thread-actions">
					<Link className={buttonClassName()} href={financePriorityAction.href}>
						{financePriorityAction.label}
					</Link>
					{dominantThreadNextMove && dominantThreadNextMove.href !== financePriorityAction.href ? (
						<Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={dominantThreadNextMove.href}>
							{dominantThreadNextMove.label}
						</Link>
					) : null}
				</div>
			</section>

			<PageGrid className="ops-hub__workspace" hasSidebar={showFinanceSidebar}>
				{!hideFinanceQueueCard ? (
					<Card
						className={cx(
							(showFinanceQueueClearCompact || showFinanceFileFirst) &&
								"finance-desk-page__queue-card--compact"
						)}
						padding={showFinanceQueueClearCompact ? "compact" : "spacious"}
						tone="raised"
					>
					{!showFinanceQueueClearCompact && !showFinanceFileFirst ? (
						<CardHeader className="finance-desk-page__queue-header">
						<div className="finance-desk-page__queue-header-main">
							<CardHeaderContent>
								<CardTitle>Finance closeout queue</CardTitle>
							</CardHeaderContent>
						</div>
						<details className="finance-desk-page__queue-panel" open={filtersApplied}>
							<summary className="finance-desk-page__queue-panel-summary">
								<span className="finance-desk-page__queue-panel-copy">
									<strong>Filters</strong>
									<small>{financeQueuePanelSummary}</small>
								</span>
								<span className="finance-desk-page__queue-panel-indicator" aria-hidden="true" />
							</summary>
							<Form className="finance-desk-page__queue-filters" method="get">
								<FormField label="Search">
									<Input
										defaultValue={filters.query}
										name="query"
										placeholder="Invoice number, customer, vehicle"
										type="search"
									/>
								</FormField>
								<FormField label="Stage">
									<Select defaultValue={filters.stage} name="stage">
										<option value="">All</option>
										<option value="field_handoff">Field handoff</option>
										<option value="ready_release">Ready to release</option>
										<option value="collect_now">Collect now</option>
										<option value="reminder_due">Reminder due</option>
										<option value="aged_risk">Aged risk</option>
										<option value="partial_follow_up">Partial follow-up</option>
										<option value="closed_paid">Closed paid</option>
										<option value="voided">Voided</option>
									</Select>
								</FormField>
								<div className="finance-desk-page__queue-filter-actions">
									<button className={buttonClassName({ size: "sm" })} type="submit">
										Apply
									</button>
									{filtersApplied ? (
										<Link
											className={buttonClassName({ size: "sm", tone: "tertiary" })}
											href={
												useRoleDefaultStage
													? `/dashboard/finance?stage=${financeRoleFocus.defaultValue}`
													: "/dashboard/finance"
											}
										>
											Clear
										</Link>
									) : null}
								</div>
							</Form>
						</details>
						</CardHeader>
					) : null}
					<CardContent>
						{queueInvoices.length ? (
							<div className="ops-hub__list">
								{queueInvoices.map((invoice) => {
									const isSelected = selectedInvoice?.invoiceId === invoice.invoiceId;
									const stage = getInvoiceCollectionStage(invoice);
									const threadSummary = invoiceThreadSummaryByInvoiceId.get(invoice.invoiceId) ?? null;
									const stageSummaryCopy =
										stage === "field_handoff" ? getCollectionStageCopy(stage) : threadSummary?.copy;
									const stageNextMoveLabel =
										stage === "field_handoff"
											? getCollectionNextMove(stage).label
											: threadSummary?.nextActionLabel;

									return (
										<Link
											className={cx("ops-hub__row", isSelected && "ops-hub__row--selected")}
											href={buildFinanceHref(filters, { invoiceId: invoice.invoiceId })}
											key={invoice.invoiceId}
										>
											<div className="ops-hub__row-main">
												<div>
													<p className="ops-hub__row-eyebrow">{invoice.invoiceNumber}</p>
													<h3 className="ops-hub__row-title">{invoice.title}</h3>
													<p className="ops-hub__row-meta">
														{stageSummaryCopy ?? getCollectionStageCopy(stage)} Updated{" "}
														{formatDateTime(invoice.updatedAt, {
															fallback: "Unknown",
															timeZone: context.company.timezone
														})}
													</p>
													<div className="finance-desk-page__queue-row-continuity">
														<span>
															{stageNextMoveLabel
																? `Next closeout · ${stageNextMoveLabel}`
																: getCollectionNextMove(stage).label}
														</span>
													</div>
												</div>
												<div className="ops-hub__row-status">
													<Badge tone={getCollectionStageTone(stage)}>{getCollectionStageLabel(stage)}</Badge>
													<strong className="ops-hub__row-value">
														{formatCurrencyFromCents(invoice.balanceDueCents)}
													</strong>
												</div>
											</div>
										</Link>
									);
								})}
							</div>
						) : (
							showFinanceQueueClearCompact ? (
								<div className="finance-desk-page__queue-clear-compact">
									<div className="finance-desk-page__queue-clear-inline">
										<div>
											<p className="ops-hub__row-eyebrow">Queue clear</p>
											<h3 className="ops-hub__row-title">No closeout thread is stalled</h3>
											<p className="ops-hub__row-meta">No live service thread is stalled by money right now.</p>
										</div>
										<Link className={buttonClassName({ size: "sm", tone: "secondary" })} href="/dashboard/visits">
											Open billing-ready visits
										</Link>
									</div>
									<div className="finance-desk-page__queue-clear-metrics">
										{financeQueueClearMetrics.map((metric) => (
											<div
												className={cx(
													"finance-desk-page__queue-clear-metric",
													`finance-desk-page__queue-clear-metric--${metric.tone}`
												)}
												key={metric.label}
											>
												<span>{metric.label}</span>
												<strong>{metric.value}</strong>
											</div>
										))}
									</div>
								</div>
							) : (
								<EmptyState
									actions={
										<Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits">
											Open billing-ready visits
										</Link>
									}
									description={
										filtersApplied
											? "No closeout thread matches this slice."
											: "No live service thread is stalled by money right now."
									}
									eyebrow={filtersApplied ? "No matches" : "Queue clear"}
									title={filtersApplied ? "Nothing in this slice" : "No closeout thread is stalled"}
									tone={filtersApplied ? "info" : "success"}
								/>
							)
						)}
					</CardContent>
					</Card>
				) : null}

				{showFinanceFile ? (
				<aside className="ui-sidebar-stack">
					{selectedDetail && selectedInvoice ? (
						<Card padding="spacious" tone="raised">
							<CardHeader>
								<CardHeaderContent>
									<CardTitle>{selectedDetail.invoice.invoiceNumber}</CardTitle>
									<CardDescription>
									{[
										selectedDetail.invoice.title,
										selectedCollectionStage
											? getCollectionStageLabel(selectedCollectionStage)
											: null,
										selectedServiceThreadSummary?.nextActionLabel ?? null,
										selectedFollowUpSummary?.isFollowUpVisit ? "Return visit" : null
									]
											.filter(Boolean)
											.join(" · ")}
									</CardDescription>
								</CardHeaderContent>
							</CardHeader>
							<CardContent className="ops-hub__detail-stack">
								{selectedCollectionsNextMove ? (
									<div className={cx("finance-desk-page__file-callout", `finance-desk-page__file-callout--${selectedCollectionStage ? getCollectionStageTone(selectedCollectionStage) : "neutral"}`)}>
										<div>
											<p className="finance-desk-page__file-callout-label">Next move</p>
											<strong className="finance-desk-page__file-callout-title">{selectedCollectionsNextMove.label}</strong>
										</div>
										<p className="finance-desk-page__file-callout-copy">{selectedCollectionsNextMove.copy}</p>
									</div>
								) : null}

								<div className="finance-desk-page__file-thread-strip">
									{financePrimaryThreadItems.map((item) => (
										<div className="finance-desk-page__file-thread-item" key={item.label}>
											<span>{item.label}</span>
											<strong>{item.value}</strong>
										</div>
									))}
								</div>

								<div className="finance-desk-page__file-context">
									<p>
										<strong>
											{selectedCollectionStage
												? getCollectionStageLabel(selectedCollectionStage)
												: "Thread in view"}
										</strong>{" "}
										· {selectedServiceThreadSummary?.label ??
											selectedFollowUpSummary?.recoveryOwner ??
											"Single invoice thread"} ·{" "}
										{selectedServiceSiteThreadSummary.label} ·{" "}
										{selectedServiceSite
											? selectedServiceSitePlaybookReady
												? "Site playbook ready"
												: "Site playbook needs access notes"
											: "No site anchored"}
									</p>
									<p>
										{selectedServiceSite
											? formatServiceSiteAddress(selectedServiceSite) || "Address details still missing"
											: "Attach the service location to keep the thread portable"}{" "}
										· {selectedTrustSummary?.label ?? "Stable thread"}
									</p>
								</div>

								<div className="finance-desk-page__file-actions">
									<Link className={buttonClassName({ size: "sm" })} href={selectedVisitThreadHref}>
										Open visit thread
									</Link>
									{selectedEstimate?.status === "accepted" ? (
										<Link
											className={buttonClassName({ size: "sm", tone: "secondary" })}
											href={selectedEstimateThreadHref}
										>
											Open release runway
										</Link>
									) : null}
									{["issued", "partially_paid", "paid"].includes(selectedDetail.invoice.status) ? (
										<form action={sendInvoiceNotificationAction}>
											<input name="invoiceId" type="hidden" value={selectedDetail.invoice.id} />
											<input name="returnHref" type="hidden" value={selectedInvoiceReturnHref} />
											<button
												className={buttonClassName({
													size: "sm",
													tone:
														financeActionLabels.primaryAction === "invoice"
															? "primary"
															: "secondary"
												})}
												type="submit"
											>
												{financeActionLabels.invoice}
											</button>
										</form>
									) : null}
									{isInvoiceEligibleForReminder(selectedDetail.invoice) ? (
										<form action={sendPaymentReminderAction}>
											<input name="invoiceId" type="hidden" value={selectedDetail.invoice.id} />
											<input name="returnHref" type="hidden" value={selectedInvoiceReturnHref} />
											<button
												className={buttonClassName({
													size: "sm",
													tone:
														financeActionLabels.primaryAction === "reminder"
															? "primary"
															: "secondary"
												})}
												type="submit"
											>
												{financeActionLabels.reminder}
											</button>
										</form>
									) : null}
									{!showFinanceFileFirst ? (
										<details className="finance-desk-page__file-actions-overflow">
											<summary className={buttonClassName({ size: "sm", tone: "ghost" })}>
												More
											</summary>
											<div className="finance-desk-page__file-actions-overflow-body">
												<Link
													className={buttonClassName({ size: "sm", tone: "ghost" })}
													href={selectedCustomerThreadHref}
												>
													Open customer thread
												</Link>
												{selectedServiceSite ? (
													<Link
														className={buttonClassName({ size: "sm", tone: "ghost" })}
														href={selectedSiteThreadHref}
													>
														Open site thread
													</Link>
												) : null}
												{selectedEstimate && selectedEstimate.status !== "accepted" ? (
													<Link
														className={buttonClassName({ size: "sm", tone: "ghost" })}
														href={selectedEstimateThreadHref}
													>
														{selectedEstimateThreadLabel}
													</Link>
												) : null}
												<Link
													className={buttonClassName({ size: "sm", tone: "ghost" })}
													href={getInvoiceWorkspaceHref(selectedInvoice, financeVisitLinkOptions)}
												>
													{getInvoiceActionLabel(selectedInvoice)}
												</Link>
											</div>
										</details>
									) : null}
								</div>

								<div className="ops-hub__detail-grid">
									<div className="ops-hub__detail-item">
										<span>Customer</span>
										<strong>{selectedCustomerName}</strong>
									</div>
									<div className="ops-hub__detail-item">
										<span>Vehicle</span>
										<strong>
											{selectedDetail.vehicle.year} {selectedDetail.vehicle.make}{" "}
											{selectedDetail.vehicle.model}
										</strong>
									</div>
									<div className="ops-hub__detail-item">
										<span>Total</span>
										<strong>{formatCurrencyFromCents(selectedDetail.totals.totalCents)}</strong>
									</div>
									<div className="ops-hub__detail-item">
										<span>Balance due</span>
										<strong>
											{formatCurrencyFromCents(selectedDetail.totals.balanceDueCents)}
										</strong>
									</div>
								</div>

								{(financeExpandedDetailSections.length ||
								selectedDetail.lineItems.length ||
								selectedFinanceCommunications.length) &&
								!showFinanceFileFirst ? (
									<details className="finance-desk-page__file-more">
										<summary className="finance-desk-page__file-more-summary">
											<span>More thread detail</span>
											<small>
												{selectedDetail.lineItems.length} line item
												{selectedDetail.lineItems.length === 1 ? "" : "s"} ·{" "}
												{selectedFinanceCommunications.length} update
												{selectedFinanceCommunications.length === 1 ? "" : "s"}
											</small>
										</summary>
										<div className="finance-desk-page__file-more-body">
											{financeExpandedDetailSections.length
												? financeExpandedDetailSections.map((section, index) => (
														<Fragment key={index}>{section}</Fragment>
												  ))
												: null}

											<div className="ops-hub__detail-secondary-grid">
												<div className="ops-hub__detail-section">
													<p className="ops-hub__detail-section-label">Line items</p>
													<div className="ops-hub__queue">
														{selectedDetail.lineItems.length ? (
															selectedDetail.lineItems.map((lineItem) => (
																<div className="ops-hub__queue-item" key={lineItem.id}>
																	<div>
																		<p className="ops-hub__queue-title">{lineItem.name}</p>
																		<p className="ops-hub__queue-meta">
																			{lineItem.quantity} x{" "}
																			{formatCurrencyFromCents(lineItem.unitPriceCents)}
																		</p>
																	</div>
																	<strong>{formatCurrencyFromCents(lineItem.lineSubtotalCents)}</strong>
																</div>
															))
														) : (
															<p className="ops-hub__empty-copy">No line items yet.</p>
														)}
													</div>
												</div>

												<div className="ops-hub__detail-section">
													<p className="ops-hub__detail-section-label">Customer communication</p>
													<div className="ops-hub__queue">
														{selectedFinanceCommunications.length ? (
															selectedFinanceCommunications.map((entry) => (
																<div className="ops-hub__queue-item" key={entry.id}>
																	<div>
																		<p className="ops-hub__queue-title">
																			{entry.communicationType
																				.replace("follow_up_", "return_")
																				.replaceAll("_", " ")}
																		</p>
																		<p className="ops-hub__queue-meta">
																			{formatDateTime(entry.createdAt, {
																				fallback: "Saved recently",
																				timeZone: context.company.timezone
																			})}{" "}
																			· {entry.channel.toUpperCase()} ·{" "}
																			{entry.recipientName ??
																				entry.recipientEmail ??
																				entry.recipientPhone ??
																				"customer"}
																		</p>
																	</div>
																	<StatusBadge status={entry.status} />
																</div>
															))
														) : (
															<p className="ops-hub__empty-copy">
																No customer-facing updates have been logged for this invoice visit yet.
															</p>
														)}
													</div>
												</div>
											</div>
										</div>
									</details>
								) : null}
							</CardContent>
						</Card>
					) : null}
				</aside>
				) : null}
			</PageGrid>
		</Page>
	);
}

export default FinanceWorkspacePageImpl;

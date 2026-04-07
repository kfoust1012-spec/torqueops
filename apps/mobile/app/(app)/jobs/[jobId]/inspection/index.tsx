import { canCompleteInspection, formatDateTime, getCustomerDisplayName } from "@mobile-mechanic/core";
import type { InspectionSection } from "@mobile-mechanic/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard,
  StatusBadge
} from "../../../../../src/components/ui";
import {
  type AssignedInspectionDetail,
  ensureAssignedInspection,
  loadAssignedInspection,
  submitInspectionCompletion
} from "../../../../../src/features/inspections/api";
import {
  getInspectionRunPath,
  getInspectionSectionCounts,
  getInspectionSectionFocusLabel,
  getNextInspectionSection
} from "../../../../../src/features/inspections/navigation";
import { InspectionProgress } from "../../../../../src/features/inspections/components/inspection-progress";
import { InspectionSectionCard } from "../../../../../src/features/inspections/components/inspection-section-card";
import { useSessionContext } from "../../../../../src/providers/session-provider";

type InspectionDetailData = AssignedInspectionDetail | null;

export default function InspectionEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext } = useSessionContext();
  const [detail, setDetail] = useState<InspectionDetailData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    body: string;
    title?: string;
    tone: "brand" | "danger" | "success" | "warning";
  } | null>(null);

  const loadInspection = useCallback(
    async (options?: { ensure?: boolean }) => {
      if (!appContext || !jobId) {
        return;
      }

      const result = options?.ensure
        ? await ensureAssignedInspection(appContext.companyId, appContext.userId, jobId)
        : await loadAssignedInspection(appContext.companyId, appContext.userId, jobId);

      setDetail(result);
    },
    [appContext, jobId]
  );

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!appContext || !jobId) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await ensureAssignedInspection(appContext.companyId, appContext.userId, jobId);

        if (!isMounted) {
          return;
        }

        setDetail(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load the inspection workflow."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext, jobId]);

  async function handleRefresh() {
    if (!appContext || !jobId) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await loadInspection();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to refresh the inspection workflow."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCompleteInspection() {
    if (!appContext || !detail || !jobId) {
      return;
    }

    setIsCompleting(true);
    setNotice(null);

    try {
      const result = await submitInspectionCompletion(
        appContext.companyId,
        appContext.userId,
        jobId,
        detail.inspection.id
      );
      await loadInspection();
      setNotice(result.queued
        ? {
            body: "Inspection completion is stored on this device and will sync automatically when the connection is back.",
            title: "Completion queued",
            tone: "warning"
          }
        : {
            body: "This inspection is now complete and read-only for the rest of the visit.",
            title: "Inspection completed",
            tone: "success"
          });
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The inspection could not be completed.",
        title: "Completion failed",
        tone: "danger"
      });
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <LoadingState
        body="Loading the inspection checklist for this assigned stop."
        title="Loading inspection"
      />
    );
  }

  if (!detail || !jobId) {
    return (
      <Screen>
        <ErrorState
          actions={
            <View style={{ gap: 12 }}>
              <Button onPress={() => void handleRefresh()}>Retry</Button>
              <Button
                onPress={() => router.replace(jobId ? `/jobs/${jobId}` : "/jobs")}
                tone="secondary"
              >
                Back to stop
              </Button>
            </View>
          }
          body={errorMessage ?? "This inspection could not be loaded for the assigned stop."}
          eyebrow="Stop inspection"
          title="Inspection unavailable"
        />
      </Screen>
    );
  }

  const allItems = detail.sections.flatMap((section) => section.items);
  const inspectionIsCompleted = detail.inspection.status === "completed";
  const completionReady = canCompleteInspection(allItems);
  const nextSection = getNextInspectionSection(detail.sections);
  const nextSectionCounts = nextSection ? getInspectionSectionCounts(nextSection) : null;
  const runInspectionPath = getInspectionRunPath(jobId, detail);
  const nextSectionFocusLabel = getInspectionSectionFocusLabel(nextSection);

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          actions={
            <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
              Back to stop
            </Button>
          }
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={detail.inspection.status} />
              <Badge tone="info">Template {detail.inspection.templateVersion}</Badge>
            </View>
          }
          description={`${getCustomerDisplayName(detail.customer)} · ${
            detail.vehicle.year ? `${detail.vehicle.year} ` : ""
          }${detail.vehicle.make} ${detail.vehicle.model}`}
          eyebrow="Inspection workflow"
          compact
          title="Vehicle inspection"
        />

        {errorMessage ? (
          <Notice
            actions={
              <Button onPress={() => void handleRefresh()} tone="secondary">
                Retry refresh
              </Button>
            }
            body={errorMessage}
            title="Refresh failed"
            tone="danger"
          />
        ) : null}

        {notice ? <Notice body={notice.body} title={notice.title} tone={notice.tone} /> : null}
        {detail.pendingMutationCount ? (
          <Notice
            body={`${detail.pendingMutationCount} inspection change${
              detail.pendingMutationCount === 1 ? "" : "s"
            } are stored on this device and will sync automatically when the app reconnects.`}
            title="Offline queue"
            tone="warning"
          />
        ) : null}

        {nextSection ? (
          <ActionTile
            badge={
              <Badge
                tone={
                  inspectionIsCompleted
                    ? "success"
                    : nextSectionCounts?.failCount
                      ? "danger"
                      : nextSectionCounts?.requiredRemainingCount
                        ? "warning"
                        : "info"
                }
              >
                {inspectionIsCompleted ? "Review" : "Continue"}
              </Badge>
            }
            description={
              inspectionIsCompleted
                ? "Inspection complete. Review the next section if you need context."
                : `${nextSectionCounts?.checkedCount ?? 0} of ${nextSection.items.length} checked${
                    nextSectionCounts?.requiredRemainingCount
                      ? ` · ${nextSectionCounts.requiredRemainingCount} required left`
                      : ""
                  }${nextSectionCounts?.failCount ? ` · ${nextSectionCounts.failCount} fail` : ""}${
                    nextSectionFocusLabel ? ` · ${nextSectionFocusLabel}` : ""
                  }`
            }
            eyebrow={inspectionIsCompleted ? "Review section" : "Resume next section"}
            onPress={() => router.push(runInspectionPath as never)}
            title={inspectionIsCompleted ? `Review ${nextSection.title}` : `Continue with ${nextSection.title}`}
            tone={inspectionIsCompleted ? "subtle" : "primary"}
          />
        ) : null}

        <InspectionProgress items={allItems} />

        <SectionCard
          compact
          description="Finish the checklist cleanly before sending it back to the stop."
          eyebrow="Inspection status"
          title="Readiness"
        >
          <DetailRow label="Template version" value={detail.inspection.templateVersion} />
          <DetailRow
            label="Started"
            value={formatDateTime(detail.inspection.startedAt, {
              includeTimeZoneName: false,
              timeZone: appContext?.company.timezone
            })}
          />
          {detail.inspection.completedAt ? (
            <DetailRow
              label="Completed"
              value={formatDateTime(detail.inspection.completedAt, {
                includeTimeZoneName: false,
                timeZone: appContext?.company.timezone
              })}
            />
          ) : null}

          {inspectionIsCompleted ? (
            <Notice
              body="Completed inspections are read-only. Review the sections any time you need checklist history."
              tone="success"
            />
          ) : completionReady ? (
            <Notice
              body="All required items are checked. Complete the inspection when the walkthrough is finished."
              tone="success"
            />
          ) : (
            <Notice
              body="Required items still need results before the inspection can be completed."
              tone="warning"
            />
          )}

          {!inspectionIsCompleted ? (
            <Button
              disabled={!completionReady || isCompleting}
              loading={isCompleting}
              onPress={() => void handleCompleteInspection()}
              tone={completionReady ? "success" : "secondary"}
            >
              Complete inspection
            </Button>
          ) : null}
        </SectionCard>

        <SectionCard
          compact
          description="Open a section to continue the checklist or review finished findings."
          eyebrow="Checklist"
          title="Inspection sections"
        >
          {detail.sections.length ? (
            <View style={{ gap: 8 }}>
              {detail.sections.map((section) => (
                <InspectionSectionCard
                  key={section.sectionKey}
                  onPress={() => router.push(`/jobs/${jobId}/inspection/${section.sectionKey}`)}
                  isNextSection={!inspectionIsCompleted && nextSection?.sectionKey === section.sectionKey}
                  section={section}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              actions={
                <Button onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
                  Back to stop
                </Button>
              }
              body="No checklist sections are available for this inspection yet."
              eyebrow="Checklist"
              title="No sections available"
            />
          )}
        </SectionCard>
      </ScreenScrollView>
    </Screen>
  );
}

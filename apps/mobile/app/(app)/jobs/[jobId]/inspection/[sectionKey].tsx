import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import {
  Badge,
  Button,
  Chip,
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
  submitInspectionItemUpdate
} from "../../../../../src/features/inspections/api";
import { InspectionItemEditor } from "../../../../../src/features/inspections/components/inspection-item-editor";
import { InspectionProgress } from "../../../../../src/features/inspections/components/inspection-progress";
import { getInspectionSectionCounts } from "../../../../../src/features/inspections/navigation";
import { useSessionContext } from "../../../../../src/providers/session-provider";
import { mobileTheme } from "../../../../../src/theme";

type InspectionDetailData = AssignedInspectionDetail | null;

export default function InspectionSectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId?: string | string[];
    sectionKey?: string | string[];
  }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const sectionKey =
    typeof params.sectionKey === "string" ? params.sectionKey : params.sectionKey?.[0] ?? null;
  const { appContext } = useSessionContext();
  const [detail, setDetail] = useState<InspectionDetailData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [nextTargetItemId, setNextTargetItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    body: string;
    title?: string;
    tone: "brand" | "danger" | "success" | "warning";
  } | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const itemOffsetRef = useRef<Record<string, number>>({});

  const loadDetail = useCallback(async () => {
    if (!appContext || !jobId) {
      return;
    }

    const result = await ensureAssignedInspection(appContext.companyId, appContext.userId, jobId);
    setDetail(result);
  }, [appContext, jobId]);

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
          error instanceof Error ? error.message : "Failed to load the inspection section."
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
    setIsRefreshing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await loadDetail();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to refresh the inspection section."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSaveItem(
    inspectionItemId: string,
    input: {
      status: "pass" | "attention" | "fail" | "not_checked";
      findingSeverity: "low" | "medium" | "high" | "critical" | null;
      technicianNotes: string | null;
      recommendation: string | null;
    }
  ) {
    if (!appContext || !jobId) {
      return;
    }

    setSavingItemId(inspectionItemId);
    setNotice(null);

    try {
      const result = await submitInspectionItemUpdate(
        appContext.companyId,
        appContext.userId,
        jobId,
        inspectionItemId,
        input
      );
      const refreshedDetail = await ensureAssignedInspection(appContext.companyId, appContext.userId, jobId);
      setDetail(refreshedDetail);

      const refreshedSection =
        refreshedDetail.sections.find((entry) => entry.sectionKey === sectionKey) ?? null;
      const savedItemIndex =
        refreshedSection?.items.findIndex((item) => item.id === inspectionItemId) ?? -1;
      const nextUncheckedItem =
        savedItemIndex >= 0
          ? refreshedSection?.items
              .slice(savedItemIndex + 1)
              .find((item) => item.status === "not_checked") ?? null
          : null;

      setNextTargetItemId(nextUncheckedItem?.id ?? null);
      setNotice(result.queued
        ? {
            body: nextUncheckedItem
              ? `This inspection item is stored on this device and will sync automatically when the connection is back. Next up: ${nextUncheckedItem.label}.`
              : "This inspection item is stored on this device and will sync automatically when the connection is back.",
            title: "Item queued",
            tone: "warning"
          }
        : nextUncheckedItem
          ? {
              body: `Saved. Continue with ${nextUncheckedItem.label}.`,
              title: "Next item ready",
              tone: "success"
            }
          : null);
    } catch (error) {
      setNotice({
        body:
          error instanceof Error ? error.message : "The inspection item could not be saved.",
        title: "Save failed",
        tone: "danger"
      });
    } finally {
      setSavingItemId(null);
    }
  }

  useEffect(() => {
    if (!nextTargetItemId) {
      return;
    }

    const offset = itemOffsetRef.current[nextTargetItemId];

    if (typeof offset !== "number") {
      return;
    }

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, offset - 140)
      });
    }, 60);

    return () => clearTimeout(timer);
  }, [nextTargetItemId, detail?.inspection.updatedAt]);

  if (isLoading) {
    return (
      <LoadingState
        body="Loading the inspection section for this assigned stop."
        title="Loading section"
      />
    );
  }

  const section = detail?.sections.find((entry) => entry.sectionKey === sectionKey) ?? null;

  if (!detail || !section || !jobId) {
    return (
      <Screen>
        <ErrorState
          actions={
            <View style={{ gap: 12 }}>
              <Button onPress={() => void handleRefresh()}>Retry</Button>
              <Button
                onPress={() => router.replace(jobId ? `/jobs/${jobId}/inspection` : "/jobs")}
                tone="secondary"
              >
                Back to inspection
              </Button>
            </View>
          }
          body={errorMessage ?? "This stop inspection section could not be loaded."}
          eyebrow="Stop inspection"
          title="Section unavailable"
        />
      </Screen>
    );
  }

  const inspectionIsCompleted = detail.inspection.status === "completed";
  const sectionIndex = detail.sections.findIndex((entry) => entry.sectionKey === section.sectionKey);
  const previousSection = sectionIndex > 0 ? detail.sections[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex >= 0 && sectionIndex < detail.sections.length - 1
      ? detail.sections[sectionIndex + 1]
      : null;
  const checkedCount = section.items.filter((item) => item.status !== "not_checked").length;
  const failCount = section.items.filter((item) => item.status === "fail").length;
  const requiredRemainingCount = section.items.filter(
    (item) => item.isRequired && item.status === "not_checked"
  ).length;
  const sectionIsComplete = checkedCount === section.items.length;

  return (
    <Screen>
      <ScreenScrollView
        ref={scrollViewRef}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          actions={
            <Button
              fullWidth={false}
              onPress={() => router.replace(`/jobs/${jobId}/inspection`)}
              tone="secondary"
            >
              Section picker
            </Button>
          }
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge tone="info">{`Section ${sectionIndex + 1} of ${detail.sections.length}`}</Badge>
              <StatusBadge status={detail.inspection.status} />
              {requiredRemainingCount ? (
                <Badge tone="warning">{requiredRemainingCount} required left</Badge>
              ) : null}
            </View>
          }
          description={
            inspectionIsCompleted
              ? "Inspection complete. Items are read-only in this section."
              : "Set the item result first, then add notes or a recommendation only when needed."
          }
          eyebrow="Inspection section"
          compact
          title={section.title}
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

        {inspectionIsCompleted ? (
          <Notice
            body="This inspection is complete, so the checklist is now read-only."
            tone="success"
          />
        ) : sectionIsComplete ? (
          <Notice
            actions={
              <Button
                fullWidth={false}
                onPress={() =>
                  router.replace(
                    nextSection
                      ? `/jobs/${jobId}/inspection/${nextSection.sectionKey}`
                      : `/jobs/${jobId}/inspection`
                  )
                }
                tone="secondary"
              >
                {nextSection ? "Next section" : "Review completion"}
              </Button>
            }
            body={
              nextSection
                ? "This section is complete. Move straight to the next section instead of backing out to the overview."
                : "This is the last section. Review completion and finish the inspection."
            }
            title="Section complete"
            tone="success"
          />
        ) : failCount ? (
          <Notice
            body="Failed items in this section need clear notes or recommendations before you move on."
            tone="danger"
          />
        ) : (
          <View
            style={{
              backgroundColor: mobileTheme.colors.brand.soft,
              borderRadius: mobileTheme.radius.lg,
              borderWidth: 1,
              borderColor: mobileTheme.colors.border.base,
              gap: 4,
              paddingHorizontal: mobileTheme.spacing[3],
              paddingVertical: mobileTheme.spacing[2]
            }}
          >
            <Text
              style={{
                color: mobileTheme.colors.brand.strong,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.6,
                textTransform: "uppercase"
              }}
            >
              Checklist flow
            </Text>
            <Text
              style={{
                color: mobileTheme.colors.brand.strong,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 13,
                lineHeight: 18
              }}
            >
              Move item by item. Attention or fail results open the extra detail fields.
            </Text>
          </View>
        )}

        <InspectionProgress items={section.items} />

        <ScrollView
          contentContainerStyle={{ gap: 6, paddingRight: 2 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ flexDirection: "row", gap: 6 }}>
            {detail.sections.map((entry) => {
              const counts = getInspectionSectionCounts(entry);

              return (
                <Chip
                  compact
                  key={entry.sectionKey}
                  onPress={() => router.replace(`/jobs/${jobId}/inspection/${entry.sectionKey}`)}
                  selected={entry.sectionKey === section.sectionKey}
                  tone={
                    entry.sectionKey === section.sectionKey
                      ? "brand"
                      : counts.failCount
                        ? "warning"
                        : counts.requiredRemainingCount
                          ? "info"
                          : "neutral"
                  }
                >
                  {entry.title}
                </Chip>
              );
            })}
          </View>
        </ScrollView>

        <SectionCard
          compact
          description={`${checkedCount} of ${section.items.length} items checked in this section.`}
          eyebrow="Checklist"
          title="Section items"
        >
          {section.items.length ? (
            <View style={{ gap: 8 }}>
              {section.items.map((item) => (
                <View
                  key={item.id}
                  onLayout={(event) => {
                    itemOffsetRef.current[item.id] = event.nativeEvent.layout.y;
                  }}
                >
                  <InspectionItemEditor
                    isBusy={savingItemId === item.id}
                    isCompleted={inspectionIsCompleted}
                    isNextTarget={nextTargetItemId === item.id}
                    item={item}
                    onSave={(input) => handleSaveItem(item.id, input)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              actions={
                <Button
                  onPress={() => router.replace(`/jobs/${jobId}/inspection`)}
                  tone="secondary"
                >
                  Back to inspection
                </Button>
              }
              body="No checklist items are available in this section yet."
              eyebrow="Checklist"
              title="No items available"
            />
          )}
        </SectionCard>

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
            justifyContent: previousSection ? "space-between" : "flex-end"
          }}
        >
          {previousSection ? (
            <Button
              fullWidth={false}
              onPress={() =>
                router.replace(`/jobs/${jobId}/inspection/${previousSection.sectionKey}`)
              }
              size="sm"
              tone="tertiary"
            >
              Previous
            </Button>
          ) : null}

          <Button
            fullWidth={false}
            onPress={() =>
              router.replace(
                nextSection
                  ? `/jobs/${jobId}/inspection/${nextSection.sectionKey}`
                  : `/jobs/${jobId}/inspection`
              )
            }
            size="sm"
          >
            {nextSection ? "Next section" : "Overview"}
          </Button>
        </View>
      </ScreenScrollView>
    </Screen>
  );
}

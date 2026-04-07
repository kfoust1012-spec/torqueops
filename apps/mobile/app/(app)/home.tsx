import {
  isTechnicianLiveJobStatus,
  isTechnicianUpcomingJobStatus
} from "@mobile-mechanic/core";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, Text, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Notice,
  PriorityBadge,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard,
  StatusBadge
} from "../../src/components/ui";
import { useLiveLocationSharing } from "../../src/features/location/use-live-location-sharing";
import { loadTechnicianHomeData } from "../../src/features/jobs/api";
import { JobCard } from "../../src/features/jobs/components/job-card";
import { formatJobAssignmentSummary, formatJobTitleLabel } from "../../src/features/jobs/mappers";
import { useNotificationInbox } from "../../src/features/notifications/notification-inbox-provider";
import type { MobileAppContext } from "../../src/lib/app-context";
import { canCreateJobsFromMobile } from "../../src/lib/mobile-capabilities";
import { mobileTheme } from "../../src/theme";
import { useSessionContext } from "../../src/providers/session-provider";

type HomeData = Awaited<ReturnType<typeof loadTechnicianHomeData>> | null;

function getFeaturedJob(data: HomeData) {
  if (!data?.jobs.length) {
    return null;
  }

  return (
    data.jobs.find((job) => isTechnicianLiveJobStatus(job.status)) ??
    data.jobs.find((job) => isTechnicianUpcomingJobStatus(job.status)) ??
    data.jobs[0]
  );
}

function getQueuedJobs(data: HomeData, featuredJobId: string | null) {
  if (!data?.jobs.length) {
    return [];
  }

  return data.jobs
    .filter((job) => job.id !== featuredJobId)
    .filter(
      (job) => isTechnicianLiveJobStatus(job.status) || isTechnicianUpcomingJobStatus(job.status)
    )
    .slice(0, 3);
}

function getFeaturedJobEyebrow(isLiveJob: boolean) {
  return isLiveJob ? "Current stop" : "Up next";
}

function getFeaturedJobCtaLabel(isLiveJob: boolean) {
  return isLiveJob ? "Resume current stop" : "Open next stop";
}

function formatSharedTime(value: string | null) {
  if (!value) {
    return "Not shared yet";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

type HomeSummaryStripProps = {
  liveNowCount: number;
  queuedCount: number;
  todayCount: number;
};

function HomeSummaryStrip({
  liveNowCount,
  queuedCount,
  todayCount
}: HomeSummaryStripProps) {
  const items = [
    {
      label: "Today",
      value: todayCount
    },
    {
      label: "Live now",
      value: liveNowCount
    },
    {
      label: "Queued",
      value: queuedCount
    }
  ];

  return (
    <View
      style={{
        borderRadius: mobileTheme.radius.xl,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border.subtle,
        backgroundColor: mobileTheme.colors.surface.base,
        flexDirection: "row",
        overflow: "hidden"
      }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: mobileTheme.spacing[4],
            paddingVertical: mobileTheme.spacing[3],
            gap: mobileTheme.spacing[1],
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: mobileTheme.colors.border.subtle
          }}
        >
          <Text
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.8,
              textTransform: "uppercase"
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: 22,
              fontWeight: "700",
              lineHeight: 24
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { appContext, refreshAppContext } = useSessionContext();
  const { unreadCount } = useNotificationInbox();
  const [homeData, setHomeData] = useState<HomeData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    errorMessage: locationErrorMessage,
    isSharing,
    lastSharedAt,
    startSharing,
    status: locationStatus,
    stopSharing
  } = useLiveLocationSharing(appContext);
  const canCreateJobs = appContext ? canCreateJobsFromMobile(appContext.membership.role) : false;

  const loadData = useCallback(
    async (context: MobileAppContext | null = appContext) => {
      if (!context) {
        return;
      }

      const result = await loadTechnicianHomeData(context.companyId, context.userId);
      setHomeData(result);
    },
    [appContext]
  );

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!appContext) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await loadTechnicianHomeData(appContext.companyId, appContext.userId);

        if (!isMounted) {
          return;
        }

        setHomeData(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load technician home.");
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
  }, [appContext]);

  async function handleRefresh() {
    if (!appContext) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const nextContext = await refreshAppContext();
      await loadData(nextContext);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to refresh technician home.");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return <LoadingState body="Loading your assigned work for today." title="Loading today" />;
  }

  const featuredJob = getFeaturedJob(homeData);
  const upcomingJobs = getQueuedJobs(homeData, featuredJob?.id ?? null);
  const queuePreviewJob = upcomingJobs.length === 1 ? upcomingJobs[0] : null;
  const todayCount = homeData?.jobs.length ?? 0;
  const liveNowCount = (homeData?.jobs ?? []).filter((job) => isTechnicianLiveJobStatus(job.status)).length;
  const queuedCount = upcomingJobs.length;

  return (
    <Screen>
      <ScreenScrollView
        contentContainerStyle={{ paddingBottom: mobileTheme.spacing[9] }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          actions={
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: mobileTheme.spacing[2]
              }}
            >
              {canCreateJobs ? (
                <Button
                  fullWidth={false}
                  onPress={() => router.push("/new-job" as never)}
                  size="sm"
                  tone="secondary"
                >
                  New job
                </Button>
              ) : null}
              <Badge tone="info">{homeData?.jobs.length ?? 0} stops today</Badge>
            </View>
          }
          description="Start with the live stop, then work forward through the queue."
          eyebrow={appContext?.company.name ?? "Technician"}
          title="Today's work"
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

        {unreadCount ? (
          <Notice
            actions={
              <Button fullWidth={false} onPress={() => router.push("/inbox" as never)} tone="secondary">
                Open inbox
              </Button>
            }
            body={`${unreadCount} dispatch update${unreadCount === 1 ? "" : "s"} still need review.`}
            title="Queue changed"
            tone="warning"
          />
        ) : null}

        <View style={{ gap: mobileTheme.spacing[4] }}>
        {featuredJob ? (
          <View style={{ gap: mobileTheme.spacing[2] }}>
            <SectionCard
              eyebrow="Right now"
              surface="flat"
              title="Current assignment"
            >
              <ActionTile
                badge={
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <StatusBadge status={featuredJob.status} />
                    <PriorityBadge value={featuredJob.priority} />
                  </View>
                }
                descriptionNumberOfLines={4}
                description={formatJobAssignmentSummary({
                  customerDisplayName: featuredJob.customerDisplayName,
                  locationSummary: featuredJob.serviceSiteSummary ?? featuredJob.addressSummary,
                  scheduledStartAt: featuredJob.scheduledStartAt,
                  timeZone: appContext?.company.timezone,
                  vehicleDisplayName: featuredJob.vehicleDisplayName
                })}
                eyebrow={getFeaturedJobEyebrow(isTechnicianLiveJobStatus(featuredJob.status))}
                layout="hero"
                onPress={() => router.push(`/jobs/${featuredJob.id}`)}
                title={formatJobTitleLabel(featuredJob.title)}
                titleNumberOfLines={3}
                tone="primary"
              />
              <Button onPress={() => router.push(`/jobs/${featuredJob.id}`)}>
                {getFeaturedJobCtaLabel(isTechnicianLiveJobStatus(featuredJob.status))}
              </Button>
            </SectionCard>

            <HomeSummaryStrip
              liveNowCount={liveNowCount}
              queuedCount={queuedCount}
              todayCount={todayCount}
            />
          </View>
        ) : (
          <EmptyState
            actions={
              <Button onPress={() => router.push("/jobs")} tone="secondary">
                Open My Work
              </Button>
            }
            body="No assigned stops are ready right now. Pull to refresh after dispatch changes."
            eyebrow="Technician view"
            title="No assigned stops"
          />
        )}

        {upcomingJobs.length ? (
          <SectionCard
            description={
              queuePreviewJob
                ? "One stop is queued after the current assignment."
                : "These are the next stops after the current assignment."
            }
            eyebrow="Queue"
            surface="flat"
            title={queuePreviewJob ? "Next stop" : "Coming up next"}
          >
            {queuePreviewJob ? (
              <ActionTile
                badge={
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <StatusBadge status={queuePreviewJob.status} />
                    <PriorityBadge value={queuePreviewJob.priority} />
                  </View>
                }
                descriptionNumberOfLines={4}
                description={formatJobAssignmentSummary({
                  customerDisplayName: queuePreviewJob.customerDisplayName,
                  locationSummary: queuePreviewJob.serviceSiteSummary ?? queuePreviewJob.addressSummary,
                  scheduledStartAt: queuePreviewJob.scheduledStartAt,
                  timeZone: appContext?.company.timezone,
                  vehicleDisplayName: queuePreviewJob.vehicleDisplayName
                })}
                eyebrow="Queued next"
                onPress={() => router.push(`/jobs/${queuePreviewJob.id}`)}
                title={formatJobTitleLabel(queuePreviewJob.title)}
                titleNumberOfLines={2}
                tone="subtle"
              />
            ) : (
              <View style={{ gap: 12 }}>
                {upcomingJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onPress={() => router.push(`/jobs/${job.id}`)}
                    timeZone={appContext?.company.timezone}
                  />
                ))}
              </View>
            )}

            <Button fullWidth={false} onPress={() => router.push("/jobs")} size="sm" tone="tertiary">
              Open My Work
            </Button>
          </SectionCard>
        ) : (
          <View style={{ gap: mobileTheme.spacing[2] }}>
            <Text
              style={{
                color: mobileTheme.colors.text.muted,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.8,
                textTransform: "uppercase"
              }}
            >
              Queue
            </Text>
            <Notice body="No additional stops queued." tone="brand" />
          </View>
        )}
        </View>

        <View style={{ paddingTop: mobileTheme.spacing[3] }}>
        <SectionCard
          eyebrow="Workday tracking"
          surface="flat"
          title="Live location"
        >
          <View
            style={{
              gap: mobileTheme.spacing[2]
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: mobileTheme.spacing[2]
              }}
            >
              <View style={{ flex: 1, gap: mobileTheme.spacing[1], minWidth: 220 }}>
                <Text
                  style={{
                    color: mobileTheme.colors.text.strong,
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 16,
                    fontWeight: "700"
                  }}
                >
                  {isSharing ? "Dispatch can see your live position." : "Tracking is off."}
                </Text>
                <Text
                  style={{
                    color: mobileTheme.colors.text.muted,
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 13,
                    lineHeight: 18
                  }}
                >
                  {isSharing
                    ? `Last shared ${formatSharedTime(lastSharedAt)}.`
                    : "Start when dispatch needs live tracking."}
                </Text>
              </View>
              <View style={{ paddingTop: mobileTheme.spacing[1] }}>
                <Badge tone={isSharing ? "success" : locationStatus === "starting" ? "warning" : "neutral"}>
                  {isSharing ? "Active" : locationStatus === "starting" ? "Starting…" : "Off"}
                </Badge>
              </View>
            </View>

            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: mobileTheme.spacing[1],
                paddingBottom: mobileTheme.spacing[2]
              }}
            >
              {isSharing ? (
                <Button fullWidth={false} onPress={() => void stopSharing()} size="sm" tone="secondary">
                  End workday tracking
                </Button>
              ) : (
                <Button
                  fullWidth={false}
                  loading={locationStatus === "starting"}
                  onPress={() => void startSharing()}
                  size="sm"
                  tone="tertiary"
                >
                  Start workday tracking
                </Button>
              )}
            </View>
          </View>

          {locationErrorMessage ? (
            <Notice
              body={locationErrorMessage}
              title="Workday tracking is off"
              tone="warning"
            />
          ) : null}
        </SectionCard>
        </View>
      </ScreenScrollView>
    </Screen>
  );
}

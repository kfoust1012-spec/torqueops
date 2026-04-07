import type { JobStatus } from "@mobile-mechanic/types";
import {
  formatDesignStatusLabel,
  isTechnicianActiveFieldJobStatus,
  isTechnicianLiveJobStatus,
  isTechnicianUpcomingJobStatus
} from "@mobile-mechanic/core";
import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  Chip,
  EmptyState,
  LoadingState,
  Notice,
  PriorityBadge,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  StatusBadge
} from "../../../src/components/ui";
import { loadTechnicianJobs } from "../../../src/features/jobs/api";
import { JobCard } from "../../../src/features/jobs/components/job-card";
import { formatJobAssignmentSummary, formatJobTitleLabel } from "../../../src/features/jobs/mappers";
import { useNotificationInbox } from "../../../src/features/notifications/notification-inbox-provider";
import type { MobileAppContext } from "../../../src/lib/app-context";
import { canCreateJobsFromMobile } from "../../../src/lib/mobile-capabilities";
import { useSessionContext } from "../../../src/providers/session-provider";
import { mobileTheme } from "../../../src/theme";

const filters = ["all", "live", "queued", "blocked", "completed"] as const;

type StatusFilter = (typeof filters)[number];

function formatFilterLabel(filter: StatusFilter) {
  switch (filter) {
    case "all":
      return "All";
    case "live":
      return "Live";
    case "queued":
      return "Queued";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Done";
    default:
      return formatDesignStatusLabel(filter satisfies never);
  }
}

function matchesFilter(job: Awaited<ReturnType<typeof loadTechnicianJobs>>[number], filter: StatusFilter) {
  switch (filter) {
    case "all":
      return true;
    case "live":
      return isTechnicianActiveFieldJobStatus(job.status);
    case "queued":
      return isTechnicianUpcomingJobStatus(job.status);
    case "blocked":
      return job.status === "waiting_approval" || job.status === "waiting_parts";
    case "completed":
      return job.status === "completed";
    default:
      return false;
  }
}

function getFeaturedJob(
  jobs: Awaited<ReturnType<typeof loadTechnicianJobs>>,
  selectedFilter: StatusFilter
) {
  if (!jobs.length || selectedFilter === "completed") {
    return null;
  }

  return (
    jobs.find((job) => isTechnicianLiveJobStatus(job.status)) ??
    jobs.find((job) => isTechnicianUpcomingJobStatus(job.status)) ??
    jobs[0]
  );
}

function getQueueGroups(jobs: Awaited<ReturnType<typeof loadTechnicianJobs>>) {
  return {
    active: jobs.filter((job) => isTechnicianActiveFieldJobStatus(job.status)),
    blocked: jobs.filter((job) => job.status === "waiting_approval" || job.status === "waiting_parts"),
    ready: jobs.filter((job) => isTechnicianUpcomingJobStatus(job.status)),
    completed: jobs.filter((job) => job.status === "completed"),
    other: jobs.filter(
      (job) =>
        !isTechnicianActiveFieldJobStatus(job.status) &&
        !isTechnicianUpcomingJobStatus(job.status) &&
        job.status !== "waiting_approval" &&
        job.status !== "waiting_parts" &&
        job.status !== "completed"
    )
  };
}

type QueueSectionProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
};

function QueueSection({ children, eyebrow, title }: QueueSectionProps) {
  return (
    <View style={{ gap: mobileTheme.spacing[2] }}>
      <Text
        style={{
          color: mobileTheme.colors.brand.warm,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          color: mobileTheme.colors.text.strong,
          fontFamily: mobileTheme.typography.family.display,
          fontSize: 28,
          fontWeight: "700",
          lineHeight: 32
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

type CompletedPreviewCardProps = {
  job: Awaited<ReturnType<typeof loadTechnicianJobs>>[number];
  onPress: () => void;
};

function CompletedPreviewCard({ job, onPress }: CompletedPreviewCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: mobileTheme.radius.xl,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border.subtle,
        backgroundColor: mobileTheme.colors.surface.subtle,
        padding: mobileTheme.spacing[4],
        gap: mobileTheme.spacing[3]
      }}
    >
      <View style={{ gap: mobileTheme.spacing[2] }}>
        <Text
          style={{
            color: mobileTheme.colors.brand.warm,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase"
          }}
        >
          Completed
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <PriorityBadge value={job.priority} />
          <StatusBadge status={job.status} />
        </View>
      </View>

      <View style={{ gap: mobileTheme.spacing[1], minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            color: mobileTheme.colors.text.strong,
            fontFamily: mobileTheme.typography.family.display,
            fontSize: 17,
            fontWeight: "700",
            lineHeight: 21
          }}
        >
          {formatJobTitleLabel(job.title)}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: mobileTheme.colors.text.subtle,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 13,
            lineHeight: 18
          }}
        >
          {job.customerDisplayName} · {job.vehicleDisplayName}
        </Text>
      </View>

      <Text
        style={{
          color: mobileTheme.colors.text.subtle,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2
        }}
      >
        View details
      </Text>
    </Pressable>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const { appContext, refreshAppContext } = useSessionContext();
  const { unreadCount } = useNotificationInbox();
  const canCreateJobs = appContext ? canCreateJobsFromMobile(appContext.membership.role) : false;
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof loadTechnicianJobs>>>([]);
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadJobs = useCallback(
    async (context: MobileAppContext | null = appContext) => {
      if (!context) {
        return;
      }

      const result = await loadTechnicianJobs(context.companyId, context.userId, {
        status: undefined
      });
      setJobs(result);
    },
    [appContext, selectedFilter]
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
        const result = await loadTechnicianJobs(appContext.companyId, appContext.userId, {
          status: undefined
        });

        if (!isMounted) {
          return;
        }

        setJobs(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load assigned jobs.");
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
  }, [appContext, selectedFilter]);

  async function handleRefresh() {
    if (!appContext) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const nextContext = await refreshAppContext();
      await loadJobs(nextContext);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to refresh assigned jobs.");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return <LoadingState body="Loading your technician job queue." title="Loading jobs" />;
  }

  const filteredJobs = jobs.filter((job) => matchesFilter(job, selectedFilter));
  const featuredJob = getFeaturedJob(filteredJobs, selectedFilter);
  const queueJobs = featuredJob ? filteredJobs.filter((job) => job.id !== featuredJob.id) : filteredJobs;
  const queueGroups = getQueueGroups(queueJobs);

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge tone="info">{jobs.length} stops</Badge>
              {selectedFilter !== "all" ? <Badge tone="info">{formatFilterLabel(selectedFilter)}</Badge> : null}
              {canCreateJobs ? (
                <Chip compact onPress={() => router.push("/new-job" as never)} tone="brand">
                  New job
                </Chip>
              ) : null}
            </View>
          }
          compact
          description="Current stop first, then the rest of the day."
          eyebrow="My work"
          title="Assigned stops"
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
            body={`${unreadCount} dispatch update${unreadCount === 1 ? "" : "s"} are waiting outside the queue.`}
            title="Dispatch changed the day"
            tone="warning"
          />
        ) : null}

        <View style={{ gap: mobileTheme.spacing[2] }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {filters.map((filter) => (
                <Chip
                  compact
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  selected={filter === selectedFilter}
                  tone={
                    filter === "all"
                      ? "brand"
                      : filter === "completed"
                        ? "neutral"
                        : filter === "blocked"
                          ? "warning"
                          : "info"
                  }
                >
                  {formatFilterLabel(filter)}
                </Chip>
              ))}
            </View>
          </ScrollView>

          {filteredJobs.length ? (
            <View style={{ gap: mobileTheme.spacing[4] }}>
            {featuredJob ? (
              <View style={{ gap: mobileTheme.spacing[2] }}>
                <Text
                  style={{
                    color: mobileTheme.colors.brand.warm,
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase"
                  }}
                >
                  Current stop
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
                  {isTechnicianLiveJobStatus(featuredJob.status) ? "Resume work" : "Start next stop"}
                </Text>
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
                  eyebrow={isTechnicianLiveJobStatus(featuredJob.status) ? "Current assignment" : "Next assignment"}
                  layout="hero"
                  onPress={() => router.push(`/jobs/${featuredJob.id}`)}
                  title={formatJobTitleLabel(featuredJob.title)}
                  titleNumberOfLines={3}
                  tone="primary"
                />
              </View>
            ) : null}

            {queueJobs.length ? (
              <>
                {queueGroups.active.length ? (
                  <QueueSection eyebrow="Live now" title="Keep these moving">
                    <View style={{ gap: 12 }}>
                      {queueGroups.active.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onPress={() => router.push(`/jobs/${job.id}`)}
                          timeZone={appContext?.company.timezone}
                        />
                      ))}
                    </View>
                  </QueueSection>
                ) : null}

                {queueGroups.ready.length ? (
                  <QueueSection eyebrow="Queued next" title="Ready to roll">
                    <View style={{ gap: 12 }}>
                      {queueGroups.ready.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onPress={() => router.push(`/jobs/${job.id}`)}
                          timeZone={appContext?.company.timezone}
                        />
                      ))}
                    </View>
                  </QueueSection>
                ) : null}

                {queueGroups.blocked.length ? (
                  <QueueSection eyebrow="Needs attention" title="Blocked work">
                    <View style={{ gap: 12 }}>
                      {queueGroups.blocked.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onPress={() => router.push(`/jobs/${job.id}`)}
                          timeZone={appContext?.company.timezone}
                        />
                      ))}
                    </View>
                  </QueueSection>
                ) : null}

                {queueGroups.other.length ? (
                  <QueueSection eyebrow="Other queue" title="Additional stops">
                    <View style={{ gap: 12 }}>
                      {queueGroups.other.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onPress={() => router.push(`/jobs/${job.id}`)}
                          timeZone={appContext?.company.timezone}
                        />
                      ))}
                    </View>
                  </QueueSection>
                ) : null}

                {selectedFilter === "all" && queueGroups.completed.length ? (
                  <View style={{ gap: mobileTheme.spacing[2] }}>
                    <Text
                      style={{
                        color: mobileTheme.colors.brand.warm,
                        fontFamily: mobileTheme.typography.family.body,
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        textTransform: "uppercase"
                      }}
                    >
                      Done
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
                      Recently completed
                    </Text>
                    <View style={{ gap: 12 }}>
                      {queueGroups.completed.slice(0, 1).map((job) => (
                        <CompletedPreviewCard
                          key={job.id}
                          job={job}
                          onPress={() => router.push(`/jobs/${job.id}`)}
                        />
                      ))}
                    </View>
                    {queueGroups.completed.length > 1 ? (
                      <Text
                        style={{
                          color: mobileTheme.colors.text.subtle,
                          fontFamily: mobileTheme.typography.family.body,
                          fontSize: 13,
                          lineHeight: 18
                        }}
                      >
                        {queueGroups.completed.length - 1} more completed stop
                        {queueGroups.completed.length - 1 === 1 ? "" : "s"} in this view.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{ gap: mobileTheme.spacing[2] }}>
                <Text
                  style={{
                    color: mobileTheme.colors.brand.warm,
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase"
                  }}
                >
                  Queue
                </Text>
                <Notice
                  body={
                    featuredJob
                      ? "No other assigned stops are queued after the current assignment."
                      : "Assigned stops will appear here once dispatch adds work to your day."
                  }
                  tone="brand"
                />
              </View>
            )}
            </View>
          ) : (
            <EmptyState
              actions={selectedFilter !== "all" ? (
                <Button onPress={() => setSelectedFilter("all")} tone="secondary">
                  Clear filter
                </Button>
              ) : null}
              body="No assigned stops match the current filter. Pull to refresh if dispatch changed recently."
              eyebrow="Technician view"
              title="No matching stops"
            />
          )}
        </View>
      </ScreenScrollView>
    </Screen>
  );
}

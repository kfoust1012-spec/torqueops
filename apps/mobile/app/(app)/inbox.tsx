import { formatDateTime } from "@mobile-mechanic/core";
import { useRouter } from "expo-router";
import { RefreshControl, Text, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  EmptyState,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard
} from "../../src/components/ui";
import { useNotificationInbox } from "../../src/features/notifications/notification-inbox-provider";
import { useSessionContext } from "../../src/providers/session-provider";
import { mobileTheme } from "../../src/theme";

function formatInboxTypeLabel(type: "job_assigned" | "job_rescheduled" | "unknown") {
  switch (type) {
    case "job_assigned":
      return "New assignment";
    case "job_rescheduled":
      return "Timing update";
    case "unknown":
    default:
      return "Dispatch update";
  }
}

function formatInboxTimestamp(isoString: string, timeZone: string | undefined) {
  return formatDateTime(isoString, {
    includeTimeZoneName: false,
    timeZone
  });
}

function InboxSummaryRow({
  latestUpdateLabel,
  relatedStopCount,
  unreadCount
}: {
  latestUpdateLabel: string;
  relatedStopCount: number;
  unreadCount: number;
}) {
  const items = [
    { label: "Unread", value: `${unreadCount}` },
    { label: "Linked", value: `${relatedStopCount}` },
    { label: "Latest", value: latestUpdateLabel }
  ];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            borderRadius: mobileTheme.radius.pill,
            borderWidth: 1,
            borderColor: mobileTheme.colors.border.subtle,
            backgroundColor: mobileTheme.colors.surface.base,
            paddingHorizontal: mobileTheme.spacing[3],
            paddingVertical: mobileTheme.spacing[2],
            gap: 2
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
            numberOfLines={1}
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 14,
              fontWeight: "700",
              lineHeight: 17
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InboxExampleCard({
  body,
  eyebrow,
  title
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <View
      style={{
        borderRadius: mobileTheme.radius.xl,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border.subtle,
        backgroundColor: mobileTheme.colors.surface.subtle,
        padding: mobileTheme.spacing[4],
        gap: mobileTheme.spacing[2]
      }}
    >
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
          fontSize: 18,
          fontWeight: "700",
          lineHeight: 22
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: mobileTheme.colors.text.muted,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 14,
          lineHeight: 20
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { appContext } = useSessionContext();
  const { entries, isLoading, markAllRead, markRead, refreshInbox, unreadCount } = useNotificationInbox();

  const unreadEntries = entries.filter((entry) => !entry.readAt);
  const readEntries = entries.filter((entry) => Boolean(entry.readAt));
  const latestUnreadEntry = unreadEntries[0] ?? null;
  const remainingUnreadEntries = latestUnreadEntry ? unreadEntries.slice(1) : unreadEntries;
  const relatedStopCount = new Set(entries.map((entry) => entry.jobId).filter(Boolean)).size;
  const latestUpdateLabel = entries[0]
    ? formatInboxTimestamp(entries[0].createdAt, appContext?.company.timezone)
    : "Waiting on the next dispatch change";

  async function handleOpenEntry(entryId: string, path: string | null) {
    await markRead(entryId);

    if (path) {
      router.push(path as never);
    }
  }

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refreshInbox()} />}
      >
        <ScreenHeader
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Button fullWidth={false} onPress={() => router.push("/jobs" as never)} tone="secondary">
                Open My Work
              </Button>
              {unreadCount ? (
                <Button fullWidth={false} onPress={() => void markAllRead()} tone="tertiary">
                  Mark all read
                </Button>
              ) : null}
            </View>
          }
          compact
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge tone="info">{entries.length} updates</Badge>
              <Badge tone={unreadCount ? "warning" : "success"}>
                {unreadCount ? `${unreadCount} unread` : "All clear"}
              </Badge>
              {relatedStopCount ? <Badge tone="neutral">{relatedStopCount} linked stops</Badge> : null}
            </View>
          }
          description="Reopen the right stop without guessing what changed."
          eyebrow="Dispatch feed"
          title="Inbox"
        />

        <InboxSummaryRow
          latestUpdateLabel={entries.length ? latestUpdateLabel : "Quiet"}
          relatedStopCount={relatedStopCount}
          unreadCount={unreadCount}
        />

        {entries.length ? unreadCount ? (
          <Notice
            body="Unread dispatch changes stay above history so the right stop reopens fast."
            title="Needs attention"
            tone="warning"
          />
        ) : (
          <Notice
            body="Everything in the feed has already been reviewed."
            title="All clear"
            tone="brand"
          />
        ) : null}

        {entries.length ? (
          <View style={{ gap: 12 }}>
            {latestUnreadEntry ? (
              <SectionCard
                eyebrow="Act first"
                title="Latest unread update"
              >
                <ActionTile
                  badge={
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
                      <Badge tone="warning">{formatInboxTypeLabel(latestUnreadEntry.type)}</Badge>
                      {latestUnreadEntry.jobId ? <Badge tone="info">Linked stop</Badge> : null}
                    </View>
                  }
                  description={`${latestUnreadEntry.body} · ${formatInboxTimestamp(
                    latestUnreadEntry.createdAt,
                    appContext?.company.timezone
                  )}`}
                  descriptionNumberOfLines={4}
                  eyebrow="Newest unread"
                  onPress={() => void handleOpenEntry(latestUnreadEntry.id, latestUnreadEntry.path)}
                  title={latestUnreadEntry.title}
                  titleNumberOfLines={3}
                  tone="primary"
                />
              </SectionCard>
            ) : null}

            <SectionCard
              eyebrow="Unread queue"
              title={remainingUnreadEntries.length ? "Still waiting" : "No remaining unread updates"}
            >
              {remainingUnreadEntries.length ? (
                <View style={{ gap: 12 }}>
                  {remainingUnreadEntries.map((entry) => (
                    <ActionTile
                      key={entry.id}
                      badge={
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Badge tone="warning">{formatInboxTypeLabel(entry.type)}</Badge>
                          {entry.jobId ? <Badge tone="info">Linked stop</Badge> : null}
                        </View>
                      }
                      description={`${entry.body} · ${formatInboxTimestamp(entry.createdAt, appContext?.company.timezone)}`}
                      descriptionNumberOfLines={3}
                      eyebrow="Unread"
                      onPress={() => void handleOpenEntry(entry.id, entry.path)}
                      title={entry.title}
                      titleNumberOfLines={2}
                      tone="default"
                    />
                  ))}
                </View>
              ) : (
                <Notice
                  body="Everything here has already been reviewed."
                  title="All caught up"
                  tone="success"
                />
              )}
            </SectionCard>

            <SectionCard
              eyebrow="History"
              title="Dispatch history"
            >
              {readEntries.length ? (
                <View style={{ gap: 12 }}>
                  {readEntries.map((entry) => (
                    <ActionTile
                      key={entry.id}
                      badge={
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Badge tone="neutral">{formatInboxTypeLabel(entry.type)}</Badge>
                          <Badge tone="neutral">Read</Badge>
                        </View>
                      }
                      description={`${entry.body} · ${formatInboxTimestamp(entry.createdAt, appContext?.company.timezone)}`}
                      descriptionNumberOfLines={3}
                      eyebrow="History"
                      onPress={() => void handleOpenEntry(entry.id, entry.path)}
                      title={entry.title}
                      titleNumberOfLines={2}
                      tone="subtle"
                    />
                  ))}
                </View>
              ) : (
                <Notice
                  body="Reviewed dispatch changes will stay here as a same-day trail back to the right stop."
                  title="History will build here"
                  tone="info"
                />
              )}
            </SectionCard>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <SectionCard
              eyebrow="Quiet shift"
              surface="flat"
              title="Nothing is waiting"
            >
              <Notice body="Dispatch updates will land here as assignments and timing changes happen." tone="brand" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Button fullWidth={false} onPress={() => router.push("/jobs" as never)} tone="secondary">
                  Open My Work
                </Button>
                <Button fullWidth={false} onPress={() => router.push("/home" as never)} tone="tertiary">
                  Open Today
                </Button>
              </View>
            </SectionCard>

            <SectionCard
              eyebrow="What lands here"
              surface="flat"
              title="Expected updates"
            >
              <View style={{ gap: 10 }}>
                <InboxExampleCard
                  body="Reopen the right stop from the feed instead of hunting through the queue."
                  eyebrow="New assignment"
                  title="Dispatch added a stop"
                />
                <InboxExampleCard
                  body="Timing changes stay visible after the push banner disappears."
                  eyebrow="Timing update"
                  title="Dispatch moved the schedule"
                />
                <InboxExampleCard
                  body="Useful updates should take you back to the job in one tap."
                  eyebrow="Linked stop"
                  title="One tap back to the work"
                />
              </View>
            </SectionCard>
          </View>
        )}
      </ScreenScrollView>
    </Screen>
  );
}

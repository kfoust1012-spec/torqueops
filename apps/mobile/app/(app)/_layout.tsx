import { Redirect, Tabs, usePathname } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, ErrorState, LoadingState } from "../../src/components/ui";
import { NotificationInboxProvider, useNotificationInbox } from "../../src/features/notifications/notification-inbox-provider";
import { useSessionContext } from "../../src/providers/session-provider";
import { mobileTheme } from "../../src/theme";

type TabGlyphProps = {
  active: boolean;
  label: string;
};

function TabGlyph({ active, label }: TabGlyphProps) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: active ? 26 : 22,
        height: active ? 26 : 22,
        borderRadius: active ? 13 : 11,
        backgroundColor: active ? mobileTheme.colors.brand.strong : "transparent",
        borderWidth: 1,
        borderColor: active ? mobileTheme.colors.brand.strong : "transparent"
      }}
    >
      <Text
        style={{
          color: active ? mobileTheme.colors.text.inverse : mobileTheme.colors.text.muted,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 10,
          fontWeight: "700",
          lineHeight: 11
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function AppTabs() {
  const { unreadCount } = useNotificationInbox();
  const pathname = usePathname();
  const visibleTabRoutes = new Set(["/home", "/jobs", "/inbox", "/profile"]);
  const shouldHideTabBar = !visibleTabRoutes.has(pathname);

  const tabBarStyle = shouldHideTabBar
    ? {
        display: "none" as const
      }
    : {
        position: "absolute" as const,
        left: mobileTheme.spacing[4],
        right: mobileTheme.spacing[4],
        bottom: mobileTheme.spacing[2],
        height: 62,
        paddingBottom: 8,
        paddingTop: 8,
        paddingHorizontal: mobileTheme.spacing[2],
        borderRadius: mobileTheme.radius.xl,
        borderTopWidth: 0,
        backgroundColor: mobileTheme.colors.surface.raised,
        shadowColor: mobileTheme.shadow.raised.shadowColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 6
      };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mobileTheme.colors.brand.strong,
        tabBarInactiveTintColor: mobileTheme.colors.text.muted,
        tabBarStyle,
        tabBarItemStyle: {
          borderRadius: mobileTheme.radius.lg
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2
        },
        tabBarHideOnKeyboard: true
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <TabGlyph active={focused} label="T" />
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "My Work",
          tabBarIcon: ({ focused }) => <TabGlyph active={focused} label="W" />
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          tabBarIcon: ({ focused }) => <TabGlyph active={focused} label="I" />,
          ...(unreadCount > 0
            ? {
                tabBarBadge: `${Math.min(unreadCount, 9)}${unreadCount > 9 ? "+" : ""}`
              }
            : {}),
          title: "Inbox"
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabGlyph active={focused} label="P" />
        }}
      />
      <Tabs.Screen
        name="new-job"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}

export default function AppLayout() {
  const { appContext, appError, isLoading, session, refreshAppContext, signOutUser } = useSessionContext();

  if (isLoading) {
    return <LoadingState body="Loading technician workspace..." title="Loading workspace" />;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!appContext) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#f5f4ef", padding: 24, justifyContent: "center" }}
      >
        <ErrorState
          actions={
            <>
              <Button onPress={() => void refreshAppContext()} size="lg">
                Retry
              </Button>
              <Button onPress={() => void signOutUser()} size="lg" tone="secondary">
                Sign out
              </Button>
            </>
          }
          body={appError ?? "This account does not have technician job access yet."}
          eyebrow="Technician access"
          title="Mobile access is not ready"
        />
      </SafeAreaView>
    );
  }

  return (
    <NotificationInboxProvider>
      <AppTabs />
    </NotificationInboxProvider>
  );
}

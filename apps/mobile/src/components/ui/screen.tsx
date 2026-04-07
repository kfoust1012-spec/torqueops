import { forwardRef, type ComponentProps, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
  type ScrollViewProps,
  type ViewProps
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { createCardStyles, mobileLayoutStyles, mobileTheme, type MobileStatusTone } from "../../theme";
import { Card, CardCopy, CardTitle } from "./card";

type ScreenProps = ComponentProps<typeof SafeAreaView> & {
  children: ReactNode;
};

export function Screen({ children, style, ...props }: ScreenProps) {
  return (
    <SafeAreaView style={[mobileLayoutStyles.screen, style]} {...props}>
      <View style={mobileLayoutStyles.screenFrame}>{children}</View>
    </SafeAreaView>
  );
}

type ScreenScrollViewProps = ScrollViewProps & {
  children: ReactNode;
};

export const ScreenScrollView = forwardRef<ScrollView, ScreenScrollViewProps>(
  function ScreenScrollView(
    {
      children,
      contentContainerStyle,
      style,
      ...props
    },
    ref
  ) {
    return (
      <ScrollView
        contentContainerStyle={[mobileLayoutStyles.screenContent, contentContainerStyle]}
        ref={ref}
        style={[mobileLayoutStyles.screenScrollView, style]}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

type ScreenHeaderProps = {
  actions?: ReactNode;
  badges?: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  eyebrow?: string;
  title: string;
};

export function ScreenHeader({
  actions,
  badges,
  compact = false,
  description,
  eyebrow,
  title
}: ScreenHeaderProps) {
  return (
    <View
      style={[
        mobileLayoutStyles.pageHeader,
        {
          backgroundColor: mobileTheme.colors.surface.base,
          borderRadius: mobileTheme.radius.xl,
          borderWidth: 1,
          borderColor: mobileTheme.colors.border.subtle,
          padding: compact ? mobileTheme.spacing[3] : mobileTheme.spacing[5],
          gap: compact ? mobileTheme.spacing[1] : mobileTheme.spacing[3]
        }
      ]}
    >
      {eyebrow ? <Text style={mobileLayoutStyles.pageEyebrow}>{eyebrow}</Text> : null}
      <Text
        style={[
          mobileLayoutStyles.pageTitle,
          compact
            ? {
                fontSize: 23,
                lineHeight: 25
              }
            : null
        ]}
      >
        {title}
      </Text>
      {description ? (
        typeof description === "string" ? (
          <Text
            style={[
              mobileLayoutStyles.pageDescription,
              compact
                ? {
                    fontSize: 13,
                    lineHeight: 18
                  }
                : null
            ]}
          >
            {description}
          </Text>
        ) : (
          description
        )
      ) : null}
      {actions ? (
        <View
          style={[
            mobileLayoutStyles.actionRow,
            compact
              ? {
                  gap: mobileTheme.spacing[1]
                }
              : null
          ]}
        >
          {actions}
        </View>
      ) : null}
      {badges ? (
        <View
          style={[
            mobileLayoutStyles.actionRow,
            compact
              ? {
                  gap: mobileTheme.spacing[1]
                }
              : null
          ]}
        >
          {badges}
        </View>
      ) : null}
    </View>
  );
}

type MetricGridProps = ViewProps & {
  children: ReactNode;
};

export function MetricGrid({ children, style, ...props }: MetricGridProps) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: mobileTheme.spacing[3]
        },
        style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

type MetricCardProps = {
  label: string;
  meta?: string | undefined;
  value: ReactNode;
};

export function MetricCard({ label, meta, value }: MetricCardProps) {
  return (
    <Card
      style={{
        flex: 1,
        minWidth: 112,
        gap: mobileTheme.spacing[2]
      }}
      tone="subtle"
    >
      <Text
        style={{
          color: mobileTheme.colors.text.muted,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: mobileTheme.colors.text.strong,
          fontFamily: mobileTheme.typography.family.display,
          fontSize: 26,
          fontWeight: "700",
          lineHeight: 28
        }}
      >
        {value}
      </Text>
      {meta ? (
        <Text
          style={{
            color: mobileTheme.colors.text.muted,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 13,
            lineHeight: 18
          }}
        >
          {meta}
        </Text>
      ) : null}
    </Card>
  );
}

type ActionTileProps = {
  badge?: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
  description?: string | undefined;
  descriptionNumberOfLines?: number | undefined;
  eyebrow?: string | undefined;
  layout?: "default" | "hero";
  onPress: () => void;
  title: string;
  titleNumberOfLines?: number | undefined;
  tone?: "default" | "primary" | "subtle";
};

export function ActionTile({
  badge,
  cardStyle,
  description,
  descriptionNumberOfLines,
  eyebrow,
  layout = "default",
  onPress,
  title,
  titleNumberOfLines,
  tone = "default"
}: ActionTileProps) {
  const isPrimary = tone === "primary";
  const isSubtle = tone === "subtle";
  const isHero = layout === "hero";

  return (
    <Pressable
      onPress={onPress}
      style={[
        createCardStyles({ tone: isSubtle ? "subtle" : isPrimary ? "raised" : "default" }),
        {
          minHeight: isHero ? 168 : 112,
          gap: isHero ? mobileTheme.spacing[4] : mobileTheme.spacing[3],
          backgroundColor: isPrimary ? mobileTheme.colors.surface.inverse : undefined,
          padding: isHero ? mobileTheme.spacing[5] : undefined
        },
        cardStyle
      ]}
    >
      <View style={{ gap: isHero ? mobileTheme.spacing[3] : mobileTheme.spacing[2] }}>
        <View style={{ gap: mobileTheme.spacing[1], minWidth: 0 }}>
          {eyebrow ? (
            <Text
              style={{
                color: isPrimary ? "#d7e5f7" : mobileTheme.colors.brand.warm,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 1.1,
                textTransform: "uppercase"
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            numberOfLines={titleNumberOfLines}
            style={{
              color: isPrimary ? mobileTheme.colors.text.inverse : mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: isHero ? 28 : 24,
              fontWeight: "700",
              lineHeight: isHero ? 33 : 29
            }}
          >
            {title}
          </Text>
        </View>
        {badge ? (
          <View
            style={{
              alignItems: "flex-start",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: mobileTheme.spacing[2]
            }}
          >
            {badge}
          </View>
        ) : null}
      </View>
      {description ? (
        <Text
          numberOfLines={descriptionNumberOfLines}
          style={{
            color: isPrimary ? "#eef4fb" : mobileTheme.colors.text.muted,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: isHero ? 16 : 15,
            lineHeight: isHero ? 24 : 21
          }}
        >
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

type DetailRowProps = {
  label: string;
  value: ReactNode;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={{ gap: mobileTheme.spacing[1] }}>
      <Text
        style={{
          color: mobileTheme.colors.text.muted,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text
          style={{
            color: mobileTheme.colors.text.strong,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 15,
            lineHeight: 20
          }}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

type NoticeTone = MobileStatusTone | "brand";

type NoticeProps = {
  actions?: ReactNode;
  body: string;
  title?: string | undefined;
  tone?: NoticeTone | undefined;
};

export function Notice({ actions, body, title, tone = "warning" }: NoticeProps) {
  const palette =
    tone === "brand"
      ? {
          background: mobileTheme.colors.brand.soft,
          border: mobileTheme.colors.border.base,
          text: mobileTheme.colors.brand.strong
        }
      : {
          background: mobileTheme.status[tone].background,
          border: mobileTheme.status[tone].border,
          text: mobileTheme.status[tone].text
        };

  return (
    <View
      style={{
        borderRadius: mobileTheme.radius.xl,
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.border,
        padding: mobileTheme.spacing[5],
        gap: mobileTheme.spacing[2]
      }}
    >
      {title ? (
        <Text
          style={{
            color: palette.text,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 13,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase"
          }}
        >
          {title}
        </Text>
      ) : null}
      <Text
        style={{
          color: palette.text,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 15,
          lineHeight: 21
        }}
      >
        {body}
      </Text>
      {actions ? <View style={{ gap: mobileTheme.spacing[2] }}>{actions}</View> : null}
    </View>
  );
}

type SectionCardProps = {
  children: ReactNode;
  compact?: boolean;
  description?: string | undefined;
  eyebrow?: string | undefined;
  surface?: "card" | "flat";
  title: string;
};

export function SectionCard({
  children,
  compact = false,
  description,
  eyebrow,
  surface = "card",
  title
}: SectionCardProps) {
  const header = (
    <View style={{ gap: compact ? mobileTheme.spacing[1] : mobileTheme.spacing[2] }}>
      {eyebrow ? <Text style={mobileLayoutStyles.pageEyebrow}>{eyebrow}</Text> : null}
      {compact ? (
        <Text
          style={{
            color: mobileTheme.colors.text.strong,
            fontFamily: mobileTheme.typography.family.display,
            fontSize: 17,
            fontWeight: "700",
            lineHeight: 20
          }}
        >
          {title}
        </Text>
      ) : (
        <CardTitle>{title}</CardTitle>
      )}
      {description ? (
        compact ? (
          <Text
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 13,
              lineHeight: 18
            }}
          >
            {description}
          </Text>
        ) : (
          <CardCopy>{description}</CardCopy>
        )
      ) : null}
    </View>
  );

  if (surface === "flat") {
    return (
      <View style={{ gap: compact ? mobileTheme.spacing[3] : mobileTheme.spacing[4] }}>
        {header}
        <View style={{ gap: compact ? mobileTheme.spacing[2] : mobileTheme.spacing[3] }}>{children}</View>
      </View>
    );
  }

  return (
    <Card style={{ gap: compact ? mobileTheme.spacing[3] : mobileTheme.spacing[4] }}>
      {header}
      <View style={{ gap: compact ? mobileTheme.spacing[2] : mobileTheme.spacing[3] }}>{children}</View>
    </Card>
  );
}

type StickyActionDockProps = {
  children: ReactNode;
};

export function StickyActionDock({ children }: StickyActionDockProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: mobileTheme.colors.canvas.base,
        paddingHorizontal: mobileTheme.spacing[4],
        paddingTop: mobileTheme.spacing[1],
        paddingBottom: Math.max(insets.bottom, mobileTheme.spacing[4]) + mobileTheme.spacing[2]
      }}
    >
      <View
        style={[
          createCardStyles({ tone: "subtle" }),
          {
            gap: 10,
            paddingHorizontal: mobileTheme.spacing[3],
            paddingVertical: mobileTheme.spacing[2],
            shadowOpacity: 0,
            elevation: 0
          }
        ]}
      >
        {children}
      </View>
    </View>
  );
}

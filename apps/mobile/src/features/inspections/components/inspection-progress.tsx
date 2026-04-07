import { getInspectionProgressSummary } from "@mobile-mechanic/core";
import type { InspectionItem } from "@mobile-mechanic/types";
import { Text, View } from "react-native";

import { Badge, SectionCard } from "../../../components/ui";
import { mobileTheme } from "../../../theme";

type InspectionProgressProps = {
  items: InspectionItem[];
};

export function InspectionProgress({ items }: InspectionProgressProps) {
  const summary = getInspectionProgressSummary(items);
  const completionPercent = summary.totalCount
    ? Math.round((summary.completedCount / summary.totalCount) * 100)
    : 0;

  return (
    <SectionCard
      compact
      description="Track completion and unresolved issues before closing the inspection."
      eyebrow="Inspection"
      title="Progress"
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: mobileTheme.spacing[2]
        }}
      >
        <Text
          style={{
            color: mobileTheme.colors.text.strong,
            fontFamily: mobileTheme.typography.family.display,
            fontSize: 24,
            fontWeight: "700",
            lineHeight: 28
          }}
        >
          {completionPercent}%
        </Text>
        <Badge tone={summary.failCount ? "danger" : summary.requiredRemainingCount ? "warning" : "success"}>
          {summary.failCount
            ? `${summary.failCount} fail`
            : summary.requiredRemainingCount
              ? `${summary.requiredRemainingCount} required left`
              : "Ready to complete"}
        </Badge>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
        {[
          {
            label: "Checked",
            value: `${summary.completedCount}/${summary.totalCount}`
          },
          {
            label: "Fails",
            value: String(summary.failCount)
          },
          {
            label: "Required left",
            value: String(summary.requiredRemainingCount)
          }
        ].map((metric) => (
          <View
            key={metric.label}
            style={{
              backgroundColor: mobileTheme.colors.surface.base,
              borderRadius: mobileTheme.radius.lg,
              borderWidth: 1,
              borderColor: mobileTheme.colors.border.subtle,
              gap: 2,
              minWidth: 92,
              paddingHorizontal: mobileTheme.spacing[3],
              paddingVertical: mobileTheme.spacing[2]
            }}
          >
            <Text
              style={{
                color: mobileTheme.colors.text.muted,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.6,
                textTransform: "uppercase"
              }}
            >
              {metric.label}
            </Text>
            <Text
              style={{
                color: mobileTheme.colors.text.strong,
                fontFamily: mobileTheme.typography.family.display,
                fontSize: 20,
                fontWeight: "700",
                lineHeight: 22
              }}
            >
              {metric.value}
            </Text>
          </View>
        ))}
      </View>

      {summary.failCount ? (
        <View
          style={{
            backgroundColor: mobileTheme.status.danger.background,
            borderRadius: mobileTheme.radius.lg,
            borderWidth: 1,
            borderColor: mobileTheme.status.danger.border,
            gap: 4,
            paddingHorizontal: mobileTheme.spacing[3],
            paddingVertical: mobileTheme.spacing[2]
          }}
        >
          <Text
            style={{
              color: mobileTheme.status.danger.text,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase"
            }}
          >
            Failed items need follow-up
          </Text>
          <Text
            style={{
              color: mobileTheme.status.danger.text,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 13,
              lineHeight: 18
            }}
          >
            Review failed items before completing the inspection.
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

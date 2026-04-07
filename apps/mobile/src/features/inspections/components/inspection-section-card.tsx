import type { InspectionSection } from "@mobile-mechanic/types";
import { Pressable, Text, View } from "react-native";

import { Badge } from "../../../components/ui";
import { createCardStyles, mobileTheme } from "../../../theme";

type InspectionSectionCardProps = {
  isNextSection?: boolean | undefined;
  onPress: () => void;
  section: InspectionSection;
};

export function InspectionSectionCard({ isNextSection, onPress, section }: InspectionSectionCardProps) {
  const checkedCount = section.items.filter((item) => item.status !== "not_checked").length;
  const failCount = section.items.filter((item) => item.status === "fail").length;
  const attentionCount = section.items.filter((item) => item.status === "attention").length;
  const requiredRemainingCount = section.items.filter(
    (item) => item.isRequired && item.status === "not_checked"
  ).length;
  const isComplete = checkedCount === section.items.length;
  const nextItem =
    section.items.find((item) => item.isRequired && item.status === "not_checked") ??
    section.items.find((item) => item.status === "not_checked") ??
    section.items.find((item) => item.status === "fail" || item.status === "attention") ??
    null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        createCardStyles({ tone: failCount ? "raised" : "default" }),
        {
          gap: mobileTheme.spacing[2],
          paddingHorizontal: mobileTheme.spacing[3],
          paddingVertical: mobileTheme.spacing[3]
        }
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: mobileTheme.spacing[3]
        }}
      >
        <View style={{ flex: 1, gap: mobileTheme.spacing[1] }}>
          <Text
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: 18,
              fontWeight: "700",
              lineHeight: 21
            }}
          >
            {section.title}
          </Text>
          <Text
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 14,
              lineHeight: 19
            }}
          >
            {checkedCount} of {section.items.length} items checked
          </Text>
        </View>
        <Badge tone={isComplete ? "success" : requiredRemainingCount ? "warning" : "info"}>
          {isComplete ? "Complete" : requiredRemainingCount ? `${requiredRemainingCount} left` : "In progress"}
        </Badge>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
        {isNextSection ? <Badge tone="info">Up next</Badge> : null}
        {failCount ? <Badge tone="danger">{failCount} fail</Badge> : null}
        {attentionCount ? <Badge tone="warning">{attentionCount} attention</Badge> : null}
        {requiredRemainingCount ? <Badge tone="warning">{requiredRemainingCount} required left</Badge> : null}
      </View>

      {nextItem ? (
        <Text
          style={{
            color: mobileTheme.colors.text.muted,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 13,
            lineHeight: 18
          }}
        >
          {nextItem.status === "not_checked" ? `Next item: ${nextItem.label}` : `Review: ${nextItem.label}`}
        </Text>
      ) : null}

      <Text
        style={{
          color: mobileTheme.colors.brand.strong,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 13,
          fontWeight: "700"
        }}
      >
        {isComplete ? "Review section" : "Continue section"}
      </Text>
    </Pressable>
  );
}

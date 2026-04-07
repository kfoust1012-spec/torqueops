import type { TechnicianJobListItem } from "@mobile-mechanic/types";
import { Pressable, Text, View } from "react-native";

import { PriorityBadge, StatusBadge } from "../../../components/ui";
import { createCardStyles, mobileTheme } from "../../../theme";
import {
  formatArrivalWindow,
  formatJobDateTime,
  formatJobTitleLabel,
  formatJobStatusLabel
} from "../mappers";

type JobCardProps = {
  job: TechnicianJobListItem;
  onPress: () => void;
  timeZone?: string | undefined;
};

export function JobCard({ job, onPress, timeZone }: JobCardProps) {
  const arrivalWindow = formatArrivalWindow(job.arrivalWindowStartAt, job.arrivalWindowEndAt, timeZone);
  const location = job.serviceSiteSummary ?? job.addressSummary ?? "No service location";
  const metaLabelStyle = {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const
  };
  const metaValueStyle = {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 15,
    lineHeight: 20
  };

  return (
    <Pressable
      onPress={onPress}
      style={[
        createCardStyles({ tone: "raised" }),
        {
          gap: mobileTheme.spacing[4]
        }
      ]}
    >
      <View style={{ gap: mobileTheme.spacing[3] }}>
        <View
          style={{
            alignItems: "flex-start",
            gap: mobileTheme.spacing[2]
          }}
        >
          <Text
            style={{
              color: mobileTheme.colors.brand.warm,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 1,
              textTransform: "uppercase"
            }}
          >
            {formatJobStatusLabel(job.status)}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: mobileTheme.spacing[2]
            }}
          >
            <PriorityBadge value={job.priority} />
            <StatusBadge status={job.status} />
          </View>
        </View>

        <View style={{ gap: mobileTheme.spacing[2], minWidth: 0 }}>
          <Text
            numberOfLines={3}
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: 21,
              fontWeight: "700",
              lineHeight: 26
            }}
          >
            {formatJobTitleLabel(job.title)}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 14,
              lineHeight: 20
            }}
          >
            {job.customerDisplayName} · {job.vehicleDisplayName}
          </Text>
        </View>
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: mobileTheme.colors.border.subtle,
          paddingTop: mobileTheme.spacing[3],
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: mobileTheme.spacing[4],
          rowGap: mobileTheme.spacing[3]
        }}
      >
        <View style={{ flex: 1, minWidth: 132, gap: mobileTheme.spacing[1] }}>
          <Text style={metaLabelStyle}>Scheduled</Text>
          <Text style={metaValueStyle}>{formatJobDateTime(job.scheduledStartAt, timeZone)}</Text>
        </View>

        <View style={{ flex: 1, minWidth: 132, gap: mobileTheme.spacing[1] }}>
          <Text style={metaLabelStyle}>Arrival window</Text>
          <Text style={metaValueStyle}>{arrivalWindow ?? "No arrival window"}</Text>
        </View>

        <View style={{ width: "100%", gap: mobileTheme.spacing[1] }}>
          <Text style={metaLabelStyle}>Location</Text>
          <Text numberOfLines={2} style={metaValueStyle}>
            {location}
          </Text>
        </View>
      </View>

      <Text
        style={{
          color: mobileTheme.colors.brand.strong,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 13,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        Open stop
      </Text>
    </Pressable>
  );
}

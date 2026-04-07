import type { ReactNode } from "react";
import { Text, View } from "react-native";

import {
  formatDesignLabel,
  formatDesignStatusLabel,
  resolveDesignPriorityTone,
  resolveDesignReminderStageTone,
  resolveDesignSeverityTone
} from "@mobile-mechanic/core";

import { createStatusBadgeStyles, getMobileStatusTone, type MobileStatusTone } from "../../theme";

type BadgeProps = {
  children: ReactNode;
  tone: MobileStatusTone;
};

export function Badge({ children, tone }: BadgeProps) {
  const styles = createStatusBadgeStyles(tone);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge tone={getMobileStatusTone(status)}>{formatDesignStatusLabel(status)}</Badge>;
}

type SemanticBadgeProps = {
  label?: string | undefined;
  value: string;
};

export function SeverityBadge({ label, value }: SemanticBadgeProps) {
  return <Badge tone={resolveDesignSeverityTone(value)}>{label ?? formatDesignLabel(value)}</Badge>;
}

export function PriorityBadge({ label, value }: SemanticBadgeProps) {
  return <Badge tone={resolveDesignPriorityTone(value)}>{label ?? formatDesignLabel(value)}</Badge>;
}

export function ReminderStageBadge({ label, value }: SemanticBadgeProps) {
  return (
    <Badge tone={resolveDesignReminderStageTone(value)}>{label ?? formatDesignLabel(value)}</Badge>
  );
}

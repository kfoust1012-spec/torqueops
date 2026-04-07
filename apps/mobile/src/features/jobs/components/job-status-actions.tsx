import type { JobStatus, TechnicianAllowedStatus } from "@mobile-mechanic/types";
import { Text, View } from "react-native";

import { Button } from "../../../components/ui";
import { getTechnicianStatusActions, getTechnicianStatusActionLabel } from "../status";

type JobStatusActionsProps = {
  busyStatus?: TechnicianAllowedStatus | null;
  compact?: boolean | undefined;
  currentStatus: JobStatus;
  disabledReasons?: Partial<Record<TechnicianAllowedStatus, string>> | undefined;
  isBusy: boolean;
  onChangeStatus: (status: TechnicianAllowedStatus) => void;
};

export function JobStatusActions({
  busyStatus = null,
  compact = false,
  currentStatus,
  disabledReasons = {},
  isBusy,
  onChangeStatus
}: JobStatusActionsProps) {
  const actions = getTechnicianStatusActions(currentStatus);
  const enabledActions = actions.filter((status) => !disabledReasons[status]);
  const disabledActions = actions.filter((status) => Boolean(disabledReasons[status]));
  const firstDisabledAction = disabledActions[0] ?? null;

  if (!actions.length) {
    return null;
  }

  return (
    <View style={{ gap: compact ? 10 : 12 }}>
      {(compact ? enabledActions : actions).map((status) => {
        const disabledReason = disabledReasons[status];

        return (
          <View key={status} style={{ gap: compact ? 4 : 6 }}>
            <Button
              disabled={isBusy || Boolean(disabledReason)}
              fullWidth={!compact}
              loading={busyStatus === status}
              onPress={() => onChangeStatus(status)}
              size={compact ? "sm" : "lg"}
              tone={status === "completed" ? "success" : "primary"}
            >
              {busyStatus === status ? "Saving..." : getTechnicianStatusActionLabel(status)}
            </Button>
            {disabledReason ? (
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: compact ? 12 : 13,
                  lineHeight: compact ? 16 : 18
                }}
              >
                {disabledReason}
              </Text>
            ) : null}
          </View>
        );
      })}
      {compact && firstDisabledAction ? (
        <View
          style={{
            backgroundColor: "#f7f3ec",
            borderColor: "#d9cfbf",
            borderRadius: 18,
            borderWidth: 1,
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 10
          }}
        >
          <Text
            style={{
              color: "#9a6230",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase"
            }}
          >
            Unavailable now
          </Text>
          <Text style={{ color: "#374151", fontSize: 13, lineHeight: 17 }}>
            {disabledActions.map((status) => getTechnicianStatusActionLabel(status)).join(" • ")}
          </Text>
          <Text style={{ color: "#6b7280", fontSize: 12, lineHeight: 16 }}>
            {disabledReasons[firstDisabledAction]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

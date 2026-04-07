import type { FindingSeverity, InspectionItem, InspectionItemStatus } from "@mobile-mechanic/types";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  formatFindingSeverityLabel,
  formatInspectionItemStatusLabel,
  getInspectionCompletionLabel
} from "../mappers";
import {
  Badge,
  Button,
  Chip,
  DictationButton,
  Field,
  Input,
  Notice,
  StatusBadge
} from "../../../components/ui";
import { Card, CardCopy, CardTitle } from "../../../components/ui";
import { mobileTheme } from "../../../theme";
import {
  inspectionPhrases,
  mechanicActionPhrases,
  mergeDictationContext
} from "../../voice/dictation-context";

type InspectionItemEditorProps = {
  isBusy: boolean;
  isCompleted: boolean;
  isNextTarget?: boolean | undefined;
  item: InspectionItem;
  onSave: (input: {
    status: InspectionItemStatus;
    findingSeverity: FindingSeverity | null;
    technicianNotes: string | null;
    recommendation: string | null;
  }) => Promise<void>;
};

const statusOptions: InspectionItemStatus[] = ["pass", "attention", "fail", "not_checked"];
const severityOptions: FindingSeverity[] = ["low", "medium", "high", "critical"];

function buildInspectionNoteChoices(status: InspectionItemStatus) {
  switch (status) {
    case "pass":
      return ["No issues found.", "Checked and operating normally."] as const;
    case "attention":
      return ["Monitor condition.", "Service recommended soon."] as const;
    case "fail":
      return ["Repair required before release.", "Unsafe condition found."] as const;
    case "not_checked":
    default:
      return ["Item not checked during visit."] as const;
  }
}

function buildInspectionRecommendationChoices(status: InspectionItemStatus) {
  switch (status) {
    case "pass":
      return ["No repair needed at this time."] as const;
    case "attention":
      return ["Recommend service at next visit.", "Recommend customer approval for follow-up repair."] as const;
    case "fail":
      return ["Recommend immediate repair.", "Recommend replacement before vehicle returns to service."] as const;
    case "not_checked":
    default:
      return ["Reinspect on follow-up visit."] as const;
  }
}

export function InspectionItemEditor({
  isBusy,
  isCompleted,
  isNextTarget,
  item,
  onSave
}: InspectionItemEditorProps) {
  const [status, setStatus] = useState<InspectionItemStatus>(item.status);
  const [findingSeverity, setFindingSeverity] = useState<FindingSeverity | null>(
    item.findingSeverity
  );
  const [technicianNotes, setTechnicianNotes] = useState(item.technicianNotes ?? "");
  const [recommendation, setRecommendation] = useState(item.recommendation ?? "");
  const [isCollapsed, setIsCollapsed] = useState(
    item.status === "pass" && !item.findingSeverity && !item.technicianNotes && !item.recommendation
  );
  const [showDetails, setShowDetails] = useState(
    Boolean(item.technicianNotes || item.recommendation || item.status === "attention" || item.status === "fail")
  );

  useEffect(() => {
    setStatus(item.status);
    setFindingSeverity(item.findingSeverity);
    setTechnicianNotes(item.technicianNotes ?? "");
    setRecommendation(item.recommendation ?? "");
    setShowDetails(
      Boolean(
        item.technicianNotes || item.recommendation || item.status === "attention" || item.status === "fail"
      )
    );
    setIsCollapsed(
      !isNextTarget &&
        item.status === "pass" &&
        !item.findingSeverity &&
        !item.technicianNotes &&
        !item.recommendation
    );
  }, [
    isNextTarget,
    item.findingSeverity,
    item.id,
    item.recommendation,
    item.status,
    item.technicianNotes
  ]);

  const requiresSeverity = status === "attention" || status === "fail";
  const saveDisabled =
    isBusy ||
    (requiresSeverity && !findingSeverity) ||
    (status === "fail" &&
      !technicianNotes.trim().length &&
      !recommendation.trim().length);

  function getStatusTone(value: InspectionItemStatus) {
    switch (value) {
      case "pass":
        return "success" as const;
      case "attention":
        return "warning" as const;
      case "fail":
        return "danger" as const;
      default:
        return "neutral" as const;
    }
  }

  function getSeverityTone(value: FindingSeverity) {
    switch (value) {
      case "low":
        return "neutral" as const;
      case "medium":
        return "warning" as const;
      case "high":
      case "critical":
        return "danger" as const;
    }
  }

  const validationMessage =
    requiresSeverity && !findingSeverity
      ? "Choose a severity before saving an attention or fail result."
      : status === "fail" && !technicianNotes.trim().length && !recommendation.trim().length
        ? "Add notes or a recommendation before saving a failed item."
        : null;
  const quickNoteChoices = buildInspectionNoteChoices(status);
  const quickRecommendationChoices = buildInspectionRecommendationChoices(status);
  const canQuickPass =
    !isCompleted &&
    !isBusy &&
    item.status === "not_checked" &&
    status === "not_checked" &&
    !findingSeverity &&
    !technicianNotes.trim().length &&
    !recommendation.trim().length;
  const isSimplePass =
    status === "pass" &&
    !findingSeverity &&
    !technicianNotes.trim().length &&
    !recommendation.trim().length;
  const showCompactPassRow = !isCompleted && isCollapsed && isSimplePass;
  const showCompletionSummary =
    status !== "not_checked" || Boolean(findingSeverity) || Boolean(technicianNotes.trim()) || Boolean(recommendation.trim());
  const hasChosenResult = status !== "not_checked";

  function saveQuickPass() {
    void onSave({
      status: "pass",
      findingSeverity: null,
      technicianNotes: null,
      recommendation: null
    });
  }

  if (showCompactPassRow) {
    return (
      <Card
        style={{
          gap: mobileTheme.spacing[2],
          paddingHorizontal: mobileTheme.spacing[3],
          paddingVertical: mobileTheme.spacing[3]
        }}
        tone="subtle"
      >
        <View style={{ gap: mobileTheme.spacing[2] }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: mobileTheme.spacing[2]
            }}
          >
            <StatusBadge status="pass" />
            {item.isRequired ? <Badge tone="warning">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
            <Badge tone="success">Saved pass</Badge>
          </View>
          <Text
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: 18,
              fontWeight: "700",
              lineHeight: 21
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 14,
              lineHeight: 19
            }}
          >
            Checked and passed. Expand only if you need to change the result or add detail.
          </Text>
          <Button fullWidth={false} onPress={() => setIsCollapsed(false)} size="sm" tone="secondary">
            Adjust result
          </Button>
        </View>
      </Card>
    );
  }

  return (
    <Card
      style={{
        gap: mobileTheme.spacing[2],
        paddingHorizontal: mobileTheme.spacing[3],
        paddingVertical: mobileTheme.spacing[3]
      }}
      tone={status === "fail" ? "raised" : isNextTarget ? "raised" : status === "not_checked" ? "default" : "subtle"}
    >
      <View style={{ gap: mobileTheme.spacing[1] }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: mobileTheme.spacing[2]
          }}
        >
          <StatusBadge status={status} />
          {item.isRequired ? <Badge tone="warning">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
          {isNextTarget ? <Badge tone="info">Next up</Badge> : null}
          {findingSeverity ? <Badge tone={getSeverityTone(findingSeverity)}>{formatFindingSeverityLabel(findingSeverity)}</Badge> : null}
        </View>
        <Text
          style={{
            color: mobileTheme.colors.text.strong,
            fontFamily: mobileTheme.typography.family.display,
            fontSize: 18,
            fontWeight: "700",
            lineHeight: 21
          }}
        >
          {item.label}
        </Text>
        {showCompletionSummary ? (
          <Text
            style={{
              color: mobileTheme.colors.text.muted,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 14,
              lineHeight: 19
            }}
          >
            {getInspectionCompletionLabel({
              ...item,
              status,
              findingSeverity
            })}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: mobileTheme.spacing[1] }}>
        <Text
          style={{
            color: mobileTheme.colors.text.subtle,
            fontFamily: mobileTheme.typography.family.body,
            fontSize: 12,
            fontWeight: "700"
          }}
        >
          Result
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
          {(hasChosenResult ? statusOptions : statusOptions.filter((option) => option !== "not_checked")).map((option) => {
            const selected = option === status;

            return (
              <Chip
                key={option}
                disabled={isCompleted}
                onPress={
                  isCompleted
                    ? undefined
                    : () => {
                        if (canQuickPass && option === "pass") {
                          saveQuickPass();
                          return;
                        }

                        setStatus(option);

                        if (!["attention", "fail"].includes(option)) {
                          setFindingSeverity(null);
                        }
                        if (option === "attention" || option === "fail") {
                          setShowDetails(true);
                        }
                      }
                }
                compact
                selected={selected}
                tone={getStatusTone(option)}
              >
                {formatInspectionItemStatusLabel(option)}
              </Chip>
            );
          })}
        </View>
      </View>

      {requiresSeverity ? (
        <View style={{ gap: mobileTheme.spacing[1] }}>
          <Text
            style={{
              color: mobileTheme.colors.text.subtle,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 12,
              fontWeight: "700"
            }}
          >
            Severity
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
            {severityOptions.map((option) => {
              const selected = option === findingSeverity;

              return (
                <Chip
                  key={option}
                  disabled={isCompleted}
                  compact
                  onPress={isCompleted ? undefined : () => setFindingSeverity(option)}
                  selected={selected}
                  tone={getSeverityTone(option)}
                >
                  {formatFindingSeverityLabel(option)}
                </Chip>
              );
            })}
          </View>
        </View>
      ) : null}

      {!isCompleted && hasChosenResult ? (
        <Pressable onPress={() => setShowDetails((current) => !current)}>
          <Text
            style={{
              color: mobileTheme.colors.brand.strong,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 13,
              fontWeight: "700"
            }}
          >
            {showDetails ? "Hide extra detail" : "Add notes and recommendation"}
          </Text>
        </Pressable>
      ) : null}

      {showDetails ? (
        <View style={{ gap: mobileTheme.spacing[2] }}>
          <Field
            hint="Explain the finding for office review."
            label="Technician notes"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
              {quickNoteChoices.map((choice) => (
                <Chip
                  compact
                  key={choice}
                  disabled={isCompleted}
                  onPress={isCompleted ? undefined : () => setTechnicianNotes(choice)}
                  selected={technicianNotes.trim() === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
            <Input
              editable={!isCompleted}
              multiline
              onChangeText={setTechnicianNotes}
              placeholder="Add field notes for office review"
              placeholderTextColor="#9ca3af"
              value={technicianNotes}
            />
            <DictationButton
              contextualStrings={mergeDictationContext(
                [item.label],
                quickNoteChoices,
                inspectionPhrases,
                mechanicActionPhrases
              )}
              label="Dictate inspection note"
              onChangeText={setTechnicianNotes}
              value={technicianNotes}
            />
          </Field>

          <Field
            hint="Recommended follow-up or repair."
            label="Recommendation"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
              {quickRecommendationChoices.map((choice) => (
                <Chip
                  compact
                  key={choice}
                  disabled={isCompleted}
                  onPress={isCompleted ? undefined : () => setRecommendation(choice)}
                  selected={recommendation.trim() === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
            <Input
              editable={!isCompleted}
              multiline
              onChangeText={setRecommendation}
              placeholder="Recommended follow-up or repair"
              placeholderTextColor="#9ca3af"
              value={recommendation}
            />
            <DictationButton
              contextualStrings={mergeDictationContext(
                [item.label],
                quickRecommendationChoices,
                inspectionPhrases,
                mechanicActionPhrases
              )}
              label="Dictate recommendation"
              onChangeText={setRecommendation}
              value={recommendation}
            />
          </Field>
        </View>
      ) : null}

      {validationMessage ? <Notice body={validationMessage} tone="warning" /> : null}

      {!isCompleted && hasChosenResult ? (
        <Button
          disabled={saveDisabled}
          loading={isBusy}
          onPress={() =>
            void onSave({
              status,
              findingSeverity: findingSeverity ?? null,
              technicianNotes: technicianNotes.trim() ? technicianNotes : null,
              recommendation: recommendation.trim() ? recommendation : null
            })
          }
          size="sm"
          tone={status === "fail" ? "danger" : "primary"}
        >
          Save result
        </Button>
      ) : null}
    </Card>
  );
}

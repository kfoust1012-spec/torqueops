import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { mobileStateStyles, mobileTheme } from "../../theme";

type BaseStateProps = {
  actions?: ReactNode;
  body: string;
  eyebrow?: string;
  title: string;
};

export function EmptyState({ actions, body, eyebrow, title }: BaseStateProps) {
  return (
    <View style={mobileStateStyles.stateCard}>
      {eyebrow ? <Text style={mobileStateStyles.stateEyebrow}>{eyebrow}</Text> : null}
      <Text style={mobileStateStyles.stateTitle}>{title}</Text>
      <Text style={mobileStateStyles.stateCopy}>{body}</Text>
      {actions ? <View style={mobileStateStyles.stateActions}>{actions}</View> : null}
    </View>
  );
}

export function ErrorState({ actions, body, eyebrow, title }: BaseStateProps) {
  return (
    <View style={[mobileStateStyles.stateCard, mobileStateStyles.stateCardError]}>
      {eyebrow ? (
        <Text style={[mobileStateStyles.stateEyebrow, mobileStateStyles.stateEyebrowError]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={mobileStateStyles.stateTitle}>{title}</Text>
      <Text style={mobileStateStyles.stateCopy}>{body}</Text>
      {actions ? <View style={mobileStateStyles.stateActions}>{actions}</View> : null}
    </View>
  );
}

type LoadingStateProps = {
  body?: string | undefined;
  title?: string | undefined;
};

export function LoadingState({
  body = "Please wait while the latest technician workspace data loads.",
  title = "Loading"
}: LoadingStateProps) {
  return (
    <View style={mobileStateStyles.centeredScreen}>
      <View style={[mobileStateStyles.stateCard, mobileStateStyles.stateCardCentered]}>
        <ActivityIndicator color={mobileTheme.colors.brand.strong} size="large" />
        <Text style={mobileStateStyles.stateTitle}>{title}</Text>
        <Text style={[mobileStateStyles.stateCopy, mobileStateStyles.stateCopyCentered]}>{body}</Text>
      </View>
    </View>
  );
}

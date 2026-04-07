import type { ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";

import { createCardStyles, mobileTheme } from "../../theme";

type CardTone = "default" | "raised" | "subtle";

type CardProps = ViewProps & {
  children: ReactNode;
  padded?: boolean | undefined;
  tone?: CardTone | undefined;
};

export function Card({ children, padded = true, style, tone = "default", ...props }: CardProps) {
  return (
    <View style={[createCardStyles({ padded, tone }), style]} {...props}>
      {children}
    </View>
  );
}

type CardTitleProps = {
  children: ReactNode;
};

export function CardTitle({ children }: CardTitleProps) {
  return (
    <Text
      style={{
        color: mobileTheme.colors.text.strong,
        fontFamily: mobileTheme.typography.family.display,
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 22
      }}
    >
      {children}
    </Text>
  );
}

type CardCopyProps = {
  children: ReactNode;
};

export function CardCopy({ children }: CardCopyProps) {
  return (
    <Text
      style={{
        color: mobileTheme.colors.text.muted,
        fontFamily: mobileTheme.typography.family.body,
        fontSize: 15,
        lineHeight: 21
      }}
    >
      {children}
    </Text>
  );
}

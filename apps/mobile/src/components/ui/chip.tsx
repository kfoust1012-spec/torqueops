import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { mobileTheme, type MobileStatusTone } from "../../theme";

type ChipTone = MobileStatusTone | "brand";

type ChipProps = {
  children: ReactNode;
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
  onPress?: (() => void) | undefined;
  selected?: boolean | undefined;
  tone?: ChipTone | undefined;
};

export function Chip({
  children,
  compact = false,
  disabled = false,
  onPress,
  selected = false,
  tone = "neutral"
}: ChipProps) {
  const palette =
    tone === "brand"
      ? {
          background: mobileTheme.colors.brand.soft,
          border: mobileTheme.colors.border.base,
          text: mobileTheme.colors.brand.strong,
          solid: mobileTheme.colors.brand.strong,
          solidText: mobileTheme.colors.text.inverse
        }
      : mobileTheme.status[tone];

  const content = (
    <View
      style={{
        minHeight: compact ? 36 : 44,
        borderRadius: mobileTheme.radius.pill,
        paddingHorizontal: compact ? mobileTheme.spacing[3] : mobileTheme.spacing[4],
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? palette.solid : palette.background,
        borderWidth: 1,
        borderColor: selected ? "transparent" : palette.border,
        opacity: disabled ? 0.6 : 1
      }}
    >
      <Text
        style={{
          color: selected ? palette.solidText : palette.text,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: compact ? 13 : 14,
          fontWeight: "700"
        }}
      >
        {children}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable disabled={disabled} onPress={onPress}>
      {content}
    </Pressable>
  );
}

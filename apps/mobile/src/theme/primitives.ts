import type { TextStyle, ViewStyle } from "react-native";

import { mobileTheme, type MobileStatusTone } from "./tokens";

export type MobileButtonTone = "primary" | "secondary" | "tertiary" | "danger" | "success";
export type MobileButtonSize = "sm" | "md" | "lg";
export type MobileCardTone = "default" | "raised" | "subtle";

type ButtonStyleOptions = {
  disabled?: boolean | undefined;
  fullWidth?: boolean | undefined;
  size?: MobileButtonSize | undefined;
  tone?: MobileButtonTone | undefined;
};

type CardStyleOptions = {
  padded?: boolean | undefined;
  tone?: MobileCardTone | undefined;
};

type InputStyleOptions = {
  invalid?: boolean | undefined;
  multiline?: boolean | undefined;
};

const buttonMinHeight: Record<MobileButtonSize, number> = {
  sm: 40,
  md: 48,
  lg: 54
};

const mobileMaxContentWidth = mobileTheme.layout.measure;

const buttonTones: Record<
  MobileButtonTone,
  {
    backgroundColor: string;
    borderColor: string;
    borderWidth?: number | undefined;
    textColor: string;
  }
> = {
  primary: {
    backgroundColor: mobileTheme.colors.brand.strong,
    borderColor: "transparent",
    textColor: mobileTheme.colors.text.inverse
  },
  secondary: {
    backgroundColor: mobileTheme.colors.surface.raised,
    borderColor: mobileTheme.colors.border.base,
    borderWidth: 1,
    textColor: mobileTheme.colors.text.strong
  },
  tertiary: {
    backgroundColor: mobileTheme.colors.surface.subtle,
    borderColor: mobileTheme.colors.border.subtle,
    borderWidth: 1,
    textColor: mobileTheme.colors.brand.strong
  },
  danger: {
    backgroundColor: mobileTheme.status.danger.solid,
    borderColor: "transparent",
    textColor: mobileTheme.status.danger.solidText
  },
  success: {
    backgroundColor: mobileTheme.status.success.solid,
    borderColor: "transparent",
    textColor: mobileTheme.status.success.solidText
  }
};

export function createButtonStyles({
  disabled,
  fullWidth = true,
  size = "md",
  tone = "primary"
}: ButtonStyleOptions = {}) {
  const palette = buttonTones[tone];

  return {
    button: {
      minHeight: buttonMinHeight[size],
      borderRadius: mobileTheme.radius.xl,
      paddingHorizontal:
        size === "lg"
          ? mobileTheme.spacing[5]
          : size === "sm"
            ? mobileTheme.spacing[3]
            : mobileTheme.spacing[4],
      flexDirection: "row",
      gap: mobileTheme.spacing[2],
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.backgroundColor,
      borderColor: palette.borderColor,
      borderWidth: palette.borderWidth ?? 0,
      opacity: disabled ? 0.6 : 1,
      alignSelf: fullWidth ? "stretch" : "flex-start"
    } satisfies ViewStyle,
    text: {
      color: palette.textColor,
      fontFamily: mobileTheme.typography.family.body,
      fontSize: size === "lg" ? 15 : size === "sm" ? 13 : 14,
      fontWeight: "700"
    } satisfies TextStyle
  };
}

export function createCardStyles({ padded = true, tone = "default" }: CardStyleOptions = {}) {
  const backgroundColor =
    tone === "subtle" ? mobileTheme.colors.surface.subtle : mobileTheme.colors.surface.raised;
  const borderColor =
    tone === "subtle" ? mobileTheme.colors.border.base : mobileTheme.colors.border.subtle;

  return {
    borderRadius: mobileTheme.radius.xl,
    backgroundColor,
    borderWidth: 1,
    borderColor,
    padding: padded ? mobileTheme.spacing[5] : 0,
    ...(tone === "raised" ? mobileTheme.shadow.raised : tone === "default" ? mobileTheme.shadow.card : null)
  } satisfies ViewStyle;
}

export function createInputStyles({ invalid, multiline }: InputStyleOptions = {}) {
  return {
    input: {
      minHeight: multiline ? 120 : 52,
      borderRadius: mobileTheme.radius.xl,
      borderWidth: 1,
      borderColor: invalid ? mobileTheme.status.danger.text : mobileTheme.colors.border.base,
      backgroundColor: invalid ? "#fff8f7" : mobileTheme.colors.surface.base,
      paddingHorizontal: mobileTheme.spacing[4],
      paddingVertical: multiline ? mobileTheme.spacing[4] : mobileTheme.spacing[3],
      color: mobileTheme.colors.text.strong,
      fontFamily: mobileTheme.typography.family.body,
      fontSize: 15,
      textAlignVertical: multiline ? "top" : "center"
    } satisfies TextStyle
  };
}

export function createStatusBadgeStyles(tone: MobileStatusTone) {
  const palette = mobileTheme.status[tone];

  return {
    container: {
      minHeight: 28,
      borderRadius: mobileTheme.radius.pill,
      paddingHorizontal: mobileTheme.spacing[2],
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.border
    } satisfies ViewStyle,
    text: {
      color: palette.text,
      fontFamily: mobileTheme.typography.family.body,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase"
    } satisfies TextStyle
  };
}

export const mobileLayoutStyles = {
  screen: {
    flex: 1,
    backgroundColor: mobileTheme.colors.canvas.base
  } satisfies ViewStyle,
  screenFrame: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    maxWidth: mobileMaxContentWidth
  } satisfies ViewStyle,
  screenScrollView: {
    flex: 1,
    width: "100%"
  } satisfies ViewStyle,
  screenContent: {
    width: "100%",
    padding: mobileTheme.spacing[5],
    paddingBottom: mobileTheme.spacing[7],
    gap: mobileTheme.spacing[4]
  } satisfies ViewStyle,
  pageHeader: {
    gap: mobileTheme.spacing[2]
  } satisfies ViewStyle,
  pageEyebrow: {
    color: mobileTheme.colors.brand.warm,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  } satisfies TextStyle,
  pageTitle: {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.display,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 30
  } satisfies TextStyle,
  pageDescription: {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 15,
    lineHeight: 21
  } satisfies TextStyle,
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  stickyFooter: {
    paddingTop: mobileTheme.spacing[4],
    paddingBottom: mobileTheme.spacing[5],
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  sectionStack: {
    gap: mobileTheme.spacing[4]
  } satisfies ViewStyle
} as const;

export const mobileFormStyles = {
  field: {
    gap: mobileTheme.spacing[2]
  } satisfies ViewStyle,
  label: {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 13,
    fontWeight: "700"
  } satisfies TextStyle,
  hint: {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 13,
    lineHeight: 18
  } satisfies TextStyle,
  error: {
    color: mobileTheme.status.danger.text,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 13,
    fontWeight: "700"
  } satisfies TextStyle,
  section: {
    gap: mobileTheme.spacing[4]
  } satisfies ViewStyle,
  sectionTitle: {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.display,
    fontSize: 20,
    fontWeight: "700"
  } satisfies TextStyle,
  sectionDescription: {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 14,
    lineHeight: 20
  } satisfies TextStyle
} as const;

export const mobileListStyles = {
  list: {
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  item: {
    ...createCardStyles(),
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: mobileTheme.spacing[3],
    alignItems: "flex-start"
  } satisfies ViewStyle,
  itemTitle: {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.display,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22
  } satisfies TextStyle,
  itemCopy: {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 14,
    lineHeight: 20
  } satisfies TextStyle
} as const;

export const mobileStateStyles = {
  centeredScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileTheme.colors.canvas.base,
    padding: mobileTheme.spacing[5]
  } satisfies ViewStyle,
  stateCard: {
    ...createCardStyles({ tone: "raised" }),
    width: "100%",
    maxWidth: 480,
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  stateCardError: {
    borderColor: mobileTheme.status.danger.border,
    backgroundColor: "#fff7f6"
  } satisfies ViewStyle,
  stateCardCentered: {
    alignItems: "center"
  } satisfies ViewStyle,
  stateEyebrow: {
    color: mobileTheme.colors.brand.warm,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  } satisfies TextStyle,
  stateEyebrowError: {
    color: mobileTheme.status.danger.text
  } satisfies TextStyle,
  stateTitle: {
    color: mobileTheme.colors.text.strong,
    fontFamily: mobileTheme.typography.family.display,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30
  } satisfies TextStyle,
  stateCopy: {
    color: mobileTheme.colors.text.muted,
    fontFamily: mobileTheme.typography.family.body,
    fontSize: 15,
    lineHeight: 21
  } satisfies TextStyle,
  stateActions: {
    gap: mobileTheme.spacing[3]
  } satisfies ViewStyle,
  stateCopyCentered: {
    textAlign: "center"
  } satisfies TextStyle
} as const;

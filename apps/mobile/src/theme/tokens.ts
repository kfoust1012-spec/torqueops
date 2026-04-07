import {
  designStatusTones,
  designTokens,
  resolveDesignStatusTone,
  type DesignStatusTone
} from "@mobile-mechanic/core";
import { Platform } from "react-native";

const mobilePalette = {
  canvas: {
    base: "#efe7da",
    elevated: "#f6f0e6",
    sunken: "#e4dacb"
  },
  surface: {
    base: "#fbf7f1",
    raised: "#fffdf9",
    subtle: "#f2e9dc",
    inverse: "#193041"
  },
  text: {
    strong: "#15202b",
    base: "#374556",
    muted: "#59687a",
    subtle: "#6f7d8d",
    inverse: "#fffdf8"
  },
  border: {
    subtle: "#d9cfbf",
    base: "#c8baa5",
    strong: "#ae9f88"
  },
  brand: {
    strong: "#1f3a4f",
    base: "#30526c",
    warm: "#9a6230",
    soft: "#e0ebf4",
    focus: "rgba(31, 58, 79, 0.16)"
  }
} as const;

const mobileTypographyFamily = Platform.select({
  ios: {
    display: "Avenir Next Condensed",
    body: "Avenir Next",
    mono: "Menlo"
  },
  android: {
    display: "sans-serif-condensed",
    body: "sans-serif",
    mono: "monospace"
  },
  default: {
    display: "System",
    body: "System",
    mono: "Courier"
  }
})!;

export const mobileTheme = {
  colors: {
    canvas: mobilePalette.canvas,
    surface: mobilePalette.surface,
    text: mobilePalette.text,
    border: mobilePalette.border,
    brand: mobilePalette.brand
  },
  spacing: designTokens.spacing,
  radius: designTokens.radius,
  typography: {
    ...designTokens.typography,
    family: mobileTypographyFamily
  },
  layout: designTokens.layout,
  status: designStatusTones,
  shadow: {
    card: {
      elevation: 3,
      shadowColor: "#15202b",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 24
    },
    raised: {
      elevation: 5,
      shadowColor: "#15202b",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.12,
      shadowRadius: 32
    }
  }
} as const;

export type MobileStatusTone = DesignStatusTone;

export function getMobileStatusTone(status: string | null | undefined) {
  return resolveDesignStatusTone(status);
}

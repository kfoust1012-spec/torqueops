import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { createButtonStyles } from "../../theme";

type MobileButtonTone = "primary" | "secondary" | "tertiary" | "danger" | "success";
type MobileButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  fullWidth?: boolean | undefined;
  loading?: boolean | undefined;
  size?: MobileButtonSize | undefined;
  tone?: MobileButtonTone | undefined;
};

export function Button({
  children,
  disabled,
  fullWidth,
  loading,
  size,
  tone,
  ...props
}: ButtonProps) {
  const styles = createButtonStyles({
    disabled: disabled || loading,
    fullWidth,
    size,
    tone
  });

  return (
    <Pressable disabled={disabled || loading} style={styles.button} {...props}>
      {loading ? <ActivityIndicator color={styles.text.color} size="small" /> : null}
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

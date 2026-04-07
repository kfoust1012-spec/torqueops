import type { ReactNode } from "react";
import { Text, TextInput, View, type TextInputProps, type ViewProps } from "react-native";

import { createInputStyles, mobileFormStyles } from "../../theme";

type FieldProps = ViewProps & {
  children: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  label?: string | undefined;
};

export function Field({ children, error, hint, label, style, ...props }: FieldProps) {
  return (
    <View style={[mobileFormStyles.field, style]} {...props}>
      {label ? <Text style={mobileFormStyles.label}>{label}</Text> : null}
      {children}
      {hint ? <Text style={mobileFormStyles.hint}>{hint}</Text> : null}
      {error ? <Text style={mobileFormStyles.error}>{error}</Text> : null}
    </View>
  );
}

type InputProps = TextInputProps & {
  invalid?: boolean | undefined;
};

export function Input({ invalid, multiline, style, ...props }: InputProps) {
  const styles = createInputStyles({ invalid, multiline });

  return <TextInput multiline={multiline} style={[styles.input, style]} {...props} />;
}

import { signInWithPassword } from "@mobile-mechanic/api-client";
import { loginInputSchema } from "@mobile-mechanic/validation";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { Button, Card, CardCopy, CardTitle, Field, Input, Notice, Screen } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setErrorMessage(null);

    const parsed = loginInputSchema.safeParse({ email, password });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await signInWithPassword(supabase, parsed.data);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace("/home");
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <Card tone="raised" style={{ gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: "#8b5e34",
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 1.4
              }}
            >
              TECHNICIAN APP
            </Text>
            <CardTitle>Sign in to assigned jobs</CardTitle>
            <CardCopy>
              Open assigned work, contact the customer, navigate to the vehicle, and keep field updates current from one place.
            </CardCopy>
          </View>

          {errorMessage ? (
            <Notice body={errorMessage} title="Sign-in failed" tone="danger" />
          ) : null}

          <View style={{ gap: 16 }}>
            <Field label="Email">
              <Input
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="tech@shop.com"
                placeholderTextColor="#9ca3af"
                value={email}
              />
            </Field>

            <Field label="Password">
              <Input
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
              />
            </Field>
          </View>

          <Button loading={isSubmitting} onPress={() => void handleSignIn()} size="lg">
            Sign in
          </Button>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

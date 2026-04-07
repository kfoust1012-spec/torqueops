import "react-native-gesture-handler";
import "@expo/metro-runtime";
import "../src/features/location/background-location-task";

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider } from "../src/providers/session-provider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

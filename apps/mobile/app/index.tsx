import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useSessionContext } from "../src/providers/session-provider";

export default function IndexScreen() {
  const { isLoading, session } = useSessionContext();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f4ef"
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/home" : "/login"} />;
}

import { Redirect } from "expo-router";

import { useSessionContext } from "../src/providers/session-provider";

export default function DashboardRedirectScreen() {
  const { session } = useSessionContext();

  return <Redirect href={session ? "/home" : "/login"} />;
}

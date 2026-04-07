import type { LoginInput } from "@mobile-mechanic/types";
import { loginInputSchema } from "@mobile-mechanic/validation";

import type { AppSupabaseClient } from "./types";

export async function signInWithPassword(client: AppSupabaseClient, input: LoginInput) {
  const credentials = loginInputSchema.parse(input);

  return client.auth.signInWithPassword(credentials);
}

export async function signOut(client: AppSupabaseClient) {
  return client.auth.signOut();
}

export async function getCurrentSession(client: AppSupabaseClient) {
  return client.auth.getSession();
}

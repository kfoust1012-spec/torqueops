import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";

import type { Database } from "@mobile-mechanic/types";

import { parseSupabaseClientEnv } from "../env";
import type { AppSupabaseClient } from "./types";

type CreateAppSupabaseClientInput = {
  supabaseUrl: string;
  supabaseKey: string;
  options?: SupabaseClientOptions<"public">;
};

export function createAppSupabaseClient(input: CreateAppSupabaseClientInput): AppSupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = parseSupabaseClientEnv({
    supabaseUrl: input.supabaseUrl,
    supabaseAnonKey: input.supabaseKey
  });

  return createClient<Database>(supabaseUrl, supabaseAnonKey, input.options);
}

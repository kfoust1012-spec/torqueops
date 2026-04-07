import { supabaseClientEnvSchema } from "@mobile-mechanic/validation";

export type SupabaseClientEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function parseSupabaseClientEnv(env: unknown): SupabaseClientEnv {
  return supabaseClientEnvSchema.parse(env);
}

import { createAppSupabaseClient } from "@mobile-mechanic/api-client";

import { webEnv } from "../env";
import { getSupabaseServiceRoleKey } from "../server-env";

let serviceRoleClient: ReturnType<typeof createAppSupabaseClient> | null = null;

export function createServiceRoleSupabaseClient() {
  return createAppSupabaseClient({
    supabaseUrl: webEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: getSupabaseServiceRoleKey(),
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  });
}

export function getServiceRoleSupabaseClient() {
  if (!serviceRoleClient) {
    serviceRoleClient = createServiceRoleSupabaseClient();
  }

  return serviceRoleClient;
}

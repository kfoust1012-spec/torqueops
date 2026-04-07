import type { Database } from "@mobile-mechanic/types";
import { createBrowserClient } from "@supabase/ssr";

import { webEnv } from "../env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      webEnv.NEXT_PUBLIC_SUPABASE_URL,
      webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  return browserClient;
}

import type { Database } from "@mobile-mechanic/types";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { webEnv } from "../env";
import { createServerComponentCookieAdapter } from "./cookies";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    webEnv.NEXT_PUBLIC_SUPABASE_URL,
    webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: createServerComponentCookieAdapter(cookieStore)
    }
  );
}

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@mobile-mechanic/types";

export type AppSupabaseClient = SupabaseClient<Database>;
export type AppSession = Session;
export type AppUser = User;

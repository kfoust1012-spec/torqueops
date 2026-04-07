import "react-native-url-polyfill/auto";

import { createAppSupabaseClient } from "@mobile-mechanic/api-client";

import { mobileEnv } from "../env";
import { clientStorage } from "./client-storage";

const secureStoreAdapter = {
  getItem: (key: string) => clientStorage.getItem(key),
  setItem: (key: string, value: string) => clientStorage.setItem(key, value),
  removeItem: (key: string) => clientStorage.removeItem(key)
};

export const supabase = createAppSupabaseClient({
  supabaseUrl: mobileEnv.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  options: {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
});

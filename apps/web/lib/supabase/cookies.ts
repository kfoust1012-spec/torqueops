import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

type ResponseCookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];
type ServerCookieStore = Awaited<ReturnType<typeof cookies>>;
type ServerCookieOptions = Parameters<ServerCookieStore["set"]>[2];

type CookieWrite<TOptions> = {
  name: string;
  value: string;
  options?: TOptions;
};

export function createRequestResponseCookieAdapter(
  requestCookies: NextRequest["cookies"],
  responseCookies: NextResponse["cookies"]
) {
  return {
    getAll() {
      return requestCookies.getAll();
    },
    setAll(cookiesToSet: CookieWrite<ResponseCookieOptions>[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        requestCookies.set(name, value);

        if (options) {
          responseCookies.set(name, value, options);
          return;
        }

        responseCookies.set(name, value);
      });
    }
  };
}

export function createServerComponentCookieAdapter(cookieStore: ServerCookieStore) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: CookieWrite<ServerCookieOptions>[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (options) {
            cookieStore.set(name, value, options);
            return;
          }

          cookieStore.set(name, value);
        });
      } catch {
        // Server components can read cookies but may not be allowed to write them.
      }
    }
  };
}

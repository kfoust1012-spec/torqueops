import { describe, expect, it } from "vitest";
import {
  assertLocalSupabasePortsReady,
  getConfiguredSupabasePortChecks,
  isHealthySupabaseStatus
} from "./local-supabase-guard.mjs";

describe("getConfiguredSupabasePortChecks", () => {
  it("extracts the configured local Supabase ports from config.toml content", () => {
    const checks = getConfiguredSupabasePortChecks({
      configText: `
[api]
port = 54321

[db]
port = 54322

[studio]
port = 54323

[inbucket]
port = 54324
`
    });

    expect(checks).toEqual([
      { port: 54321, purpose: "Supabase API", section: "api" },
      { port: 54322, purpose: "Supabase Postgres", section: "db" },
      { port: 54323, purpose: "Supabase Studio", section: "studio" },
      { port: 54324, purpose: "Supabase Mailpit", section: "inbucket" }
    ]);
  });
});

describe("isHealthySupabaseStatus", () => {
  const portChecks = [
    { port: 54321, purpose: "Supabase API", section: "api" },
    { port: 54322, purpose: "Supabase Postgres", section: "db" },
    { port: 54323, purpose: "Supabase Studio", section: "studio" },
    { port: 54324, purpose: "Supabase Mailpit", section: "inbucket" }
  ];

  it("accepts a healthy local status that matches the configured ports", () => {
    expect(
      isHealthySupabaseStatus(
        {
          API_URL: "http://127.0.0.1:54321",
          DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
          INBUCKET_URL: "http://127.0.0.1:54324",
          STUDIO_URL: "http://127.0.0.1:54323"
        },
        portChecks
      )
    ).toBe(true);
  });

  it("rejects status output that does not match the configured ports", () => {
    expect(
      isHealthySupabaseStatus(
        {
          API_URL: "http://127.0.0.1:54321",
          DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
          INBUCKET_URL: "http://127.0.0.1:54330",
          STUDIO_URL: "http://127.0.0.1:54323"
        },
        portChecks
      )
    ).toBe(false);
  });
});

describe("assertLocalSupabasePortsReady", () => {
  it("passes when ports are occupied by the healthy expected local stack", async () => {
    await expect(
      assertLocalSupabasePortsReady({
        getSupabaseStatusSummary: async () => ({
          error: null,
          status: {
            API_URL: "http://127.0.0.1:54321",
            DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
            INBUCKET_URL: "http://127.0.0.1:54324",
            STUDIO_URL: "http://127.0.0.1:54323"
          }
        }),
        inspectPortChecks: async () => [
          {
            listeners: [{ pid: 1234, processName: "docker-proxy" }],
            port: 54321,
            purpose: "Supabase API",
            section: "api"
          }
        ],
        portChecks: [
          { port: 54321, purpose: "Supabase API", section: "api" },
          { port: 54322, purpose: "Supabase Postgres", section: "db" },
          { port: 54323, purpose: "Supabase Studio", section: "studio" },
          { port: 54324, purpose: "Supabase Mailpit", section: "inbucket" }
        ]
      })
    ).resolves.toBeUndefined();
  });

  it("fails with a clear diagnostic when ports are occupied by the wrong services", async () => {
    const error = await assertLocalSupabasePortsReady({
      getSupabaseStatusSummary: async () => ({
        error: "supabase status could not connect to the expected local project",
        status: null
      }),
      inspectPortChecks: async () => [
        {
          listeners: [{ pid: 4321, processName: "postgres" }],
          port: 54322,
          purpose: "Supabase Postgres",
          section: "db"
        }
      ],
      portChecks: [
        { port: 54321, purpose: "Supabase API", section: "api" },
        { port: 54322, purpose: "Supabase Postgres", section: "db" }
      ]
    }).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Local Supabase preflight failed because required Supabase ports are already in use but the expected project stack is not healthy.");
    expect(error.message).toContain("Port 54322 for Supabase Postgres");
    expect(error.message).toContain("Supabase CLI status check: supabase status could not connect to the expected local project");
    expect(error.message).toContain("run `pnpm db:stop` before rerunning");
  });
});

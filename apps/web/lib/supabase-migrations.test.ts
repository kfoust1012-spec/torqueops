import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations"
);

function readMigrationVersions() {
  return readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => fileName.split("_", 1)[0])
    .sort();
}

describe("supabase migration versions", () => {
  it("stay unique and prefix-safe for Supabase CLI reconciliation", () => {
    const versions = readMigrationVersions();
    const collisions: string[] = [];

    for (let index = 0; index < versions.length; index += 1) {
      const version = versions[index];

      if (!version) {
        continue;
      }

      for (let otherIndex = index + 1; otherIndex < versions.length; otherIndex += 1) {
        const other = versions[otherIndex];

        if (other && other.startsWith(version)) {
          collisions.push(`${version} -> ${other}`);
        }
      }
    }

    expect(new Set(versions).size).toBe(versions.length);
    expect(collisions).toEqual([]);
  });
});

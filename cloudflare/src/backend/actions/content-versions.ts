import type { BackendDatabase, JsonRecord } from "./types.ts";

export type ContentVersionDomain = "issues" | "announcements" | "facilities";
export type ContentVersions = Record<ContentVersionDomain, number>;

const EMPTY_VERSIONS: ContentVersions = {
  announcements: 1,
  facilities: 1,
  issues: 1,
};

export async function loadContentVersions(database: BackendDatabase): Promise<ContentVersions> {
  const { data, error } = await database
    .table("app_private", "content_versions")
    .select("domain,version");
  if (error) throw error;
  const versions = { ...EMPTY_VERSIONS };
  for (const row of data ?? []) {
    const domain = String(row.domain);
    if (domain === "announcements" || domain === "facilities" || domain === "issues") {
      versions[domain] = Math.max(1, Number(row.version));
    }
  }
  return versions;
}

export async function loadContentVersion(
  database: BackendDatabase,
  domain: ContentVersionDomain,
) {
  const versions = await loadContentVersions(database);
  return versions[domain];
}

export function attachContentVersion(value: unknown, version: number) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
  return { ...record, version };
}

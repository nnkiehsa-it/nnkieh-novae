import { createHash } from "node:crypto";

export function canonicalizeMigrationSource(source) {
  return source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}

export function migrationChecksum(source) {
  return createHash("sha256")
    .update(canonicalizeMigrationSource(source))
    .digest("hex");
}

export function resolveAppliedMigrationChecksum(name, source, existing) {
  const checksum = migrationChecksum(source);
  if (!existing || existing === checksum) {
    return checksum;
  }
  throw new Error(`Applied migration checksum changed: ${name}`);
}

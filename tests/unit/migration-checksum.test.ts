import { describe, expect, it } from "vitest";
import {
  canonicalizeMigrationSource,
  migrationChecksum,
  resolveAppliedMigrationChecksum,
} from "../../scripts/migration-checksum.mjs";

describe("migration checksums", () => {
  it("ignores BOM and platform line endings", () => {
    const lf = "select 1;\nselect 2;\n";
    const crlf = "\uFEFFselect 1;\r\nselect 2;\r\n";
    const mixed = "select 1;\r\nselect 2;\n";

    expect(canonicalizeMigrationSource(crlf)).toBe(lf);
    expect(migrationChecksum(crlf)).toBe(migrationChecksum(lf));
    expect(migrationChecksum(mixed)).toBe(migrationChecksum(lf));
  });

  it("hashes new migration names without registration", () => {
    const source = "create table future_table (id bigint primary key);\r\n";
    const expected = migrationChecksum(source);
    expect(resolveAppliedMigrationChecksum("9999_future_change.sql", source)).toBe(expected);
    expect(resolveAppliedMigrationChecksum("9999_future_change.sql", source, expected)).toBe(expected);
  });

  it("rejects changes to an applied migration", () => {
    const source = "select 1;\n";
    const appliedChecksum = migrationChecksum(source);
    expect(() => resolveAppliedMigrationChecksum(
      "9999_future_change.sql",
      `${source}select 2;\n`,
      appliedChecksum,
    )).toThrow(/Applied migration checksum changed/u);
  });
});

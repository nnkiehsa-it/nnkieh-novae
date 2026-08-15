import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeMigrationSource,
  migrationChecksum,
  resolveAppliedMigrationChecksum,
} from "../../scripts/migration-checksum.mjs";

test("migration checksums ignore BOM and platform line endings", () => {
  const lf = "select 1;\nselect 2;\n";
  const crlf = "\uFEFFselect 1;\r\nselect 2;\r\n";
  const mixed = "select 1;\r\nselect 2;\n";

  assert.equal(canonicalizeMigrationSource(crlf), lf);
  assert.equal(migrationChecksum(crlf), migrationChecksum(lf));
  assert.equal(migrationChecksum(mixed), migrationChecksum(lf));
});

test("any new migration filename uses canonical hashing without registration", () => {
  const source = "create table future_table (id bigint primary key);\r\n";
  const expected = migrationChecksum(source);

  assert.equal(
    resolveAppliedMigrationChecksum("9999_future_change.sql", source),
    expected,
  );
  assert.equal(
    resolveAppliedMigrationChecksum(
      "9999_future_change.sql",
      source,
      expected,
    ),
    expected,
  );
});

test("an actual applied migration content change remains rejected", () => {
  const source = "select 1;\n";
  const appliedChecksum = migrationChecksum(source);

  assert.throws(
    () =>
      resolveAppliedMigrationChecksum(
        "9999_future_change.sql",
        `${source}select 2;\n`,
        appliedChecksum,
      ),
    /Applied migration checksum changed/u,
  );
});

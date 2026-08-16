import { describe, expect, it } from "vitest";
import { AppDatabaseClient } from "../../cloudflare/src/backend/database/client.ts";

interface TestPool {
  connect(): Promise<{ release(): void }>;
  end(): Promise<void>;
  query(): Promise<{ rows: Array<Record<string, unknown>> }>;
}

describe("AppDatabaseClient", () => {
  it("allows independent queries to overlap", async () => {
    const database = new AppDatabaseClient("postgresql://unused");
    const pool = (database as unknown as { pool: TestPool }).pool;
    let activeQueries = 0;
    let peakQueries = 0;

    pool.connect = async () => ({ release() {} });
    pool.end = async () => {};
    pool.query = async () => {
      activeQueries += 1;
      peakQueries = Math.max(peakQueries, activeQueries);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeQueries -= 1;
      return { rows: [] };
    };

    await Promise.all([
      database.table("app_private", "user_profiles").select("uid").limit(1),
      database.table("app_private", "user_profiles").select("uid").limit(1),
    ]);
    await database.close();

    expect(peakQueries).toBe(2);
  });
});

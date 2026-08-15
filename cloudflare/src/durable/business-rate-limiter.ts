import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types";

export interface DurableRateLimitClaim {
  errorCode: string;
  expiresAtMs: number;
  key: string;
  limit: number;
  units: number;
}

export interface DurableRateLimitResult {
  errorCode?: string;
  retryAfterSeconds?: number;
  success: boolean;
}

interface StoredRateLimit extends Record<string, SqlStorageValue> {
  expires_at: number;
  units: number;
}

export class BusinessRateLimiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        units INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits(expires_at);
    `);
  }

  claim(claims: DurableRateLimitClaim[]): DurableRateLimitResult {
    const now = Date.now();
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("DELETE FROM rate_limits WHERE expires_at <= ?", now);
      const pending: Array<DurableRateLimitClaim & { nextUnits: number }> = [];
      for (const claim of claims) {
        const current = this.ctx.storage.sql
          .exec<StoredRateLimit>("SELECT units, expires_at FROM rate_limits WHERE key = ?", claim.key)
          .toArray()[0];
        const nextUnits = (current?.units ?? 0) + claim.units;
        if (nextUnits > claim.limit) {
          return {
            errorCode: claim.errorCode,
            retryAfterSeconds: Math.max(1, Math.ceil((claim.expiresAtMs - now) / 1000)),
            success: false,
          };
        }
        pending.push({ ...claim, nextUnits });
      }
      for (const claim of pending) {
        this.ctx.storage.sql.exec(
          `INSERT INTO rate_limits(key, units, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET units = excluded.units, expires_at = excluded.expires_at`,
          claim.key,
          claim.nextUnits,
          claim.expiresAtMs,
        );
      }
      return { success: true };
    });
  }
}

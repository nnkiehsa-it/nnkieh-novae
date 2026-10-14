import { describe, expect, it, vi } from 'vitest';
import { getOperationPolicies, getOperationsQueue } from '../../cloudflare/src/backend/actions/operations';
import type { AuthContext, BackendDatabase } from '../../cloudflare/src/backend/actions/types';
import { DEFAULT_OPERATION_POLICIES } from "../../shared/operation-policies.ts";

const administrator = { isAdmin: true } as AuthContext;
const member = { isAdmin: false } as AuthContext;

describe('operations console reads', () => {
  it('refreshes the complete queue without capacity or policy queries', async () => {
    const sql = vi.fn().mockResolvedValue({ rows: [] });
    const sqlOne = vi.fn();
    const result = await getOperationsQueue({ page: 2 }, administrator, { sql, sqlOne } as unknown as BackendDatabase);
    expect(Object.keys(result).sort()).toEqual(['cleanupBacklog', 'deliveries', 'errors', 'failedDeliveries', 'hasMore', 'jobs', 'sampledAt']);
    expect(sql).toHaveBeenCalledTimes(5);
    expect(sqlOne).not.toHaveBeenCalled();
    expect(sql.mock.calls.map(([query]) => query.join('')).join(' ')).not.toMatch(/pg_stat|operational_metrics|operation_policy/);
    expect(sql.mock.calls.some((call) => call.includes(200))).toBe(true);
    await expect(getOperationsQueue({ page: 0 }, member, { sql } as unknown as BackendDatabase)).rejects.toThrow('permission-denied');
  });

  it('reads policies and history without running any system-monitoring queries', async () => {
    const settings = { revision: 3, values: DEFAULT_OPERATION_POLICIES };
    const sqlOne = vi.fn().mockResolvedValue({ value: JSON.stringify(settings) });
    const sql = vi.fn().mockResolvedValue({ rows: [{ id: 1, revision: 3 }] });
    const result = await getOperationPolicies({}, administrator, { sql, sqlOne } as unknown as BackendDatabase);
    expect(result).toEqual({ settings, history: [{ id: 1, revision: 3 }] });
    expect(sqlOne).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0].join('')).toContain('operation_policy_history');
    await expect(getOperationPolicies({}, member, { sql, sqlOne } as unknown as BackendDatabase)).rejects.toThrow('permission-denied');
  });
});

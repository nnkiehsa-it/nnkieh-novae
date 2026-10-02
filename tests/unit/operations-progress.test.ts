import { describe, expect, it, vi } from 'vitest';
import { handleOperationsAction } from '../../cloudflare/src/backend/actions/operations';
import type { AuthContext, BackendDatabase } from '../../cloudflare/src/backend/actions/types';
import { DEFAULT_OPERATION_POLICIES } from '../../cloudflare/generated/operations';

describe('operations progress', () => {
  it('reads only the jobs page, without capacity, history or diagnostic queries', async () => {
    const sql = vi.fn().mockResolvedValue({ rows: [{ id: 'job', status: 'processing' }] });
    const database = { sql } as unknown as BackendDatabase;
    const result = await handleOperationsAction('getOperationsConsole', { page: 2, progressOnly: true },
      { isAdmin: true } as AuthContext, database);
    expect(result).toEqual({ jobs: [{ id: 'job', status: 'processing' }] });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][1]).toBe(200);
    expect(sql.mock.calls[0][0].join('')).toContain('app_private.background_jobs');
  });

  it('keeps progress behind the same administrator boundary', async () => {
    const sql = vi.fn();
    await expect(handleOperationsAction('getOperationsConsole', { progressOnly: true },
      { isAdmin: false } as AuthContext, { sql } as unknown as BackendDatabase))
      .rejects.toThrow('permission-denied');
    expect(sql).not.toHaveBeenCalled();
  });

  it('refreshes the complete queue without capacity or policy queries', async () => {
    const sql = vi.fn().mockResolvedValue({ rows: [] });
    const sqlOne = vi.fn();
    const result = await handleOperationsAction('getOperationsConsole', { page: 2, queueOnly: true },
      { isAdmin: true } as AuthContext, { sql, sqlOne } as unknown as BackendDatabase);
    const panels: Record<string, unknown> = {};
    for await (const panel of result as AsyncIterable<{ key: string; data: unknown }>) panels[panel.key] = panel.data;
    expect(Object.keys(panels).sort()).toEqual(['cleanupBacklog', 'deliveries', 'errors', 'failedDeliveries', 'hasMore', 'jobs', 'sampledAt']);
    expect(sql).toHaveBeenCalledTimes(5);
    expect(sqlOne).not.toHaveBeenCalled();
    expect(sql.mock.calls.map(([query]) => query.join('')).join(' ')).not.toMatch(/pg_stat|operational_metrics|operation_policy/);
    await expect(handleOperationsAction('getOperationsConsole', { queueOnly: true },
      { isAdmin: false } as AuthContext, { sql } as unknown as BackendDatabase)).rejects.toThrow('permission-denied');
  });

  it('reads policies and history without running any system-monitoring queries', async () => {
    const settings = { revision: 3, values: DEFAULT_OPERATION_POLICIES };
    const sqlOne = vi.fn().mockResolvedValue({ value: JSON.stringify(settings) });
    const sql = vi.fn().mockResolvedValue({ rows: [{ id: 1, revision: 3 }] });
    const result = await handleOperationsAction('getOperationsConsole', { policiesOnly: true },
      { isAdmin: true } as AuthContext, { sql, sqlOne } as unknown as BackendDatabase);
    expect(result).toEqual({ settings, history: [{ id: 1, revision: 3 }] });
    expect(sqlOne).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0].join('')).toContain('operation_policy_history');
    await expect(handleOperationsAction('getOperationsConsole', { policiesOnly: true },
      { isAdmin: false } as AuthContext, { sql, sqlOne } as unknown as BackendDatabase))
      .rejects.toThrow('permission-denied');
  });
});

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Timestamp } from '@shared/contract.ts';
import { NotificationCursor } from '@shared/contracts/notifications.ts';

describe('contract timestamps', () => {
  it.each([
    ['2026-01-01T00:00:00.123456+00:00', '2026-01-01T00:00:00.123456Z'],
    ['2026-01-01 08:00:00.123456+08', '2026-01-01T00:00:00.123456Z'],
    ['2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
    ['2025-12-31 19:30:00-04:30', '2026-01-01T00:00:00Z'],
  ])('spells %s as one UTC instant with its full precision', (value, expected) => {
    expect(v.parse(Timestamp, value)).toBe(expected);
  });

  it.each(['invalid', '2026-01-01', '2026-01-01T00:00:00'])('rejects %s', (value) => {
    expect(v.safeParse(Timestamp, value).success).toBe(false);
  });

  it('keeps a page cursor exactly as precise as the database sent it', () => {
    const cursor = { id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-01-01T00:00:00.123456+00:00' };
    expect(v.parse(NotificationCursor, cursor)).toEqual({ ...cursor, createdAt: '2026-01-01T00:00:00.123456Z' });
  });
});

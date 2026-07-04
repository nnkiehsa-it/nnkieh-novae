import { asRecord, asString } from "../_shared/http.ts";
import type { JsonRecord } from "./types.ts";

const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function asDateIso(value: unknown) {
  const rawValue = typeof value === "number" || typeof value === "string" ? value : "";
  const date = new Date(rawValue);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function asUuid(value: unknown) {
  const text = asString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)
    ? text
    : "";
}

export function toMs(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function readCursor(payload: JsonRecord) {
  return asRecord(payload.cursor);
}

export function readCursorDate(payload: JsonRecord, key: string, fallbackKey?: string) {
  return asDateIso(payload[key] ?? (fallbackKey ? payload[fallbackKey] : undefined));
}

export function applyDescendingDateCursor<TQuery>(
  query: TQuery,
  cursor: JsonRecord,
  dateColumn: string,
) {
  const id = asUuid(cursor.id);
  const date = readCursorDate(cursor, `${dateColumn}Ms`, dateColumn);
  if (!id || !date || typeof query !== "object" || query === null || !("or" in query)) return query;
  return (query as { or: (filters: string) => TQuery }).or(
    `${dateColumn}.lt.${date},and(${dateColumn}.eq.${date},id.lt.${id})`,
  );
}

export function applyAscendingDateCursor<TQuery>(
  query: TQuery,
  cursor: JsonRecord,
  dateColumn: string,
) {
  const id = asUuid(cursor.id);
  const date = readCursorDate(cursor, `${dateColumn}Ms`, dateColumn);
  if (!id || !date || typeof query !== "object" || query === null || !("or" in query)) return query;
  return (query as { or: (filters: string) => TQuery }).or(
    `${dateColumn}.gt.${date},and(${dateColumn}.eq.${date},id.gt.${id})`,
  );
}

export function cursorRange(pageSize: number) {
  return { from: 0, to: Math.max(0, Math.min(pageSize, 50)) };
}

export function latestDateMs(rows: Array<{ created_at?: unknown; updated_at?: unknown }>) {
  return rows.reduce((latest, row) => {
    const createdAtMs = toMs(row.created_at) ?? 0;
    const updatedAtMs = toMs(row.updated_at) ?? 0;
    return Math.max(latest, createdAtMs, updatedAtMs);
  }, 0);
}

export function taipeiDayWindow(date = new Date()) {
  const shifted = new Date(date.getTime() + TAIPEI_UTC_OFFSET_MS);
  const startMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
    - TAIPEI_UTC_OFFSET_MS;
  return {
    expiresAt: new Date(startMs + 24 * 60 * 60 * 1000),
    startsAt: new Date(startMs),
  };
}

export function utcHourWindow(date = new Date()) {
  const startsAt = new Date(date);
  startsAt.setUTCMinutes(0, 0, 0);
  return {
    expiresAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
    startsAt,
  };
}

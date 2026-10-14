import { asRecord, asString } from "../shared/json.ts";
import type { JsonRecord } from "./types.ts";

const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asDateIso(value: unknown) {
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

export function countRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, count]) => {
      const total = Number(count ?? 0);
      return [key, Number.isFinite(total) && total >= 0 ? total : 0];
    }),
  );
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

export function readCursorDate(payload: JsonRecord, key: string) {
  return asDateIso(payload[key]);
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


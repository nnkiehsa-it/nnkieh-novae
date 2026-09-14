/**
 * What the outside services actually said, read into shapes the screen can draw.
 *
 * Three providers answer in three unrelated dialects: Cloudinary reports usage
 * as nested counters, the Workers GraphQL API buries a day of traffic under
 * four levels of envelope, and the telemetry query returns a flat list of
 * events. None of them is ours to change, and none of them is fit to put in
 * front of a reader as it stands, so each is read here and the screen is left
 * with figures it can name.
 */

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function usageOf(value: unknown): number | null {
  const nested = record(value);
  return nested ? numberOf(nested.usage) : numberOf(value);
}

export interface CloudinaryReading {
  /** Billing credits, the only Cloudinary figure that comes with a ceiling. */
  credits: { limit: number | null; usage: number } | null;
  bandwidthBytes: number | null;
  lastUpdated: string | null;
  objects: number | null;
  plan: string | null;
  requests: number | null;
  storageBytes: number | null;
  transformations: number | null;
}

export function readCloudinaryUsage(data: unknown): CloudinaryReading | null {
  const source = record(data);
  if (!source) return null;
  const credits = record(source.credits);
  const creditUsage = credits ? numberOf(credits.usage) : null;
  return {
    bandwidthBytes: usageOf(source.bandwidth),
    credits: creditUsage === null ? null : { limit: numberOf(credits?.limit), usage: creditUsage },
    lastUpdated: textOf(source.last_updated),
    objects: usageOf(source.resources),
    plan: textOf(source.plan),
    requests: numberOf(source.requests),
    storageBytes: usageOf(source.storage),
    transformations: usageOf(source.transformations),
  };
}

export interface WorkerStatusReading {
  errors: number;
  requests: number;
  status: string;
}

export interface WorkerReading {
  /** Microseconds, as the Workers API reports them. */
  cpuP50: number | null;
  cpuP99: number | null;
  errors: number;
  requests: number;
  statuses: WorkerStatusReading[];
  subrequests: number;
}

export function readWorkerMetrics(data: unknown): WorkerReading | null {
  const viewer = record(record(data)?.viewer);
  const accounts = viewer?.accounts;
  const account = Array.isArray(accounts) ? record(accounts[0]) : null;
  const rows = account?.workersInvocationsAdaptive;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const reading: WorkerReading = {
    cpuP50: null,
    cpuP99: null,
    errors: 0,
    requests: 0,
    statuses: [],
    subrequests: 0,
  };
  let weightedP50 = 0;
  let weightedP99 = 0;

  for (const entry of rows) {
    const row = record(entry);
    if (!row) continue;
    const sum = record(row.sum);
    const quantiles = record(row.quantiles);
    const requests = numberOf(sum?.requests) ?? 0;
    const errors = numberOf(sum?.errors) ?? 0;
    reading.requests += requests;
    reading.errors += errors;
    reading.subrequests += numberOf(sum?.subrequests) ?? 0;
    weightedP50 += (numberOf(quantiles?.cpuTimeP50) ?? 0) * requests;
    weightedP99 += (numberOf(quantiles?.cpuTimeP99) ?? 0) * requests;
    const status = textOf(record(row.dimensions)?.status);
    if (status) reading.statuses.push({ errors, requests, status });
  }

  if (reading.requests > 0) {
    reading.cpuP50 = weightedP50 / reading.requests;
    reading.cpuP99 = weightedP99 / reading.requests;
  }
  reading.statuses.sort((left, right) => right.requests - left.requests);
  return reading;
}

export interface WorkerLogEvent {
  /** Milliseconds spent on the request, as the telemetry query reports it. */
  duration: number | null;
  id: string;
  level: string | null;
  origin: string | null;
  region: string | null;
  requestId: string | null;
  startedAt: Date | null;
}

export function readWorkerLogs(data: unknown): WorkerLogEvent[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry, index) => {
    const row = record(entry);
    if (!row) return [];
    const startTime = numberOf(row.startTime);
    return [{
      duration: numberOf(row.duration),
      id: textOf(row.id) ?? String(index),
      level: textOf(row.level),
      origin: textOf(row.origin),
      region: textOf(row.region),
      requestId: textOf(row.requestId) ?? textOf(row.rayId),
      startedAt: startTime === null ? null : new Date(startTime),
    }];
  });
}

const BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

export function formatBytes(value: number): string {
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < BYTE_UNITS.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? scaled : scaled.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatMilliseconds(microseconds: number): string {
  return `${(microseconds / 1000).toFixed(microseconds < 10_000 ? 1 : 0)} ms`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function percentOf(usage: number, limit: number | null): number | null {
  return limit && limit > 0 ? Math.min(100, (usage / limit) * 100) : null;
}

import { errorStatus, publicErrorBody } from "../shared/http.ts";
import type { ApiErrorCode } from "../shared/api-errors.ts";
import { operationPolicies } from "../shared/operation-policies.ts";
import type { ActionSegment } from "./types.ts";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message?: string;
  failureId?: string;
  retryAfterSeconds?: number;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  operationId: string;
  policyRevision: number;
  success: true;
}

/**
 * A line of an answer in flight.
 *
 * An action response is newline-delimited JSON: one `start` line naming the
 * operation, then a `part` for each piece of the answer as it is ready, then
 * `end`. A failure that happens after the first piece has left cannot be an
 * HTTP status any more, so it is the last line instead.
 */
export type ApiStreamLine =
  | { operationId: string; policyRevision: number; type: "start" }
  | { data: unknown; key?: string; type: "part" }
  | { type: "end" }
  | { error: ApiErrorBody; type: "error" };

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
  operationId: string;
  success: false;
}

function camelCaseKey(key: string) {
  return key.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
}

function timestampKey(key: string) {
  if (key.endsWith("_at_ms")) return camelCaseKey(key.slice(0, -3));
  if (key.endsWith("AtMs")) return key.slice(0, -2);
  return null;
}

export function toApiJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toApiJson);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (timestampKey(key)) continue;
    result[camelCaseKey(key)] = toApiJson(entry);
  }
  for (const [key, entry] of Object.entries(source)) {
    const targetKey = timestampKey(key);
    if (!targetKey) continue;
    if (targetKey in result) continue;
    result[targetKey] = typeof entry === "number" && Number.isFinite(entry)
      ? new Date(entry).toISOString()
      : null;
  }
  return result;
}

/**
 * Every answer carries the revision of the settings it was produced under, so
 * a client learns that they changed from the traffic it was making anyway
 * instead of asking on a timer.
 */
export function successEnvelope<TData>(data: TData, operationId: string): ApiSuccessEnvelope<TData> {
  return { data: toApiJson(data) as TData, operationId, policyRevision: operationPolicies().revision, success: true };
}

export function errorEnvelope(error: unknown, operationId: string, failureId?: string): ApiErrorEnvelope {
  return {
    error: publicErrorBody(error, failureId),
    operationId,
    success: false,
  };
}

export function successResponse<TData>(data: TData, operationId: string, init: ResponseInit = {}) {
  return Response.json(successEnvelope(data, operationId), init);
}

function streamLine(line: ApiStreamLine) {
  return new TextEncoder().encode(`${JSON.stringify(line)}
`);
}

/**
 * The answer as it is produced, one line per piece.
 *
 * The first piece is already in hand when this is called, so an action that
 * fails before producing anything is still an ordinary error response with its
 * own status; everything after that travels on the open stream, and the reader
 * can show each piece as it lands instead of waiting for the last one.
 */
export function streamingResponse(
  first: ActionSegment,
  rest: AsyncIterator<ActionSegment>,
  operationId: string,
  onFailure: (error: unknown) => Promise<ApiErrorBody>,
) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const pump = (async () => {
    await writer.write(streamLine({ operationId, policyRevision: operationPolicies().revision, type: "start" }));
    await writer.write(streamLine({ data: first.data, key: first.key, type: "part" }));
    try {
      for (let next = await rest.next(); !next.done; next = await rest.next()) {
        await writer.write(streamLine({ data: next.value.data, key: next.value.key, type: "part" }));
      }
      await writer.write(streamLine({ type: "end" }));
    } catch (error) {
      await writer.write(streamLine({ error: await onFailure(error), type: "error" }));
    }
    await writer.close();
  })();
  return { response: new Response(readable, { headers: { "content-type": "application/x-ndjson" } }), pump };
}

export function errorResponse(error: unknown, operationId: string, failureId?: string, init: ResponseInit = {}) {
  const envelope = errorEnvelope(error, operationId, failureId);
  const retryAfterSeconds = envelope.error.retryAfterSeconds;
  return Response.json(
    envelope,
    {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
      },
      status: init.status ?? errorStatus(error),
    },
  );
}

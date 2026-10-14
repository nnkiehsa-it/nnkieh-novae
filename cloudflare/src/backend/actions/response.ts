import { errorStatus, publicErrorBody } from "../shared/errors.ts";
import type { ApiErrorCode } from "../../../../shared/api-errors.ts";
import { operationPolicies } from "../shared/operation-policies.ts";
import type { ActionSegment } from "./types.ts";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message?: string;
  failureId?: string;
  retryAfterSeconds?: number;
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

export function errorEnvelope(error: unknown, operationId: string, failureId?: string): ApiErrorEnvelope {
  return {
    error: publicErrorBody(error, failureId),
    operationId,
    success: false,
  };
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
  signal?: AbortSignal,
) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let rejectAbort: ((reason?: unknown) => void) | null = null;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  let disconnected = false;
  const disconnect = (reason: unknown) => {
    disconnected = true;
    rejectAbort?.(reason);
  };
  // Cloudflare can cancel the response without aborting Request.signal.
  void aborted.catch(() => undefined);
  void writer.closed.catch(disconnect);
  const stop = () => {
    disconnect(signal?.reason ?? new Error("request-aborted"));
    void writer.abort(signal?.reason).catch(() => undefined);
  };
  const write = async (line: ApiStreamLine) => {
    const bytes = streamLine(line);
    try { await writer.write(bytes); }
    catch (error) { disconnect(error); throw error; }
  };
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  const pump = (async () => {
    try {
      await write({ operationId, policyRevision: operationPolicies().revision, type: "start" });
      await write({ data: first.data, key: first.key, type: "part" });
      for (
        let next = await Promise.race([rest.next(), aborted]);
        !next.done;
        next = await Promise.race([rest.next(), aborted])
      ) {
        await write({ data: next.value.data, key: next.value.key, type: "part" });
      }
      await write({ type: "end" });
    } catch (error) {
      if (!disconnected) {
        await write({ error: await onFailure(error), type: "error" }).catch(() => undefined);
      }
    } finally {
      signal?.removeEventListener("abort", stop);
      if (rest.return) {
        if (disconnected) void rest.return().catch(() => undefined);
        else await rest.return().catch(() => undefined);
      }
      if (disconnected) await writer.abort(signal?.reason).catch(() => undefined);
      else await writer.close().catch(() => undefined);
    }
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

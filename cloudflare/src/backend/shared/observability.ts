import { errorMessage, publicErrorCode } from "./http.ts";

type EdgeLogLevel = "error" | "info" | "warn";
type EdgeLogValue = boolean | number | string | null | undefined;

export type EdgeLogFields = Record<string, EdgeLogValue>;

export interface FunctionLogger {
  error(event: string, error: unknown, fields?: EdgeLogFields): void;
  success(event: string, fields?: EdgeLogFields): void;
  warn(event: string, fields?: EdgeLogFields): void;
}

export interface LoggerContext {
  invocationId?: string;
  operationId?: string;
  eventId?: string;
  attemptId?: string;
}

const EDGE_LOG_SCHEMA_VERSION = 2;
const MAX_ERROR_MESSAGE_LENGTH = 500;

function elapsedMilliseconds(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

function safeErrorMessage(error: unknown) {
  return errorMessage(error).slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function writeLog(
  level: EdgeLogLevel,
  functionName: string,
  invocationId: string,
  event: string,
  fields: EdgeLogFields,
) {
  console[level](JSON.stringify({
    ...fields,
    event,
    function: functionName,
    invocationId,
    level,
    schemaVersion: EDGE_LOG_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
  }));
}

// Emits one-line JSON records to Cloudflare Worker Logs with schemaVersion: 2.
// Standard identifiers: invocationId, operationId, eventId, attemptId, failureId.
export function createFunctionLogger(
  functionName: string,
  context: LoggerContext = {},
): FunctionLogger {
  const invocationId = context.invocationId ?? crypto.randomUUID();
  const startedAt = performance.now();
  const baseFields: EdgeLogFields = {
    ...(context.operationId ? { operationId: context.operationId } : {}),
    ...(context.eventId ? { eventId: context.eventId } : {}),
    ...(context.attemptId ? { attemptId: context.attemptId } : {}),
  };

  const withDuration = (fields: EdgeLogFields = {}) => ({
    ...baseFields,
    ...fields,
    durationMs: elapsedMilliseconds(startedAt),
  });

  return {
    error(event, error, fields = {}) {
      writeLog("error", functionName, invocationId, event, withDuration({
        ...fields,
        errorCode: publicErrorCode(error),
        errorMessage: safeErrorMessage(error),
      }));
    },
    success(event, fields = {}) {
      writeLog("info", functionName, invocationId, event, withDuration(fields));
    },
    warn(event, fields = {}) {
      writeLog("warn", functionName, invocationId, event, withDuration(fields));
    },
  };
}

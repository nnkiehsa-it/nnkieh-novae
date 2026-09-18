import { Pool, types as postgresTypes } from "pg";
import type { Env } from "../../types";
import type { AppApiFunctions } from "./schema";

// Dates and timestamps travel as the text PostgreSQL wrote them. The driver's
// own `Date` objects carry no own properties, so the API JSON they turn into is
// an empty object rather than the string every reader expects.
postgresTypes.setTypeParser(20, (value) => Number(value));
postgresTypes.setTypeParser(1082, (value) => value);
postgresTypes.setTypeParser(1114, (value) => value);
postgresTypes.setTypeParser(1184, (value) => value);

type FunctionName = keyof AppApiFunctions & string;
type FunctionArgs<TName extends FunctionName> = AppApiFunctions[TName]["Args"];
type FunctionReturn<TName extends FunctionName> = AppApiFunctions[TName]["Returns"];

interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
}

/** What `call()` answers with: the function's return value, or why it failed. */
type DatabaseResult<T> =
  | { data: T; error: null }
  | { data: null; error: DatabaseError };

export interface SqlResult<TRow> {
  rowCount: number;
  rows: TRow[];
}

const SET_RETURNING_FUNCTIONS = new Set<string>([
  "app_api.backend_toggle_support",
  "app_api.claim_background_jobs",
  "app_api.claim_event_deliveries",
  "app_api.claim_operation",
]);

const JSON_FUNCTION_ARGUMENTS = new Map<string, Set<string>>([
  ["app_api.backend_complete_initial_setup", new Set(["facility_categories", "issue_categories"])],
  ["app_api.backend_estimate_category_policy_changes", new Set(["issue_categories"])],
  ["app_api.backend_estimate_retention_cleanup", new Set(["retention_config"])],
  ["app_api.backend_save_platform_settings", new Set(["image_settings", "retention_config"])],
  ["app_api.backend_save_category_management", new Set(["facility_categories", "issue_categories"])],
  ["app_api.complete_operation", new Set(["action_response"])],
  ["app_api.fail_operation", new Set(["error_detail"])],
  ["app_api.record_domain_event", new Set(["payload"])],
  ["app_api.fail_event_delivery", new Set(["error_info"])],
  ["app_api.complete_background_job", new Set(["job_result"])],
  ["app_api.fail_background_job", new Set(["error_info"])],
  ["app_api.enqueue_background_job", new Set(["payload"])],
]);

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/u;
const DATABASE_QUERY_CONCURRENCY = 1;
const DATABASE_CONNECTION_TIMEOUT_MS = 15_000;
const DATABASE_IDLE_TIMEOUT_MS = 5_000;
const DATABASE_QUERY_TIMEOUT_MS = 60_000;

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) throw new Error("invalid-database-identifier");
  return `"${identifier}"`;
}

function databaseError(error: unknown): DatabaseError {
  if (error instanceof Error) return error as DatabaseError;
  return new Error(String(error));
}

/** Every interpolation becomes a bound parameter; nothing is ever spliced into the statement text. */
function statementText(fragments: TemplateStringsArray, values: unknown[]) {
  let text = fragments[0];
  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${fragments[index + 1]}`;
  }
  return text;
}

type RunQuery = <TRow extends Record<string, unknown>>(
  sql: string,
  values?: unknown[],
) => Promise<{ rowCount?: number | null; rows: TRow[] }>;

class FunctionQuery<TReturn> implements PromiseLike<DatabaseResult<TReturn>> {
  constructor(private readonly operation: () => Promise<DatabaseResult<TReturn>>) {}

  then<TResult1 = DatabaseResult<TReturn>, TResult2 = never>(
    onfulfilled?: ((value: DatabaseResult<TReturn>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.operation().then(onfulfilled, onrejected);
  }

  async single(): Promise<DatabaseResult<TReturn extends Array<infer TItem> ? TItem : TReturn>> {
    const result = await this.operation();
    if (result.error) return { data: null, error: result.error };
    const value = result.data;
    if (!Array.isArray(value) || value.length !== 1) {
      return { data: null, error: Object.assign(new Error("not-found"), { code: "ROW_NOT_FOUND" }) };
    }
    return { data: value[0], error: null } as DatabaseResult<TReturn extends Array<infer TItem> ? TItem : TReturn>;
  }
}

export interface DatabaseSession {
  /** Tagged template for statements: `` sql<Row>`select … where id = ${id}` ``. Rejects on database errors. */
  sql<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<SqlResult<TRow>>;
  /** Same as `sql`, but requires exactly one row and returns it. */
  sqlOne<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow>;
  /** Same as `sql`, but allows zero rows and rejects on more than one. */
  sqlMaybe<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow | null>;
  call<TName extends FunctionName>(
    schema: "app_api",
    functionName: TName,
    args?: FunctionArgs<TName>,
  ): FunctionQuery<FunctionReturn<TName>>;
}

export class AppDatabaseSession implements DatabaseSession {
  constructor(private readonly runQuery: RunQuery) {}

  async sql<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<SqlResult<TRow>> {
    const result = await this.runQuery(statementText(fragments, values), values);
    return { rowCount: result.rowCount ?? result.rows.length, rows: result.rows as unknown as TRow[] };
  }

  async sqlOne<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow> {
    const { rows } = await this.sql<TRow>(fragments, ...values);
    if (rows.length !== 1) throw Object.assign(new Error("not-found"), { code: "ROW_NOT_FOUND" });
    return rows[0];
  }

  async sqlMaybe<TRow extends object = Record<string, unknown>>(
    fragments: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow | null> {
    const { rows } = await this.sql<TRow>(fragments, ...values);
    if (rows.length > 1) throw Object.assign(new Error("multiple-rows"), { code: "MULTIPLE_ROWS" });
    return rows[0] ?? null;
  }

  call<TName extends FunctionName>(
    schema: "app_api",
    functionName: TName,
    args?: FunctionArgs<TName>,
  ) {
    return new FunctionQuery<FunctionReturn<TName>>(async () => {
      try {
        const qualifiedName = `${schema}.${functionName}`;
        const jsonArguments = JSON_FUNCTION_ARGUMENTS.get(qualifiedName);
        const entries = Object.entries(args ?? {}).filter(([, value]) => value !== undefined);
        const values = entries.map(([name, value]) =>
          jsonArguments?.has(name) ? JSON.stringify(value) : value
        );
        const parameters = entries.map(([name], index) => `${quoteIdentifier(name)} => $${index + 1}`).join(", ");
        const setReturning = SET_RETURNING_FUNCTIONS.has(qualifiedName);
        const rowAlias = setReturning ? "novae_function_row" : "result";
        const sql = `SELECT to_jsonb(${rowAlias}) AS value FROM ${quoteIdentifier(schema)}.${quoteIdentifier(functionName)}(${parameters}) ${rowAlias}`;
        const result = await this.runQuery<{ value: FunctionReturn<TName> }>(sql, values);
        const data = setReturning
          ? result.rows.map((row) => row.value)
          : result.rows[0]?.value ?? null;
        return { data: data as FunctionReturn<TName>, error: null };
      } catch (error) {
        return { data: null, error: databaseError(error) };
      }
    });
  }
}

export class AppDatabaseClient implements DatabaseSession {
  private connected = false;
  private closed = false;
  private connecting: Promise<void> | null = null;
  private queryTail: Promise<unknown> = Promise.resolve();
  private readonly pool: Pool;
  private readonly session: DatabaseSession;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: DATABASE_IDLE_TIMEOUT_MS,
      max: DATABASE_QUERY_CONCURRENCY,
      query_timeout: DATABASE_QUERY_TIMEOUT_MS,
      statement_timeout: DATABASE_QUERY_TIMEOUT_MS,
    });
    this.session = new AppDatabaseSession(this.query.bind(this));
  }

  sql<TRow extends object = Record<string, unknown>>(fragments: TemplateStringsArray, ...values: unknown[]) {
    return this.session.sql<TRow>(fragments, ...values);
  }

  sqlOne<TRow extends object = Record<string, unknown>>(fragments: TemplateStringsArray, ...values: unknown[]) {
    return this.session.sqlOne<TRow>(fragments, ...values);
  }

  sqlMaybe<TRow extends object = Record<string, unknown>>(fragments: TemplateStringsArray, ...values: unknown[]) {
    return this.session.sqlMaybe<TRow>(fragments, ...values);
  }

  call<TName extends FunctionName>(schema: "app_api", functionName: TName, args?: FunctionArgs<TName>) {
    return this.session.call(schema, functionName, args);
  }

  async transaction<T>(callback: (tx: DatabaseSession) => Promise<T>): Promise<T> {
    await this.connect();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let transactionQueryTail: Promise<unknown> = Promise.resolve();
      const txSession = new AppDatabaseSession(<TRow extends Record<string, unknown>>(
        sql: string,
        values: unknown[] = [],
      ) => {
        const query = transactionQueryTail.then(() => client.query<TRow>(sql, values));
        transactionQueryTail = query.then(() => undefined, () => undefined);
        return query;
      });
      const result = await callback(txSession);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async connect() {
    if (this.connected) return;
    if (this.closed) throw new Error("database-client-closed");
    if (this.connecting) return this.connecting;

    const connection = this.pool.connect().then(
      (client) => {
        client.release();
        this.connected = true;
      },
      (error: unknown) => {
        throw error;
      },
    );
    this.connecting = connection;
    try {
      await connection;
    } finally {
      if (this.connecting === connection) this.connecting = null;
    }
  }

  async close() {
    if (this.connecting) await this.connecting.catch(() => undefined);
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    await this.pool.end();
  }

  /**
   * Runs a statement that is not written here — a migration file, or a name the
   * caller assembles. Everything the Worker itself runs goes through `sql`.
   */
  query<TRow extends Record<string, unknown>>(sql: string, values: unknown[] = []) {
    const query = this.queryTail
      .then(() => this.connect())
      .then(() => this.pool.query<TRow>(sql, values));
    this.queryTail = query.then(() => undefined, () => undefined);
    return query;
  }
}

export async function createDatabaseClient(env: Env) {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) throw new Error("database-not-configured");
  const database = new AppDatabaseClient(connectionString);
  await database.connect();
  return database;
}

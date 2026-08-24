import { Pool, types as postgresTypes } from "pg";
import type { Env } from "../../types";
import type { AppApiFunctions, AppPrivateTables } from "./schema";

postgresTypes.setTypeParser(20, (value) => Number(value));
postgresTypes.setTypeParser(1114, (value) => value);
postgresTypes.setTypeParser(1184, (value) => value);

type TableName = keyof AppPrivateTables & string;
type TableDefinition<TName extends TableName> = AppPrivateTables[TName];
type TableRow<TName extends TableName> = TableDefinition<TName>["Row"] & Record<string, unknown>;
type TableInsert<TName extends TableName> = TableDefinition<TName>["Insert"];
type TableUpdate<TName extends TableName> = TableDefinition<TName>["Update"];
type FunctionName = keyof AppApiFunctions & string;
type FunctionArgs<TName extends FunctionName> = AppApiFunctions[TName]["Args"];
type FunctionReturn<TName extends FunctionName> = AppApiFunctions[TName]["Returns"];

export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
}

export type DatabaseResult<T> =
  | { count?: number | null; data: T; error: null }
  | { count?: null; data: null; error: DatabaseError };

type Filter =
  | { column: string; operator: "=" | "<>" | "<" | "<=" | ">" | ">="; value: unknown }
  | { column: string; operator: "in"; value: unknown[] }
  | { column: string; operator: "is"; value: unknown }
  | { dateColumn: string; date: string; direction: "ascending" | "descending"; id: string };

const SET_RETURNING_FUNCTIONS = new Set<string>([
  "app_api.backend_toggle_support",
  "app_api.claim_deletion_jobs",
  "app_api.claim_idempotency_key",
  "app_api.claim_outbox_events",
  "app_api.claim_push_delivery_jobs",
  "app_api.claim_realtime_events",
]);

const JSON_FUNCTION_ARGUMENTS = new Map<string, Set<string>>([
  ["app_api.backend_complete_initial_setup", new Set(["facility_categories", "issue_categories"])],
  ["app_api.backend_estimate_category_policy_changes", new Set(["issue_categories"])],
  ["app_api.backend_estimate_retention_cleanup", new Set(["retention_config"])],
  ["app_api.backend_save_platform_settings", new Set(["image_settings", "retention_config"])],
  ["app_api.backend_save_category_management", new Set(["facility_categories", "issue_categories"])],
  ["app_api.complete_idempotency_key", new Set(["action_response"])],
]);

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/u;
const DATABASE_QUERY_CONCURRENCY = 4;

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) throw new Error("invalid-database-identifier");
  return `"${identifier}"`;
}

function selectedColumns(columns: string) {
  if (columns.trim() === "*") return "*";
  return columns.split(",").map((column) => quoteIdentifier(column.trim())).join(", ");
}

function databaseError(error: unknown): DatabaseError {
  if (error instanceof Error) return error as DatabaseError;
  return new Error(String(error));
}

function appendValue(values: unknown[], value: unknown) {
  values.push(value);
  return `$${values.length}`;
}

function compileFilters(filters: Filter[], values: unknown[]) {
  if (filters.length === 0) return "";
  const fragments = filters.map((filter) => {
    if ("dateColumn" in filter) {
      const dateColumn = quoteIdentifier(filter.dateColumn);
      const date = appendValue(values, filter.date);
      const id = appendValue(values, filter.id);
      const comparison = filter.direction === "descending" ? "<" : ">";
      return `(${dateColumn} ${comparison} ${date} OR (${dateColumn} = ${date} AND "id" ${comparison} ${id}))`;
    }
    const column = quoteIdentifier(filter.column);
    if (filter.operator === "in") {
      if (filter.value.length === 0) return "FALSE";
      return `${column} = ANY(${appendValue(values, filter.value)})`;
    }
    if (filter.operator === "is") {
      if (filter.value === null) return `${column} IS NULL`;
      if (filter.value === true) return `${column} IS TRUE`;
      if (filter.value === false) return `${column} IS FALSE`;
      return `${column} IS NOT DISTINCT FROM ${appendValue(values, filter.value)}`;
    }
    return `${column} ${filter.operator} ${appendValue(values, filter.value)}`;
  });
  return ` WHERE ${fragments.join(" AND ")}`;
}

interface UpsertOptions {
  ignoreDuplicates?: boolean;
  onConflict: string;
}

type QueryOperation = "delete" | "insert" | "select" | "update" | "upsert";

class TableQuery<TName extends TableName> implements PromiseLike<DatabaseResult<TableRow<TName>[]>> {
  private filters: Filter[] = [];
  private countRequested = false;
  private headOnly = false;
  private limitCount: number | null = null;
  private offsetCount = 0;
  private operation: QueryOperation = "select";
  private orderings: Array<{ ascending: boolean; column: string }> = [];
  private payload: TableInsert<TName> | TableInsert<TName>[] | TableUpdate<TName> | null = null;
  private returning = false;
  private selected = "*";
  private upsertOptions: UpsertOptions | null = null;

  constructor(
    private readonly query: <TRow extends Record<string, unknown>>(
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: TRow[] }>,
    private readonly tableName: TName,
  ) {}

  select(columns = "*", options: { count?: "exact"; head?: boolean } = {}) {
    this.selected = selectedColumns(columns);
    this.countRequested = options.count === "exact";
    this.headOnly = options.head === true;
    if (this.operation !== "select") this.returning = true;
    return this;
  }

  insert(values: TableInsert<TName> | TableInsert<TName>[]) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  upsert(values: TableInsert<TName> | TableInsert<TName>[], options: UpsertOptions) {
    this.operation = "upsert";
    this.payload = values;
    this.upsertOptions = options;
    return this;
  }

  update(values: TableUpdate<TName>) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: "<>", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, operator: "<", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "<=", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, operator: ">", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: ">=", value });
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.filters.push({ column, operator: "in", value: [...values] });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: "is", value });
    return this;
  }

  match(values: Record<string, unknown>) {
    for (const [column, value] of Object.entries(values)) this.eq(column, value);
    return this;
  }

  cursor(dateColumn: string, date: string, id: string, direction: "ascending" | "descending") {
    this.filters.push({ dateColumn, date, direction, id });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderings.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitCount = Math.max(0, Math.trunc(value));
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = Math.max(0, Math.trunc(from));
    this.limitCount = Math.max(0, Math.trunc(to) - this.offsetCount + 1);
    return this;
  }

  async single(): Promise<DatabaseResult<TableRow<TName>>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    if (result.data?.length !== 1) {
      return { data: null, error: Object.assign(new Error("not-found"), { code: "ROW_NOT_FOUND" }) };
    }
    return { data: result.data[0], error: null };
  }

  async maybeSingle(): Promise<DatabaseResult<TableRow<TName> | null>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    if (!result.data?.length) return { data: null, error: null };
    if (result.data.length > 1) {
      return { data: null, error: Object.assign(new Error("multiple-rows"), { code: "MULTIPLE_ROWS" }) };
    }
    return { data: result.data[0], error: null };
  }

  then<TResult1 = DatabaseResult<TableRow<TName>[]>, TResult2 = never>(
    onfulfilled?: ((value: DatabaseResult<TableRow<TName>[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<DatabaseResult<TableRow<TName>[]>> {
    try {
      const values: unknown[] = [];
      const table = `"app_private".${quoteIdentifier(this.tableName)}`;
      let sql: string;

      if (this.operation === "select") {
        const projection = this.headOnly
          ? `COUNT(*)::bigint AS "__novae_count"`
          : this.countRequested
            ? `${this.selected}, COUNT(*) OVER()::bigint AS "__novae_count"`
            : this.selected;
        sql = `SELECT ${projection} FROM ${table}${compileFilters(this.filters, values)}`;
        if (this.orderings.length > 0) {
          sql += ` ORDER BY ${this.orderings.map(({ ascending, column }) =>
            `${quoteIdentifier(column)} ${ascending ? "ASC" : "DESC"}`).join(", ")}`;
        }
        if (this.limitCount !== null) sql += ` LIMIT ${appendValue(values, this.limitCount)}`;
        if (this.offsetCount > 0) sql += ` OFFSET ${appendValue(values, this.offsetCount)}`;
      } else if (this.operation === "insert" || this.operation === "upsert") {
        const records = (Array.isArray(this.payload) ? this.payload : [this.payload])
          .filter((record): record is TableInsert<TName> => Boolean(record));
        if (records.length === 0) return { data: [], error: null };
        const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
        if (columns.length === 0) throw new Error("empty-insert");
        const rows = records.map((record) => `(${columns.map((column) =>
          appendValue(values, (record as Record<string, unknown>)[column] ?? null)).join(", ")})`);
        sql = `INSERT INTO ${table} (${columns.map(quoteIdentifier).join(", ")}) VALUES ${rows.join(", ")}`;
        if (this.operation === "upsert") {
          if (!this.upsertOptions) throw new Error("missing-upsert-options");
          const conflicts = this.upsertOptions.onConflict.split(",").map((column) => quoteIdentifier(column.trim()));
          if (this.upsertOptions.ignoreDuplicates) {
            sql += ` ON CONFLICT (${conflicts.join(", ")}) DO NOTHING`;
          } else {
            const conflictSet = new Set(this.upsertOptions.onConflict.split(",").map((column) => column.trim()));
            const updateColumns = columns.filter((column) => !conflictSet.has(column));
            sql += updateColumns.length > 0
              ? ` ON CONFLICT (${conflicts.join(", ")}) DO UPDATE SET ${updateColumns.map((column) =>
                `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(", ")}`
              : ` ON CONFLICT (${conflicts.join(", ")}) DO NOTHING`;
          }
        }
        if (this.returning) sql += ` RETURNING ${this.selected}`;
      } else if (this.operation === "update") {
        const record = (this.payload ?? {}) as Record<string, unknown>;
        const entries = Object.entries(record).filter(([, value]) => value !== undefined);
        if (entries.length === 0) throw new Error("empty-update");
        sql = `UPDATE ${table} SET ${entries.map(([column, value]) =>
          `${quoteIdentifier(column)} = ${appendValue(values, value)}`).join(", ")}`;
        sql += compileFilters(this.filters, values);
        if (this.returning) sql += ` RETURNING ${this.selected}`;
      } else {
        sql = `DELETE FROM ${table}${compileFilters(this.filters, values)}`;
        if (this.returning) sql += ` RETURNING ${this.selected}`;
      }

      const result = await this.query<TableRow<TName> & { __novae_count?: number | string }>(sql, values);
      const count = this.countRequested
        ? Number(result.rows[0]?.__novae_count ?? 0)
        : null;
      const rows = this.headOnly
        ? []
        : result.rows.map((row) => {
          if (!("__novae_count" in row)) return row;
          const { __novae_count: _count, ...record } = row;
          return record as TableRow<TName>;
        });
      return { count, data: rows, error: null };
    } catch (error) {
      return { count: null, data: null, error: databaseError(error) };
    }
  }
}

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

export class AppDatabaseClient {
  private connected = false;
  private closed = false;
  private connecting: Promise<void> | null = null;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: DATABASE_QUERY_CONCURRENCY,
    });
  }

  table<TName extends TableName>(schema: "app_private", table: TName) {
    if (schema !== "app_private") throw new Error("invalid-database-schema");
    return new TableQuery(this.query.bind(this), table);
  }

  call<TName extends FunctionName>(
    schema: "app_api",
    functionName: TName,
    args?: FunctionArgs<TName>,
  ) {
    return new FunctionQuery<FunctionReturn<TName>>(async () => {
      try {
        await this.connect();
        const qualifiedName = `${schema}.${functionName}`;
        const jsonArguments = JSON_FUNCTION_ARGUMENTS.get(qualifiedName);
        const entries = Object.entries(args ?? {}).filter(([, value]) => value !== undefined);
        const values = entries.map(([name, value]) =>
          jsonArguments?.has(name) ? JSON.stringify(value) : value
        );
        const parameters = entries.map(([name], index) => `${quoteIdentifier(name)} => $${index + 1}`).join(", ");
        const sql = `SELECT to_jsonb(result) AS value FROM ${quoteIdentifier(schema)}.${quoteIdentifier(functionName)}(${parameters}) result`;
        const result = await this.query<{ value: FunctionReturn<TName> }>(sql, values);
        const data = SET_RETURNING_FUNCTIONS.has(qualifiedName)
          ? result.rows.map((row) => row.value)
          : result.rows[0]?.value ?? null;
        return { data: data as FunctionReturn<TName>, error: null };
      } catch (error) {
        return { data: null, error: databaseError(error) };
      }
    });
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

  private query<TRow extends Record<string, unknown>>(sql: string, values: unknown[] = []) {
    return this.connect().then(() => this.pool.query<TRow>(sql, values));
  }
}

export async function createDatabaseClient(env: Env) {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) throw new Error("database-not-configured");
  const database = new AppDatabaseClient(connectionString);
  await database.connect();
  return database;
}

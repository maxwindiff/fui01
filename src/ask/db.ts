import * as duckdb from "@duckdb/duckdb-wasm";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import { TABLES } from "./data";

export type ColType = "quantitative" | "temporal" | "nominal" | "boolean" | "list";
export interface Column { name: string; type: ColType }
export interface Result { columns: Column[]; rows: Record<string, unknown>[] }

let conn: Promise<duckdb.AsyncDuckDBConnection> | null = null;

export function connect() {
  return (conn ??= (async () => {
    const bundle = await duckdb.selectBundle({ mvp: { mainModule: mvpWasm, mainWorker: mvpWorker }, eh: { mainModule: ehWasm, mainWorker: ehWorker } });
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(bundle.mainWorker!));
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const c = await db.connect();
    for (const t of TABLES) {
      await db.registerFileText(`${t.name}.json`, JSON.stringify(t.rows));
      const cols = Object.entries(t.columns).map(([k, v]) => `${k}: '${v}'`).join(", ");
      await c.query(`CREATE TABLE ${t.name} AS SELECT * FROM read_json('${t.name}.json', format = 'array', columns = {${cols}})`);
    }
    return c;
  })());
}

function colType(t: { typeId: number; toString(): string }): ColType {
  const s = t.toString();
  if (/^(Int|Uint|Float|Decimal)/i.test(s)) return "quantitative";
  if (/^(Date|Timestamp)/i.test(s)) return "temporal";
  if (/^Bool/i.test(s)) return "boolean";
  if (/^List/i.test(s)) return "list";
  return "nominal";
}

function plain(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v && typeof v === "object" && "toArray" in v && typeof (v as { toArray: unknown }).toArray === "function") return Array.from((v as { toArray(): ArrayLike<unknown> }).toArray(), plain);
  return v;
}

// Arrow hands decimals over as 128-bit integers in four words, with the scale kept on the column type.
function decimal(v: Uint32Array, scale: number) {
  let n = 0n;
  for (let i = v.length - 1; i >= 0; i--) n = (n << 32n) | BigInt(v[i]);
  if (v[v.length - 1] & 0x80000000) n -= 1n << BigInt(v.length * 32);
  return Number(n) / 10 ** scale;
}

export async function query(sql: string): Promise<Result> {
  const c = await connect();
  const t = await c.query(sql);
  const columns = t.schema.fields.map((f) => ({ name: f.name, type: colType(f.type) }));
  const scales = t.schema.fields.map((f) => (String(f.type).startsWith("Decimal") ? (f.type as unknown as { scale: number }).scale : null));
  const rows = t.toArray().map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const v = r[col.name];
      o[col.name] = scales[i] !== null && v instanceof Uint32Array ? decimal(v, scales[i]!) : plain(v);
    });
    return o;
  });
  return { columns, rows };
}

export const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export async function exec(sql: string) {
  const c = await connect();
  await c.query(sql);
}

// The parse tree of a statement, as DuckDB's json extension writes it. Locations are dropped, since an edited tree
// no longer matches the original text and the largest location value does not survive a round trip through JSON.
export async function parse(sql: string): Promise<AstRoot> {
  const r = await query(`SELECT json_serialize_sql(${quote(sql)}) AS j`);
  const tree = JSON.parse(String(r.rows[0].j));
  if (tree.error) throw new Error(tree.error_message ?? "Could not parse the query");
  const strip = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    delete (o as Record<string, unknown>).query_location;
    Object.values(o).forEach(strip);
  };
  strip(tree);
  return tree;
}

export async function unparse(tree: AstRoot): Promise<string> {
  const r = await query(`SELECT json_deserialize_sql(${quote(JSON.stringify(tree))}) AS s`);
  return String(r.rows[0].s);
}

export type Ast = Record<string, any>;
export interface AstRoot { error: boolean; statements: { node: Ast }[] }

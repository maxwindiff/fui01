import { exec, query } from "./db";
import type { Column, Result } from "./db";
import { TABLES } from "./data";
import { findFilters } from "./filters";
import type { Filter } from "./filters";
import { check } from "./spec";
import type { Answer } from "./spec";

export interface Loaded { results: Record<string, Result>; filters: Filter[]; errors: string[] }

const BASE = new Set(TABLES.map((t) => t.name));
const MAX_ROWS = 4000;
let queue: Promise<unknown> = Promise.resolve();

// Runs the queries of an answer. Each table becomes a temporary view, so a later table can read an earlier one by
// name. Answers share the views, so runs go one at a time.
export function load(a: Answer): Promise<Loaded> {
  const run = queue.then(() => loadNow(a));
  queue = run.catch(() => undefined);
  return run;
}

async function loadNow(a: Answer): Promise<Loaded> {
  const errors: string[] = [];
  const results: Record<string, Result> = {};
  // Views left by other answers are dropped, so an answer that reads another answer's table fails here rather than
  // later, when that table is gone or holds something else.
  const own = new Set(Object.keys(a.tables ?? {}));
  const stale = await query("SELECT view_name FROM duckdb_views() WHERE temporary AND NOT internal");
  for (const r of stale.rows) if (!own.has(String(r.view_name))) await exec(`DROP VIEW IF EXISTS ${String(r.view_name)}`);
  for (const [k, p] of Object.entries(a.params ?? {})) await exec(`SET VARIABLE ${k} = ${Number(p.value)}`);
  for (const [name, t] of Object.entries(a.tables)) {
    if (BASE.has(name)) { errors.push(`tables.${name}: the name is taken by a base table`); continue; }
    try {
      await exec(`CREATE OR REPLACE TEMP VIEW ${name} AS ${t.sql.replace(/;\s*$/, "")}`);
      results[name] = await query(`SELECT * FROM ${name} LIMIT ${MAX_ROWS + 1}`);
      if (results[name].rows.length > MAX_ROWS) errors.push(`tables.${name}: more than ${MAX_ROWS} rows`);
    } catch (e) {
      errors.push(`tables.${name}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  const cols: Record<string, Column[]> = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.columns]));
  errors.push(...check(a, cols));
  const filters: Filter[] = [];
  for (const [name, t] of Object.entries(a.tables)) {
    if (!results[name]) continue;
    try { filters.push(...(await findFilters(name, t.sql)).filters); } catch { /* unparseable SQL gets no controls */ }
  }
  return { results, filters, errors };
}

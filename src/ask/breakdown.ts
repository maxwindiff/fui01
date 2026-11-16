import { TABLES } from "./data";
import { query } from "./db";
import type { Loaded } from "./run";
import { human, labelOf } from "./spec";
import type { Answer, Channel, Layer } from "./spec";

// Bars of totals can be split by a second column of the rows behind them, or opened up into those rows. Both work
// from source_rows: each bar lists the ids of the base rows it adds up, so the page joins them back to the base table
// and groups them again. The original table stays in the answer, so its conditions keep their controls.

export interface Breakdown {
  layer: number;
  table: string;
  band: string;
  value: string;
  base: string;
  agg: "sum" | "count";
  measure?: string;
  options: { field: string; label: string; expr: string }[];
  current?: string;
  rows: number;
  bands: string[];
}
interface SplitNote { field: string; table: string; layer: number; original: Layer }

const BASES = new Map(TABLES.map((t) => [t.name, t]));
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const PART_TONES = ["accent", "t1", "t3", "t4", "t5", "t2", "t6"];

export function breakdown(a: Answer, loaded: Loaded): Breakdown | null {
  const note = a.notes?.split as SplitNote | undefined;
  const layers = note ? a.layers.map((l, i) => (i === note.layer ? note.original : l)) : a.layers;
  for (const [i, l] of layers.entries()) {
    if (l.mark !== "span" || !l.from || l.encoding.x2 || l.encoding.y2) continue;
    const r = loaded.results[l.from];
    const t = a.tables[l.from];
    if (!r || !t || !r.rows.some((row) => Array.isArray(row.source_rows))) continue;
    const typeOf = (c?: Channel) => r.columns.find((col) => col.name === c?.field)?.type;
    const [bandCh, valueCh] = typeOf(l.encoding.y) === "nominal" && typeOf(l.encoding.x) === "quantitative" ? [l.encoding.y, l.encoding.x]
      : typeOf(l.encoding.x) === "nominal" && typeOf(l.encoding.y) === "quantitative" ? [l.encoding.x, l.encoding.y] : [];
    if (!bandCh?.field || !valueCh?.field) continue;
    const base = [...t.sql.matchAll(/\bFROM\s+"?(\w+)"?/gi)].map((m) => m[1]).find((n) => BASES.has(n));
    const def = base ? BASES.get(base)! : null;
    if (!def || !("id" in def.columns)) continue;
    const m = t.sql.match(new RegExp(`\\b(sum|count)\\s*\\(\\s*(\\*|"?[a-z_][a-z0-9_]*"?)\\s*\\)\\s+AS\\s+"?${valueCh.field}"?(?![\\w"])`, "i"));
    if (!m) continue;
    const agg = m[1].toLowerCase() as "sum" | "count";
    const measure = agg === "sum" ? m[2].replace(/"/g, "") : undefined;
    if (measure && !(measure in def.columns)) continue;
    const rows = def.rows as Record<string, unknown>[];
    const options: Breakdown["options"] = [];
    for (const [col, type] of Object.entries(def.columns)) {
      if (col === "id" || col.endsWith("_id") || col === bandCh.field) continue;
      if (type === "DATE" || type === "TIMESTAMP") { options.push({ field: `${col}_year`, label: col === "date" ? "Year" : `Year of ${human(col).toLowerCase()}`, expr: `CAST(year(b.${q(col)}) AS VARCHAR)` }); continue; }
      if (type !== "VARCHAR" && type !== "BOOLEAN") continue;
      const n = new Set(rows.map((x) => x[col])).size;
      if (n >= 2 && n <= 40) options.push({ field: col, label: labelOf(a, col) || human(col), expr: `CAST(b.${q(col)} AS VARCHAR)` });
    }
    if (!options.length) continue;
    const count = r.rows.reduce((s, row) => s + (Array.isArray(row.source_rows) ? row.source_rows.length : 0), 0);
    return { layer: i, table: l.from, band: bandCh.field, value: valueCh.field, base: base!, agg, measure, options, current: note?.field, rows: count, bands: [...new Set(r.rows.map((row) => String(row[bandCh.field!])))] };
  }
  return null;
}

// Removes a split, giving back the layer as it was.
export function unsplit(a: Answer): Answer {
  const note = a.notes?.split as SplitNote | undefined;
  if (!note) return a;
  const { [`${note.table}_parts`]: _gone, ...tables } = a.tables;
  const { split: _s, ...notes } = a.notes ?? {};
  return { ...a, tables, notes, layers: a.layers.map((l, i) => (i === note.layer ? note.original : l)) };
}

// Each bar becomes a stack of parts. With more than seven values in the column, the six largest across the whole view
// keep their own colour and the rest become Other.
export async function split(a0: Answer, b: Breakdown, field: string): Promise<Answer> {
  const a = unsplit(a0);
  const opt = b.options.find((o) => o.field === field)!;
  const name = `${b.table}_parts`;
  const v = b.agg === "sum" ? `sum(b.${q(b.measure!)})` : "count(*)";
  const sql = `WITH parts AS (
  SELECT t.${q(b.band)} AS band, t.ord, coalesce(${opt.expr}, 'No value') AS part, ${v} AS v, list(b.id) AS ids
  FROM (SELECT ${q(b.band)}, ord, unnest(source_rows) AS rid FROM (SELECT ${q(b.band)}, source_rows, row_number() OVER () AS ord FROM ${b.table})) t
  JOIN ${b.base} b ON b.id = t.rid
  GROUP BY ALL
), top_parts AS (
  SELECT part FROM (SELECT part, row_number() OVER (ORDER BY sum(v) DESC) AS k, count(*) OVER () AS n FROM parts GROUP BY part)
  WHERE k <= 6 OR n <= 7
)
SELECT band || ':' || coalesce(top_parts.part, 'Other') AS key, band AS ${q(b.band)}, coalesce(top_parts.part, 'Other') AS ${q(field)}, sum(v) AS ${q(b.value)}, flatten(list(ids)) AS source_rows
FROM parts LEFT JOIN top_parts ON parts.part = top_parts.part
GROUP BY ALL
ORDER BY min(ord), ${field.endsWith("_year") ? `${q(field)}` : "sum(v) DESC"}`;
  const top = await query(`WITH parts AS (SELECT coalesce(${opt.expr}, 'No value') AS part, ${v} AS v FROM (SELECT unnest(source_rows) AS rid FROM ${b.table}) t JOIN ${b.base} b ON b.id = t.rid GROUP BY ALL) SELECT part FROM parts ORDER BY v DESC`);
  const named = top.rows.slice(0, top.rows.length <= 7 ? 7 : 6);
  const map = Object.fromEntries([...named.map((r, i) => [String(r.part), PART_TONES[i]]), ["Other", "ink"]]);
  const original = a.layers[b.layer];
  const keep = new Set([b.band, b.value]);
  const enc = Object.fromEntries(Object.entries(original.encoding).filter(([k, c]) => !c?.field || keep.has(c.field) || k === "x" || k === "y"));
  const layer: Layer = { ...original, from: name, adjust: "stack", encoding: { ...enc, text: undefined, tone: { field, map } } };
  return {
    ...a,
    tables: { ...a.tables, [name]: { key: "key", sql } },
    layers: a.layers.map((l, i) => (i === b.layer ? layer : l)),
    labels: { ...a.labels, [field]: opt.label },
    notes: { ...a.notes, split: { field, table: b.table, layer: b.layer, original } satisfies SplitNote },
  };
}

// Opens the bars into the rows they add up, as a table. A condition on the bar column names the selected bars, or all
// of them, so the reader can add bars back or take them out with the control the page makes for it.
export function listRows(a0: Answer, b: Breakdown, bands: string[], all: string[]): Answer {
  const a = unsplit(a0);
  const where = ` WHERE ${q(b.band)} IN (${(bands.length ? bands : all).map(lit).join(", ")})`;
  const sql = `SELECT * FROM ${b.base}\nWHERE id IN (SELECT unnest(source_rows) FROM ${b.table}${where})${b.measure ? `\nORDER BY ${q(b.measure)} DESC` : ""}`;
  const units = a.unit?.[1] ?? "rows";
  return {
    ...a,
    title: bands.length ? `${units[0].toUpperCase()}${units.slice(1)} in ${bands.length > 2 ? `${bands.length} ${labelOf(a, b.band).toLowerCase()} values` : bands.join(" and ")}` : `${units[0].toUpperCase()}${units.slice(1)} behind ${a.title[0].toLowerCase()}${a.title.slice(1)}`,
    tables: { ...a.tables, listed: { key: "id", sql } },
    layers: [{ from: "listed", mark: "point", encoding: b.band in BASES.get(b.base)!.columns ? { tone: { field: b.band } } : {} }],
    form: "table",
    sort: b.measure ? { field: b.measure, desc: true } : undefined,
    notes: { ...a.notes, split: undefined },
  };
}

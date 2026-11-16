import { parse, query, unparse } from "./db";
import type { Ast, AstRoot } from "./db";
import { human } from "./spec";
import type { Answer } from "./spec";

// Every comparison of an expression with constants in a WHERE or HAVING clause, or as a boolean column, becomes
// a control on the page. Comparisons are found in the parse tree, so the agent writes plain SQL and declares nothing.

export type Op = "=" | "≠" | "<" | ">" | "≤" | "≥";
export type VType = "number" | "date" | "timestamp" | "text" | "bool";
interface Base { id: string; table: string; path: (string | number)[]; sel: (string | number)[]; label: string; expr: string; vtype: VType; clause: "where" | "having" | "column" }
export interface Compare extends Base { kind: "compare"; op: Op; value: number | string }
export interface Between extends Base { kind: "between"; lo: number | string; hi: number | string }
export interface InSet extends Base { kind: "in"; not: boolean; values: string[] }
export type Filter = (Compare | Between | InSet) & { domain?: Domain };
export type Domain = { min: number; max: number; int: boolean } | { values: string[] };

const OPS: Record<string, Op> = {
  COMPARE_EQUAL: "=", COMPARE_NOTEQUAL: "≠", COMPARE_LESSTHAN: "<", COMPARE_GREATERTHAN: ">",
  COMPARE_LESSTHANOREQUALTO: "≤", COMPARE_GREATERTHANOREQUALTO: "≥",
};
const OP_TYPE = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k])) as Record<Op, string>;
const FLIP: Record<Op, Op> = { "=": "=", "≠": "≠", "<": ">", ">": "<", "≤": "≥", "≥": "≤" };

interface Const { value: number | string; vtype: VType }
function constant(e: Ast | undefined): Const | null {
  if (!e) return null;
  if (e.class === "CONSTANT" && !e.value.is_null) {
    const id = e.value.type.id, v = e.value.value;
    if (id === "DECIMAL") return { value: v / Math.pow(10, e.value.type.type_info.scale), vtype: "number" };
    if (/INT|DOUBLE|FLOAT|REAL/.test(id)) return { value: Number(v), vtype: "number" };
    if (id === "VARCHAR") return { value: String(v), vtype: /^\d{4}-\d\d-\d\d( |$)/.test(v) ? (v.length > 10 ? "timestamp" : "date") : "text" };
    if (id === "BOOLEAN") return { value: v ? "true" : "false", vtype: "bool" };
    return null;
  }
  if (e.class === "CAST" && e.child?.class === "CONSTANT") {
    const t = e.cast_type.id;
    const c = constant(e.child);
    if (!c) return null;
    if (t === "DATE") return { value: String(c.value), vtype: "date" };
    if (t.startsWith("TIMESTAMP")) return { value: String(c.value), vtype: "timestamp" };
    if (t === "BOOLEAN") return { value: c.value === "t" || c.value === "true" ? "true" : "false", vtype: "bool" };
    return c;
  }
  // A negative number parses as a function applied to a constant.
  if (e.class === "FUNCTION" && e.function_name === "-" && e.children?.length === 1) {
    const c = constant(e.children[0]);
    return c && c.vtype === "number" ? { value: -c.value, vtype: "number" } : null;
  }
  return null;
}
const isConst = (e: Ast) => constant(e) !== null;
const hasColumn = (e: Ast): boolean => !!e && typeof e === "object" && (e.class === "COLUMN_REF" || Object.values(e).some((v) => (Array.isArray(v) ? v.some(hasColumn) : typeof v === "object" && hasColumn(v as Ast))));

let template: Ast | null = null;
async function exprText(e: Ast) {
  template ??= (await parse("SELECT 1")).statements[0].node;
  const node = { ...structuredClone(template), select_list: [{ ...e, alias: "" }] };
  return (await unparse({ error: false, statements: [{ node }] })).replace(/^SELECT /, "");
}
const labelFor = (e: Ast, text: string) => (e.class === "COLUMN_REF" ? human(e.column_names[e.column_names.length - 1]) : text);

function at(root: Ast, path: (string | number)[]) {
  return path.reduce<Ast>((o, k) => o[k], root);
}

interface Found { path: (string | number)[]; clause: Base["clause"]; select: (string | number)[] }
function collect(node: Ast, path: (string | number)[], out: Found[]) {
  if (!node || typeof node !== "object") return;
  if (node.type === "SELECT_NODE") {
    const conds = (e: Ast, p: (string | number)[], clause: Found["clause"]) => {
      if (!e) return;
      if (e.class === "CONJUNCTION" && e.type === "CONJUNCTION_AND") e.children.forEach((c: Ast, i: number) => conds(c, [...p, "children", i], clause));
      else out.push({ path: p, clause, select: path });
    };
    conds(node.where_clause, [...path, "where_clause"], "where");
    conds(node.having, [...path, "having"], "having");
    node.select_list?.forEach((e: Ast, i: number) => {
      if (["COMPARISON", "BETWEEN"].includes(e.class) || (e.class === "OPERATOR" && /COMPARE_(NOT_)?IN/.test(e.type))) out.push({ path: [...path, "select_list", i], clause: "column", select: path });
    });
  }
  for (const [k, v] of Object.entries(node)) {
    if (Array.isArray(v)) v.forEach((c, i) => collect(c, [...path, k, i], out));
    else if (v && typeof v === "object") collect(v as Ast, [...path, k], out);
  }
}

export async function findFilters(table: string, sql: string): Promise<{ tree: AstRoot; filters: Filter[] }> {
  const tree = await parse(sql);
  const found: Found[] = [];
  collect(tree.statements[0].node, ["statements", 0, "node"], found);
  const filters: Filter[] = [];
  for (const f of found) {
    const e = at(tree, f.path);
    const base = { table, path: f.path, sel: f.select, clause: f.clause, id: `${table}:${f.path.join(".")}` };
    if (e.class === "COMPARISON" && OPS[e.type]) {
      let left = e.left, right = e.right, op = OPS[e.type];
      if (isConst(left) && !isConst(right)) { [left, right] = [right, left]; op = FLIP[op]; }
      const c = constant(right);
      if (!c || !hasColumn(left) || c.vtype === "bool") continue;
      if (c.vtype === "text" && !["=", "≠"].includes(op)) continue;
      const expr = await exprText(left);
      filters.push({ ...base, kind: "compare", op, value: c.value, vtype: c.vtype, expr, label: labelFor(left, expr) });
    } else if (e.class === "BETWEEN") {
      const lo = constant(e.lower), hi = constant(e.upper);
      if (!lo || !hi || !hasColumn(e.input)) continue;
      const expr = await exprText(e.input);
      filters.push({ ...base, kind: "between", lo: lo.value, hi: hi.value, vtype: lo.vtype === "text" ? hi.vtype : lo.vtype, expr, label: labelFor(e.input, expr) });
    } else if (e.class === "OPERATOR" && /COMPARE_(NOT_)?IN/.test(e.type)) {
      const [left, ...rest] = e.children;
      const cs = rest.map(constant);
      if (!hasColumn(left) || cs.some((c: Const | null) => !c || c.vtype !== "text")) continue;
      const expr = await exprText(left);
      filters.push({ ...base, kind: "in", not: e.type === "COMPARE_NOT_IN", values: cs.map((c: Const) => String(c.value)), vtype: "text", expr, label: labelFor(left, expr) });
    }
  }
  await Promise.all(filters.map(async (f) => { f.domain = await domainOf(tree, f).catch(() => undefined); }));
  return { tree, filters };
}

const leftOf = (e: Ast) => (e.class === "COMPARISON" ? (isConst(e.left) ? e.right : e.left) : e.class === "BETWEEN" ? e.input : e.children[0]);

// The values the compared expression takes over the same FROM clause with no conditions, so a slider can range
// over all of them. A correlated subquery has no FROM of its own to read, and its control falls back to a range
// around the current value.
async function domainOf(tree: AstRoot, f: Filter): Promise<Domain> {
  const select = structuredClone(at(tree, f.sel));
  select.select_list = [{ ...structuredClone(leftOf(at(tree, f.path))), alias: "v" }];
  select.where_clause = null;
  select.having = null;
  select.modifiers = [];
  if (f.clause !== "having") { select.group_expressions = []; select.group_sets = []; }
  if (!select.cte_map?.map?.length) select.cte_map = structuredClone(tree.statements[0].node.cte_map);
  const inner = await unparse({ error: false, statements: [{ node: select }] });
  const k = `${f.vtype}|${inner}`;
  if (!domains.has(k)) domains.set(k, readDomain(inner, f.vtype));
  return domains.get(k)!;
}
const domains = new Map<string, Promise<Domain>>();
async function readDomain(inner: string, vtype: VType): Promise<Domain> {
  if (vtype === "text") {
    const r = await query(`SELECT DISTINCT CAST(v AS VARCHAR) AS v FROM (${inner}) WHERE v IS NOT NULL ORDER BY 1 LIMIT 60`);
    return { values: r.rows.map((x) => String(x.v)) };
  }
  const num = vtype === "number" ? "v" : "epoch_ms(v)";
  const r = await query(`SELECT min(${num}) AS lo, max(${num}) AS hi, bool_and(${num} = round(${num})) AS int FROM (${inner})`);
  const row = r.rows[0];
  return { min: Number(row.lo), max: Number(row.hi), int: !!row.int };
}

export const toMs = (v: number | string) => (typeof v === "number" ? v : Date.parse(v.length > 10 ? v.replace(" ", "T") + "Z" : v + "T00:00:00Z"));
export const fromMs = (ms: number, vtype: VType) => {
  const s = new Date(ms).toISOString();
  return vtype === "timestamp" ? s.slice(0, 19).replace("T", " ") : s.slice(0, 10);
};

function setConst(e: Ast, v: number | string, vtype: VType) {
  if (vtype === "number") {
    const n = Number(v);
    return { class: "CONSTANT", type: "VALUE_CONSTANT", alias: "", value: { type: { id: Number.isInteger(n) ? "INTEGER" : "DOUBLE", type_info: null }, is_null: false, value: n } };
  }
  const value = { class: "CONSTANT", type: "VALUE_CONSTANT", alias: "", value: { type: { id: "VARCHAR", type_info: null }, is_null: false, value: String(v) } };
  if (vtype === "date" || vtype === "timestamp") return { class: "CAST", type: "OPERATOR_CAST", alias: e?.alias ?? "", child: value, cast_type: { id: vtype === "date" ? "DATE" : "TIMESTAMP", type_info: null }, try_cast: false };
  return value;
}

export type FilterEdit = { op?: Op; value?: number | string; lo?: number | string; hi?: number | string; values?: string[]; remove?: boolean };

export async function editFilter(a: Answer, f: Filter, ed: FilterEdit): Promise<Answer> {
  const tree = await parse(a.tables[f.table].sql);
  const e = at(tree, f.path);
  if (ed.remove) {
    const parentPath = f.path.slice(0, -2);
    const parent = at(tree, parentPath);
    if (f.clause === "column") return a;
    if (parent?.class === "CONJUNCTION") {
      parent.children.splice(f.path[f.path.length - 1], 1);
      if (parent.children.length === 1) Object.assign(at(tree, parentPath), parent.children[0]);
    } else {
      const holder = at(tree, f.path.slice(0, -1));
      holder[f.path[f.path.length - 1]] = null;
    }
  } else if (f.kind === "compare") {
    const leftConst = isConst(e.left) && !isConst(e.right);
    const op = ed.op ?? f.op;
    e.type = OP_TYPE[leftConst ? FLIP[op] : op];
    const side = leftConst ? "left" : "right";
    if (ed.value !== undefined) e[side] = setConst(e[side], ed.value, f.vtype);
  } else if (f.kind === "between") {
    if (ed.lo !== undefined) e.lower = setConst(e.lower, ed.lo, f.vtype);
    if (ed.hi !== undefined) e.upper = setConst(e.upper, ed.hi, f.vtype);
  } else if (f.kind === "in" && ed.values) {
    if (!ed.values.length) return a;
    e.children = [e.children[0], ...ed.values.map((v) => setConst(null as unknown as Ast, v, "text"))];
  }
  const sql = await unparse(tree);
  return { ...a, tables: { ...a.tables, [f.table]: { ...a.tables[f.table], sql } } };
}

export function describe(f: Filter, fmt: (v: number | string) => string): string {
  if (f.kind === "compare") return `${f.label} ${f.op} ${fmt(f.value)}`;
  if (f.kind === "between") return `${f.label} ${fmt(f.lo)} to ${fmt(f.hi)}`;
  return `${f.label} ${f.not ? "not " : ""}${f.values.length > 2 ? `${f.values.length} values` : f.values.join(", ")}`;
}

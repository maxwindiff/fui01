import type { ReactNode } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import type { Column } from "./db";
import { fmtDate, fmtValue } from "./format";
import type { MapData } from "./map";
import type { Loaded } from "./run";
import { CHANNELS, CONVENTIONS, inferType, labelOf } from "./spec";
import type { Answer, Channel, FieldType, Layer, Look, Token } from "./spec";

// Turns an answer and its query results into marks with positions, the axes around them and the key.

export interface Label { text: string; dx: number; dy: number; anchor: "start" | "middle" | "end" }
export interface MarkT { id: string; x: number; y: number; w: number; h: number; rx: number; rot: number; cls: string; src?: string[]; layer: number; row: Record<string, unknown>; label?: Label; want?: string }
export interface LinkT { id: string; a: string; b: string; cls: string; w: number; dir: boolean }
export interface KeyItem { label: string; cls: string; shape: string }
export interface KeyEntry { title: string; items: KeyItem[]; rank?: number }
export interface AxisTitle { axis: "x" | "y"; text: string; x: number; y: number; field: string; anchor: "start" | "end" }
export interface Tick { p: number; label: string }
// The plot area and its ticks, for the 3D view, which lays its ground out over the same area.
export interface Frame { x0: number; y0: number; x1: number; y1: number; xt: Tick[]; yt: Tick[]; xBand: boolean; yBand: boolean; map?: { ox: number; oy: number; s: number } }
export interface Scene { marks: MarkT[]; links: LinkT[]; chrome: ReactNode; over?: ReactNode; key: KeyEntry[]; titles: AxisTitle[]; height: number; columns?: TableCol[]; rows?: TableRow[]; frame?: Frame }
export interface TableCol { field: string; label: string; x: number; w: number; num: boolean; type: string }
export interface TableRow { id: string; y: number; cells: string[] }

interface L { l: Layer; i: number; rows: Record<string, unknown>[]; cols: Column[]; key?: string }
type V = number | string;
interface Scale { kind: "band" | "linear" | "time"; pos: (v: V) => number; step: number; bands: string[]; ticks: { p: number; label: string }[]; bin?: number }

const AUTO: Record<Look, Token[]> = {
  tone: ["ink", "accent", "t1", "t3", "t4", "t5", "t6", "t2"],
  fill: ["solid", "hollow", "hatch", "tint"],
  weight: ["strong", "normal", "quiet", "ghost"],
  shape: ["dot", "diamond", "square", "ring"],
};

const num = (v: unknown): number => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Number(v));
const hashUnit = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
}

function linear(lo: number, hi: number, a: number, b: number, count: number, fmt: (v: number) => string): Scale {
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceStep(hi - lo, count);
  const d0 = Math.floor(lo / step) * step, d1 = Math.ceil(hi / step) * step;
  const pos = (v: V) => a + ((num(v) - d0) / (d1 - d0)) * (b - a);
  const ticks = [];
  for (let v = d0; v <= d1 + step / 2; v += step) ticks.push({ p: pos(v), label: fmt(+v.toPrecision(12)) });
  return { kind: "linear", pos, step: 0, bands: [], ticks };
}

const DAY = 864e5;
function time(lo: number, hi: number, a: number, b: number, px: number): Scale {
  const pad = (hi - lo) * 0.03 || DAY;
  const d0 = lo - pad, d1 = hi + pad;
  const pos = (v: V) => a + ((num(v) - d0) / (d1 - d0)) * (b - a);
  const span = d1 - d0, ticks: Scale["ticks"] = [];
  const room = Math.max(2, Math.floor(px / 70));
  if (span > 2 * 365 * DAY) {
    const y0 = new Date(d0).getUTCFullYear() + 1, y1 = new Date(d1).getUTCFullYear();
    const every = Math.max(1, Math.ceil((y1 - y0 + 1) / room));
    for (let y = y0; y <= y1; y += every) ticks.push({ p: pos(Date.UTC(y, 0, 1)), label: String(y) });
  } else if (span > 45 * DAY) {
    const s = new Date(d0);
    const every = Math.max(1, Math.ceil(span / (30 * DAY) / room));
    for (let m = s.getUTCMonth() + 1, y = s.getUTCFullYear(); Date.UTC(y, m, 1) < d1; m += every) {
      const t = Date.UTC(y, m, 1);
      const d = new Date(t);
      ticks.push({ p: pos(t), label: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : fmtDate(t).split(" ")[1] });
    }
  } else if (span > 2 * DAY) {
    const every = Math.max(1, Math.ceil(span / DAY / room));
    for (let t = Math.ceil(d0 / DAY) * DAY; t < d1; t += every * DAY) ticks.push({ p: pos(t), label: fmtDate(t).split(" ").slice(0, 2).join(" ") });
  } else {
    const H = 36e5, every = Math.max(1, Math.ceil(span / H / room));
    for (let t = Math.ceil(d0 / H) * H; t < d1; t += every * H) ticks.push({ p: pos(t), label: `${new Date(t).getUTCHours()}:00` });
  }
  return { kind: "time", pos, step: 0, bands: [], ticks };
}

function band(cats: string[], a: number, b: number): Scale {
  const step = (b - a) / Math.max(1, cats.length);
  const idx = new Map(cats.map((c, i) => [c, i]));
  return { kind: "band", pos: (v) => a + step * ((idx.get(String(v)) ?? 0) + 0.5), step, bands: cats, ticks: cats.map((c, i) => ({ p: a + step * (i + 0.5), label: c })) };
}

const autoField = (L: L, ch: Look) => CONVENTIONS.find((v) => v.auto && v.channel === ch && L.cols.some((col) => col.name === v.field))?.field;

function tokenFor(a: Answer, L: L, ch: Look, row: Record<string, unknown>, seen: Map<string, string[]>): Token | null {
  const c = L.l.encoding[ch];
  if (c?.value !== undefined) return String(c.value);
  const field = c?.field ?? autoField(L, ch);
  if (!field) return null;
  const v = String(row[field]);
  const map = c?.map ?? CONVENTIONS.find((x) => x.channel === ch && x.field === field)?.map;
  if (map?.[v]) return map[v];
  const k = `${ch}:${field}`;
  const list = seen.get(k) ?? [];
  seen.set(k, list);
  if (!list.includes(v)) list.push(v);
  return AUTO[ch][list.indexOf(v) % AUTO[ch].length];
}

function looks(a: Answer, L: L, row: Record<string, unknown>, seen: Map<string, string[]>) {
  const t = Object.fromEntries(CHANNELS.map((c) => [c, tokenFor(a, L, c, row, seen)])) as Record<Look, Token | null>;
  const shape = t.shape ?? (L.l.mark === "point" ? "dot" : "square");
  const fill = shape === "ring" ? "hollow" : t.fill ?? (L.l.mark === "point" ? "tint" : "solid");
  return { cls: `m-${L.l.mark} f-${fill} w-${t.weight ?? "normal"} t-${t.tone ?? "ink"}`, shape };
}

function keyEntries(a: Answer, ls: L[], seen: Map<string, string[]>): KeyEntry[] {
  const out: KeyEntry[] = [];
  const done = new Set<string>();
  for (const L of ls) {
    if (L.l.mark === "rule" || L.l.mark === "text") continue;
    const line = L.l.mark === "link";
    const base = looks(a, L, {}, new Map());
    const lead = ls.filter((x) => x.l.from && !["rule", "text", "link"].includes(x.l.mark)).sort((p, q) => q.rows.length - p.rows.length)[0];
    // Channels mapped from the same field share an entry, so each value shows its tone and shape together.
    const fields = new Map<string, Look[]>();
    for (const ch of CHANNELS) {
      const c = L.l.encoding[ch];
      const field = c?.field ?? (c?.value === undefined ? autoField(L, ch) : undefined);
      if (field) fields.set(field, [...(fields.get(field) ?? []), ch]);
    }
    // The unit entry shows what a single mark stands for. When the marks take their shape from a field, its swatch
    // matches none of them, and when the unit is also the name of a mapped field the two entries read the same.
    const unit = a.unit?.[0].toLowerCase();
    const shaped = [...fields.values()].some((chs) => chs.includes("shape"));
    const echoed = [...fields.keys()].some((f) => labelOf(a, f).toLowerCase() === unit);
    if (!line && L === lead && a.unit && !shaped && !echoed && !L.rows.some((r) => Array.isArray(r.source_rows))) {
      const size = L.l.encoding.size?.field;
      out.push({ title: "", items: [{ label: `${a.unit[0][0].toUpperCase()}${a.unit[0].slice(1)}${size ? `, sized by ${labelOf(a, size).toLowerCase()}` : ""}`, cls: base.cls, shape: base.shape }] });
    }
    for (const [field, chs] of fields) {
      const id = `${L.l.from}:${field}`;
      if (done.has(id)) continue;
      done.add(id);
      const vals = [...new Set(L.rows.map((r) => String(r[field])))].slice(0, 8);
      if (vals.length < 2 && !chs.includes("fill")) continue;
      out.push({
        rank: line || chs.includes("tone") ? 0 : chs.includes("shape") ? 1 : chs.includes("fill") ? 2 : 3,
        title: labelOf(a, field),
        items: vals.map((v) => {
          const row = { ...L.rows.find((r) => String(r[field]) === v) };
          const t = Object.fromEntries(chs.map((ch) => [ch, tokenFor(a, L, ch, row, seen)])) as Partial<Record<Look, Token | null>>;
          const fixed = looks(a, L, Object.fromEntries(Object.keys(L.l.encoding).map((k) => [k, undefined])), new Map());
          const shape = line ? "line" : t.shape ?? (L.l.encoding.shape?.value as string | undefined) ?? fixed.shape;
          const fill = t.fill ?? (shape === "ring" ? "hollow" : (L.l.encoding.fill?.value as string | undefined) ?? (L.l.mark === "point" ? "tint" : "solid"));
          const cls = `m-${L.l.mark} f-${fill} w-${t.weight ?? "normal"} t-${t.tone ?? (L.l.encoding.tone?.value as string | undefined) ?? "ink"}${shape === "arrow" ? " s-arrow" : ""}`;
          const label = v === "true" ? "Yes" : v === "false" ? "No" : v === "null" || v === "undefined" ? "No value" : v;
          return { label, cls, shape: line ? "line" : shape };
        }),
      });
    }
  }
  // Layers that map the same field show one group, listing each value once for every look it takes.
  const merged: KeyEntry[] = [];
  for (const e of out) {
    const into = e.title ? merged.find((m) => m.title === e.title) : undefined;
    if (!into) { merged.push({ ...e, items: [...e.items] }); continue; }
    for (const it of e.items) if (!into.items.some((x) => x.label === it.label && x.cls === it.cls && x.shape === it.shape)) into.items.push(it);
  }
  // At most two groups show, preferring colour, then shape, then the rest. The fields left out still show in each
  // mark's tip.
  if (merged.length <= 2) return merged;
  const keep = new Set([...merged].sort((p, q) => (p.rank ?? 0) - (q.rank ?? 0)).slice(0, 2));
  return merged.filter((e) => keep.has(e));
}

// Text widths come from the page, which measures them in the theme's fonts. The fallback is a rough average.
let measure: (s: string, cls: string) => number = (s) => s.length * 6.3;
export function setMeasure(f: (s: string, cls: string) => number) { measure = f; }
const textW = (s: string, cls = "c-label") => measure(s, cls);
const clip = (t: string, w: number, cls = "c-label") => {
  if (textW(t, cls) <= w) return t;
  let s = t;
  while (s.length > 1 && textW(`${s}…`, cls) > w) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
};
const charW = (cls: string) => measure("Aerospace and defense", cls) / 21;
const axisChannel = (ls: L[], ax: "x" | "y") => {
  const chs = ls.filter((L) => L.l.mark !== "rule" && L.l.mark !== "text").map((L) => L.l.encoding[ax]).filter((c) => c?.field);
  return chs.find((c) => c!.title) ?? chs[0] ?? ls.map((L) => L.l.encoding[ax]).find((c) => c?.field);
};

// The key sits in the top right corner of the chart, in rows that wrap and line up on the right edge.
const KEY_ROW = 18;
function keyLayout(entries: KeyEntry[], right: number, room: number) {
  type Tok = { w: number; title?: string; item?: KeyItem; lead: boolean };
  const toks: Tok[] = entries.flatMap((e) => [
    ...(e.title ? [{ w: textW(e.title, "c-label") + 8, title: e.title, lead: true }] : []),
    ...e.items.map((it, i) => ({ w: 17 + textW(it.label, "c-label") + 14, item: it, lead: !e.title && i === 0 })),
  ]);
  const rows: Tok[][] = [[]];
  let used = 0;
  for (const t of toks) {
    const gap = t.lead && rows[rows.length - 1].length ? 12 : 0;
    if (used + gap + t.w > room && rows[rows.length - 1].length) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(t);
    used += (rows[rows.length - 1].length > 1 ? gap : 0) + t.w;
  }
  if (!toks.length) return { height: 0, node: null };
  const node = (top: number) => (
    <g key="key" className="ask-legend">
      {rows.map((row, r) => {
        const width = row.reduce((s, t, i) => s + t.w + (i && t.lead ? 12 : 0), 0) - 14;
        let x = right - width;
        const y = top + r * KEY_ROW + 9;
        return row.map((t, i) => {
          if (i && t.lead) x += 12;
          const at = x;
          x += t.w;
          if (t.title) return <text key={`${r}-${i}`} className="c-label dim" x={at} y={y + 4}>{t.title}</text>;
          const it = t.item!;
          const d = it.shape === "diamond" ? 7.5 : 9;
          return (
            <g key={`${r}-${i}`}>
              {it.shape === "line"
                ? <path className={`ask-link ${it.cls}`} d={`M${at} ${y}H${at + 12}`} />
                : <g className={`ask-m ask-sw-m ${it.cls}`} transform={`translate(${at + 6} ${y})${it.shape === "diamond" ? " rotate(45)" : ""}`}><rect x={-d / 2} y={-d / 2} width={d} height={d} rx={it.shape === "dot" || it.shape === "ring" ? d / 2 : 0} /></g>}
              <text className="c-label" x={at + 17} y={y + 4}>{it.label}</text>
            </g>
          );
        });
      })}
    </g>
  );
  return { height: rows.length * KEY_ROW + 6, node };
}

export function scene(a: Answer, data: Loaded, W: number, H: number, map: MapData | null, scope: string): Scene {
  const ls: L[] = a.layers.map((l, i) => ({
    l, i,
    rows: l.from ? data.results[l.from]?.rows ?? [] : [{}],
    cols: l.from ? data.results[l.from]?.columns ?? [] : [],
    key: l.from ? a.tables[l.from]?.key : undefined,
  }));
  const ids = new Set<string>();
  const idOf = (L: L, r: Record<string, unknown>, j: number) => {
    let id = L.key && r[L.key] != null ? String(r[L.key]) : `${scope}:${L.i}:${j}`;
    if (ids.has(id)) id = `${id}#${L.i}`;
    ids.add(id);
    return id;
  };
  const srcOf = (r: Record<string, unknown>) => (Array.isArray(r.source_rows) ? r.source_rows.map(String) : undefined);
  return a.form === "table" ? tableScene(a, ls, W, H, idOf, srcOf) : chartScene(a, ls, W, H, map, idOf, srcOf);
}

function tableScene(a: Answer, ls: L[], W: number, H: number, idOf: (L: L, r: Record<string, unknown>, j: number) => string, srcOf: (r: Record<string, unknown>) => string[] | undefined): Scene {
  const L = ls.find((x) => x.l.from && !["rule", "text", "link"].includes(x.l.mark)) ?? ls[0];
  const seen = new Map<string, string[]>();
  const hidden = new Set([L.key, "source_rows"]);
  const cols = L.cols.filter((c) => !hidden.has(c.name) && c.type !== "list");
  let rows = L.rows.map((r, j) => ({ r, id: idOf(L, r, j) }));
  if (a.sort) {
    const { field, desc } = a.sort;
    rows = [...rows].sort((p, q) => {
      const u = p.r[field], v = q.r[field];
      const c = typeof u === "number" && typeof v === "number" ? u - v : String(u).localeCompare(String(v));
      return desc ? -c : c;
    });
  }
  const RH = 24, top = 34, left = 34;
  const sample = rows.slice(0, 200);
  const want = cols.map((c) => Math.min(260, Math.max(textW(labelOf(a, c.name), "ask-th-probe") + 24, ...sample.map((x) => textW(fmtValue(a, c.name, x.r[c.name], c.type)) + 16))));
  const total = want.reduce((s, w) => s + w, 0);
  const scale = Math.min(1, (W - left - 12) / Math.max(1, total));
  let x = left;
  const columns: TableCol[] = cols.map((c, i) => {
    const w = want[i] * scale;
    const col = { field: c.name, label: labelOf(a, c.name), x, w, num: c.type === "quantitative", type: c.type };
    x += w;
    return col;
  });
  const marks: MarkT[] = rows.map(({ r, id }, k) => {
    const lk = looks(a, L, r, seen);
    const y = top + k * RH + RH / 2;
    const span = L.l.mark === "span" || L.l.mark === "cell";
    const w = span ? 14 : 9, h = span ? 8 : 9;
    return { id, x: 17, y, w, h, rx: lk.shape === "dot" ? 4.5 : 0, rot: lk.shape === "diamond" ? 45 : 0, cls: lk.cls, src: srcOf(r), layer: L.i, row: r };
  });
  const tableRows: TableRow[] = rows.map(({ r, id }, k) => ({ id, y: top + k * RH, cells: cols.map((c) => fmtValue(a, c.name, r[c.name], c.type)) }));
  const key = keyEntries(a, [L], seen);
  const kl = keyLayout(key, W - 12, W - 24);
  const end = top + rows.length * RH + 12;
  return { marks, links: [], chrome: kl.node?.(end), key, titles: [], height: Math.max(H, end + kl.height + 8), columns, rows: tableRows };
}

function chartScene(a: Answer, ls: L[], W: number, H: number, map: MapData | null, idOf: (L: L, r: Record<string, unknown>, j: number) => string, srcOf: (r: Record<string, unknown>) => string[] | undefined): Scene {
  const seen = new Map<string, string[]>();
  const colOf = (L: L, f?: string) => L.cols.find((c) => c.name === f);
  const typeOf = (L: L, ch?: Channel): FieldType | null => {
    if (!ch) return null;
    if (ch.field) return inferType(colOf(L, ch.field), ch);
    if (ch.type) return ch.type;
    return ch.datum !== undefined || ch.param ? (typeof ch.datum === "string" ? "nominal" : "quantitative") : null;
  };
  const val = (L: L, ch: Channel | undefined, r: Record<string, unknown>): V | null => {
    if (!ch) return null;
    if (ch.param) return a.params?.[ch.param]?.value ?? null;
    if (ch.datum !== undefined) return typeof ch.datum === "string" && typeOf(L, ch) === "temporal" ? Date.parse(ch.datum) : ch.datum;
    if (!ch.field) return null;
    const v = r[ch.field];
    if (v === null || v === undefined) return null;
    const t = typeOf(L, ch);
    return t === "quantitative" || t === "temporal" ? num(v) : String(v);
  };
  const placeMode = ls.some((L) => L.l.encoding.place);

  // Axis kinds and the values each axis has to show.
  type Ax = "x" | "y";
  const kindOf = (ax: Ax): FieldType | null => {
    for (const L of ls) for (const k of [ax, `${ax}2`] as const) { const t = typeOf(L, L.l.encoding[k]); if (t && L.l.encoding[k]?.field) return t; }
    for (const L of ls) { const t = typeOf(L, L.l.encoding[ax]); if (t) return t; }
    return null;
  };
  const kx = placeMode ? null : kindOf("x"), ky = placeMode ? null : kindOf("y");
  const binOf = (ax: Ax) => ls.map((L) => L.l.encoding[ax]?.bin).find((b) => b);
  const cats = (ax: Ax) => {
    const out: string[] = [];
    for (const L of ls) for (const r of L.rows) { const v = val(L, L.l.encoding[ax], r); if (v !== null && L.l.encoding[ax]?.field && !out.includes(String(v))) out.push(String(v)); }
    return out;
  };

  // Spans without a second end stack along the quantitative axis, keyed by their place on the other axis.
  interface Pre { L: L; r: Record<string, unknown>; j: number; x: V | null; y: V | null; x2: V | null; y2: V | null }
  const valueAxis = (L: L): Ax | null => (ky === "quantitative" && (kx !== "quantitative" || L.l.encoding.x?.bin) ? "y" : kx === "quantitative" ? "x" : null);
  const pre: Pre[] = [];
  const acc = new Map<string, number>();
  for (const L of ls) {
    const e = L.l.encoding;
    L.rows.forEach((r, j) => {
      const p: Pre = { L, r, j, x: val(L, e.x, r), y: val(L, e.y, r), x2: val(L, e.x2, r), y2: val(L, e.y2, r) };
      if (L.l.mark === "span" && p.x2 === null && p.y2 === null) {
        const vAxis = valueAxis(L);
        if (vAxis) {
          const base = vAxis === "y" ? p.x : p.y;
          const v = Number((vAxis === "y" ? p.y : p.x) ?? 0);
          const k = `${String(base)}|${v < 0 ? "-" : "+"}`;
          const s = L.l.adjust === "stack" || L.l.adjust === undefined ? acc.get(k) ?? 0 : 0;
          if (L.l.adjust === "stack" || L.l.adjust === undefined) acc.set(k, s + v);
          if (vAxis === "y") { p.y = s; p.y2 = s + v; } else { p.x = s; p.x2 = s + v; }
        }
      }
      pre.push(p);
    });
  }
  const nums = (ax: Ax) => pre.flatMap((p) => [p[ax], p[`${ax}2`]]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const hasZero = (ax: Ax) => ls.some((L) => L.l.mark === "span" && !L.l.encoding[`${ax}2`] && valueAxis(L) === ax);

  const callouts = ls.filter((L) => L.l.mark === "text" && !L.l.encoding.x && !L.l.encoding.y);
  const yCats = ky === "nominal" || ky === "ordinal" ? cats("y") : [];
  const xCats = kx === "nominal" || kx === "ordinal" ? cats("x") : [];
  const ml = placeMode ? 16 : yCats.length ? Math.min(200, 18 + Math.max(...yCats.map((c) => textW(c)))) : ky ? 58 : 16;
  // The key's height is worked out before the marks are placed. Tokens are assigned in a throwaway map here, since the
  // real assignment follows the order in which the marks take them.
  const keyH = keyLayout(keyEntries(a, ls, new Map()), W - 22, W * 0.62).height;
  // A short callout reads as a headline. A longer one is set smaller, and either kind wraps to the plot's width.
  let callY = keyH + 16;
  const callSet = callouts.map((L) => {
    const text = L.rows.map((r) => String(L.l.encoding.text?.field ? r[L.l.encoding.text.field] : L.l.encoding.text?.value ?? "")).join("  ");
    const cls = text.length > 60 ? "ask-callout small" : "ask-callout";
    const lh = text.length > 60 ? 20 : 30;
    const lines: string[] = [];
    for (const word of text.split(/\s+/)) {
      const last = lines[lines.length - 1];
      if (last !== undefined && textW(`${last} ${word}`, cls) <= W - ml - 22) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    const at = callY;
    callY += lines.length * lh + 12;
    return { L, cls, lh, lines, at };
  });
  const mt = (ky && ky !== "nominal" && ky !== "ordinal" ? 38 : 26) + (callY - keyH - 16) + keyH;
  const mb = placeMode ? 12 : kx ? 46 : 16;
  const mr = 22;
  const X0 = ml, X1 = W - mr, Y0 = mt, Y1 = H - mb;
  const pw = X1 - X0, ph = Y1 - Y0;

  const fmtAxis = (ax: Ax) => (v: number) => {
    const L = ls.find((x) => x.l.encoding[ax]?.field);
    const f = L?.l.encoding[ax]?.field ?? "";
    return fmtValue(a, f, v);
  };
  const makeScale = (ax: Ax, kind: FieldType | null, a0: number, a1: number): Scale | null => {
    if (!kind) return null;
    if (kind === "nominal" || kind === "ordinal") return band(ax === "x" ? xCats : yCats, Math.min(a0, a1), Math.max(a0, a1));
    const vs = nums(ax);
    if (!vs.length) return null;
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hasZero(ax)) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (kind === "temporal") return time(lo, hi, a0, a1, Math.abs(a1 - a0));
    const b = binOf(ax);
    if (b) {
      const step = typeof b === "object" ? b.step : niceStep(hi - lo, 20);
      const s = linear(Math.floor(lo / step) * step, (Math.floor(hi / step) + 1) * step, a0, a1, Math.max(3, Math.floor(Math.abs(a1 - a0) / 60)), fmtAxis(ax));
      return { ...s, bin: step };
    }
    return linear(lo, hi, a0, a1, Math.max(3, Math.floor(Math.abs(a1 - a0) / (ax === "x" ? 80 : 50))), fmtAxis(ax));
  };
  const sx = makeScale("x", kx, X0, X1), sy = makeScale("y", ky, Y1, Y0);

  const marks: MarkT[] = [];
  const chrome: ReactNode[] = [];
  // Rules and text marks annotate the data, so they are drawn over the marks.
  const over: ReactNode[] = [];
  // A label goes to the right of its anchor, or to the left when it would run past the plot.
  const beside = (x: number, gap: number, s: string) => (x + gap + textW(s) > X1 + 8 ? { x: x - gap, textAnchor: "end" as const } : { x: x + gap });
  const titles: AxisTitle[] = [];

  // Map backdrop.
  let proj: ((code: string) => [number, number] | null) | null = null;
  let mapT: Frame["map"];
  if (placeMode && map) {
    const s = Math.min(pw / map.w, ph / map.h);
    const ox = X0 + (pw - map.w * s) / 2, oy = Y0 + (ph - map.h * s) / 2;
    mapT = { ox, oy, s };
    chrome.push(<path key="map" className="ask-map" d={map.d} transform={`translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(4)})`} />);
    proj = (code) => { const c = map.cent[code]; return c ? [ox + c[0] * s, oy + c[1] * s] : null; };
  }

  // Axes.
  if (sx) {
    chrome.push(<line key="xa" className="c-axis" x1={X0} x2={X1} y1={Y1 + 0.5} y2={Y1 + 0.5} />);
    sx.ticks.forEach((t, i) => {
      if (t.p < X0 - 1 || t.p > X1 + 1) return;
      chrome.push(<line key={`xt${i}`} className="c-tick" x1={t.p} x2={t.p} y1={Y1} y2={Y1 + 4} />);
      chrome.push(<text key={`xl${i}`} className="c-label" x={t.p} y={Y1 + 16} textAnchor="middle">{sx.kind === "band" ? clip(t.label, sx.step - 6) : t.label}</text>);
    });
    const f = axisChannel(ls, "x");
    if (f?.field) titles.push({ axis: "x", text: f.title ?? labelOf(a, f.field), x: X1, y: Y1 + 26, field: f.field, anchor: "end" });
  }
  if (sy) {
    if (sy.kind === "band") {
      sy.ticks.forEach((t, i) => {
        chrome.push(<text key={`yl${i}`} className="c-label ink" x={X0 - 10} y={t.p + 4} textAnchor="end">{clip(t.label, X0 - 16, "c-label ink")}</text>);
        if (i) chrome.push(<line key={`yg${i}`} className="ask-grid" x1={X0} x2={X1} y1={t.p - sy.step / 2} y2={t.p - sy.step / 2} />);
      });
    } else {
      sy.ticks.forEach((t, i) => {
        if (t.p < Y0 - 1 || t.p > Y1 + 1) return;
        chrome.push(<line key={`yg${i}`} className="ask-grid" x1={X0} x2={X1} y1={t.p} y2={t.p} />);
        chrome.push(<text key={`yl${i}`} className="c-label" x={X0 - 8} y={t.p + 4} textAnchor="end">{t.label}</text>);
      });
    }
    const f = axisChannel(ls, "y");
    if (f?.field) titles.push({ axis: "y", text: f.title ?? labelOf(a, f.field), x: 12, y: Y0 - (sy.kind === "band" ? 8 : 18), field: f.field, anchor: "start" });
  }

  // Sizes. One sqrt scale across layers, sized to the room each mark has.
  const sizeVals = pre.filter((p) => p.L.l.encoding.size?.field).map((p) => num(p.r[p.L.l.encoding.size!.field!])).filter((v) => v > 0);
  const sMax = Math.max(1, ...sizeVals);
  const pointCount = pre.filter((p) => p.L.l.mark === "point").length || 1;
  const room = Math.sqrt((pw * ph) / pointCount);
  const rBase = Math.max(2.2, Math.min(6, room / 4.2));
  const rTop = Math.max(5, Math.min(placeMode ? 40 : 26, room / 1.6));
  const radius = (p: Pre) => {
    const f = p.L.l.encoding.size?.field;
    if (!f) return rBase;
    return Math.max(1.6, Math.sqrt(Math.max(0, num(p.r[f])) / sMax) * rTop);
  };
  const center = (s: Scale | null, v: V | null, lo: number, hi: number) => (s && v !== null ? s.pos(s.bin ? Math.floor(num(v) / s.bin) * s.bin + s.bin / 2 : v) : (lo + hi) / 2);

  for (const L of ls) {
    const items = pre.filter((p) => p.L === L);
    const e = L.l.encoding;
    if (L.l.mark === "link") continue;
    if (L.l.mark === "rule") {
      items.forEach((p, k) => {
        const lab = e.text?.field ? String(p.r[e.text.field]) : null;
        if (p.x !== null && sx) { const x = sx.pos(p.x); over.push(<g key={`r${L.i}-${k}`}><line className={`ask-rule ${looks(a, L, p.r, seen).cls}`} x1={x} x2={x} y1={Y0} y2={Y1} />{lab ? <text className="c-label halo" {...beside(x, 4, lab)} y={Y0 + 10}>{lab}</text> : null}</g>); }
        if (p.y !== null && sy) { const y = sy.pos(p.y); over.push(<g key={`r${L.i}-${k}`}><line className={`ask-rule ${looks(a, L, p.r, seen).cls}`} x1={X0} x2={X1} y1={y} y2={y} />{lab ? <text className="c-label halo" x={X1} y={y - 5} textAnchor="end">{lab}</text> : null}</g>); }
      });
      continue;
    }
    if (L.l.mark === "text") {
      if (!e.x && !e.y) {
        const c = callSet.find((s) => s.L === L)!;
        chrome.push(<text key={`c${L.i}`} className={c.cls}>{c.lines.map((t, j) => <tspan key={j} x={X0} y={c.at + 14 + j * c.lh}>{t}</tspan>)}</text>);
      } else items.forEach((p, k) => {
        const f = e.text?.field;
        const label = f ? fmtValue(a, f, p.r[f], colOf(L, f)?.type) : String(e.text?.value ?? "");
        over.push(<text key={`t${L.i}-${k}`} className="c-label ink halo" {...beside(center(sx, p.x, X0, X1), 6, label)} y={center(sy, p.y, Y1, Y0) + 4}>{label}</text>);
      });
      continue;
    }
    if (L.l.mark === "cell" && sx && sy) {
      items.forEach((p) => {
        const lk = looks(a, L, p.r, seen);
        const w = Math.max(3, sx.step * 0.86), h = Math.max(3, Math.min(sy.step * 0.8, 40));
        marks.push({ id: idOf(L, p.r, p.j), x: center(sx, p.x, X0, X1), y: center(sy, p.y, Y1, Y0), w, h, rx: 1, rot: 0, cls: lk.cls, src: srcOf(p.r), layer: L.i, row: p.r });
      });
      continue;
    }
    // Spans that share their lanes with points become thin rails, with the points sitting on them.
    const beads = sy?.kind === "band" && ls.some((o) => o.l.mark === "point" && o.l.encoding.y?.field);
    const labelText = (r: Record<string, unknown>) => (e.text?.field ? fmtValue(a, e.text.field, r[e.text.field], colOf(L, e.text.field)?.type) : undefined);
    if (L.l.mark === "span") {
      // Rails that overlap in time within a lane take separate rows below the lane's center line.
      const rail = new Map<Pre, number>();
      if (beads) {
        const ends = new Map<string, number[]>();
        for (const p of [...items].sort((u, v) => Number(u.x) - Number(v.x))) {
          const lane = String(p.y), row = ends.get(lane) ?? [];
          let k = row.findIndex((end) => end <= Number(p.x));
          if (k < 0) k = row.length;
          row[k] = Number(p.x2);
          ends.set(lane, row);
          rail.set(p, k);
        }
      }
      items.forEach((p, k) => {
        const lk = looks(a, L, p.r, seen);
        let x0: number, x1: number, y0: number, y1: number;
        const thick = (s: Scale | null, count: number, full: number) => (s?.bin ? Math.max(1.5, Math.abs(s.pos(s.bin) - s.pos(0)) * 0.84) : s?.kind === "band" ? Math.min(s.step * 0.64, 26) : s?.kind === "time" ? Math.max(2, (full / Math.max(1, count)) * 0.7) : 8);
        if (p.x2 !== null && sx) {
          x0 = sx.pos(p.x!); x1 = sx.pos(p.x2);
          const cy = (sy ? center(sy, p.y, Y1, Y0) : Y0 + (k + 0.5) * Math.min(28, ph / items.length)) + (beads ? (rail.get(p) ?? 0) * 11 : 0);
          const t = beads ? 6 : sy ? thick(sy, 1, ph) : Math.min(18, (ph / items.length) * 0.7);
          y0 = cy - t / 2; y1 = cy + t / 2;
        } else if (p.y2 !== null && sy) {
          y0 = sy.pos(p.y!); y1 = sy.pos(p.y2);
          const xs = new Set(items.map((q) => String(q.x))).size;
          const cx = center(sx, p.x, X0, X1), t = sx ? thick(sx, xs, pw) : 20;
          x0 = cx - t / 2; x1 = cx + t / 2;
        } else return;
        const x = Math.min(x0, x1), y = Math.min(y0, y1);
        const w = Math.max(1.5, Math.abs(x1 - x0)), h = Math.max(1.5, Math.abs(y1 - y0));
        marks.push({ id: idOf(L, p.r, p.j), x: x + w / 2, y: y + h / 2, w, h, rx: 0, rot: 0, cls: lk.cls, src: srcOf(p.r), layer: L.i, row: p.r, want: labelText(p.r) });
      });
      continue;
    }

    // Points.
    const pts = items.map((p) => {
      const lk = looks(a, L, p.r, seen);
      let cx = center(sx, p.x, X0, X1), cy = center(sy, p.y, Y1, Y0);
      if (proj && e.place?.field) { const c = proj(String(p.r[e.place.field])); if (c) [cx, cy] = c; }
      return { p, lk, cx, cy, r: radius(p), id: idOf(L, p.r, p.j) };
    });
    const adjust = L.l.adjust ?? (sx?.bin && !e.y ? "stack" : undefined);
    if (L.l.layout === "network") {
      const ids = new Set(pts.map((q) => q.id));
      const edges = ls.filter((x) => x.l.mark === "link").flatMap((x) => x.rows.map((r) => ({ a: String(r[x.l.encoding.source!.field!]), b: String(r[x.l.encoding.target!.field!]) }))).filter((l) => ids.has(l.a) && ids.has(l.b));
      const big = Math.max(...pts.map((q) => q.r));
      if (big > 18) for (const q of pts) q.r *= 18 / big;
      network(pts, edges, X0, Y0, pw, ph);
    } else if (proj && e.place?.field) {
      // Largest first, each point takes the first free spot on a spiral out from its state's centroid.
      const placed: typeof pts = [];
      for (const q of [...pts].sort((u, v) => v.r - u.r)) {
        if (pts.length > 40) q.r = Math.min(q.r, Math.max(3, rTop * 0.4));
        const ox = q.cx, oy = q.cy;
        for (let k = 0; k < 600; k++) {
          const ang = k * 2.39996, rad = Math.sqrt(k) * 2.2;
          const x = ox + Math.cos(ang) * rad, y = oy + Math.sin(ang) * rad;
          if (placed.every((o) => Math.hypot(o.cx - x, o.cy - y) >= o.r + q.r + 0.6)) { q.cx = x; q.cy = y; break; }
        }
        placed.push(q);
      }
    } else if (adjust === "stack") {
      const bw = sx?.bin ? Math.abs(sx.pos(sx.bin) - sx.pos(0)) : sx?.kind === "band" ? sx.step * 0.8 : 12;
      const groups = new Map<string, typeof pts>();
      for (const q of pts) { const k = `${q.cx.toFixed(1)}|${sy?.kind === "band" ? q.cy.toFixed(1) : ""}`; groups.set(k, [...(groups.get(k) ?? []), q]); }
      const avail = sy?.kind === "band" ? sy.step * 0.9 : ph - 4;
      const biggest = Math.max(...[...groups.values()].map((g) => g.length));
      let r = 7;
      for (; r > 1; r -= 0.25) { const cols = Math.max(1, Math.floor(bw / (2 * r))); if (Math.ceil(biggest / cols) * 2 * r <= avail) break; }
      const cols = Math.max(1, Math.floor(bw / (2 * r)));
      for (const g of groups.values()) g.forEach((q, k) => {
        const base = sy?.kind === "band" ? q.cy + sy.step * 0.45 : Y1 - 2;
        const c = k % cols, row = Math.floor(k / cols);
        q.cx += (c - (Math.min(cols, g.length) - 1) / 2) * 2 * r;
        q.cy = base - r - row * 2 * r;
        q.r = r * 0.92;
      });
    } else if (adjust === "dodge") {
      const alongX = !(sx?.kind === "band" && sy && sy.kind !== "band");
      const pile = (sx?.kind === "band" && !sy) || (!sx && !sy);
      const groups = new Map<string, typeof pts>();
      for (const q of pts) { const k = alongX && !pile ? q.cy.toFixed(1) : q.cx.toFixed(1); groups.set(k, [...(groups.get(k) ?? []), q]); }
      const half = alongX ? (sy?.kind === "band" ? sy.step / 2 - 2 : sy ? 30 : ph) : (sx?.kind === "band" ? sx.step / 2 - 2 : 30);
      for (let attempt = 0; attempt < 4; attempt++) {
        let worst = 0;
        for (const g of groups.values()) worst = Math.max(worst, pile ? pileOut(g, sx ? sx.step * 0.86 : pw, Y1) : swarm(g, alongX, !sy && alongX, Y1));
        if (worst <= half || attempt === 3) break;
        const f = Math.max(0.35, Math.sqrt(half / worst));
        for (const q of pts) { q.r *= f; if (alongX) q.cy = center(sy, q.p.y, Y1, Y0); else q.cx = center(sx, q.p.x, X0, X1); if (pile) { q.cx = center(sx, q.p.x, X0, X1); } }
      }
    } else if (adjust === "jitter") {
      for (const q of pts) {
        if (sx?.kind === "band") q.cx += (hashUnit(q.id) - 0.5) * sx.step * 0.6;
        if (sy?.kind === "band") q.cy += (hashUnit(`${q.id}y`) - 0.5) * sy.step * 0.6;
      }
    }
    for (const q of pts) {
      const d = q.lk.shape === "diamond" ? q.r * 1.6 : q.r * 2;
      marks.push({ id: q.id, x: q.cx, y: q.cy, w: d, h: d, rx: q.lk.shape === "dot" || q.lk.shape === "ring" ? d / 2 : 0, rot: q.lk.shape === "diamond" ? 45 : 0, cls: q.lk.cls, src: srcOf(q.p.r), layer: L.i, row: q.p.r, want: labelText(q.p.r) });
    }
  }
  placeLabels(marks, X0 - (ky ? 0 : 12), Y0 - 20, X1 + mr - 4, Y1 + (kx ? 0 : 10));
  const byId = new Set(marks.map((m) => m.id));
  const links: LinkT[] = [];
  for (const L of ls) {
    if (L.l.mark !== "link") continue;
    const e = L.l.encoding;
    const sizeF = e.size?.field;
    const wMax = sizeF ? Math.max(1, ...L.rows.map((r) => num(r[sizeF]))) : 1;
    L.rows.forEach((r, j) => {
      const s0 = String(r[e.source!.field!]), t0 = String(r[e.target!.field!]);
      if (!byId.has(s0) || !byId.has(t0)) return;
      const lk = looks(a, L, r, seen);
      const dir = lk.shape === "arrow";
      links.push({ id: L.key && r[L.key] != null ? `link:${r[L.key]}` : `link:${L.i}:${s0}>${t0}:${j}`, a: s0, b: t0, cls: `${lk.cls}${dir ? " s-arrow" : ""}`, w: sizeF ? 0.6 + (num(r[sizeF]) / wMax) * 3 : 1, dir });
    });
  }
  const key = keyEntries(a, ls, seen);
  chrome.push(keyLayout(key, W - 22, W * 0.62).node?.(6));
  const inX = (t: Tick) => t.p >= X0 - 1 && t.p <= X1 + 1, inY = (t: Tick) => t.p >= Y0 - 1 && t.p <= Y1 + 1;
  const frame: Frame = { x0: X0, y0: Y0, x1: X1, y1: Y1, xt: sx?.ticks.filter(inX) ?? [], yt: sy?.ticks.filter(inY) ?? [], xBand: sx?.kind === "band", yBand: sy?.kind === "band", map: mapT };
  return { marks, links, chrome, over, key, titles, height: H, frame };
}

// Labels go to the right of a mark, or above, below or to its left when that spot is taken. A label inside a bar
// stays inside it, shortened to fit. Larger marks are placed first, and a label with no free spot is left off.
function placeLabels(marks: MarkT[], x0: number, y0: number, x1: number, y1: number) {
  type Box = [number, number, number, number];
  const taken: Box[] = marks.filter((m) => m.rx >= Math.min(m.w, m.h) / 2 - 0.5 || m.w <= m.h * 2).map((m) => [m.x - m.w / 2, m.y - m.h / 2, m.x + m.w / 2, m.y + m.h / 2]);
  const free = (b: Box) => b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1 && taken.every((t) => b[0] >= t[2] || b[2] <= t[0] || b[1] >= t[3] || b[3] <= t[1]);
  const order = marks.filter((m) => m.want).sort((p, q) => q.w * q.h - p.w * p.h);
  for (const m of order) {
    const text = m.want!;
    const isBar = m.rx < Math.min(m.w, m.h) / 2 - 0.5 && m.w > m.h * 2;
    if (isBar && m.h <= 8) {
      const tw = textW(text, "ask-label");
      const above: Box = [m.x - m.w / 2, m.y - m.h / 2 - 19, m.x - m.w / 2 + 4 + tw, m.y - m.h / 2 - 7];
      const below: Box = [m.x - m.w / 2, m.y + m.h / 2 + 1, m.x - m.w / 2 + 4 + tw, m.y + m.h / 2 + 13];
      const b = free(below) ? below : free(above) ? above : null;
      if (!b) continue;
      m.label = { text, dx: -m.w / 2, dy: b === below ? m.h / 2 + 11 : -m.h / 2 - 9, anchor: "start" };
      taken.push(b);
      continue;
    }
    if (isBar) {
      const room = Math.floor((m.w - 10) / charW("ask-label"));
      if (room < 6) continue;
      const t = text.length > room ? `${text.slice(0, room - 1)}…` : text;
      m.label = { text: t, dx: -m.w / 2 + 5, dy: 4, anchor: "start" };
      continue;
    }
    const w = textW(text, "ask-label"), r = Math.max(m.w, m.h) / 2;
    const spots: [Label, Box][] = [
      [{ text, dx: r + 4, dy: 4, anchor: "start" }, [m.x + r + 2, m.y - 7, m.x + r + 6 + w, m.y + 7]],
      [{ text, dx: 0, dy: -r - 5, anchor: "middle" }, [m.x - w / 2 - 2, m.y - r - 17, m.x + w / 2 + 2, m.y - r - 3]],
      [{ text, dx: 0, dy: r + 13, anchor: "middle" }, [m.x - w / 2 - 2, m.y + r + 2, m.x + w / 2 + 2, m.y + r + 16]],
      [{ text, dx: -r - 4, dy: 4, anchor: "end" }, [m.x - r - 6 - w, m.y - 7, m.x - r - 2, m.y + 7]],
    ];
    const hit = spots.find(([, b]) => free(b));
    if (!hit) continue;
    m.label = hit[0];
    taken.push(hit[1]);
  }
}

// A force layout, started from the positions the same nodes had last time, so an edit that adds or removes a few
// nodes leaves the rest close to where they were. Positions are kept in layout units and fitted to the view.
const lastPos = new Map<string, [number, number]>();
interface NetNode extends SimulationNodeDatum { id: string; q: { cx: number; cy: number; r: number } }
function network(pts: { id: string; cx: number; cy: number; r: number }[], edges: { a: string; b: string }[], X0: number, Y0: number, pw: number, ph: number) {
  const known = pts.filter((q) => lastPos.has(q.id)).length;
  const nodes: NetNode[] = pts.map((q) => {
    let p = lastPos.get(q.id);
    if (!p) {
      const nb = edges.find((l) => (l.a === q.id && lastPos.has(l.b)) || (l.b === q.id && lastPos.has(l.a)));
      const base = nb ? lastPos.get(nb.a === q.id ? nb.b : nb.a)! : [0, 0];
      const ang = hashUnit(q.id) * Math.PI * 2, rad = nb ? 30 : 60 + hashUnit(`${q.id}r`) * 120;
      p = [base[0] + Math.cos(ang) * rad, base[1] + Math.sin(ang) * rad];
    }
    return { id: q.id, q, x: p[0], y: p[1] };
  });
  const links: SimulationLinkDatum<NetNode>[] = edges.map((l) => ({ source: l.a, target: l.b }));
  const sim = forceSimulation(nodes)
    .force("link", forceLink<NetNode, SimulationLinkDatum<NetNode>>(links).id((d) => d.id).distance(70).strength(0.35))
    .force("charge", forceManyBody().strength(-220))
    .force("collide", forceCollide<NetNode>((d) => d.q.r + 10))
    .force("x", forceX(0).strength(0.06))
    .force("y", forceY(0).strength(0.09))
    .alpha(known === pts.length ? 0.3 : known ? 0.7 : 1)
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
  for (const n of nodes) lastPos.set(n.id, [n.x!, n.y!]);
  const xs = nodes.map((n) => n.x!), ys = nodes.map((n) => n.y!);
  const lx = Math.min(...xs), hx = Math.max(...xs), ly = Math.min(...ys), hy = Math.max(...ys);
  const padX = 120, padY = 30;
  const s = Math.min(1.6, (pw - padX * 2) / Math.max(1, hx - lx), (ph - padY * 2) / Math.max(1, hy - ly));
  const cx = X0 + pw / 2, cy = Y0 + ph / 2;
  for (const n of nodes) {
    n.q.cx = cx + (n.x! - (lx + hx) / 2) * s;
    n.q.cy = cy + (n.y! - (ly + hy) / 2) * s;
  }
}

interface Q { cx: number; cy: number; r: number }
// Places circles one at a time, each at the smallest offset from its line where it overlaps none placed so far.
// With an anchor the offsets go up from the baseline only.
function swarm(g: Q[], alongX: boolean, anchored: boolean, base: number): number {
  const order = [...g].sort((a, b) => (alongX ? a.cx - b.cx : a.cy - b.cy));
  const placed: Q[] = [];
  let worst = 0;
  for (const q of order) {
    const line = alongX ? (anchored ? base : q.cy) : q.cx;
    const t = alongX ? q.cx : q.cy;
    const near = placed.filter((o) => Math.abs((alongX ? o.cx : o.cy) - t) < o.r + q.r);
    const cands = [anchored ? q.r : 0];
    for (const o of near) {
      const dt = (alongX ? o.cx : o.cy) - t, rr = o.r + q.r + 0.6;
      const h = Math.sqrt(Math.max(0, rr * rr - dt * dt));
      const oo = (alongX ? o.cy : o.cx) - line;
      cands.push(oo + h, oo - h);
    }
    const ok = (off: number) => near.every((o) => Math.hypot((alongX ? o.cx : o.cy) - t, (alongX ? o.cy : o.cx) - (line + off)) >= o.r + q.r + 0.5);
    let best = Infinity;
    for (const c of cands) {
      const off = anchored ? -Math.abs(c) : c;
      if ((anchored && -off < q.r) || Math.abs(off) >= Math.abs(best)) continue;
      if (ok(off)) best = off;
    }
    if (!Number.isFinite(best)) best = anchored ? -q.r : 0;
    if (alongX) q.cy = line + best; else q.cx = line + best;
    worst = Math.max(worst, Math.abs(best) + q.r);
    placed.push(q);
  }
  return worst;
}

// Fills a column of the given width from the baseline up, largest circles first.
function pileOut(g: Q[], width: number, base: number): number {
  const order = [...g].sort((a, b) => b.r - a.r);
  const mid = order.length ? order[0].cx : 0;
  let y = base, rowW = 0, rowH = 0, row: Q[] = [];
  const flush = () => {
    let x = mid - rowW / 2;
    for (const q of row) { q.cx = x + q.r; q.cy = y - rowH / 2; x += q.r * 2 + 1; }
    y -= rowH + 1;
    row = []; rowW = 0; rowH = 0;
  };
  for (const q of order) {
    if (row.length && rowW + q.r * 2 > width) flush();
    row.push(q);
    rowW += q.r * 2 + (row.length > 1 ? 1 : 0);
    rowH = Math.max(rowH, q.r * 2);
  }
  if (row.length) flush();
  return base - y;
}

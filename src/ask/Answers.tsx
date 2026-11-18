import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { PANEL_TITLES } from "../panels";
import { TABLES } from "../tables";
import { tip } from "../tip";
import type { Theme } from "../themes";
import { ws } from "../workspace";
import { Segmented, useSize } from "../components/primitives";
import { breakdown, listRows, split, unsplit } from "./breakdown";
import { BreakMenu, FilterChip, ParamChip, RowTip } from "./chips";
import { Deep } from "./Deep";
import { Composer } from "./Composer";
import { connect, query } from "./db";
import { entityIn } from "./entities";
import { Engine } from "./engine";
import { editFilter } from "./filters";
import type { Filter, FilterEdit } from "./filters";
import { fmtValue } from "./format";
import { loadMapData } from "./map";
import type { MapData } from "./map";
import { askModel, current, savePassword } from "./model";
import { kindFor, respond } from "./mock";
import type { AskContext, Op } from "./mock";
import { entitiesOf, markRecords, matching, onLenses, passes } from "./records";
import type { OnLens } from "./records";
import { scene, setMeasure } from "./render";
import type { MarkT, Scene, SceneOpts } from "./render";
import { load } from "./run";
import { labelOf } from "./spec";
import type { Loaded } from "./run";
import { isScope, partsText, scopeIds, scopeLabel } from "./scope";
import { sourceFor } from "./sources";
import type { Answer } from "./spec";
import { answerOf, board, FIND, getBoard, useBoard, useLenses } from "./board";
import type { Busy, Card, Layout, Part, Ref } from "./board";

const PAINT_TONES = [["ink", "--ink-2"], ["accent", "--accent"], ["t1", "--t1"], ["t2", "--t2"], ["t3", "--t3"], ["t4", "--t4"], ["t5", "--t5"], ["t6", "--t6"]] as const;
const GAP = 14;
const HAS_GPU = typeof navigator !== "undefined" && "gpu" in navigator;

const fitCache = new Map<string, string>();
// Shortens text to fit a width, measured in the theme's font with the probe the layout uses.
function fit(text: string, w: number) {
  const probe = document.querySelector<SVGTextElement>(".ask-probe");
  if (!probe) return text;
  const k = `${document.documentElement.dataset.family}|${Math.round(w)}|${text}`;
  if (fitCache.has(k)) return fitCache.get(k)!;
  probe.setAttribute("class", "ask-probe c-label ink");
  probe.textContent = text;
  let t = text;
  if (probe.getComputedTextLength() > w) {
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      probe.textContent = `${text.slice(0, mid)}\u2026`;
      if (probe.getComputedTextLength() <= w) lo = mid; else hi = mid - 1;
    }
    t = `${text.slice(0, Math.max(1, lo))}\u2026`;
  }
  fitCache.set(k, t);
  return t;
}

// Patterns and the text probe are shared by every chart on the page, so they sit in a hidden SVG of their own.
function Defs({ probe }: { probe: RefObject<SVGTextElement | null> }) {
  return (
    <svg className="ans-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <pattern id="ask-hatch-p" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="#fff" /></pattern>
        <marker id="ask-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0.5 8 4 0 7.5Z" fill="context-stroke" /></marker>
        {PAINT_TONES.map(([t, v]) => (
          <g key={t}>
            <pattern id={`ask-ph-${t}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" style={{ fill: `color-mix(in srgb, var(${v}) 14%, transparent)` }} /><rect width="1.3" height="4" style={{ fill: `var(${v})` }} /></pattern>
            <pattern id={`ask-pd-${t}`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" style={{ fill: `var(${v})` }} /></pattern>
            <pattern id={`ask-ps-${t}`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="4" height="5" style={{ fill: `var(${v})` }} /></pattern>
          </g>
        ))}
        <mask id="ask-hatch" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#ask-hatch-p)" /></mask>
      </defs>
      <text ref={probe} className="ask-probe" x={-9999} y={-9999} />
    </svg>
  );
}

// Each answer runs once and keeps its rows, since the queries of all answers share one set of temporary views.
const loads = new WeakMap<Answer, Promise<Loaded>>();
const loadOnce = (a: Answer) => {
  let p = loads.get(a);
  if (!p) { p = load(a); loads.set(a, p); }
  return p;
};
function useLoaded(answers: Answer[], ready: boolean) {
  const [out, setOut] = useState<Loaded[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    Promise.all(answers.map(loadOnce)).then((r) => {
      if (!live) return;
      setOut(r);
      for (const l of r) if (l.errors.length) console.warn(l.errors);
    });
    return () => { live = false; };
  }, [ready, ...answers]);
  return out;
}

// Lenses that hide take the rows they do not match out of the view before it is laid out, so the axes fit what is
// left. A link stays when both of its ends do.
function hideRows(a: Answer, data: Loaded, L: OnLens[]): Loaded {
  if (!L.some((l) => l.mode === "hide")) return data;
  const results = { ...data.results };
  const kept = new Set<string>();
  for (const layer of a.layers) {
    if (!layer.from || layer.mark === "link" || !data.results[layer.from]) continue;
    const r = data.results[layer.from];
    const key = a.tables[layer.from]?.key;
    const rows = r.rows.filter((row) => {
      const own = Array.isArray(row.source_rows) ? row.source_rows.map(String) : key ? [String(row[key])] : [];
      return passes(own, L, ["hide"], entityIn(row, key));
    });
    results[layer.from] = { ...r, rows };
    if (key) for (const row of rows) kept.add(String(row[key]));
  }
  for (const layer of a.layers) {
    const e = layer.encoding;
    if (layer.mark !== "link" || !layer.from || !data.results[layer.from] || !e.source?.field || !e.target?.field) continue;
    const r = data.results[layer.from];
    results[layer.from] = { ...r, rows: r.rows.filter((row) => kept.has(String(row[e.source!.field!])) && kept.has(String(row[e.target!.field!]))) };
  }
  return { ...data, results };
}
function useHidden(answers: Answer[], data: Loaded[] | null) {
  const lenses = useLenses();
  return useMemo(() => {
    if (!data) return null;
    const L = onLenses(lenses);
    return data.map((d, i) => hideRows(answers[i], d, L));
  }, [data, lenses, ...answers]);
}

function markName(a: Answer, data: Loaded, m: MarkT) {
  const L = a.layers[m.layer];
  const cols = (L.from ? data.results[L.from]?.columns : []) ?? [];
  const key = L.from ? a.tables[L.from]?.key : undefined;
  const words = cols.filter((c) => c.name !== key && c.type === "nominal" && m.row[c.name] != null).slice(0, 2).map((c) => String(m.row[c.name]));
  const when = cols.find((c) => c.type === "temporal" && m.row[c.name] != null);
  return [...words, ...(when ? [fmtValue(a, when.name, m.row[when.name], "temporal")] : [])].join(", ") || m.id;
}

interface Look { theme: Theme; map: MapData | null; fonts: string; ready: boolean }

// One chart. Its marks light up when they match the selection, a lens, or records hovered anywhere on the page.
function SceneView({ card, a, data, sc, look, deep, onLeft, onSort }: { card: Card; a: Answer; data: Loaded; sc: Scene; look: Look; deep?: "on" | "leaving"; onLeft?: () => void; onSort?: (field: string) => void }) {
  const marks = useRef<SVGGElement>(null);
  const links = useRef<SVGGElement>(null);
  const engine = useRef<Engine | null>(null);
  const sel = useBoard((s) => s.sel);
  const lenses = useLenses();
  const hover = useBoard((s) => s.hover);
  const recs = useMemo(() => sc.marks.map((m) => markRecords(m, a.layers[m.layer].from ? a.tables[a.layers[m.layer].from!]?.key : undefined)), [sc, a]);

  useLayoutEffect(() => {
    engine.current = new Engine(marks.current!, links.current!, look.theme.gpu.edge.curve);
    return () => { engine.current?.dispose(); engine.current = null; };
  }, []);
  useLayoutEffect(() => { engine.current?.apply(sc.marks, sc.links, { dur: 450, stagger: 60 }); }, [sc]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.light(matching(recs, new Set(sel.ids)), "sel");
    const all = new Set<string>();
    let keep: Set<string> | null = null;
    lenses.forEach((l, i) => {
      const hit = l.on && l.mode !== "hide" ? matching(recs, new Set(l.set.ids)) : new Set<string>();
      if (l.id !== FIND) {
        e.light(hit, `ln${i}`);
        for (const id of hit) all.add(id);
      }
      if (l.on && l.mode === "dim") keep = keep ? new Set([...keep].filter((x) => hit.has(x))) : hit;
    });
    e.light(all.size || lenses.some((l) => l.on && l.mode !== "hide" && l.id !== FIND) ? all : new Set(), "ln");
    e.light(keep ? ((keep as Set<string>).size ? keep : new Set(["-"])) : new Set(), "keep");
    e.light(hover?.from === "ref" ? matching(recs, new Set(hover.ids)) : new Set(), "ref");
    e.light(hover?.from === "mark" && hover.at !== card.id ? matching(recs, new Set(hover.ids)) : new Set(), "lit");
  }, [recs, sel, lenses, hover, card.id]);

  const markOf = (e: { target: EventTarget }) => {
    const id = (e.target as Element).closest<SVGGElement>("[data-id]")?.dataset.id;
    return id ? sc.marks.find((m) => m.id === id) ?? null : null;
  };
  const over = (e: ReactPointerEvent<SVGGElement>) => {
    const m = markOf(e);
    if (!m) return;
    engine.current?.light(new Set([m.id]));
    board.hover({ ids: m.src ?? [m.id], from: "mark", at: card.id });
    tip.show((e.target as Element).closest("[data-id]")!, <RowTip a={a} data={data} m={m} />, { card: true });
  };
  const out = () => { engine.current?.light(new Set()); board.hover(null); tip.hide(); };
  const pick = (e: ReactMouseEvent<SVGGElement>) => {
    const m = markOf(e);
    if (!m) return;
    e.stopPropagation();
    const own = m.src ?? [m.id];
    const cur = getBoard().sel;
    const add = (e.shiftKey || e.metaKey) && cur.from === card.id;
    const same = cur.ids.length === own.length && own.every((x) => cur.ids.includes(x));
    if (same && !add) { board.clearSelection(); return; }
    board.select({ ids: add ? [...new Set([...cur.ids, ...own])] : own, label: add ? `${cur.label}; ${markName(a, data, m)}` : markName(a, data, m), from: card.id });
  };

  const selIds = useMemo(() => matching(recs, new Set(sel.ids)), [recs, sel]);
  const pick3d = (m: MarkT) => {
    const own = m.src ?? [m.id];
    const cur = getBoard().sel;
    if (cur.ids.length === own.length && own.every((x) => cur.ids.includes(x))) board.clearSelection();
    else board.select({ ids: own, label: markName(a, data, m), from: card.id });
  };
  const hover3d = (m: MarkT | null, at: { x: number; y: number }) => {
    if (!m) { tip.hide(); board.hover(null); return; }
    board.hover({ ids: m.src ?? [m.id], from: "mark", at: card.id });
    tip.show(at, <RowTip a={a} data={data} m={m} />, { card: true });
  };

  return (
    <div className={`ans-scene${sc.rows ? " table" : ""}`} data-flow={look.theme.gpu.money.mode} data-space={deep === "on" ? "deep" : "flat"} style={sc.rows ? { maxHeight: card.height ?? 320 } : undefined}>
      {deep ? <Deep sc={sc} a={a} map={look.map} theme={look.theme} sel={selIds} leaving={deep === "leaving"} onLeft={onLeft ?? (() => undefined)} onHover={hover3d} onPick={pick3d} /> : null}
      {sc.columns ? (
        <div className="ask-th">
          {sc.columns.map((c) => (
            <button key={c.field} type="button" style={{ left: c.x, width: c.w, textAlign: c.num ? "right" : "left" }} onClick={() => onSort?.(c.field)} aria-sort={a.sort?.field === c.field ? (a.sort.desc ? "descending" : "ascending") : undefined}>
              {c.label}{a.sort?.field === c.field ? (a.sort.desc ? " \u2193" : " \u2191") : ""}
            </button>
          ))}
        </div>
      ) : null}
      <svg width="100%" height={sc.height} role="img" aria-label={a.title} onClick={() => { if (getBoard().sel.from === card.id) board.clearSelection(); }}>
        <g key={`c${sc.marks.length}${sc.rows ? "t" : ""}`} className="ask-chrome">{sc.chrome}</g>
        {sc.rows ? (
          <g className="ask-table">
            {sc.columns!.map((c) => <line key={c.field} className="ask-grid" x1={c.x} x2={c.x} y1={6} y2={sc.height - 6} />)}
            {sc.rows.map((r) => (
              <g key={r.id} className="ask-tr" style={{ transform: `translateY(${r.y}px)` }}>
                {sc.columns!.map((c, i) => <text key={c.field} className="c-label ink" x={c.num ? c.x + c.w - 8 : c.x + 8} y={16} textAnchor={c.num ? "end" : "start"}>{fit(r.cells[i], c.w - 14)}</text>)}
              </g>
            ))}
          </g>
        ) : null}
        <g ref={links} className="ask-links" />
        <g ref={marks} className="ask-marks" onPointerOver={over} onPointerOut={out} onClick={pick} />
        <g className="ask-chrome">{sc.over}</g>
      </svg>
      {sc.titles.map((t) => (
        <span key={t.axis} className={`ans-axis ${t.axis}`} style={t.anchor === "end" ? { right: `calc(100% - ${t.x}px)`, top: t.y - 12 } : { left: t.x, top: t.y - 12 }}>{t.text}</span>
      ))}
    </div>
  );
}

// A chart answer, with a control for each condition in its SQL and each model parameter, and ways to look at it: as
// a chart or a table, flat or in 3D, and with its bars split by a column of the rows behind them. Changing a condition,
// a parameter, the split or the sort makes a new version of the answer. Dragging the same chip folds into one version.
// The form and the space are ways of looking that leave the answer as it is.
function ChartBody({ card, look }: { card: Card; look: Look }) {
  const a = answerOf(card)!;
  const [form, setForm] = useState<"chart" | "table" | null>(null);
  const [space, setSpace] = useState<"flat" | "deep" | "leaving">("flat");
  const sel = useBoard((s) => s.sel);
  const shown = form ? { ...a, form } : a;
  const [box, { w }] = useSize<HTMLDivElement>();
  const raw = useLoaded([a], look.ready);
  const data = useHidden([a], raw);
  const sc = useMemo(() => (data && w > 200 ? scene(shown, data[0], w, card.height ?? 320, look.map, card.id) : null), [data, w, look.map, look.fonts, a, form]);
  const edit = async (label: string, key: string, fn: () => Promise<Answer> | Answer) => {
    try { board.edit(card.id, { label, answer: await fn(), key }); } catch (e) { console.error(e); board.note("Error querying data"); }
  };
  const onFilter = (f: Filter, ed: FilterEdit, label: string) => edit(label, `f:${f.id}:${ed.remove ? "rm" : ed.op ? "op" : "v"}`, () => editFilter(a, f, ed));
  const onParam = (k: string, v: number) => edit(`${a.params?.[k].label ?? k} ${v}`, `p:${k}`, () => ({ ...a, params: { ...a.params, [k]: { ...a.params![k], value: v } } }));
  const isTable = (shown.form ?? "chart") === "table";
  const brk = raw && !isTable ? breakdown(a, raw[0]) : null;
  const bands = brk && sc ? [...new Set(sc.marks.filter((m) => m.row[brk.band] != null && (m.src ?? [m.id]).some((x) => sel.ids.includes(x))).map((m) => String(m.row[brk.band])))] : [];
  const onSplit = (field: string | null) => {
    if (!brk) return;
    const label = field ? brk.options.find((o) => o.field === field)!.label : "";
    edit(field ? `Split by ${label.toLowerCase()}` : "Removed the split", "split", () => (field ? split(a, brk, field) : unsplit(a)));
  };
  const onList = () => {
    if (!brk) return;
    setForm(null);
    const units = a.unit?.[1] ?? "rows";
    edit(bands.length ? `Listed the ${units} in ${bands.join(", ")}` : `Listed the ${units}`, "list", () => listRows(a, brk, bands, brk.bands));
  };
  const onSort = (field: string) => edit(`Sorted by ${labelOf(a, field).toLowerCase()}`, "sort", () => ({ ...a, sort: { field, desc: a.sort?.field === field ? !a.sort.desc : false } }));
  // Conditions get chips when they shape what is drawn: in a table a layer draws, or in a table one of those reads.
  const drawn = a.layers.flatMap((l) => (l.from ? [l.from] : []));
  const shapes = (t: string) => drawn.includes(t) || drawn.some((d) => new RegExp(`\\b${t}\\b`).test(a.tables[d]?.sql ?? ""));
  const filters = (raw?.[0].filters ?? []).filter((f) => shapes(f.table));
  const deep = space !== "flat" && !!sc?.frame && !isTable ? (space === "deep" ? "on" : "leaving") : undefined;
  return (
    <>
      <div className="ans-tools">
        {filters.map((f) => <FilterChip key={f.id} f={f} labels={a.labels} onEdit={onFilter} />)}
        {Object.entries(a.params ?? {}).map(([k, p]) => <ParamChip key={k} k={k} p={p} onSet={onParam} />)}
        <span className="ans-views">
          {brk ? <BreakMenu b={brk} units={a.unit?.[1] ?? "rows"} picked={bands.length} onSplit={onSplit} onList={onList} /> : null}
          {HAS_GPU && !isTable && sc?.frame ? <Segmented label="Space" value={space === "deep" ? "deep" : "flat"} onChange={(v) => setSpace(v === "deep" ? "deep" : space === "deep" ? "leaving" : "flat")} options={[{ value: "flat", label: "Flat" }, { value: "deep", label: "3D", tip: "Drag to turn, scroll to zoom" }]} /> : null}
          <Segmented label="Form" value={isTable ? "table" : "chart"} onChange={(v) => { setSpace("flat"); setForm(v === (a.form ?? "chart") ? null : v); }} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
        </span>
      </div>
      <div ref={box} className="ans-body">{sc && data ? <SceneView card={card} a={shown} data={data[0]} sc={sc} look={look} deep={deep} onLeft={() => setSpace("flat")} onSort={onSort} /> : <div style={{ height: card.height ?? 320 }} />}</div>
    </>
  );
}

// Views on a shared axis. Each view is laid out once to find its x range and left margin, then again with the widest
// range and margin of them all, so a date sits at the same x in every view.
function StackBody({ card, look }: { card: Card; look: Look }) {
  const members = card.members!;
  const answers = useMemo(() => members.map((m) => m.answer), [members]);
  const [box, { w }] = useSize<HTMLDivElement>();
  const data = useHidden(answers, useLoaded(answers, look.ready));
  const scenes = useMemo(() => {
    if (!data || w < 200) return null;
    const first = members.map((m, i) => scene(m.answer, data[i], w, m.height, look.map, `${card.id}${i}`));
    const ds = first.map((s) => s.frame?.xd).filter((d): d is [number, number] => !!d);
    const opts: SceneOpts = { ml: Math.max(...first.map((s) => s.frame?.x0 ?? 0)), x: ds.length ? [Math.min(...ds.map((d) => d[0])), Math.max(...ds.map((d) => d[1]))] : undefined };
    return members.map((m, i) => scene(m.answer, data[i], w, m.height, look.map, `${card.id}${i}`, opts));
  }, [data, w, look.map, look.fonts, members]);
  return (
    <div ref={box} className="ans-body ans-stack">
      {scenes && data ? members.map((m, i) => (
        <section key={i}>
          <h4 className="ans-sub">{m.answer.title}</h4>
          <SceneView card={card} a={m.answer} data={data[i]} sc={scenes[i]} look={look} />
        </section>
      )) : <div style={{ height: members.reduce((s, m) => s + m.height, 0) }} />}
    </div>
  );
}

// A written answer. Hovering a reference lights its records in every view, and selecting it makes them the selection.
// A reference keeps the records it matched when it was written, and is marked when its query matches others now.
function TextBody({ card, ready }: { card: Card; ready: boolean }) {
  const t = card.text!;
  const sel = useBoard((s) => s.sel);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    (async () => {
      const next: Record<string, Ref> = {};
      let diff = false;
      for (const [k, r] of Object.entries(t.refs)) {
        if (!r.set.sql) { next[k] = r; continue; }
        const now = (await query(r.set.sql)).rows.map((x) => String(x.id));
        const changed = now.length !== r.set.ids.length || now.some((x) => !r.set.ids.includes(x));
        if (changed !== !!r.changed) diff = true;
        next[k] = { ...r, changed };
      }
      if (live && diff) board.updateRefs(card.id, next);
    })();
    return () => { live = false; };
  }, [ready, card.id]);
  const wide = useMemo(() => new Set([...sel.ids, ...entitiesOf(sel.ids)]), [sel]);
  return (
    <div className="ans-body ans-text">
      {t.paras.map((p, i) => (
        <p key={i}>
          {p.map((run, j) => {
            if (typeof run === "string") return <span key={j}>{run}</span>;
            const r = t.refs[run.ref];
            return (
              <button
                key={j} type="button" className={`ans-ref${r.set.ids.some((x) => wide.has(x)) ? " on" : ""}${r.changed ? " changed" : ""}`}
                data-tip={r.changed ? "Matches other records now" : undefined}
                onMouseEnter={() => board.hover({ ids: r.set.ids, from: "ref", at: card.id })} onMouseLeave={() => board.hover(null)}
                onClick={(e) => { e.stopPropagation(); board.select({ ids: r.set.ids, label: r.label, from: card.id }); }}
              >{run.text}</button>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function Status({ text }: { text: string }) {
  return <span className="ask-status"><i />{text}</span>;
}
const X = () => <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1 7 7M7 1 1 7" /></svg>;
const AskIcon = () => <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 4.5 6.5 7.5 3 10.5M7.5 11h4" /></svg>;

const titleOf = (id: string | null) => (id === null ? null : PANEL_TITLES[id] ?? getBoard().cards.find((c) => c.id === id)?.title ?? null);

// Shows where an answer came from: the panel scrolls into view, and an earlier answer is brought into view.
function reveal(id: string) {
  if (PANEL_TITLES[id]) { ws.reveal(id); return; }
  document.querySelector(`[data-card="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  board.focus(id);
}

function Question({ card }: { card: Card }) {
  if (!card.parts) return <span className="ans-qt">{card.question}</span>;
  return (
    <span className="ans-qt">
      {card.parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : (
        <button key={i} type="button" className={`ans-qtok k-${p.kind}`} onClick={() => (p.kind === "set" ? board.select({ ids: scopeIds(p), label: scopeLabel(p), from: card.id }) : reveal(p.id))}>{scopeLabel(p)}</button>
      )))}
    </span>
  );
}

interface Slot { setEl: (id: string, el: HTMLElement | null) => void; folded: Set<string> }

function CardView({ card, look, slot }: { card: Card; look: Look; slot: Slot }) {
  const focused = useBoard((s) => s.focus === card.id || s.ctx.includes(card.id));
  const busy = useBoard((s) => (s.busy?.kind === "edit" && s.busy.at === card.id ? s.busy : null));
  const revs = card.revs ?? [];
  const rev = card.rev ?? 0;
  const from = titleOf(card.from);
  const open = card.open ?? !slot.folded.has(card.id);
  return (
    <section
      ref={(el) => slot.setEl(card.id, el)} data-card={card.id} className={`ans-card${card.pinned ? "" : " draft"}${focused ? " focus" : ""}${open ? "" : " folded"}`}
      data-kind={card.kind} onPointerDown={() => board.focus(card.id)}
    >
      <header className="ans-h">
        <button type="button" className="ans-fold-t" aria-expanded={open} aria-label={open ? `Fold ${card.title}` : `Unfold ${card.title}`} onClick={() => board.open(card.id, !open)}>
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M3 2 6.5 5 3 8" /></svg>
        </button>
        <h3 className="ans-title" onClick={() => { if (!open) board.open(card.id, true); }}>{card.title}</h3>
        <span className="ans-acts">
          <button type="button" className="panel-ask" aria-label={`Ask about ${card.title}`} data-tip="Ask about this" onClick={(e) => { e.stopPropagation(); board.insert([{ kind: "card", id: card.id }]); }}><AskIcon /></button>
          {card.pinned ? null : <button type="button" className="btn" onClick={() => board.pin(card.id)}>Pin</button>}
          <button type="button" className="ans-x" aria-label={`Remove ${card.title}`} data-tip="Remove" onClick={() => board.remove(card.id)}><X /></button>
        </span>
      </header>
      <p className="ans-q"><Question card={card} />{revs.length > 1 && open ? (
        <span className="ans-revs">
          <button type="button" disabled={rev === 0} aria-label="Earlier version" data-tip={revs[rev - 1]?.label} onClick={() => board.step(card.id, -1)}>‹</button>
          <span className="num">{rev + 1}/{revs.length}</span>
          <button type="button" disabled={rev === revs.length - 1} aria-label="Later version" data-tip={revs[rev + 1]?.label} onClick={() => board.step(card.id, 1)}>›</button>
        </span>
      ) : null}{from && !card.parts?.some((p) => typeof p !== "string" && p.kind !== "set" && p.id === card.from) ? <button type="button" className="ans-from" onClick={() => reveal(card.from!)}>on {from}</button> : null}{busy ? <Status text={busy.status} /> : null}</p>
      <div className="fold ans-fold" data-open={open}>
        <div inert={!open}>
          {card.kind === "chart" ? <ChartBody card={card} look={look} /> : card.kind === "stack" ? <StackBody card={card} look={look} /> : <TextBody card={card} ready={look.ready} />}
        </div>
      </div>
    </section>
  );
}

function Waiting({ busy, slot }: { busy: Busy; slot: Slot }) {
  return (
    <section ref={(el) => slot.setEl("wait", el)} className="ans-card draft pending">
      <header className="ans-h"><h3 className="ans-title">{busy.question}</h3></header>
      <div className="ans-wait"><Status text={busy.status} /></div>
    </section>
  );
}

// The panel nearest the upper part of the window, for answers to questions about the whole case.
function nearestPanel(): string | undefined {
  const mid = innerHeight * 0.35;
  let best: [number, string] | null = null;
  for (const p of document.querySelectorAll<HTMLElement>(".board > .panel[data-panel]")) {
    const r = p.getBoundingClientRect();
    const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
    if (!best || d < best[0]) best = [d, p.dataset.panel!];
  }
  return best?.[1];
}

// The question goes to the scripted agent first and to the model when the script has no answer. Its context is the
// first panel or answer it names, the data behind it, the records of the sets it names, and the questions that
// answer was asked from. The script can be turned off for model evals with the ask-script key in localStorage.
const scripted = () => { try { return localStorage.getItem("ask-script") !== "off"; } catch { return true; } };
async function runQuestion(parts: Part[]) {
  const s = getBoard();
  const scopes = parts.filter(isScope);
  const primary = scopes.find((p) => p.kind === "panel" || p.kind === "card");
  const card = primary?.kind === "card" ? s.cards.find((c) => c.id === primary.id) ?? null : null;
  const fig = primary?.kind === "panel" ? primary.id : null;
  const focusAnswer = card ? answerOf(card) : fig ? sourceFor(fig) : null;
  const sets = scopes.filter((p) => p.kind === "set");
  const ids = [...new Set(sets.flatMap(scopeIds))];
  const question = partsText(parts);
  const plain = parts.filter((p): p is string => typeof p === "string").join(" ");
  const at = card?.id ?? fig;
  const ctx: AskContext = { focus: at ? { title: titleOf(at) ?? "", answer: focusAnswer } : null, sel: { ids, label: sets.map(scopeLabel).join(", ") } };
  // Only an answer can be changed in place. An edit asked from a case panel becomes a new answer beside it.
  let kind = (scripted() && kindFor(plain, ctx)) || "view";
  if (kind === "edit" && !card?.revs) kind = "view";
  const busy: Busy = { question, status: "Analyzing question", at, near: at ? undefined : nearestPanel(), kind };
  board.note("");
  board.busy(busy);
  try {
    let op: Op | null = scripted() ? await respond(plain, ctx, (status) => board.busy({ ...busy, status })) : null;
    if (!op) op = await modelOp(question, card, focusAnswer, ids, (status) => board.busy({ ...busy, status }));
    board.busy(null);
    if (!op) return;
    const base = { question, parts, from: at, near: busy.near };
    if (op.op === "edit" && card?.revs) board.edit(card.id, { label: question, answer: op.answer });
    else if (op.op === "lens") board.addLens(op.name, op.set);
    else if (op.op === "text") board.place({ ...base, kind: "text", title: op.title, text: op.body });
    else if (op.op === "stack") board.place({ ...base, kind: "stack", title: op.title, members: op.members });
    else board.place({ ...base, kind: "chart", title: op.answer.title, height: (op.op === "view" && op.height) || 320, revs: [{ label: question, answer: op.answer }], rev: 0 });
  } catch (e) {
    console.error(e);
    board.busy(null);
    board.note("Error querying data");
  }
}

// The records of the named sets, as rows: from the view the question is about when they are drawn there, and from
// the tables otherwise.
async function selectionRows(loaded: Loaded | null, ids: string[]) {
  if (!ids.length) return [];
  const want = new Set(ids);
  const fromView = loaded ? Object.values(loaded.results).flatMap((r) => r.rows).filter((r) => want.has(String(r.id ?? r.key)) || (Array.isArray(r.source_rows) && r.source_rows.some((x) => want.has(String(x))))) : [];
  if (fromView.length) return fromView.slice(0, 15);
  return TABLES.flatMap((t) => (t.rows as Record<string, unknown>[]).filter((r) => want.has(String(r.id))).map((r) => ({ table: t.name, ...r }))).slice(0, 15);
}

async function modelOp(question: string, card: Card | null, a: Answer | null, ids: string[], onStatus: (s: string) => void): Promise<Op | null> {
  const loaded = a ? await loadOnce(a) : null;
  const selection = await selectionRows(loaded, ids);
  const past: { question: string; summary?: string; edits: string[] }[] = [];
  for (let c = card ? getBoard().cards.find((x) => x.id === card.from) : undefined; c && past.length < 5; c = getBoard().cards.find((x) => x.id === c!.from)) past.unshift({ question: c.question, summary: c.summary, edits: [] });
  const edits = card?.revs?.slice(1, (card.rev ?? 0) + 1).map((r) => r.label) ?? [];
  const m = await askModel(question, { past, current: a && loaded ? current(card?.question ?? a.question, edits, a, loaded.results) : null, selection }, onStatus);
  if ("answer" in m) {
    if (card && m.previousSummary) board.annotate(card.id, m.previousSummary);
    return { op: "view", answer: m.answer };
  }
  if ("password" in m) {
    const pw = window.prompt(`${m.password} Enter the password to ask questions.`);
    if (pw) { savePassword(pw); return modelOp(question, card, a, ids, onStatus); }
    return null;
  }
  board.note("error" in m ? m.error : "Error querying data");
  return null;
}

interface Placed { id: string; from: string | null; near?: string; y?: number }
const anchorOf = (o: Placed) => o.from ?? o.near ?? null;

// When the answers in a group take more room than the group has, the oldest are folded until the rest fit. Groups
// are laid out from the top, so a group pushed down by the one above has less room. The answer the reader last
// touched, the newest answer, answers named in the question being written and answers the reader opened stay open.
interface Group { ids: string[]; top: number; limit: number }
function foldFor(groups: Group[], full: (id: string) => number, mini: (id: string) => number, keep: Set<string>, shut: Set<string>, age: (id: string) => number) {
  const out = new Set<string>();
  const h = (id: string) => (out.has(id) || shut.has(id) ? mini(id) : full(id));
  let bottom = -Infinity;
  for (const g of groups) {
    const start = Math.max(g.top, bottom + GAP);
    let total = g.ids.reduce((s, id) => s + h(id) + GAP, -GAP);
    for (const id of g.ids.filter((x) => !keep.has(x) && !shut.has(x)).sort((p, q) => age(p) - age(q))) {
      if (start + total <= g.limit) break;
      out.add(id);
      total -= full(id) - mini(id);
    }
    bottom = start + total;
  }
  return out;
}

// Places the answers for each layout and decides which to fold. Beside: each answer to a case panel starts level
// with the top of that panel, each answer to an answer follows it, and an answer to the whole case starts level with
// the panel the reader was looking at. An answer that would overlap the one above it moves down. Floating and below:
// answers keep their order in the flow.
function useArrange(layout: Layout, col: RefObject<HTMLDivElement | null>, order: Placed[], cards: Card[]) {
  const els = useRef(new Map<string, HTMLElement>());
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const setEl = useCallback((id: string, el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); }, []);
  const ctx = useBoard((s) => s.ctx);
  const focus = useBoard((s) => s.focus);
  const busyAt = useBoard((s) => (s.busy?.kind === "edit" ? s.busy.at : null));

  const relayout = useCallback(() => {
    const c = col.current;
    const byId = new Map(cards.map((x) => [x.id, x]));
    const fold = (el: HTMLElement) => el.querySelector<HTMLElement>(":scope > .ans-fold");
    const mini = (id: string) => { const el = els.current.get(id); const f = el && fold(el); return el ? el.offsetHeight - (f?.offsetHeight ?? 0) : 60; };
    const full = (id: string) => { const el = els.current.get(id); const f = el && fold(el); return el ? mini(id) + (f?.firstElementChild?.scrollHeight ?? 0) : 300; };
    const newest = cards.reduce<Card | null>((m, x) => (!m || (x.at ?? 0) > (m.at ?? 0) ? x : m), null);
    const keep = new Set([...ctx, ...(focus ? [focus] : []), ...(newest ? [newest.id] : []), ...(busyAt ? [busyAt] : []), "wait", ...cards.filter((x) => x.open).map((x) => x.id)]);
    const shut = new Set(cards.filter((x) => x.open === false).map((x) => x.id));
    const age = (id: string) => byId.get(id)?.at ?? 0;
    const ids = new Set(order.map((o) => o.id));
    const panelTop = (fig: string, top0: number) => { const p = document.querySelector<HTMLElement>(`.board > [data-panel="${fig}"]`); return p ? p.getBoundingClientRect().top - top0 : null; };
    let groups: Group[] = [];

    if (layout === "beside" && c) {
      const top0 = c.getBoundingClientRect().top;
      const anchor = (o: Placed) => { const a = anchorOf(o); return (a ? panelTop(a, top0) : null) ?? o.y ?? 0; };
      const roots = order.filter((o) => o.from === null || !ids.has(o.from)).map((o, i) => ({ o, i, top: anchor(o) })).sort((p, q) => p.top - q.top || p.i - q.i);
      const seq: { id: string; top: number | null }[] = [];
      const group = new Map<number, string[]>();
      const visit = (id: string, top: number | null, g: number) => { seq.push({ id, top }); group.set(g, [...(group.get(g) ?? []), id]); for (const k of order.filter((x) => x.from === id)) visit(k.id, null, g); };
      for (const r of roots) visit(r.o.id, r.top, Math.round(r.top));
      const tops = [...group.keys()].sort((p, q) => p - q);
      const end = (document.querySelector(".board")?.getBoundingClientRect().bottom ?? 0) - top0;
      // An answer may reach a little past the next group's panel before anything folds.
      groups = tops.map((t, k) => ({ ids: group.get(t)!, top: t, limit: k + 1 < tops.length ? tops[k + 1] - GAP + 160 : Math.max(end, t + innerHeight) }));
      let bottom = -GAP;
      for (const { id, top } of seq) {
        const el = els.current.get(id);
        if (!el) continue;
        const y = Math.max(top ?? bottom + GAP, bottom + GAP);
        el.style.transform = `translateY(${Math.round(y)}px)`;
        bottom = y + el.offsetHeight;
      }
      c.style.minHeight = `${Math.max(0, bottom)}px`;
    } else {
      for (const el of els.current.values()) el.style.transform = "";
      if (c) c.style.minHeight = "";
      if (layout === "floating") groups = [{ ids: order.map((o) => o.id), top: 0, limit: (c?.clientHeight ?? innerHeight) - 8 }];
      else {
        const by = new Map<string, string[]>();
        const root = (o: Placed): string => { const p = o.from && order.find((x) => x.id === o.from); return p ? root(p) : anchorOf(o) ?? "02"; };
        for (const o of order) { const k = root(o); by.set(k, [...(by.get(k) ?? []), o.id]); }
        // A slot with two columns holds about twice the height of answers before they overflow the window.
        const cols = (fig: string) => { const el = document.querySelector<HTMLElement>(`[data-slot="${fig}"]`); return el ? Math.min(2, getComputedStyle(el).gridTemplateColumns.split(" ").length) : 1; };
        groups = [...by].map(([fig, g], k) => ({ ids: g, top: k * 1e6, limit: k * 1e6 + innerHeight * 0.85 * cols(fig) }));
      }
    }
    const next = foldFor(groups, full, mini, keep, shut, age);
    setFolded((f) => (f.size === next.size && [...next].every((x) => f.has(x)) ? f : next));
  }, [col, order, layout, cards, ctx, focus, busyAt]);

  useLayoutEffect(() => {
    relayout();
    const ro = new ResizeObserver(() => relayout());
    for (const el of els.current.values()) ro.observe(el);
    const boardEl = document.querySelector(".board");
    if (boardEl) ro.observe(boardEl);
    if (col.current) ro.observe(col.current);
    addEventListener("resize", relayout);
    return () => { ro.disconnect(); removeEventListener("resize", relayout); };
  });
  return useMemo(() => ({ setEl, folded }), [setEl, folded]);
}

// The places under each case panel where answers go in the below layout. The panels put them on the page.
function useSlots(on: boolean) {
  const [slots, setSlots] = useState<Map<string, HTMLElement>>(new Map());
  useLayoutEffect(() => {
    if (!on) return;
    setSlots(new Map([...document.querySelectorAll<HTMLElement>("[data-slot]")].map((el) => [el.dataset.slot!, el])));
  }, [on]);
  return slots;
}

export function Answers({ theme }: { theme: Theme }) {
  const cards = useBoard((s) => s.cards);
  const busy = useBoard((s) => s.busy);
  const layout = useBoard((s) => s.layout);
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<MapData | null>(null);
  const [fonts, setFonts] = useState("");
  const probe = useRef<SVGTextElement>(null);
  const col = useRef<HTMLDivElement>(null);
  const want = cards.length > 0 || !!busy;

  // DuckDB loads with the first answer, so a page without answers does not wait for it.
  useEffect(() => {
    if (!want || ready) return;
    connect().then(() => setReady(true), (e) => { console.error(e); board.note("Error loading data"); });
    loadMapData().then(setMap);
  }, [want, ready]);
  useLayoutEffect(() => {
    const cache = new Map<string, number>();
    setMeasure((text, cls) => {
      const k = `${document.documentElement.dataset.family}|${cls}|${text}`;
      let w = cache.get(k);
      if (w === undefined && probe.current) {
        probe.current.setAttribute("class", `ask-probe ${cls}`);
        probe.current.textContent = text;
        w = probe.current.getComputedTextLength();
        cache.set(k, w);
      }
      return w ?? text.length * 6.3;
    });
    document.fonts.ready.then(() => { cache.clear(); fitCache.clear(); setFonts(`${document.fonts.status}:${Date.now()}`); });
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(":popover-open")) return;
      board.clearSelection();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const look: Look = useMemo(() => ({ theme, map, fonts, ready }), [theme, map, fonts, ready]);
  const showWait = !!busy && busy.kind !== "edit" && busy.kind !== "lens";
  const replacedIdx = showWait ? cards.findIndex((c) => !c.pinned && c.from === busy!.at && (busy!.at !== null || c.near === busy!.near)) : -1;
  const order = useMemo(() => {
    const o: Placed[] = cards.map((c) => ({ id: c.id, from: c.from, near: c.near, y: c.y }));
    if (!showWait) return o;
    // The answer that is on its way takes the place of the unpinned answer it will replace.
    const w = { id: "wait", from: busy!.at, near: busy!.near };
    return replacedIdx >= 0 ? o.map((x, k) => (k === replacedIdx ? w : x)) : [...o, w];
  }, [cards, busy, showWait, replacedIdx]);
  const slot = useArrange(layout, col, order, cards);
  const replaced = replacedIdx >= 0 ? cards[replacedIdx].id : undefined;
  const slots = useSlots(layout === "below");

  // A new answer scrolls into view: to the end of the column, or on the page when it was placed out of sight, as an
  // answer to a panel named from far away is.
  const newest = cards.reduce<Card | null>((m, c) => (!m || (c.at ?? 0) > (m.at ?? 0) ? c : m), null);
  const seen = useRef(newest?.id);
  useEffect(() => {
    if (layout === "floating" && col.current) col.current.scrollTo({ top: col.current.scrollHeight, behavior: "smooth" });
    if (!newest || seen.current === newest.id) return;
    seen.current = newest.id;
    if (layout === "floating") return;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-card="${newest.id}"]`);
      if (!el) return;
      // A card in the beside layout is still moving to its place, so its place is read from its transform.
      const t = /translateY\(([-\d.]+)px\)/.exec(el.style.transform);
      const top = t ? el.parentElement!.getBoundingClientRect().top + parseFloat(t[1]) : el.getBoundingClientRect().top;
      const h = el.offsetHeight;
      if (top > innerHeight - 120 || top + h < 120) scrollTo({ top: scrollY + top - Math.max(140, (innerHeight - h) / 2), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [newest, showWait, layout]);

  const view = (o: Placed): ReactNode => {
    if (o.id === "wait") return <Waiting key="wait" busy={busy!} slot={slot} />;
    const c = cards.find((x) => x.id === o.id);
    return c && c.id !== replaced ? <CardView key={c.id} card={c} look={look} slot={slot} /> : null;
  };

  let content: ReactNode;
  if (layout === "below") {
    // Answers go under the panel of their first answer in the chain, in the order they were asked.
    const by = new Map<string, Placed[]>();
    const root = (o: Placed): string => { const p = o.from && order.find((x) => x.id === o.from); return p ? root(p) : anchorOf(o) ?? "02"; };
    for (const o of order) { const k = root(o); by.set(k, [...(by.get(k) ?? []), o]); }
    content = [...by].map(([fig, list]) => { const el = slots.get(fig) ?? slots.get("02"); return el ? createPortal(<>{list.map(view)}</>, el, fig) : null; });
  } else content = order.map(view);

  return (
    <aside className="answers" aria-label="Answers" data-layout={layout}>
      <Defs probe={probe} />
      <div ref={col} className="ans-col">{layout === "below" ? null : content}</div>
      {layout === "below" ? content : null}
      <Composer ready={!want || ready} onRun={runQuestion} />
    </aside>
  );
}

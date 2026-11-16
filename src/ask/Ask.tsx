import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Segmented, useSize } from "../components/primitives";
import { tip, TipRow } from "../tip";
import { ask, suggest } from "./agent";
import { connect } from "./db";
import { Engine } from "./engine";
import type { Move } from "./engine";
import { describe, editFilter, fromMs, toMs } from "./filters";
import type { Filter, FilterEdit, Op } from "./filters";
import { fmtDate, fmtValue } from "./format";
import { askOf, commit, EMPTY_HISTORY, folded, graph, node, path } from "./history";
import type { History, VNode } from "./history";
import { loadMapData } from "./map";
import type { MapData } from "./map";
import { scene, setMeasure } from "./render";
import type { KeyEntry, MarkT, Scene } from "./render";
import { load } from "./run";
import { EntityPop } from "./EntityPop";
import { entityIn } from "./entities";
import type { Loaded } from "./run";
import { labelOf } from "./spec";
import type { Answer, Channel, Param } from "./spec";

const H = 560;

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
      probe.textContent = `${text.slice(0, mid)}…`;
      if (probe.getComputedTextLength() <= w) lo = mid; else hi = mid - 1;
    }
    t = `${text.slice(0, Math.max(1, lo))}…`;
  }
  fitCache.set(k, t);
  return t;
}

function Swatch({ cls, shape }: { cls: string; shape: string }) {
  if (shape === "line") return <svg className="ask-sw" width="16" height="12" viewBox="0 -6 16 12" aria-hidden="true"><path className={`ask-link ${cls}`} d="M1 0H15" /></svg>;
  const d = shape === "diamond" ? 7.5 : 9;
  return (
    <svg className="ask-sw" width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
      <g className={`ask-m ${cls}`} transform={shape === "diamond" ? "rotate(45)" : undefined}><rect x={-d / 2} y={-d / 2} width={d} height={d} rx={shape === "dot" || shape === "ring" ? d / 2 : 0} /></g>
    </svg>
  );
}

function Key({ entries }: { entries: KeyEntry[] }) {
  return (
    <ul className="ask-key">
      {entries.map((e, i) => (
        <li key={i}>
          {e.title ? <span className="ask-key-t">{e.title}</span> : null}
          {e.items.map((it) => <span key={it.label} className="ask-key-i"><Swatch cls={it.cls} shape={it.shape} />{it.label}</span>)}
        </li>
      ))}
    </ul>
  );
}

function RowTip({ a, data, m }: { a: Answer; data: Loaded; m: MarkT }) {
  const L = a.layers[m.layer];
  const cols = (L.from ? data.results[L.from]?.columns : []) ?? [];
  const key = L.from ? a.tables[L.from]?.key : undefined;
  const shown = cols.filter((c) => c.name !== key && c.type !== "list" && labelOf(a, c.name) !== "");
  const title = shown.find((c) => c.type === "nominal");
  return (
    <>
      {title ? <b>{String(m.row[title.name])}</b> : null}
      {shown.filter((c) => c !== title).slice(0, 8).map((c) => <TipRow key={c.name} k={labelOf(a, c.name)} v={fmtValue(a, c.name, m.row[c.name], c.type)} />)}
      {m.src ? <span className="tip-foot">Made from {m.src.length} {m.src.length === 1 ? "row" : "rows"}</span> : null}
    </>
  );
}

// A value that changes when dragged sideways and opens a finer control when clicked.
function Scrub({ text, onStep, children }: { text: string; onStep: (n: number) => void; children?: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const drag = useRef<{ x: number; moved: boolean; n: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("pointerdown", off);
    return () => removeEventListener("pointerdown", off);
  }, [open]);
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, moved: false, n: 0 };
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const n = Math.round((e.clientX - d.x) / 6);
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
    if (n !== d.n) { onStep(n - d.n); d.n = n; }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && children) setOpen((o) => !o);
  };
  return (
    <span className="ask-scrub" ref={wrap}>
      <button type="button" className="num" data-tip="Drag sideways to change, or select for more" onPointerDown={down} onPointerMove={move} onPointerUp={up}>{text}</button>
      {open && children ? <span className="ask-pop">{children(() => setOpen(false))}</span> : null}
    </span>
  );
}

const OPS: Op[] = ["≥", ">", "≤", "<"];
const OP_WORDS: Partial<Record<Op, string>> = { "≥": "at least", ">": "more than", "≤": "at most", "<": "less than", "=": "is", "≠": "is not" };

// A click opens a menu rather than changing the comparison, since the operator lies next to the value people drag.
function OpMenu({ op, ops, text, onPick }: { op: Op; ops: Op[]; text: string; onPick: (op: Op) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", off);
    addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", off); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <span className="ask-opw" ref={wrap}>
      <button type="button" className="ask-op" aria-haspopup="menu" aria-expanded={open} data-tip={open ? undefined : "Change the comparison"} onClick={() => setOpen((o) => !o)}>{text}</button>
      {open ? (
        <span className="ask-pop ask-list ask-ops" role="menu">
          {ops.map((o) => <button key={o} type="button" role="menuitemradio" aria-checked={o === op} className={o === op ? "on" : ""} onClick={() => { setOpen(false); if (o !== op) onPick(o); }}><b>{o}</b> {OP_WORDS[o]}</button>)}
        </span>
      ) : null}
    </span>
  );
}
function FilterChip({ f: raw, labels, onEdit }: { f: Filter; labels?: Record<string, string>; onEdit: (f: Filter, ed: FilterEdit, label: string) => void }) {
  const f = labels?.[raw.expr.replace(/^"|"$/g, "")] ? { ...raw, label: labels[raw.expr.replace(/^"|"$/g, "")] } : raw;
  const d = f.domain;
  const isNum = f.vtype === "number", isTime = f.vtype === "date" || f.vtype === "timestamp";
  const fmt = (v: number | string) => (isTime ? fmtDate(toMs(v)) : isNum ? fmtValue(null, f.expr, Number(v)) : String(v));
  const range = d && "min" in d ? d : null;
  const stepOf = () => {
    if (!range) return 1;
    if (isTime) { const span = range.max - range.min; return span > 3 * 365 * 864e5 ? 30 * 864e5 : span > 60 * 864e5 ? 7 * 864e5 : 864e5; }
    const s = (range.max - range.min) / 100;
    if (range.int) return Math.max(1, Math.round(s >= 5 ? Math.pow(10, Math.floor(Math.log10(s))) : 1));
    const p = Math.pow(10, Math.floor(Math.log10(s || 1)));
    return p;
  };
  const clamp = (v: number) => (range ? Math.min(Math.max(range.min, range.max), Math.max(Math.min(range.min, range.max), v)) : v);
  const shift = (v: number | string, n: number) => {
    const ms = isTime ? toMs(v) : Number(v);
    const next = clamp(ms + n * stepOf());
    return isTime ? fromMs(next, f.vtype) : +next.toPrecision(10);
  };
  const slider = (v: number | string, set: (x: number | string) => void) => range ? (
    <label className="range">
      <span>{f.label} <b className="num">{fmt(v)}</b></span>
      <input type="range" min={range.min} max={range.max} step={stepOf()} value={isTime ? toMs(v) : Number(v)}
        onChange={(e) => set(isTime ? fromMs(+e.target.value, f.vtype) : +e.target.value)}
        style={{ ["--p" as string]: `${(((isTime ? toMs(v) : Number(v)) - range.min) / (range.max - range.min || 1)) * 100}%` }} />
    </label>
  ) : null;
  const remove = f.clause !== "column" ? <button type="button" className="ask-x" aria-label={`Remove ${f.label}`} data-tip="Remove this condition" onClick={() => onEdit(f, { remove: true }, `Removed ${f.label.toLowerCase()}`)}><svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1 7 7M7 1 1 7" /></svg></button> : null;

  if (f.kind === "compare" && (isNum || isTime)) {
    const say = (op: Op, v: number | string) => `${f.label} ${op} ${fmt(v)}`;
    return (
      <span className="tag ask-f">
        <span className="ask-f-l">{f.label}</span>
        <OpMenu op={f.op} ops={OPS} text={f.op} onPick={(op) => onEdit(f, { op }, say(op, f.value))} />
        <Scrub text={fmt(f.value)} onStep={(n) => { const v = shift(f.value, n); onEdit(f, { value: v }, say(f.op, v)); }}>
          {() => slider(f.value, (v) => onEdit(f, { value: v }, say(f.op, v)))}
        </Scrub>
        {remove}
      </span>
    );
  }
  if (f.kind === "between") {
    const say = (lo: number | string, hi: number | string) => `${f.label} ${fmt(lo)} to ${fmt(hi)}`;
    return (
      <span className="tag ask-f">
        <span className="ask-f-l">{f.label}</span>
        <Scrub text={fmt(f.lo)} onStep={(n) => { const v = shift(f.lo, n); onEdit(f, { lo: v }, say(v, f.hi)); }}>{() => slider(f.lo, (v) => onEdit(f, { lo: v }, say(v, f.hi)))}</Scrub>
        <span className="ask-f-l">to</span>
        <Scrub text={fmt(f.hi)} onStep={(n) => { const v = shift(f.hi, n); onEdit(f, { hi: v }, say(f.lo, v)); }}>{() => slider(f.hi, (v) => onEdit(f, { hi: v }, say(f.lo, v)))}</Scrub>
        {remove}
      </span>
    );
  }
  const values = d && "values" in d ? d.values : [];
  if (f.kind === "compare") {
    return (
      <span className="tag ask-f">
        <span className="ask-f-l">{f.label}</span>
        <OpMenu op={f.op} ops={["=", "≠"]} text={f.op === "=" ? "is" : "is not"} onPick={(op) => onEdit(f, { op }, `${f.label} ${op} ${f.value}`)} />
        <Scrub text={String(f.value)} onStep={(n) => { if (!values.length) return; const i = (values.indexOf(String(f.value)) + n + values.length * 9) % values.length; onEdit(f, { value: values[i] }, `${f.label} ${f.op} ${values[i]}`); }}>
          {(close) => <span className="ask-list">{values.map((v) => <button key={v} type="button" className={v === f.value ? "on" : ""} onClick={() => { onEdit(f, { value: v }, `${f.label} ${f.op} ${v}`); close(); }}>{v}</button>)}</span>}
        </Scrub>
        {remove}
      </span>
    );
  }
  if (f.kind === "in") {
    const pick = (v: string) => { const next = f.values.includes(v) ? f.values.filter((x) => x !== v) : [...f.values, v]; if (next.length) onEdit(f, { values: next }, `${f.label}: ${next.join(", ")}`); };
    return (
      <span className="tag ask-f">
        <span className="ask-f-l">{f.label}{f.not ? " not" : ""}</span>
        <Scrub text={f.values.length > 2 ? `${f.values.length} values` : f.values.join(", ")} onStep={() => undefined}>
          {() => <span className="ask-list">{(values.length ? values : f.values).map((v) => <button key={v} type="button" className={f.values.includes(v) ? "on" : ""} aria-pressed={f.values.includes(v)} onClick={() => pick(v)}>{v}</button>)}</span>}
        </Scrub>
        {remove}
      </span>
    );
  }
  return <span className="tag">{describe(f, fmt)}</span>;
}

function ParamChip({ k, p, onSet }: { k: string; p: Param; onSet: (k: string, v: number) => void }) {
  const step = p.step ?? 1;
  const set = (v: number) => onSet(k, Math.min(p.max, Math.max(p.min, +v.toPrecision(10))));
  return (
    <span className="tag ask-f ask-param">
      <span className="ask-f-l">{p.label}</span>
      <Scrub text={`${p.value}${p.unit ?? ""}`} onStep={(n) => set(p.value + n * step)}>
        {() => (
          <label className="range">
            <span>{p.label} <b className="num">{p.value}{p.unit ?? ""}</b></span>
            <input type="range" min={p.min} max={p.max} step={step} value={p.value} onChange={(e) => set(+e.target.value)} style={{ ["--p" as string]: `${((p.value - p.min) / (p.max - p.min)) * 100}%` }} />
          </label>
        )}
      </Scrub>
    </span>
  );
}

function Tree({ h, onPick }: { h: History; onPick: (id: number) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const cur = askOf(h)?.id;
  useEffect(() => { setOpen(new Set()); }, [cur]);
  const { rows, lanes } = useMemo(() => graph(folded(h, open)), [h, open]);
  const expand = (ask: number) => setOpen((s) => new Set(s).add(ask));
  const onPath = new Set(path(h).map((n) => n.id));
  const on = (n: VNode) => onPath.has(n.id) || !!n.members?.some((m) => onPath.has(m));
  const LW = 14, x = (l: number) => 10 + l * LW;
  const rh = rows.map((r) => (r.n.kind === "fold" ? 24 : 30));
  const top = rh.map((_, i) => rh.slice(0, i).reduce((a, b) => a + b, 0));
  const y = (i: number) => top[i] + rh[i] / 2;
  return (
    <div className="ask-tree" style={{ ["--gw" as string]: `${20 + lanes * LW}px` }}>
      <svg width={20 + lanes * LW} height={top.length ? top[top.length - 1] + rh[rh.length - 1] : 0} aria-hidden="true">
        {rows.map((r, i) => r.parentRow < 0 ? null : (
          <path key={`e${r.n.id}`} className={on(r.n) ? "on" : ""}
            d={r.lane === r.parentLane ? `M${x(r.lane)} ${y(r.parentRow)}V${y(i)}` : `M${x(r.parentLane)} ${y(r.parentRow)}C${x(r.parentLane)} ${y(r.parentRow) + 18} ${x(r.lane)} ${y(r.parentRow) + 12} ${x(r.lane)} ${y(r.parentRow) + 30}V${y(i)}`} />
        ))}
        {rows.map((r, i) => r.n.kind === "fold" ? (
          <rect key={r.n.id} className={`k-fold${on(r.n) ? " on" : ""}`} x={x(r.lane) - 4.5} y={y(i) - 9} width={9} height={18} rx={4.5} />
        ) : (
          <circle key={r.n.id} className={`k-${r.n.kind}${r.n.id === h.head ? " head" : ""}${on(r.n) ? " on" : ""}`} cx={x(r.lane)} cy={y(i)} r={r.n.kind === "ask" ? 4.5 : 3} />
        ))}
      </svg>
      <ol>
        {rows.map((r, i) => (
          <li key={r.n.id} style={{ height: rh[i] }}>
            {r.n.kind === "fold" ? (
              <button type="button" className="k-fold" aria-expanded="false" data-tip="Show these edits" onClick={() => expand(r.n.ask!)}>{r.n.label}</button>
            ) : (
              <button type="button" className={`k-${r.n.kind}${r.n.id === h.head ? " head" : ""}`} aria-current={r.n.id === h.head ? "step" : undefined} onClick={() => onPick(r.n.id)}>{r.n.label}</button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Ask() {
  const [h, setH] = useState<History>(EMPTY_HISTORY);
  const [data, setData] = useState<{ answer: Answer; loaded: Loaded } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<{ status: string; ms: number } | null>(null);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [map, setMap] = useState<MapData | null>(null);
  const [axisMenu, setAxisMenu] = useState<"x" | "y" | null>(null);
  const [pop, setPop] = useState<{ ent: string; mark: string } | null>(null);
  // Chart or table is a way of looking at the answer rather than a change to it, so it stays out of the history.
  const [form, setForm] = useState<"chart" | "table" | null>(null);
  const [box, { w: W }] = useSize<HTMLDivElement>();
  const marks = useRef<SVGGElement>(null);
  const linkLayer = useRef<SVGGElement>(null);
  const probe = useRef<SVGTextElement>(null);
  const [fonts, setFonts] = useState("");
  const engine = useRef<Engine | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextMove = useRef<Move | null>(null);
  const prevAsk = useRef<number | null>(null);
  const seq = useRef(0);
  const hRef = useRef(h);
  hRef.current = h;
  const head = node(h, h.head);
  const answer = head?.answer ?? null;

  useEffect(() => {
    connect().then(() => setReady(true), (e) => setNote(`The case records could not be loaded: ${e.message}`));
    loadMapData().then(setMap);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "/" || (e.target as HTMLElement).closest("input, textarea")) return;
      e.preventDefault();
      input.current?.focus();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  // Widths depend on the theme's fonts, so the cache is per theme and the scene is laid out again when the theme
  // changes or the fonts finish loading.
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
    const bump = () => setFonts(`${document.documentElement.dataset.family}:${document.fonts.status}:${Date.now()}`);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-family"] });
    document.fonts.ready.then(() => { cache.clear(); fitCache.clear(); bump(); });
    return () => mo.disconnect();
  }, []);

  useLayoutEffect(() => {
    engine.current = new Engine(marks.current!, linkLayer.current!);
    return () => { engine.current?.dispose(); engine.current = null; };
  }, []);

  useEffect(() => {
    if (!answer) { seq.current++; setData(null); return; }
    if (!ready) return;
    const n = ++seq.current;
    load(answer).then((loaded) => {
      if (n !== seq.current) return;
      setData({ answer, loaded });
      setNote(loaded.errors.length ? `The description has problems the agent would repair: ${loaded.errors.join("; ")}` : "");
    });
  }, [answer, ready]);

  const scope = String(askOf(h)?.id ?? 0);
  const sc: Scene | null = useMemo(() => (data && W > 300 ? scene(form ? { ...data.answer, form } : data.answer, data.loaded, W, H, map, scope) : null), [data, W, map, scope, fonts, form]);

  useLayoutEffect(() => {
    if (!engine.current) return;
    if (!sc) { engine.current.apply([], [], { dur: 300 }); prevAsk.current = null; return; }
    const ak = askOf(hRef.current)?.id ?? null;
    const mv = nextMove.current ?? (ak !== prevAsk.current ? { dur: 450, arrive: 250 } : { dur: 450, stagger: 80 });
    nextMove.current = null;
    prevAsk.current = ak;
    engine.current.apply(sc.marks, sc.links, mv);
  }, [sc]);

  useEffect(() => { engine.current?.light(sel, "sel"); }, [sel, sc]);

  // Edits on the page. While one is being applied, only the latest of any that arrive is kept.
  const pending = useRef<{ fn: (a: Answer) => Promise<Answer> | Answer; label: string; key: string; mv: Move } | null>(null);
  const running = useRef(false);
  const edit = (label: string, key: string, fn: (a: Answer) => Promise<Answer> | Answer, mv: Move = { dur: 420, stagger: 60 }) => {
    pending.current = { fn, label, key, mv };
    if (running.current) return;
    running.current = true;
    (async () => {
      while (pending.current) {
        const p = pending.current;
        pending.current = null;
        const cur = node(hRef.current, hRef.current.head)?.answer;
        if (!cur) break;
        try {
          const next = await p.fn(cur);
          if (next === cur) continue;
          nextMove.current = p.mv;
          const h2 = commit(hRef.current, "edit", p.label, next, p.key);
          hRef.current = h2;
          setH(h2);
        } catch (e) { setNote(`The edit could not be applied: ${(e as Error).message}`); }
      }
      running.current = false;
    })();
  };
  const onFilter = (f: Filter, ed: FilterEdit, label: string) => edit(label, `f:${f.id}:${ed.remove ? "rm" : ed.op ? "op" : "v"}`, (a) => editFilter(a, f, ed), { dur: 360, stagger: 40 });
  const onParam = (k: string, v: number) => edit(`${answer?.params?.[k].label ?? k} ${v}${answer?.params?.[k].unit ?? ""}`, `p:${k}`, (a) => ({ ...a, params: { ...a.params, [k]: { ...a.params![k], value: v } } }), { dur: 220 });
  const onForm = (f: "chart" | "table") => { nextMove.current = { dur: 800, stagger: 280 }; setForm(f); };
  const onSort = (field: string) => edit(`Sorted by ${labelOf(answer!, field).toLowerCase()}`, "sort", (a) => ({ ...a, sort: { field, desc: a.sort?.field === field ? !a.sort.desc : false } }), { dur: 520, stagger: 120 });
  const onSwap = (axis: "x" | "y", from: string, to: string, type: string) => {
    setAxisMenu(null);
    if (to === from) return;
    // Binning carries over to another number field, so stacked dots stay stacked.
    const enc = (e: Channel) => ({ field: to, ...(e.bin && type === "quantitative" ? { bin: true } : {}) });
    edit(`${axis}: ${labelOf(answer!, to)}`, `swap:${axis}`, (a) => ({
      ...a,
      layers: a.layers.map((l) => (l.encoding[axis]?.field === from ? { ...l, encoding: { ...l.encoding, [axis]: enc(l.encoding[axis]!) } } : l)),
    }), { dur: 800, stagger: 240 });
  };

  const run = async (question: string) => {
    if (busy || !ready) return;
    setNote("");
    const r = await ask(question, { current: answer, selection: [...sel] });
    if ("error" in r) { setNote(r.error); return; }
    setQ("");
    setSel(new Set());
    setForm(null);
    nextMove.current = { dur: 450, arrive: 250, stagger: 120 };
    const h2 = commit(hRef.current, "ask", question, r.answer);
    hRef.current = h2;
    setH(h2);
    setBusy({ status: r.status, ms: r.ms });
    setTimeout(() => setBusy(null), r.ms);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); if (q.trim()) run(q.trim()); };
  const checkout = (id: number) => { setSel(new Set()); setH((x) => ({ ...x, head: id })); };

  const markOf = (e: { target: EventTarget }) => {
    const id = (e.target as Element).closest<SVGGElement>("[data-id]")?.dataset.id;
    return id ? sc?.marks.find((m) => m.id === id) ?? null : null;
  };
  const over = (e: ReactPointerEvent<SVGGElement>) => {
    const m = markOf(e);
    if (!m || !data) return;
    engine.current?.light(new Set([m.id]));
    tip.show((e.target as Element).closest("[data-id]")!, <RowTip a={data.answer} data={data.loaded} m={m} />, { card: true });
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pick = (e: ReactMouseEvent<SVGGElement>) => {
    const m = markOf(e);
    if (!m || !data) return;
    const L = data.answer.layers[m.layer];
    const ent = entityIn(m.row, L.from ? data.answer.tables[L.from]?.key : undefined);
    tip.hide();
    if (ent) setPop(pop?.mark === m.id ? null : { ent, mark: m.id });
    else toggle(m.id);
  };
  useEffect(() => { setPop(null); }, [h.head]);
  const popMark = pop ? sc?.marks.find((m) => m.id === pop.mark) : undefined;

  const base = data?.answer ?? answer;
  const shown = base && form ? { ...base, form } : base;
  const filters = data?.loaded.filters ?? [];
  const suggestions = ready ? suggest({ current: answer, selection: [...sel] }) : [];
  const rowsOf = (l: { from?: string }) => (l.from ? data?.loaded.results[l.from]?.rows.length ?? 0 : 0);
  const lead = shown?.layers.filter((l) => l.from && !["rule", "text", "link"].includes(l.mark)).sort((p, q) => rowsOf(q) - rowsOf(p))[0];
  // Aggregated rows count the records they were made from.
  const count = (lead?.from ? data?.loaded.results[lead.from]?.rows ?? [] : []).reduce((n, r) => n + (Array.isArray(r.source_rows) ? r.source_rows.length : 1), 0);
  const axisCols = (axis: "x" | "y") => {
    const t = sc?.titles.find((x) => x.axis === axis);
    const l = shown?.layers.find((x) => x.encoding[axis]?.field === t?.field && x.from);
    return { t, cols: (l?.from ? data?.loaded.results[l.from]?.columns ?? [] : []).filter((c) => c.type !== "list" && c.name !== shown?.tables[l!.from!]?.key) };
  };

  return (
    <section className="ask" data-form={shown?.form ?? "chart"} aria-label="Ask about the case">
      <header className="ask-head">
        <div className="ask-title">
          <h2>{shown && head ? shown.title : "Ask about the Whitcombe case"}</h2>
          {shown && head ? <span className="note num">{count} {shown.unit ? shown.unit[count === 1 ? 0 : 1] : count === 1 ? "row" : "rows"}{sel.size ? <> · {sel.size} selected <button type="button" className="btn quiet" onClick={() => setSel(new Set())}>Clear</button></> : null}</span> : null}
        </div>
        {shown && head ? (
          <div className="ask-controls">
            <div className="ask-filters">
              {filters.map((f) => <FilterChip key={f.id} f={f} labels={shown.labels} onEdit={onFilter} />)}
              {Object.entries(shown.params ?? {}).map(([k, p]) => <ParamChip key={k} k={k} p={p} onSet={onParam} />)}
            </div>
            <Segmented label="Form" value={shown.form ?? "chart"} onChange={onForm} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
          </div>
        ) : null}
      </header>
      <div className="ask-stage" ref={box} onPointerDown={(e) => { if (!(e.target as Element).closest(".ask-axis")) setAxisMenu(null); }}>
        <svg width={W} height={sc?.height ?? H} role="img" aria-label={shown?.title ?? "Empty stage"}>
          <defs>
            <pattern id="ask-hatch-p" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="#fff" /></pattern>
            <marker id="ask-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0.5 8 4 0 7.5Z" fill="context-stroke" /></marker>
            <mask id="ask-hatch" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#ask-hatch-p)" /></mask>
          </defs>
          <text ref={probe} className="ask-probe" x={-9999} y={-9999} aria-hidden="true" />
          <g key={`${h.head}-${shown?.form}`} className="ask-chrome">{sc?.chrome}</g>
          {sc?.rows ? (
            <g className="ask-table">
              {sc.columns!.map((c) => <line key={c.field} className="ask-grid" x1={c.x} x2={c.x} y1={6} y2={sc.height - 6} />)}
              {sc.rows.map((r) => (
                <g key={r.id} className="ask-tr" style={{ transform: `translateY(${r.y}px)` }}>
                  {sc.columns!.map((c, i) => <text key={c.field} className="c-label ink" x={c.num ? c.x + c.w - 8 : c.x + 8} y={16} textAnchor={c.num ? "end" : "start"}>{fit(r.cells[i], c.w - 14)}</text>)}
                </g>
              ))}
            </g>
          ) : null}
          <g ref={linkLayer} className="ask-links" />
          <g ref={marks} className="ask-marks" onPointerOver={over} onPointerOut={() => { engine.current?.light(new Set()); tip.hide(); }} onClick={pick} />
        </svg>
        {sc?.columns ? (
          <div className="ask-th">
            {sc.columns.map((c) => (
              <button key={c.field} type="button" style={{ left: c.x, width: c.w, textAlign: c.num ? "right" : "left" }} onClick={() => onSort(c.field)} aria-sort={shown?.sort?.field === c.field ? (shown.sort.desc ? "descending" : "ascending") : undefined}>
                {c.label}{shown?.sort?.field === c.field ? (shown.sort.desc ? " ↓" : " ↑") : ""}
              </button>
            ))}
          </div>
        ) : null}
        {sc?.titles.map((t) => {
          const { cols } = axisCols(t.axis);
          return (
            <span key={t.axis} className={`ask-axis ${t.axis}`} style={t.anchor === "end" ? { right: W - t.x, top: t.y - 12 } : { left: t.x, top: t.y - 12 }}>
              <button type="button" data-tip="Show another column on this axis" onClick={() => setAxisMenu(axisMenu === t.axis ? null : t.axis)}>{t.text}</button>
              {axisMenu === t.axis ? <span className="ask-pop ask-list">{cols.map((c) => <button key={c.name} type="button" className={c.name === t.field ? "on" : ""} onClick={() => onSwap(t.axis, t.field, c.name, c.type)}>{labelOf(shown!, c.name) || c.name}</button>)}</span> : null}
            </span>
          );
        })}
        {pop && popMark ? <EntityPop id={pop.ent} x={popMark.x + popMark.w / 2} y={popMark.y} w={W} h={sc?.height ?? H} selected={sel.has(popMark.id)} onAsk={(q) => { setPop(null); run(q); }} onSelect={() => toggle(popMark.id)} onClose={() => setPop(null)} /> : null}
        {!head ? (
          <div className="ask-empty">
            <p className="note">{ready ? "The agent writes a query and a description of a view for each question, and the page draws it. Conditions in the query become controls you can drag. Every question and edit stays in the history, where an earlier answer can be picked up again." : "Loading the case records into the page"}</p>
          </div>
        ) : null}
      </div>
      <aside className="ask-side">
        <h4 className="sub-h">History</h4>
        {h.nodes.length ? <Tree h={h} onPick={checkout} /> : <p className="note">Questions and edits appear here as a tree. Asking from an earlier answer starts a branch.</p>}
      </aside>
      <form className="ask-bar" onSubmit={submit}>
        <label className="search">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3 4.5 7 8l-4 3.5M8.5 12H13" /></svg>
          <input ref={input} type="text" value={q} placeholder={head && head.id !== Math.max(...h.nodes.map((n) => n.id)) ? "Ask from this answer to start a branch" : "Ask about the case"} aria-label="Ask about the case" onChange={(e) => setQ(e.target.value)} />
          <kbd>/</kbd>
        </label>
        <div className="chips ask-next">
          {busy ? <span className="ask-status"><i />{busy.status}</span> : suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => run(s)}>{s}</button>)}
        </div>
        <div className="ask-foot">
          {note ? <p className="note" aria-live="polite">{note}</p> : null}
          {sc ? <Key entries={sc.key} /> : null}
        </div>
      </form>
    </section>
  );
}

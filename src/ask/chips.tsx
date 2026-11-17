import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { TipRow } from "../tip";
import { describe, fromMs, toMs } from "./filters";
import type { Filter, FilterEdit, Op } from "./filters";
import type { Breakdown } from "./breakdown";
import { fmtDate, fmtValue } from "./format";
import type { MarkT } from "./render";
import type { Loaded } from "./run";
import { labelOf } from "./spec";
import type { Answer, Param } from "./spec";

// Controls an answer carries: one chip per condition in its SQL and per parameter of its model, and the card shown
// for a mark under the pointer.

export function RowTip({ a, data, m }: { a: Answer; data: Loaded; m: MarkT }) {
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
// Splits bars by a second column, or lists the rows behind them.
export function BreakMenu({ b, units, picked, onSplit, onList }: { b: Breakdown; units: string; picked: number; onSplit: (field: string | null) => void; onList: () => void }) {
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
  const cur = b.options.find((o) => o.field === b.current);
  const pick = (f: () => void) => { setOpen(false); f(); };
  return (
    <span className="ask-opw ask-break" ref={wrap}>
      <button type="button" className={`btn quiet${cur ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{cur ? `By ${cur.label.toLowerCase()}` : "Break down"}</button>
      {open ? (
        <span className="ask-pop ask-list" role="menu">
          <span className="ask-list-h">Split each bar by</span>
          {b.options.map((o) => <button key={o.field} type="button" role="menuitemradio" aria-checked={o.field === b.current} className={o.field === b.current ? "on" : ""} onClick={() => pick(() => onSplit(o.field === b.current ? null : o.field))}>{o.label}</button>)}
          {cur ? <button type="button" role="menuitem" onClick={() => pick(() => onSplit(null))}>No split</button> : null}
          <span className="ask-list-h">Open up</span>
          <button type="button" role="menuitem" onClick={() => pick(onList)}>{picked ? `List the ${units} in ${picked} selected ${picked === 1 ? "bar" : "bars"}` : `List all ${b.rows} ${units}`}</button>
        </span>
      ) : null}
    </span>
  );
}

export function FilterChip({ f: raw, labels, onEdit }: { f: Filter; labels?: Record<string, string>; onEdit: (f: Filter, ed: FilterEdit, label: string) => void }) {
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

export function ParamChip({ k, p, onSet }: { k: string; p: Param; onSet: (k: string, v: number) => void }) {
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


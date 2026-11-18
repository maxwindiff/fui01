import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Segmented } from "../components/primitives";
import { ENTITIES, TABLES } from "../tables";
import { board, useBoard } from "./board";
import type { Layout, Lens, LensMode, Scope } from "./board";
import { SCOPE_MIME } from "./scope";

// The toolbar over the case board and the answers: a search that selects matching records, the selection, the lenses,
// and where answers go. Each set of records can be dragged into the question box or added to it with a click.

const X = () => <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1 7 7M7 1 1 7" /></svg>;

// Every record with an id, with its text fields joined, for the search.
let index: { id: string; text: string }[] | null = null;
function find(q: string): string[] {
  index ??= [
    ...ENTITIES.map((e) => ({ id: e.id, text: `${e.name} ${e.role ?? ""}`.toLowerCase() })),
    ...TABLES.filter((t) => t.name !== "entities" && "id" in t.columns).flatMap((t) => (t.rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      text: Object.entries(r).filter(([k, v]) => typeof v === "string" && k !== "id" && !k.endsWith("_id") && !/^\d{4}-\d\d/.test(v as string)).map(([, v]) => v).join(" ").toLowerCase(),
    }))),
  ];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return index.filter((r) => words.every((w) => r.text.includes(w))).map((r) => r.id);
}

function Find() {
  const [q, setQ] = useState("");
  const sel = useBoard((s) => s.sel);
  const run = (v: string) => {
    setQ(v);
    const t = v.trim();
    if (t.length < 2) { if (sel.from === "find") board.clearSelection(); return; }
    const ids = find(t);
    board.select({ ids, label: `“${t}”`, from: "find" });
  };
  return (
    <label className="scopes-find search">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
      <input
        type="search" value={q} placeholder="Find records" aria-label="Find records" spellCheck={false}
        onChange={(e) => run(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && sel.from === "find" && sel.ids.length) { board.keepSelection(); setQ(""); }
          if (e.key === "Escape") { run(""); (e.target as HTMLInputElement).blur(); }
        }}
      />
    </label>
  );
}

const drag = (s: Scope) => (e: DragEvent) => { e.dataTransfer.setData(SCOPE_MIME, JSON.stringify(s)); e.dataTransfer.setData("text/plain", s.kind === "set" ? s.label : ""); e.dataTransfer.effectAllowed = "copy"; };
const count = (n: number) => `${n} ${n === 1 ? "record" : "records"}`;

const MODES: { value: LensMode; label: string; tip: string }[] = [
  { value: "dim", label: "Dim", tip: "Fade everything else" },
  { value: "hide", label: "Hide", tip: "Hide everything else" },
];
function SelChip() {
  const sel = useBoard((s) => s.sel);
  const findMode = useBoard((s) => s.findMode);
  const scope: Scope = { kind: "set", label: sel.label, set: { ids: sel.ids } };
  return (
    <span className="scope-chip sel" draggable onDragStart={drag(scope)}>
      <i className="ans-sw sel" />
      <button type="button" className="scope-name" data-tip="Add to the question" onClick={() => board.insert([scope])}>{sel.label}</button>
      <span className="scope-n num">{count(sel.ids.length)}</span>
      {sel.from === "find" ? (
        <div className="seg" role="group" aria-label={`How ${sel.label} shows`}>
          {MODES.map((o) => (
            <button key={o.value} type="button" aria-pressed={findMode === o.value} className={findMode === o.value ? "on" : ""} data-tip={o.tip} onClick={() => board.setFindMode(findMode === o.value ? null : o.value)}>{o.label}</button>
          ))}
        </div>
      ) : null}
      <button type="button" className="btn quiet" data-tip="Keep as a lens" onClick={() => board.keepSelection()}>Keep</button>
      <button type="button" className="ask-x" aria-label="Clear the selection" data-tip="Clear (Esc)" onClick={() => board.clearSelection()}><X /></button>
    </span>
  );
}

function LensChip({ l, i }: { l: Lens; i: number }) {
  const [naming, setNaming] = useState(false);
  // A double click renames the lens, so a single click waits to see whether a second one follows.
  const timer = useRef(0);
  const scope: Scope = { kind: "set", label: l.name, set: l.set, lens: l.id };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span className={`scope-chip${l.on ? "" : " off"}`} draggable={!naming} onDragStart={drag(scope)}>
      <button type="button" className={`ans-sw ln${i}`} aria-pressed={l.on} aria-label={l.on ? `Turn off ${l.name}` : `Turn on ${l.name}`} data-tip={l.on ? "Turn off" : "Turn on"} onClick={() => board.updateLens(l.id, { on: !l.on })} />
      {naming ? (
        <input
          className="scope-rename" defaultValue={l.name} aria-label="Lens name" autoFocus size={Math.max(8, l.name.length)} onFocus={(e) => e.target.select()}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) board.updateLens(l.id, { name: v }); setNaming(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setNaming(false); }}
        />
      ) : (
        <button
          type="button" className="scope-name" data-tip="Add to the question"
          onClick={(e) => { clearTimeout(timer.current); if (e.detail > 1) { setNaming(true); return; } timer.current = window.setTimeout(() => board.insert([scope]), 220); }}
        >{l.name}</button>
      )}
      <span className="scope-n num">{count(l.set.ids.length)}</span>
      <Segmented label={`How ${l.name} shows`} value={l.mode} onChange={(m) => board.updateLens(l.id, { mode: m, on: true })} options={MODES} />
      <button type="button" className="ask-x" aria-label={`Remove ${l.name}`} data-tip="Remove the lens" onClick={() => board.removeLens(l.id)}><X /></button>
    </span>
  );
}

const LAYOUTS: { value: Layout; label: string; tip: string }[] = [
  { value: "content", label: "Content", tip: "The panels in two columns, without answers" },
  { value: "floating", label: "Floating", tip: "Answers in order, in a column of their own" },
  { value: "beside", label: "Beside", tip: "Answers level with what they were asked about" },
  { value: "below", label: "Below", tip: "Answers under the panel they were asked about" },
];

const askQuestion = () => board.insert([]);

export function Scopes() {
  const sel = useBoard((s) => s.sel);
  const lenses = useBoard((s) => s.lenses);
  const layout = useBoard((s) => s.layout);
  const cards = useBoard((s) => s.cards);
  const allFolded = useMemo(() => cards.length > 0 && cards.every((c) => c.open === false), [cards]);
  // The question box handles / itself, and Content has none.
  useEffect(() => {
    if (layout !== "content") return;
    const key = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) { e.preventDefault(); askQuestion(); } };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [layout]);
  return (
    <div className="scopes" role="toolbar" aria-label="Records and answers">
      <Find />
      {sel.ids.length ? <SelChip /> : null}
      {lenses.map((l, i) => <LensChip key={l.id} l={l} i={i} />)}
      <span className="scopes-end">
        {layout === "content" ? (
          <button type="button" className="btn quiet scopes-fold" onClick={askQuestion}>Ask question</button>
        ) : cards.length ? (
          <button type="button" className="btn quiet scopes-fold" aria-pressed={allFolded} onClick={() => board.openAll(allFolded)}>{allFolded ? "Unfold answers" : "Fold answers"}</button>
        ) : null}
        <Segmented label="Answers" value={layout} onChange={(v) => board.setLayout(v)} options={LAYOUTS} />
      </span>
    </div>
  );
}

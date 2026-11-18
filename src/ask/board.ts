import { useMemo, useSyncExternalStore } from "react";
import type { Answer } from "./spec";

// The answers beside the case board, the scopes the reader works with, and what the reader is pointing at. Pinned
// answers, lenses and the placement of answers are saved in the browser. Answers that were not pinned, the selection
// and anything being hovered last only as long as the page.

// A set of records, kept as the query that defines it when there is one, and as the ids it matched when it was made.
export interface SetDef { sql?: string; ids: string[] }
export interface Ref { label: string; set: SetDef; changed?: boolean }
export type Run = string | { ref: string; text: string };
export interface TextBody { paras: Run[][]; refs: Record<string, Ref> }
// A version of an answer. Edits made by dragging the same control fold into one version, keyed by the control.
export interface Rev { label: string; answer: Answer; key?: string }
export interface Member { answer: Answer; height: number }

// Something a question can be about: a case panel by its figure number, an answer, or a set of records. A set taken
// from a lens keeps the lens id, so the question follows later changes to the lens.
export type Scope =
  | { kind: "panel"; id: string }
  | { kind: "card"; id: string }
  | { kind: "set"; label: string; set: SetDef; lens?: string };
// A question as written: text with scopes in it.
export type Part = string | Scope;

export interface Card {
  id: string;
  kind: "chart" | "text" | "stack";
  title: string;
  question: string;
  parts?: Part[];
  // The case panel (by its figure number) or the answer the question was asked from. A question asked from neither
  // is placed by the panel the reader was looking at when it was asked (near), or by y in answers saved before that.
  from: string | null;
  near?: string;
  y?: number;
  at?: number;
  pinned: boolean;
  // Set when the reader opens or folds the answer, and left out while the page decides.
  open?: boolean;
  // What the view shows and its main finding, written by the model from the view's rows when a question is asked
  // from it. Later questions get the summary in place of the view.
  summary?: string;
  height?: number;
  revs?: Rev[];
  rev?: number;
  members?: Member[];
  text?: TextBody;
}
// mark outlines the records in the set, dim fades everything else, and hide removes everything else.
export type LensMode = "dim" | "hide";
export interface Lens { id: string; name: string; set: SetDef; mode: LensMode; on: boolean }
export interface Selection { ids: string[]; label: string; from: string | null }
export interface Busy { question: string; status: string; at: string | null; near?: string; kind: "edit" | "view" | "text" | "lens" | "stack" }
// Records under the pointer: a reference in a written answer, or a mark in one of the views.
export interface Hover { ids: string[]; from: "ref" | "mark"; at: string }
// content leaves answers out and gives the panels two columns, floating lists answers in order in their own scrolling
// column, beside puts each answer level with what it was asked from, and below puts them under the panel they were
// asked from.
export type Layout = "content" | "floating" | "beside" | "below";

export interface BoardState {
  cards: Card[];
  lenses: Lens[];
  sel: Selection;
  // Whether the records found by the search dim or hide the rest, as a lens would.
  findMode: LensMode | null;
  focus: string | null;
  // The panels and answers named in the question being written.
  ctx: string[];
  hover: Hover | null;
  busy: Busy | null;
  note: string;
  layout: Layout;
}

const KEY = "fui01-answers-1";
const LAYOUT_KEY = "fui01-layout";
function restore(): Pick<BoardState, "cards" | "lenses" | "layout"> {
  let layout: Layout = "beside";
  try {
    const l = localStorage.getItem(LAYOUT_KEY);
    // Floating was called column.
    if (l === "column") layout = "floating";
    else if (l === "content" || l === "floating" || l === "below") layout = l;
  } catch { /* the default */ }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    // Older lenses could only mark their records, or called dimming "only".
    if (s && Array.isArray(s.cards)) return { cards: s.cards, lenses: (s.lenses ?? []).map((l: Omit<Lens, "mode"> & { mode: string }) => ({ ...l, mode: l.mode === "hide" ? "hide" : "dim" })), layout };
  } catch { /* nothing was saved */ }
  return { cards: [], lenses: [], layout };
}

const NONE: Selection = { ids: [], label: "", from: null };
let state: BoardState = { ...restore(), sel: NONE, findMode: null, focus: null, ctx: [], hover: null, busy: null, note: "" };
const subs = new Set<() => void>();
let saved = "";
function set(patch: Partial<BoardState>) {
  state = { ...state, ...patch };
  if (patch.cards || patch.lenses) {
    const doc = JSON.stringify({ cards: state.cards.filter((c) => c.pinned), lenses: state.lenses });
    if (doc !== saved) { saved = doc; try { localStorage.setItem(KEY, doc); } catch { /* kept for this page only */ } }
  }
  subs.forEach((f) => f());
}
export const getBoard = () => state;
export function useBoard<T>(pick: (s: BoardState) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => pick(state));
}

// The lenses that are drawn, with the records found by the search when they dim or hide the rest.
export const FIND = "find";
export function useLenses(): Lens[] {
  const lenses = useBoard((s) => s.lenses);
  const sel = useBoard((s) => s.sel);
  const mode = useBoard((s) => s.findMode);
  return useMemo(() => (sel.from === FIND && mode && sel.ids.length ? [...lenses, { id: FIND, name: sel.label, set: { ids: sel.ids }, mode, on: true }] : lenses), [lenses, sel, mode]);
}

export const answerOf = (c: Card | undefined | null) => (c?.revs ? c.revs[c.rev ?? c.revs.length - 1].answer : null);
let n = 0;
const newId = () => `a${Date.now().toString(36)}${n++}`;

// The question box registers itself here. Scopes sent before it has loaded wait for it.
type Insert = (parts: Part[], select?: string) => void;
let inserter: Insert | null = null;
let queued: Parameters<Insert>[] = [];
export function registerInserter(f: Insert | null) {
  inserter = f;
  if (f) { for (const q of queued) f(...q); queued = []; }
}

export const board = {
  focus(id: string | null) { if (state.focus !== id) set({ focus: id }); },
  select(sel: Selection) { set({ sel }); },
  clearSelection() { if (state.sel.ids.length) set({ sel: NONE }); },
  setFindMode(findMode: LensMode | null) { set({ findMode }); },
  hover(h: Hover | null) { if (h || state.hover) set({ hover: h }); },
  busy(b: Busy | null) { set({ busy: b }); },
  note(note: string) { set({ note }); },
  context(ctx: string[]) { if (ctx.join() !== state.ctx.join()) set({ ctx }); },
  setLayout(layout: Layout) {
    try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* kept for this page only */ }
    set({ layout });
  },
  // Puts scopes and text into the question box at the caret. Text named by select is left selected, so typing
  // replaces it.
  insert(parts: Part[], select?: string) {
    // Content has no question box, so asking goes to Floating.
    if (state.layout === "content") board.setLayout("floating");
    if (inserter) inserter(parts, select);
    else queued.push([parts, select]);
  },
  // Each panel or answer has room for one answer that was not pinned, so the next question from the same place
  // replaces it, and pinning it frees the room again.
  place(c: Omit<Card, "id" | "pinned" | "at">) {
    const card: Card = { ...c, id: newId(), pinned: false, at: Date.now() };
    const i = state.cards.findIndex((x) => !x.pinned && x.from === c.from && (c.from !== null || x.near === c.near));
    const cards = i >= 0 ? state.cards.map((x, k) => (k === i ? card : x)) : [...state.cards, card];
    set({ cards, focus: card.id });
    return card.id;
  },
  edit(id: string, rev: Rev) {
    set({ cards: state.cards.map((c) => {
      if (c.id !== id || !c.revs) return c;
      const at = c.rev ?? c.revs.length - 1;
      const fold = rev.key !== undefined && c.revs[at].key === rev.key && at === c.revs.length - 1;
      const revs = fold ? [...c.revs.slice(0, at), rev] : [...c.revs.slice(0, at + 1), rev];
      return { ...c, revs, rev: revs.length - 1, title: rev.answer.title };
    }) });
  },
  step(id: string, d: number) {
    set({ cards: state.cards.map((c) => {
      if (c.id !== id || !c.revs) return c;
      const rev = Math.max(0, Math.min(c.revs.length - 1, (c.rev ?? 0) + d));
      return { ...c, rev, title: c.revs[rev].answer.title };
    }) });
  },
  annotate(id: string, summary: string) { set({ cards: state.cards.map((c) => (c.id === id ? { ...c, summary } : c)) }); },
  pin(id: string) { set({ cards: state.cards.map((c) => (c.id === id ? { ...c, pinned: true } : c)) }); },
  open(id: string, open: boolean | undefined) { set({ cards: state.cards.map((c) => (c.id === id ? { ...c, open } : c)) }); },
  openAll(open: boolean | undefined) { set({ cards: state.cards.map((c) => ({ ...c, open })) }); },
  // An answer asked from a removed answer moves up to that answer's own place.
  remove(id: string) {
    const gone = state.cards.find((c) => c.id === id);
    const cards = state.cards.filter((c) => c.id !== id).map((c) => (c.from === id ? { ...c, from: gone?.from ?? null, near: gone?.near, y: gone?.y } : c));
    set({ cards, focus: state.focus === id ? null : state.focus, sel: state.sel.from === id ? NONE : state.sel });
  },
  addLens(name: string, s: SetDef, mode: LensMode = "dim") {
    const lens: Lens = { id: newId(), name, set: s, mode, on: true };
    set({ lenses: [...state.lenses.slice(-3), lens] });
    return lens.id;
  },
  // The selection becomes a lens, and stops being the selection.
  keepSelection() {
    if (!state.sel.ids.length) return;
    const lens: Lens = { id: newId(), name: state.sel.label, set: { ids: state.sel.ids }, mode: (state.sel.from === "find" && state.findMode) || "dim", on: true };
    set({ lenses: [...state.lenses.slice(-3), lens], sel: NONE });
  },
  updateLens(id: string, patch: Partial<Lens>) { set({ lenses: state.lenses.map((l) => (l.id === id ? { ...l, ...patch } : l)) }); },
  removeLens(id: string) { set({ lenses: state.lenses.filter((l) => l.id !== id) }); },
  updateRefs(id: string, refs: Record<string, Ref>) {
    set({ cards: state.cards.map((c) => (c.id === id && c.text ? { ...c, text: { ...c.text, refs } } : c)) });
  },
  clear() { set({ cards: [], lenses: [], sel: NONE, focus: null, hover: null, note: "" }); },
};

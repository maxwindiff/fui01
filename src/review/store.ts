import { useSyncExternalStore } from "react";
import type { Place } from "./types";

// What the reviewer has done to each change: the hunks read, the comments written, and the agent's draft comments
// accepted or dismissed. These are saved in the browser. The summarization level, the diff layout and the view are
// saved too, and the answers to questions last only as long as the page.

export type ChangeId = "small" | "medium" | "large";
export type Level = 0 | 1 | 2;
export type Layout = "unified" | "split";
export type View = { kind: "files" } | { kind: "flow"; id: string };
export interface Comment { id: string; at: Place; text: string; synced: boolean; from?: string }
// A question asked about a line has `at`, and one about the whole change has none.
export interface Asked { id: string; q: string; a: string | null; at?: Place }

interface PerChange { read: string[]; comments: Comment[]; drafts: Record<string, "accepted" | "dismissed"> }
export interface ReviewState {
  change: ChangeId;
  level: Level;
  layout: Layout;
  view: View;
  per: Record<ChangeId, PerChange>;
  // Pseudocode opened by hand as `hunk#from`, and read hunks opened again by hand, by hunk key.
  open: string[];
  writing: Place | null;
  // The agent's draft comment shown under its line, after the reviewer picks it from the list.
  draft: string | null;
  asked: Record<ChangeId, Asked[]>;
  focus: Place | null;
}

const KEY = "fui01-review";
const empty = (): PerChange => ({ read: [], comments: [], drafts: {} });

function restore(): Pick<ReviewState, "change" | "level" | "layout" | "view" | "per"> {
  const base = { change: "small" as ChangeId, level: 1 as Level, layout: "unified" as Layout, view: { kind: "files" } as View, per: { small: empty(), medium: empty(), large: empty() } };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s?.per) return { ...base, ...s, per: { ...base.per, ...s.per } };
  } catch { /* nothing was saved */ }
  return base;
}

let state: ReviewState = { ...restore(), open: [], writing: null, draft: null, asked: { small: [], medium: [], large: [] }, focus: null };
const subs = new Set<() => void>();
function set(patch: Partial<ReviewState>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify({ change: state.change, level: state.level, layout: state.layout, view: state.view, per: state.per })); } catch { /* storage can be blocked */ }
  subs.forEach((f) => f());
}
const mine = () => state.per[state.change];
const patchMine = (p: Partial<PerChange>) => set({ per: { ...state.per, [state.change]: { ...mine(), ...p } } });

export function useReview<T>(pick: (s: ReviewState) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => pick(state));
}
export const getReview = () => state;

let n = 0;
export const review = {
  setChange(change: ChangeId) { if (change !== state.change) set({ change, view: { kind: "files" }, open: [], writing: null, draft: null, focus: null }); },
  setLevel(level: Level) { set({ level, open: [] }); },
  setLayout(layout: Layout) { set({ layout }); },
  show(view: View) { set({ view }); },
  focus(at: Place | null) { set({ focus: at }); },
  reopen(key: string) { if (!state.open.includes(key)) set({ open: [...state.open, key] }); },
  showDraft(id: string | null) { set({ draft: id }); },
  toggleOpen(id: string) { set({ open: state.open.includes(id) ? state.open.filter((x) => x !== id) : [...state.open, id] }); },
  markRead(keys: string[], on = true) {
    const read = new Set(mine().read);
    for (const k of keys) if (on) read.add(k); else read.delete(k);
    patchMine({ read: [...read] });
    if (on) set({ open: state.open.filter((x) => !keys.includes(x)) });
  },
  write(at: Place | null) { set({ writing: at }); },
  comment(at: Place, text: string, from?: string) {
    const c: Comment = { id: `c${Date.now().toString(36)}${n++}`, at, text, synced: false, from };
    patchMine({ comments: [...mine().comments, c] });
    set({ writing: null });
  },
  removeComment(id: string) { patchMine({ comments: mine().comments.filter((c) => c.id !== id) }); },
  // Posts the comments that are not on GitHub yet. The prototype has no GitHub, so it only marks them as posted.
  sync() { patchMine({ comments: mine().comments.map((c) => (c.synced ? c : { ...c, synced: true })) }); },
  undecide(finding: string) { const { [finding]: _, ...rest } = mine().drafts; patchMine({ drafts: rest }); },
  decide(finding: string, verdict: "accepted" | "dismissed") {
    patchMine({ drafts: { ...mine().drafts, [finding]: verdict } });
    if (state.draft === finding) set({ draft: null });
  },
  ask(q: string, a: string | null, at?: Place) {
    const x: Asked = { id: `q${n++}`, q, a, at };
    set({ asked: { ...state.asked, [state.change]: [x, ...state.asked[state.change]] }, writing: null });
  },
  unask(id: string) { set({ asked: { ...state.asked, [state.change]: state.asked[state.change].filter((x) => x.id !== id) } }); },
};

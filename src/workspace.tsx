import { useEffect, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { gpuState, wakeScenes } from "./gpu/scene";
import { applyMotionLevel, motion } from "./motion";
import { tip } from "./tip";

interface Command { name: string; arg?: string; n: number }

export interface State {
  stage: string | null;
  trail: string[];
  doc: string;
  brief: string[];
  command: Command;
  level: number;
  replays: number;
}

let state: State = { stage: null, trail: [], doc: "E-0212", brief: [], command: { name: "", n: 0 }, level: motion.level, replays: 0 };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getState = () => state;

// A component re-renders only when what its selector returns changes.
export function useWs<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

let morphs = 0;
// Applies a change of layout inside a view transition, so every named frame travels from its old box to its new one.
// The GPU views hold still while it runs and draw once at their new size.
export function morph(change: () => void, after?: () => void) {
  tip.hide();
  if (motion.level === 0 || !document.startViewTransition) {
    flushSync(change);
    after?.();
    return;
  }
  morphs++;
  gpuState.paused = true;
  const resume = () => {
    if (--morphs > 0) return;
    gpuState.paused = false;
    wakeScenes();
  };
  const t = document.startViewTransition(() => {
    flushSync(change);
    after?.();
  });
  t.finished.then(resume, resume);
}

const panelEl = (fig: string) => document.querySelector<HTMLElement>(`[data-panel="${fig}"]`);
let boardY = 0;

export const ws = {
  setStage(fig: string | null) {
    const was = state.stage;
    if (fig === was) return;
    if (fig && !was) boardY = scrollY;
    morph(() => set({ stage: fig }), () => scrollTo(0, fig ? 0 : boardY));
  },
  reveal(fig: string) {
    if (state.stage) ws.setStage(fig);
    else panelEl(fig)?.scrollIntoView({ behavior: motion.level === 0 ? "auto" : "smooth", block: "center" });
  },
  inspect(id: string) {
    const t = state.trail;
    if (t[t.length - 1] === id) return;
    if (t.length) set({ trail: [...t, id].slice(-6) });
    else morph(() => set({ trail: [id] }));
  },
  jump(index: number) { set({ trail: state.trail.slice(0, index + 1) }); },
  closeInspector() {
    if (state.trail.length) morph(() => set({ trail: [] }));
  },
  home() {
    if (!state.stage && !state.trail.length) { scrollTo({ top: 0, behavior: motion.level === 0 ? "auto" : "smooth" }); return; }
    morph(() => set({ stage: null, trail: [] }), () => scrollTo(0, 0));
  },
  reset() {
    tip.hide();
    set({ stage: null, trail: [] });
  },
  openDoc(id: string) {
    set({ doc: id });
    ws.reveal("12");
  },
  toggleBrief(item: string) {
    set({ brief: state.brief.includes(item) ? state.brief.filter((x) => x !== item) : [...state.brief, item] });
  },
  run(name: string, arg?: string) { set({ command: { name, arg, n: state.command.n + 1 } }); },
  // A change of level replays the entry of the panels in view, so the reader can compare levels on the spot.
  setLevel(next: number) {
    applyMotionLevel(next);
    set({ level: next, replays: state.replays + 1 });
  },
};

// Everything in the store plus its actions. Components that render often should call useWs with a selector instead.
export function useWorkspace() {
  return { ...useWs((s) => s), ...ws };
}

// Runs fn each time the named command is issued after the component mounts.
export function useCommand(name: string, fn: (arg?: string) => void) {
  const command = useWs((s) => s.command);
  const latest = useRef(fn);
  latest.current = fn;
  const seen = useRef(command.n);
  useEffect(() => {
    if (command.n === seen.current) return;
    seen.current = command.n;
    if (command.name === name) latest.current(command.arg);
  }, [command, name]);
}

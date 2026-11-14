import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { reducedMotion } from "./gpu/scene";
import { tip } from "./tip";

// Applies a change of layout inside a view transition, so every named frame travels from its old box to its new one.
export function morph(change: () => void, after?: () => void) {
  tip.hide();
  if (reducedMotion || !document.startViewTransition) {
    flushSync(change);
    after?.();
    return;
  }
  document.startViewTransition(() => {
    flushSync(change);
    after?.();
  });
}

interface Command { name: string; arg?: string; n: number }

interface Workspace {
  stage: string | null;
  setStage: (fig: string | null) => void;
  reveal: (fig: string) => void;
  trail: string[];
  inspect: (id: string) => void;
  jump: (index: number) => void;
  closeInspector: () => void;
  doc: string;
  openDoc: (id: string) => void;
  brief: string[];
  toggleBrief: (item: string) => void;
  command: Command;
  run: (name: string, arg?: string) => void;
}

const Ctx = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(Ctx)!;

export function useCommand(name: string, fn: (arg?: string) => void) {
  const { command } = useWorkspace();
  const latest = useRef(fn);
  latest.current = fn;
  const seen = useRef(command.n);
  useEffect(() => {
    if (command.n === seen.current) return;
    seen.current = command.n;
    if (command.name === name) latest.current(command.arg);
  }, [command, name]);
}

const panelEl = (fig: string) => document.querySelector<HTMLElement>(`[data-panel="${fig}"]`);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [doc, setDoc] = useState("E-0212");
  const [brief, setBrief] = useState<string[]>([]);
  const [command, setCommand] = useState<Command>({ name: "", n: 0 });
  const live = useRef({ stage, trail });
  live.current = { stage, trail };
  const boardY = useRef(0);

  const setStage = useCallback((fig: string | null) => {
    const was = live.current.stage;
    if (fig === was) return;
    if (fig && !was) boardY.current = scrollY;
    morph(() => setStageState(fig), () => scrollTo(0, fig ? 0 : boardY.current));
  }, []);

  const reveal = useCallback((fig: string) => {
    if (live.current.stage) setStage(fig);
    else panelEl(fig)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  }, [setStage]);

  const inspect = useCallback((id: string) => {
    const t = live.current.trail;
    if (t[t.length - 1] === id) return;
    if (t.length) setTrail([...t, id].slice(-6));
    else morph(() => setTrail([id]));
  }, []);
  const jump = useCallback((index: number) => setTrail((t) => t.slice(0, index + 1)), []);
  const closeInspector = useCallback(() => {
    if (live.current.trail.length) morph(() => setTrail([]));
  }, []);

  const openDoc = useCallback((id: string) => {
    setDoc(id);
    reveal("12");
  }, [reveal]);

  const toggleBrief = useCallback((item: string) => setBrief((b) => (b.includes(item) ? b.filter((x) => x !== item) : [...b, item])), []);
  const run = useCallback((name: string, arg?: string) => setCommand((c) => ({ name, arg, n: c.n + 1 })), []);

  const value = useMemo(
    () => ({ stage, setStage, reveal, trail, inspect, jump, closeInspector, doc, openDoc, brief, toggleBrief, command, run }),
    [stage, setStage, reveal, trail, inspect, jump, closeInspector, doc, openDoc, brief, toggleBrief, command, run],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { THEMES, themeById } from "./themes";
import type { Theme } from "./themes";
import { Panel } from "./components/primitives";
import { NetworkView } from "./components/NetworkView";
import { MapView } from "./components/MapView";
import { Affiliation, PersonCard } from "./components/Person";
import { Timeline } from "./components/Timeline";
import { MoneyFlow, Multiples, SlopeChart, SpendChart } from "./components/Charts";
import { DocList, EmailViewer, FilingsTable, Finding } from "./components/Records";
import { Controls } from "./components/Controls";
import { MotionSheet } from "./components/Motion";
import { reducedMotion } from "./gpu/scene";

function Masthead({ theme }: { theme: Theme }) {
  return (
    <section className="mast">
      <div>
        <h1 className="mast-name">{theme.name}</h1>
        <p className="mast-concept">{theme.concept}</p>
        <p className="note">{theme.mode === "light" ? "Light" : "Dark"} theme. Drawn from: {theme.lineage}. All names and figures on this sheet are invented.</p>
      </div>
      <ul className="swatches">
        {theme.palette.map((p) => (
          <li key={p.name}><i style={{ background: `var(${p.var})` }} /><b>{p.name}</b><span>{p.role}</span></li>
        ))}
      </ul>
      <ul className="types">
        {theme.type.map((t) => (
          <li key={t.family}><span className="note">{t.family}, {t.role.toLowerCase()}</span><p style={{ fontFamily: `var(${t.var})` }}>{t.sample}</p></li>
        ))}
      </ul>
    </section>
  );
}

// Tilts each panel by its distance from the centre of the viewport, as if the board wrapped around the reader.
function useDepthStage(ref: RefObject<HTMLElement | null>, active: boolean, key: unknown) {
  useEffect(() => {
    const board = ref.current;
    if (!active || reducedMotion || !board) return;
    let raf = 0, mx = 0, my = 0;
    const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
    const update = () => {
      raf = 0;
      const vw = innerWidth, vh = innerHeight;
      const b = board.getBoundingClientRect();
      board.style.perspectiveOrigin = `${vw / 2 - b.left + mx * 50}px ${vh / 2 - b.top + my * 36}px`;
      for (const p of board.querySelectorAll<HTMLElement>(".panel, .mast")) {
        const nx = clamp((b.left + p.offsetLeft + p.offsetWidth / 2 - vw / 2) / (vw / 2), 1);
        const ny = clamp((b.top + p.offsetTop + p.offsetHeight / 2 - vh / 2) / (vh / 2), 1);
        p.style.setProperty("--ry", `${(-nx * 6 * Math.min(1, 700 / p.offsetWidth)).toFixed(2)}deg`);
        p.style.setProperty("--rx", `${(ny * 3.6 * Math.min(1, 460 / p.offsetHeight)).toFixed(2)}deg`);
      }
    };
    const queue = () => { raf ||= requestAnimationFrame(update); };
    const point = (e: PointerEvent) => {
      mx = (e.clientX / innerWidth) * 2 - 1;
      my = (e.clientY / innerHeight) * 2 - 1;
      queue();
    };
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    addEventListener("pointermove", point, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
      removeEventListener("pointermove", point);
    };
  }, [ref, active, key]);
}

export function App() {
  const [id, setId] = useState(() => themeById(location.hash.slice(1)).id);
  const theme = themeById(id);
  const [run, setRun] = useState(0);
  const board = useRef<HTMLElement>(null);
  useDepthStage(board, !!theme.gpu.deep, `${theme.id}${run}`);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    root.dataset.family = theme.family;
    root.dataset.space = theme.gpu.deep ? "deep" : "flat";
    for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
    root.style.setProperty("--dur-enter", `${theme.motion.enter}ms`);
    root.style.setProperty("--stagger", `${theme.motion.stagger}ms`);
    root.style.setProperty("--dur-hover", `${theme.motion.hover}ms`);
    root.style.setProperty("--ease", theme.motion.ease);
    root.style.setProperty("--dur-reveal", `${theme.motion.reveal}ms`);
    history.replaceState(null, "", `#${theme.id}`);
  }, [theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const t = THEMES[+e.key - 1];
      if (t) setId(t.id);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path className="hatch-line" d="M0 0V5" />
          </pattern>
        </defs>
      </svg>
      <nav className="switcher" aria-label="Theme">
        {THEMES.map((t, i) => (
          <button key={t.id} type="button" className={t.id === id ? "on" : ""} aria-pressed={t.id === id} onClick={() => setId(t.id)}>
            <kbd>{i + 1}</kbd>
            <i className="sw" style={{ background: t.vars["--bg"] }}><b style={{ background: t.vars["--ink"] }} /><b style={{ background: t.vars["--money"] }} /></i>
            {t.name}<span>{t.mode}, {t.gpu.deep ? "in depth" : "flat"}</span>
          </button>
        ))}
        <p>Keys 1 to 4 switch themes</p>
      </nav>
      <main className="board" key={`${theme.id}${run}`} ref={board}>
        <Masthead theme={theme} />
        <Panel fig="01" title="Relationship network" span={8} flush><NetworkView theme={theme} /></Panel>
        <Panel fig="02" title="Person" span={4}><PersonCard /></Panel>
        <Panel fig="03" title="Political affiliation" span={5}><Affiliation /></Panel>
        <Panel fig="04" title="Giving by state" meta="2024 cycle" span={7} flush><MapView theme={theme} /></Panel>
        <Panel fig="05" title="Timeline and career history" meta="Jan 2024 to Jun 2026"><Timeline /></Panel>
        <Panel fig="06" title="Money flow" meta="2024 cycle, $8.27M" span={7}><MoneyFlow /></Panel>
        <Panel fig="07" title="Lobbying spend by quarter" span={5}><SpendChart /></Panel>
        <Panel fig="08" title="Share of giving by recipient" span={4}><SlopeChart /></Panel>
        <Panel fig="09" title="Contacts by office, per month" span={8}><Multiples /></Panel>
        <Panel fig="10" title="Lobbying filings" span={7}><FilingsTable /></Panel>
        <Panel fig="11" title="Finding" span={5}><Finding /></Panel>
        <Panel fig="12" title="Document" span={8}><EmailViewer /></Panel>
        <Panel fig="13" title="Documents" meta="7 of 1,804" span={4}><DocList /></Panel>
        <Panel fig="14" title="Controls"><Controls /></Panel>
        <Panel fig="15" title="Motion"><MotionSheet theme={theme} onReplay={() => { scrollTo({ top: 0 }); setRun((n) => n + 1); }} /></Panel>
      </main>
    </>
  );
}

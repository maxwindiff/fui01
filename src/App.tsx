import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { THEMES, themeById } from "./themes";
import type { Theme } from "./themes";
import { Panel, Segmented } from "./components/primitives";
import { Crumbs } from "./components/Crumbs";
import { MOTION_LEVELS } from "./motion";
import { PANEL_TITLES } from "./panels";
import { NetworkView } from "./components/NetworkView";
import { MapView } from "./components/MapView";
import { Affiliation, PersonCard } from "./components/Person";
import { Timeline } from "./components/Timeline";
import { MoneyFlow, Multiples, SlopeChart, SpendChart } from "./components/Charts";
import { DocList, DocViewer, FilingsTable, Finding } from "./components/Records";
import { Controls } from "./components/Controls";
import { MotionSheet } from "./components/Motion";
import { Inspector } from "./components/Inspector";
import { TipLayer } from "./tip";
import { getState, useWs, ws } from "./workspace";
import { DOCS, FILINGS, fmtMoney, GRAPH, STATE_GIVING, WINDOW_CONTACTS } from "./data";

function Masthead({ theme }: { theme: Theme }) {
  return (
    <section className="mast">
      <h1 className="mast-name">{theme.name}</h1>
      <ul className="swatches">
        {theme.palette.map((p) => (
          <li key={p.name}><i style={{ background: `var(${p.var})` }} /><b>{p.name}</b><span>{p.role}</span></li>
        ))}
      </ul>
      <ul className="types">
        {theme.type.map((t) => (
          <li key={t.family}><span className="note">{t.family}</span><p style={{ fontFamily: `var(${t.var})` }}>{t.sample}</p></li>
        ))}
      </ul>
    </section>
  );
}

function BriefMenu() {
  const brief = useWs((s) => s.brief);
  return (
    <div id="brief-list" popover="auto" className="menu">
      {brief.length ? (
        <ul>
          {brief.map((item) => (
            <li key={item}><span>{item}</span><button type="button" className="btn quiet" onClick={() => ws.toggleBrief(item)}>Remove</button></li>
          ))}
        </ul>
      ) : <p className="note">Nothing in the brief yet.</p>}
    </div>
  );
}

function BriefButton() {
  const count = useWs((s) => s.brief.length);
  return (
    <button type="button" className={`brief${count ? " has" : ""}`} popoverTarget="brief-list" data-tip="Items collected for the written brief">
      Brief <b key={count} className="num">{count}</b>
    </button>
  );
}

function MotionControl() {
  const level = useWs((s) => s.level);
  return (
    <div className="motion-ctl">
      <span className="label">Motion</span>
      <Segmented
        label="Motion" value={String(level)} onChange={(v) => ws.setLevel(+v)}
        options={MOTION_LEVELS.map((l) => ({ value: String(l.id), label: l.name, tip: l.what }))}
      />
    </div>
  );
}

function DocGlance() {
  const doc = useWs((s) => s.doc);
  return <>{DOCS.find((d) => d.id === doc)!.title}</>;
}

function Frame({ children }: { children: ReactNode }) {
  const stage = useWs((s) => s.stage);
  const inspecting = useWs((s) => s.trail.length > 0);
  return (
    <div className="shell" data-inspect={inspecting ? "" : undefined}>
      <main className="board" data-stage={stage ?? undefined}>{children}</main>
      <footer className="foot">All names and figures are invented.</footer>
    </div>
  );
}

const act = (command: string) => {
  if (command === "stage") ws.setStage("01");
  else if (command === "dossier") ws.inspect("voss");
  else if (command === "brush") { ws.reveal("05"); ws.run("brush"); }
  else { ws.reveal("10"); ws.run(command); }
};
const replay = () => { ws.setStage(null); scrollTo({ top: 0 }); ws.replay(); };
const giving = Object.values(STATE_GIVING).reduce((a, v) => a + v, 0);
const T = PANEL_TITLES;

export function App() {
  const [id, setId] = useState(() => themeById(location.hash.slice(1)).id);
  const theme = themeById(id);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    root.dataset.family = theme.family;
    root.dataset.mode = theme.mode;
    for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
    const m = theme.motion;
    for (const [k, ms] of Object.entries({ enter: m.enter, stagger: m.stagger, hover: m.hover, reveal: m.reveal, layout: m.layout, expand: m.expand, sort: m.sort }))
      root.style.setProperty(k === "stagger" ? "--stagger" : `--dur-${k}`, `${ms}ms`);
    root.style.setProperty("--ease", m.ease);
    root.style.setProperty("--ease-layout", m.layoutEase ?? m.ease);
    history.replaceState(null, "", `#${theme.id}`);
  }, [theme]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector(":popover-open")) return;
        const { trail, stage } = getState();
        if (trail.length) ws.closeInspector();
        else if (stage) ws.setStage(null);
        return;
      }
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
      <TipLayer />
      <header className="switcher">
        <div className="themes" role="group" aria-label="Theme">
          {THEMES.map((t, i) => (
            <button key={t.id} type="button" className={`theme-btn${t.id === id ? " on" : ""}`} aria-pressed={t.id === id} data-tip={`${t.name}, key ${i + 1}`} onClick={() => setId(t.id)}>
              <i className="sw" style={{ background: t.vars["--bg"] }}><b style={{ background: t.vars["--ink"] }} /><b style={{ background: t.vars["--money"] }} /></i>
              {t.name}
            </button>
          ))}
        </div>
        <Crumbs />
        <MotionControl />
        <BriefButton />
      </header>
      <BriefMenu />
      <Frame key={theme.id}>
        <Masthead theme={theme} />
        <Panel fig="01" title={T["01"]} span={8} flush glance={`${GRAPH.entities.length} entities, ${GRAPH.ties.length} ties`}><NetworkView theme={theme} /></Panel>
        <Panel fig="02" title={T["02"]} span={4} glance="Dana Whitcombe, Republican, Arizona"><PersonCard /></Panel>
        <Panel fig="03" title={T["03"]} span={5} glance="Whitcombe at +0.38 by voting record"><Affiliation /></Panel>
        <Panel fig="04" title={T["04"]} meta="2024 cycle" span={7} flush glance={`${fmtMoney(giving)} from 48 states`}><MapView theme={theme} /></Panel>
        <Panel fig="05" title={T["05"]} meta="Jan 2024 to Jun 2026" glance={`${WINDOW_CONTACTS} contacts in the 90 days before the award`}><Timeline /></Panel>
        <Panel fig="06" title={T["06"]} meta="2024 cycle, $8.27M" span={7} glance="$8.27M through four vehicles"><MoneyFlow /></Panel>
        <Panel fig="07" title={T["07"]} span={5} glance="Halvorsen peaked at $2.94M in 2025 Q3"><SpendChart /></Panel>
        <Panel fig="08" title={T["08"]} span={4} glance="Whitcombe, 4% to 19%"><SlopeChart /></Panel>
        <Panel fig="09" title={T["09"]} span={8} glance="Six offices over 18 months"><Multiples /></Panel>
        <Panel fig="10" title={T["10"]} span={7} glance={`${FILINGS.length} filings, ${fmtMoney(FILINGS.reduce((a, f) => a + f.amt, 0))} reported`}><FilingsTable /></Panel>
        <Panel fig="11" title={T["11"]} span={5} glance="Finding 3 of 7, high confidence"><Finding /></Panel>
        <Panel fig="12" title={T["12"]} span={8} glance={<DocGlance />}><DocViewer /></Panel>
        <Panel fig="13" title={T["13"]} meta="7 of 1,804" span={4} glance="7 of 1,804 in this view"><DocList /></Panel>
        <Panel fig="14" title={T["14"]} glance="Search, filters, actions, readouts"><Controls /></Panel>
        <Panel fig="15" title={T["15"]} glance="Timings and the patterns to try"><MotionSheet theme={theme} onRun={act} onReplay={replay} /></Panel>
      </Frame>
      <Inspector />
    </>
  );
}

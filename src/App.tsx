import { useEffect, useState } from "react";
import { THEMES, themeById } from "./themes";
import type { Theme } from "./themes";
import { Panel } from "./components/primitives";
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
import { useWorkspace, WorkspaceProvider } from "./workspace";
import { DOCS, FILINGS, fmtMoney, GRAPH, STATE_GIVING, WINDOW_CONTACTS } from "./data";

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

function BriefMenu() {
  const ws = useWorkspace();
  return (
    <div id="brief-list" popover="auto" className="menu">
      {ws.brief.length ? (
        <ul>
          {ws.brief.map((item) => (
            <li key={item}><span>{item}</span><button type="button" className="btn quiet" onClick={() => ws.toggleBrief(item)}>Remove</button></li>
          ))}
        </ul>
      ) : <p className="note">The brief is empty. Add to brief on a finding, a filing or a dossier puts an item here.</p>}
    </div>
  );
}

function Sheet() {
  const [id, setId] = useState(() => themeById(location.hash.slice(1)).id);
  const theme = themeById(id);
  const ws = useWorkspace();
  const [run, setRun] = useState(0);
  const boardKey = `${theme.id}${run}`;
  const [entered, setEntered] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    root.dataset.family = theme.family;
    for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
    const m = theme.motion;
    for (const [k, ms] of Object.entries({ enter: m.enter, stagger: m.stagger, hover: m.hover, reveal: m.reveal, layout: m.layout, expand: m.expand, sort: m.sort }))
      root.style.setProperty(k === "stagger" ? "--stagger" : `--dur-${k}`, `${ms}ms`);
    root.style.setProperty("--ease", m.ease);
    history.replaceState(null, "", `#${theme.id}`);
  }, [theme]);

  // Entry animations belong to the first seconds of a board. After that, content shown again appears without them.
  useEffect(() => {
    const t = setTimeout(() => setEntered(boardKey), 4000);
    return () => clearTimeout(t);
  }, [boardKey]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector(":popover-open")) return;
        if (ws.stage) ws.setStage(null);
        else ws.closeInspector();
        return;
      }
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const t = THEMES[+e.key - 1];
      if (t) setId(t.id);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [ws.stage, ws.setStage, ws.closeInspector]);

  const act = (command: string) => {
    if (command === "stage") ws.setStage("01");
    else if (command === "dossier") ws.inspect("voss");
    else if (command === "brush") { ws.reveal("05"); ws.run("brush"); }
    else { ws.reveal("10"); ws.run(command); }
  };
  const giving = Object.values(STATE_GIVING).reduce((a, v) => a + v, 0);

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
      <nav className="switcher" aria-label="Theme">
        {THEMES.map((t, i) => (
          <button key={t.id} type="button" className={t.id === id ? "on" : ""} aria-pressed={t.id === id} onClick={() => setId(t.id)}>
            <kbd>{i + 1}</kbd>
            <i className="sw" style={{ background: t.vars["--bg"] }}><b style={{ background: t.vars["--ink"] }} /><b style={{ background: t.vars["--money"] }} /></i>
            {t.name}<span>{t.mode}</span>
          </button>
        ))}
        <p>Keys 1 and 2 switch themes. Esc steps back.</p>
        <button type="button" className={`brief${ws.brief.length ? " has" : ""}`} popoverTarget="brief-list" data-tip="Items collected for the written brief">
          Brief <b key={ws.brief.length} className="num">{ws.brief.length}</b>
        </button>
      </nav>
      <BriefMenu />
      <div className="shell" data-inspect={ws.trail.length ? "" : undefined}>
        <main className="board" key={boardKey} data-stage={ws.stage ?? undefined} data-entering={entered === boardKey ? undefined : ""}>
          <Masthead theme={theme} />
          <Panel fig="01" title="Relationship network" span={8} flush glance={`${GRAPH.entities.length} entities, ${GRAPH.ties.length} ties`}><NetworkView theme={theme} /></Panel>
          <Panel fig="02" title="Person" span={4} glance="Dana Whitcombe, Republican, Arizona"><PersonCard /></Panel>
          <Panel fig="03" title="Political affiliation" span={5} glance="Whitcombe at +0.38 by voting record"><Affiliation /></Panel>
          <Panel fig="04" title="Giving by state" meta="2024 cycle" span={7} flush glance={`${fmtMoney(giving)} from 48 states`}><MapView theme={theme} /></Panel>
          <Panel fig="05" title="Timeline and career history" meta="Jan 2024 to Jun 2026" glance={`${WINDOW_CONTACTS} contacts in the 90 days before the award`}><Timeline /></Panel>
          <Panel fig="06" title="Money flow" meta="2024 cycle, $8.27M" span={7} glance="$8.27M through four vehicles"><MoneyFlow /></Panel>
          <Panel fig="07" title="Lobbying spend by quarter" span={5} glance="Halvorsen peaked at $2.94M in 2025 Q3"><SpendChart /></Panel>
          <Panel fig="08" title="Share of giving by recipient" span={4} glance="Whitcombe, 4% to 19%"><SlopeChart /></Panel>
          <Panel fig="09" title="Contacts by office, per month" span={8} glance="Six offices over 18 months"><Multiples /></Panel>
          <Panel fig="10" title="Lobbying filings" span={7} glance={`${FILINGS.length} filings, ${fmtMoney(FILINGS.reduce((a, f) => a + f.amt, 0))} reported`}><FilingsTable /></Panel>
          <Panel fig="11" title="Finding" span={5} glance="Finding 3 of 7, high confidence"><Finding /></Panel>
          <Panel fig="12" title="Document" span={8} glance={DOCS.find((d) => d.id === ws.doc)!.title}><DocViewer /></Panel>
          <Panel fig="13" title="Documents" meta="7 of 1,804" span={4} glance="7 of 1,804 in this view"><DocList /></Panel>
          <Panel fig="14" title="Controls" glance="Search, filters, actions, readouts"><Controls /></Panel>
          <Panel fig="15" title="Motion and interaction" glance="Timings and the patterns to try">
            <MotionSheet theme={theme} onRun={act} onReplay={() => { ws.setStage(null); scrollTo({ top: 0 }); setRun((n) => n + 1); }} />
          </Panel>
        </main>
      </div>
      <Inspector />
    </>
  );
}

export function App() {
  return (
    <WorkspaceProvider>
      <Sheet />
    </WorkspaceProvider>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { notesFor, THEMES, themeById } from "./themes";
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
import { Inspector } from "./components/Inspector";
import { TipLayer } from "./tip";
import { getState, useWs, ws } from "./workspace";
import { useBoard } from "./ask/board";
import { Scopes } from "./ask/Scopes";
import { showData } from "./ask/sources";
import { DOCS, FILINGS, FLOW_TOTAL, fmtMoney, GLANCE, GRAPH, STATE_GIVING, WINDOW_CONTACTS } from "./data";

// The answers column brings DuckDB and the chart renderer with it, so it loads after the case board.
const Answers = lazy(() => import("./ask/Answers").then((m) => ({ default: m.Answers })));
const Review = lazy(() => import("./review/Review").then((m) => ({ default: m.Review })));

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
    <button type="button" className={`brief${count ? " has" : ""}`} popoverTarget="brief-list" data-tip="Items collected for the written brief" data-note="commit">
      Brief <b key={count} className="num">{count}</b>
    </button>
  );
}

function MotionControl() {
  const level = useWs((s) => s.level);
  return (
    <div className="motion-ctl">
      <span className="label">Motion</span>
      <button type="button" className="knob" data-note="selector" aria-label={`Motion is ${MOTION_LEVELS[level].name}. Turn to the next level`} style={{ ["--turn" as string]: level }} onClick={() => ws.setLevel((level + 1) % MOTION_LEVELS.length)}><i /></button>
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

// The case panels on the left, and answers to questions about them on the right.
function Frame({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  const stage = useWs((s) => s.stage);
  const layout = useBoard((s) => s.layout);
  return (
    <div className="shell">
      <div className="case" data-layout={layout}>
        <Scopes />
        <main className="board" data-stage={stage ?? undefined}>{children}</main>
        {layout === "content" ? null : aside}
      </div>
      <footer className="foot">All names and figures are invented. The portrait is a stand-in: <a href="https://commons.wikimedia.org/wiki/File:Nathan_Fielder_(cropped).jpg">Nathan Fielder</a>, photographed by Northwest, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>, cropped and toned.</footer>
    </div>
  );
}

const giving = Object.values(STATE_GIVING).reduce((a, v) => a + v, 0);
const T = PANEL_TITLES;

function CaseBoard({ theme }: { theme: Theme }) {
  return (
    <>
      <Panel fig="02" title={T["02"]} data={() => showData("02")} ask="Who gives Whitcombe the most?" glance="Dana Whitcombe, Republican, Arizona"><PersonCard /></Panel>
      <Panel fig="01" title={T["01"]} data={() => showData("01")} ask="Who is Whitcombe connected to?" flush glance={`${GRAPH.entities.length} entities, ${GRAPH.ties.length} ties`}><NetworkView theme={theme} /></Panel>
      <Panel fig="03" title={T["03"]} data={() => showData("03")} ask="Where does Whitcombe sit among senators by voting record?" glance={GLANCE.affiliation}><Affiliation /></Panel>
      <Panel fig="04" title={T["04"]} data={() => showData("04")} ask="Which states do the senators' donors live in?" meta="2024 cycle" flush glance={`${fmtMoney(giving)} from ${Object.keys(STATE_GIVING).length} states`}><MapView theme={theme} /></Panel>
      <Panel fig="05" title={T["05"]} data={() => showData("05")} ask="What happened around the award?" meta="Jan 2024 to Jun 2026" glance={`${WINDOW_CONTACTS} contacts in the 90 days before the award`}><Timeline /></Panel>
      <Panel fig="06" title={T["06"]} data={() => showData("06")} ask="Where does the money go?" meta={`2024 cycle, ${fmtMoney(FLOW_TOTAL)}`} glance={GLANCE.flow}><MoneyFlow /></Panel>
      <Panel fig="07" title={T["07"]} data={() => showData("07")} ask="How much did each client spend on lobbying per quarter?" glance={GLANCE.spend}><SpendChart /></Panel>
      <Panel fig="08" title={T["08"]} data={() => showData("08")} ask="How did aerospace giving shift between the senators?" glance={GLANCE.slope}><SlopeChart /></Panel>
      <Panel fig="09" title={T["09"]} data={() => showData("09")} ask="Which offices did lobbyists contact, and when?" glance={GLANCE.multiples}><Multiples /></Panel>
      <Panel fig="10" title={T["10"]} data={() => showData("10")} ask="Which firms filed lobbying disclosures for Halvorsen?" glance={`${FILINGS.length} filings, ${fmtMoney(FILINGS.reduce((a, f) => a + f.amt, 0))} reported`}><FilingsTable /></Panel>
      <Panel fig="11" title={T["11"]} data={() => showData("11")} ask="Did contacts rise before the award?" glance="Finding 3 of 7, high confidence"><Finding /></Panel>
      <Panel fig="12" title={T["12"]} data={() => showData("12")} ask="What does this document say?" glance={<DocGlance />}><DocViewer /></Panel>
      <Panel fig="13" title={T["13"]} data={() => showData("13")} ask="Which documents matter most?" meta={`${DOCS.length} of 1,804`} glance={`${DOCS.length} of 1,804 in this view`}><DocList /></Panel>
    </>
  );
}

type Page = "case" | "review";
const fromHash = () => themeById(location.hash.slice(1).split("/")[0]).id;
const pageFromHash = (): Page => (location.hash.slice(1).split("/")[1] === "case" ? "case" : "review");

export function App() {
  const [id, setId] = useState(fromHash);
  const [page, setPage] = useState(pageFromHash);
  const theme = themeById(id);
  const notes = useMemo(() => notesFor(theme), [theme]);

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
  }, [theme]);

  useEffect(() => {
    history.replaceState(null, "", `#${theme.id}/${page}`);
  }, [theme, page]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector(":popover-open")) return;
        const { trail, stage } = getState();
        if (trail.length) ws.closeInspector();
        else if (stage) ws.setStage(null);
        return;
      }
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
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
      <TipLayer notes={notes} />
      <header className="switcher">
        <Segmented label="Theme" value={id} onChange={setId} options={THEMES.map((t, i) => ({ value: t.id, label: t.name, tip: `Key ${i + 1}` }))} />
        <Segmented label="Page" value={page} onChange={setPage} options={[{ value: "review", label: "Review" }, { value: "case", label: "Case" }]} />
        {page === "case" ? <Crumbs root="Whitcombe case" /> : <span className="crumbs" />}
        {page === "case" ? <MotionControl /> : null}
        {page === "case" ? <BriefButton /> : null}
      </header>
      {page === "case" ? (
        <>
          <BriefMenu />
          <Frame key={theme.id} aside={<Suspense fallback={<aside className="answers" />}><Answers theme={theme} /></Suspense>}>
            <CaseBoard theme={theme} />
          </Frame>
          <Inspector />
        </>
      ) : <Suspense fallback={null}><Review /></Suspense>}
    </>
  );
}

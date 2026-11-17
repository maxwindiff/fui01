import { useState } from "react";
import type { ReactNode } from "react";
import { DOCS, entity, FILINGS, filingDetail, PRIOR_CONTACTS, REPORT_FILING, WINDOW_CALENDAR, WINDOW_CONTACTS, WINDOW_TEXT, fmtMoney } from "../data";
import type { Filing } from "../data";
import { useCommand, useWs, ws } from "../workspace";
import { Ent, Fold, useFlip } from "./primitives";
import { board } from "../ask/board";
import { useLinks } from "../links";

type SortKey = "q" | "reg" | "lob" | "amt";
const COLUMNS: { key?: SortKey; label: string; r?: boolean; first: 1 | -1 }[] = [
  { key: "q", label: "Quarter", first: -1 },
  { key: "reg", label: "Registrant", first: 1 },
  { label: "Issues", first: 1 },
  { key: "lob", label: "Lobbyists", first: -1 },
  { key: "amt", label: "Reported", r: true, first: -1 },
];

function FilingDetail({ f }: { f: Filing }) {
  const brief = useWs((s) => s.brief);
  const d = filingDetail(f);
  const max = Math.max(...d.series.map((g) => g.amt));
  const item = `Filing ${f.code}`;
  const inBrief = brief.includes(item);
  return (
    <div className="gt-detail">
      <section>
        <h4 className="sub-h">Lobbyists named</h4>
        <ul className="roster">
          {d.lobbyists.map((p) => (
            <li key={p.name} className={p.prior ? "ex" : ""}>
              <i />
              {p.id ? <Ent kind="person" sector="inter" id={p.id} bare>{p.name}</Ent> : <span>{p.name}</span>}
              {p.prior ? <span className="sub">{p.prior}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="sub-h">Client and issues</h4>
        <p><Ent kind="corp" sector="corp" id={f.client.split(" ")[0].toLowerCase()}>{f.client}</Ent></p>
        <ul className="issue-list">
          {d.issues.map((i) => <li key={i.code}><span className="codes">{i.code}</span>{i.name}</li>)}
        </ul>
        <h4 className="sub-h">Offices contacted</h4>
        <p className="sub">{d.offices.join(", ")}</p>
      </section>
      <section>
        <h4 className="sub-h">This registrant, quarter by quarter</h4>
        <svg className="mini-bars" viewBox={`0 0 ${d.series.length * 14} 44`} width={d.series.length * 14} height="44" role="img" aria-label={`${fmtMoney(f.amt)} in ${f.q}, against a high of ${fmtMoney(max)}`}>
          {d.series.map((g, i) => (
            <rect key={g.id} className={g.id === f.id ? "mult key" : "mult"} x={i * 14} y={44 - (g.amt / max) * 42} width="10" height={(g.amt / max) * 42} data-tip={`${g.q}: ${fmtMoney(g.amt)}`} data-tip-now="" />
          ))}
        </svg>
        <div className="actions">
          <button type="button" className={`btn${inBrief ? " done" : " primary"}`} aria-pressed={inBrief} data-note="commit" onClick={() => ws.toggleBrief(item)}>{inBrief ? "In brief" : "Add to brief"}</button>
          <button type="button" className="btn" onClick={() => ws.inspect(f.regId)}>Open registrant</button>
          {DOCS.find((d) => d.filing === f.id) ? <button type="button" className="btn" onClick={() => ws.openDoc(DOCS.find((d) => d.filing === f.id)!.id)}>Read the report</button> : null}
        </div>
      </section>
    </div>
  );
}

export function FilingsTable() {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [ref, capture] = useFlip<HTMLDivElement>(sort);
  const max = Math.max(...FILINGS.map((f) => f.amt));
  const rows = sort
    ? [...FILINGS].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key];
        return (typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y))) * sort.dir || a.q.localeCompare(b.q) * -1;
      })
    : FILINGS;
  const sortBy = (key: SortKey, first: 1 | -1) => {
    capture();
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: first }));
  };
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  useCommand("filing", (id) => setOpen((s) => new Set(s).add(id ?? REPORT_FILING.id)));
  const links = useLinks("10");

  return (
    <div className="gtable" role="table" aria-label="Lobbying filings" ref={ref} data-lk={links.root}>
      <div className="gt-head" role="row">
        <span role="columnheader" aria-hidden="true" />
        {COLUMNS.map((c) => (
          <span key={c.label} role="columnheader" className={c.r ? "r" : ""} aria-sort={c.key && sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
            {c.key ? (
              <button type="button" className={`sort${sort?.key === c.key ? (sort.dir === 1 ? " asc" : " desc") : ""}`} onClick={() => sortBy(c.key!, c.first)} data-tip={`Sort by ${c.label.toLowerCase()}`} data-note="sort">
                {c.label}<i aria-hidden="true" />
              </button>
            ) : c.label}
          </span>
        ))}
        <span role="columnheader" aria-hidden="true" />
        <span role="columnheader" className="r">Filing</span>
      </div>
      {rows.map((f) => {
        const isOpen = open.has(f.id);
        return (
          <div
            key={f.id} className={`${links.mark([f.id])} gt-item${f.focus ? " sel" : ""}`} style={{ ["--k" as string]: FILINGS.indexOf(f) * 2 }} data-flip={f.id} data-open={isOpen}
            onPointerEnter={() => board.hover({ ids: [f.id], from: "mark", at: "10" })} onPointerLeave={() => board.hover(null)}
          >
            <div
              className="gt-row" role="row" tabIndex={0} aria-expanded={isOpen}
              onClick={() => { toggle(f.id); if (!isOpen) board.select({ ids: [f.id], label: `${f.reg} for ${f.client}, ${f.q}`, from: "10" }); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(f.id); } }}
            >
              <span role="cell" data-note="row"><i className="chev" aria-hidden="true" /></span>
              <span role="cell" className="num">{f.q}</span>
              <span role="cell">{f.reg}</span>
              <span role="cell" className="codes" data-tip={filingDetail(f).issues.map((i) => i.name).join(", ")}>{f.issues}</span>
              <span role="cell">
                <span className="pips" aria-label={`${f.lob} lobbyists, ${f.ex} former officials`}>
                  {Array.from({ length: f.lob }, (_, i) => <i key={i} className={i < f.ex ? "ex" : ""} />)}
                </span>
              </span>
              <span role="cell" className="r num strong">{fmtMoney(f.amt)}</span>
              <span role="cell" className="bar-col"><span className="cell-bar"><i style={{ width: `${(f.amt / max) * 100}%` }} /></span></span>
              <span role="cell" className="r num dim">{f.code}</span>
            </div>
            <Fold open={isOpen}><FilingDetail f={f} /></Fold>
          </div>
        );
      })}
      <p className="gt-foot">Filled: held a federal post in the last five years.</p>
    </div>
  );
}

function Note({ n, hot, set, children }: { n: number; hot: number; set: (n: number) => void; children: ReactNode }) {
  return <li className={hot === n ? "hot" : ""} onPointerEnter={() => set(n)} onPointerLeave={() => set(0)}>{children}</li>;
}

function Email() {
  const [hot, setHot] = useState(0);
  const cite = (n: number, text: string) => (
    <span className={`cite${hot === n ? " hot" : ""}`} onPointerEnter={() => setHot(n)} onPointerLeave={() => setHot(0)}>
      <mark>{text}</mark><sup>{n}</sup>
    </span>
  );
  return (
    <>
      <header className="doc-h">
        <p className="doc-src">
          <span className="tag">FOIA 2026-0417</span>
          <span>Page 212 of 1,804</span>
          <span className="tag ok">Verified against release index</span>
        </p>
        <h3 className="doc-subject">Re: Thursday follow-up on evaluation criteria</h3>
        <dl className="doc-meta">
          <div><dt>From</dt><dd><Ent kind="person" sector="inter" id="voss">Petra Voss</Ent> <span className="dim">pvoss@kestrelrow.example</span></dd></div>
          <div><dt>To</dt><dd><Ent kind="official" sector="gov" id="calder">Imani Calder</Ent> <span className="dim">imani.calder@ool.example</span></dd></div>
          <div><dt>Cc</dt><dd><Ent kind="person" sector="inter" id="liang">Owen Liang</Ent></dd></div>
          <div><dt>Sent</dt><dd className="num">Tue 14 Oct 2025, 07:42 <span className="dim">23 days before the award</span></dd></div>
        </dl>
      </header>
      <div className="doc-cols">
        <div className="doc-body">
          <p>Imani,</p>
          <p>
            Thank you for making time on Thursday. As discussed, <Ent kind="corp" sector="corp" id="halvorsen">Halvorsen</Ent> can meet the revised cadence
            requirement {cite(1, "if the past-performance weighting stays at the level in the September draft")}. Graham will be at the
            Summit dinner and would welcome ten minutes with you and {cite(2, "the Senator's office")}.
          </p>
          <p className="redact" aria-label="Three lines withheld under exemption b 5">
            <span /><span /><span />
            <em>Withheld, exemption (b)(5)</em>
          </p>
          <p>I have attached the one-page comparison Nadia asked for. Please treat it as informal.</p>
          <p>Petra</p>
          <p className="attach"><span className="tag">PDF</span> HA_comparison_onepage.pdf <span className="dim num">112 KB</span></p>
        </div>
        <ol className="doc-notes">
          <Note n={1} hot={hot} set={setHot}>The weighting in Amendment 3, issued nine days later, matches the September draft.</Note>
          <Note n={2} hot={hot} set={setHot}>Nadia Ferreira, chief of staff to Sen. Whitcombe, sat at the Halvorsen table at the Summit dinner.</Note>
          <li className="plain">Voss left this office 19 months before writing. Her cooling-off period ended six months before.</li>
        </ol>
      </div>
    </>
  );
}

export function DocViewer() {
  const doc = useWs((s) => s.doc);
  const d = DOCS.find((x) => x.id === doc)!;
  return (
    <article className="doc" key={doc}>
      {doc === "E-0212" ? <Email /> : (
        <>
          <header className="doc-h">
            <p className="doc-src">
              <span className="tag">{d.src}</span>
              <span>{d.type} {d.id}</span>
              <span className="tag">Unverified</span>
            </p>
            <h3 className="doc-subject">{d.title}</h3>
            <dl className="doc-meta">
              <div><dt>Dated</dt><dd className="num">{d.date}</dd></div>
              <div>
                <dt>Names</dt>
                <dd className="chips">{d.about.map((id) => { const e = entity(id)!; return <Ent key={id} kind={e.kind} sector={e.sector} id={id}>{e.name}</Ent>; })}</dd>
              </div>
            </dl>
          </header>
          <div className="doc-cols">
            <div className="doc-body">{d.excerpt.map((p, i) => <p key={i}>{p}</p>)}</div>
            <ol className="doc-notes">
              <li className="plain">{d.ents} entities recognised, {d.about.length} in this case.</li>
            </ol>
          </div>
        </>
      )}
    </article>
  );
}

export function DocList() {
  const current = useWs((s) => s.doc);
  const [open, setOpen] = useState<string | null>(null);
  const links = useLinks("13");
  return (
    <ul className="doclist" data-lk={links.root}>
      {DOCS.map((d) => (
        <li
          key={d.id} className={`${links.mark([d.id])}${d.id === current ? " sel" : ""}`}
          onPointerEnter={() => board.hover({ ids: [d.id], from: "mark", at: "13" })} onPointerLeave={() => board.hover(null)} style={{ ["--k" as string]: DOCS.indexOf(d) * 2 }} data-open={open === d.id}>
          <button type="button" className="doc-row" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
            <span className="doctype">{d.type}</span>
            <span className="doc-title">{d.title}</span>
            <span className="doc-line">
              <span className="num">{d.date}</span>
              <span>{d.src}</span>
              <span>{d.ents} entities</span>
            </span>
            <span className="rel" data-tip={`Relevance to this case ${Math.round(d.rel * 100)}%`}><i style={{ width: `${d.rel * 100}%` }} /></span>
          </button>
          <Fold open={open === d.id}>
            <div className="doc-peek">
              <p>{d.excerpt[0]}</p>
              <div className="chips">
                {d.about.slice(0, 4).map((id) => { const e = entity(id)!; return <Ent key={id} kind={e.kind} sector={e.sector} id={id}>{e.name}</Ent>; })}
              </div>
              <div className="actions">
                <button type="button" className="btn" disabled={d.id === current} onClick={() => ws.openDoc(d.id)}>{d.id === current ? "Shown in the document panel" : "Open document"}</button>
              </div>
            </div>
          </Fold>
        </li>
      ))}
    </ul>
  );
}

const EVIDENCE = [
  { id: "E-0212", label: "E-0212 Email", doc: "E-0212", line: "Voss asks that the weighting stay as drafted, 14 Oct 2025" },
  { id: "F-84672", label: "F-84672 Filing", doc: "F-84672", line: `${REPORT_FILING.lob} lobbyists and ${fmtMoney(REPORT_FILING.amt)} reported for the quarter` },
  { id: "C-0031", label: "C-0031 Amendment 3", doc: "C-0031", line: "Weighting unchanged at 35 percent, 23 Oct 2025" },
  { id: "CAL", label: `Office calendar, ${WINDOW_CALENDAR} entries`, line: `Meetings logged by the Senator's office and subcommittee staff between ${WINDOW_TEXT}` },
];

export function Finding() {
  const brief = useWs((s) => s.brief);
  const [evidence, setEvidence] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const item = "Finding 3";
  const inBrief = brief.includes(item);
  return (
    <div className="finding" data-dismissed={dismissed}>
      <p className="finding-n">
        Finding 3 of 7
        {dismissed ? <> dismissed. <button type="button" className="btn quiet" onClick={() => setDismissed(false)}>Undo</button></> : null}
      </p>
      <Fold open={!dismissed}>
        <h3 className="finding-t">Contacts with the procurement office rose sharply in the 90 days before the award.</h3>
        <p className="finding-p">
          Lobbyists and Halvorsen executives logged {WINDOW_CONTACTS} contacts with public offices between {WINDOW_TEXT},
          against {PRIOR_CONTACTS} in the 90 days before that. The weighting she asked for appears unchanged in Amendment 3.
        </p>
        <div className="conf">
          <span className="conf-l">Confidence</span>
          <span className="conf-m" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={4} aria-label="Confidence 4 of 5" data-tip="4 of 5. One more independent source would make it 5."><i className="on" /><i className="on" /><i className="on" /><i className="on" /><i /></span>
          <span className="conf-t">High. Three independent sources agree. No statement from Kestrel Row yet.</span>
        </div>
        <ul className="evidence">
          {EVIDENCE.map((ev) => (
            <li key={ev.id}>
              <button type="button" className="chip" data-tip={ev.line} onClick={() => (ev.doc ? ws.openDoc(ev.doc) : setEvidence(true))}>{ev.label}</button>
            </li>
          ))}
        </ul>
        <Fold open={evidence} className="tray">
          <ol className="evidence-list">
            {EVIDENCE.map((ev) => (
              <li key={ev.id}>
                <span className="codes">{ev.id}</span>
                <span>{ev.line}</span>
                {ev.doc ? <button type="button" className="btn quiet" onClick={() => ws.openDoc(ev.doc)}>Open</button> : <span className="dim">Not released</span>}
              </li>
            ))}
          </ol>
        </Fold>
        <div className="actions">
          <button type="button" className={`btn${inBrief ? " done" : " primary"}`} aria-pressed={inBrief} data-note="commit" onClick={() => ws.toggleBrief(item)}>{inBrief ? "In brief" : "Add to brief"}</button>
          <button type="button" className="btn" aria-expanded={evidence} onClick={() => setEvidence((v) => !v)}>{evidence ? "Close evidence" : "Open evidence"}</button>
          <button type="button" className="btn quiet" onClick={() => { setDismissed(true); setEvidence(false); }}>Dismiss</button>
        </div>
      </Fold>
    </div>
  );
}

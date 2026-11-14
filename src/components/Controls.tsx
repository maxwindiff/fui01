import { useState } from "react";
import { Glyph, PartyChip, Segmented, Spark } from "./primitives";
import type { Kind, Sector } from "../data";
import { SPARK_CONTACTS, SPARK_MONEY, SPEND_HALVORSEN } from "../data";

const FILTERS: { id: string; label: string; kind: Kind; sector: Sector; n: number }[] = [
  { id: "official", label: "Officials", kind: "official", sector: "gov", n: 52 },
  { id: "agency", label: "Agencies", kind: "agency", sector: "gov", n: 3 },
  { id: "corp", label: "Companies", kind: "corp", sector: "corp", n: 22 },
  { id: "firm", label: "Lobbying firms", kind: "firm", sector: "inter", n: 2 },
  { id: "pac", label: "PACs", kind: "pac", sector: "inter", n: 14 },
  { id: "event", label: "Events", kind: "event", sector: "event", n: 3 },
];

export function Controls() {
  const [tab, setTab] = useState("ties");
  const [on, setOn] = useState(new Set(["official", "corp", "firm", "pac"]));
  const [min, setMin] = useState(3);
  const [money, setMoney] = useState(true);
  const [dim, setDim] = useState(false);
  const toggle = (id: string) => setOn((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  return (
    <div className="kit">
      <section>
        <h4 className="sub-h">Search</h4>
        <label className="search">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="M10.6 10.6 14 14" /></svg>
          <input type="search" defaultValue="from:voss to:ool before:2025-11-06" aria-label="Search people, filings and documents" />
          <kbd>/</kbd>
        </label>
        <p className="note">31 documents, 14 contacts and 2 filings match.</p>
      </section>
      <section>
        <h4 className="sub-h">Show</h4>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`chip filter${on.has(f.id) ? " on" : ""}`} aria-pressed={on.has(f.id)} onClick={() => toggle(f.id)}>
              <Glyph kind={f.kind} sector={f.sector} />
              {f.label}
              <span className="num">{f.n}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h4 className="sub-h">View</h4>
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: "ties", label: "Ties" }, { value: "money", label: "Money" }, { value: "time", label: "Time" }, { value: "place", label: "Place" }]} />
        <div className="rows">
          <label className="switch">
            <input type="checkbox" checked={money} onChange={(e) => setMoney(e.target.checked)} />
            <i />
            Animate money in the direction it moved
          </label>
          <label className="check">
            <input type="checkbox" checked={dim} onChange={(e) => setDim(e.target.checked)} />
            <i />
            Hide entities with a single tie
          </label>
          <label className="range">
            <span>Minimum tie strength <b className="num">{min}</b></span>
            <input type="range" min={1} max={10} value={min} onChange={(e) => setMin(+e.target.value)} style={{ ["--p" as string]: `${((min - 1) / 9) * 100}%` }} />
          </label>
        </div>
      </section>
      <section>
        <h4 className="sub-h">Actions</h4>
        <div className="actions">
          <button type="button" className="btn primary">Add to brief</button>
          <button type="button" className="btn">Export filings</button>
          <button type="button" className="btn quiet">Reset view</button>
          <button type="button" className="btn danger">Remove from case</button>
          <button type="button" className="btn" disabled>Awaiting release</button>
        </div>
      </section>
      <section>
        <h4 className="sub-h">Status and affiliation</h4>
        <div className="tags">
          <span className="tag ok">Verified</span>
          <span className="tag">Unverified</span>
          <span className="tag alert">Disputed</span>
          <span className="tag mute">Redacted</span>
          <PartyChip party="D" state="WA" />
          <PartyChip party="R" state="AZ" />
          <PartyChip party="I" state="ME" />
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={1804} aria-valuenow={1212}>
          <span>Indexing FOIA 2026-0417</span>
          <span className="num">1,212 of 1,804 pages</span>
          <i><b style={{ width: "67%" }} /></i>
        </div>
      </section>
      <section>
        <h4 className="sub-h">Readouts</h4>
        <dl className="readouts">
          <div><dt>Lobbying, 2025</dt><dd><b>$9.39M</b><Spark data={SPEND_HALVORSEN.slice(8)} w={72} /></dd></div>
          <div><dt>To subcommittee</dt><dd><b>$2.71M</b><Spark data={SPARK_MONEY} kind="bar" w={72} /></dd></div>
          <div><dt>Contacts logged</dt><dd><b>214</b><Spark data={SPARK_CONTACTS} w={72} /></dd></div>
        </dl>
        <div className="tip static" role="tooltip">
          <b>Liberty Orbit Fund</b>
          <span>$1.15M in ads backing Whitcombe, Aug to Oct 2025</span>
        </div>
      </section>
    </div>
  );
}

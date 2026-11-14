import { DOCS, FILINGS, PRIOR_CONTACTS, WINDOW_CONTACTS, fmtMoney } from "../data";
import { Ent } from "./primitives";

export function FilingsTable() {
  const max = Math.max(...FILINGS.map((f) => f.amt));
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Quarter</th>
          <th>Registrant</th>
          <th>Issues</th>
          <th>Lobbyists</th>
          <th className="r">Reported</th>
          <th className="bar-col" aria-hidden="true" />
          <th className="r">Filing</th>
        </tr>
      </thead>
      <tbody>
        {FILINGS.map((f) => (
          <tr key={f.id} className={f.focus ? "sel" : ""} tabIndex={0}>
            <td className="num">{f.q}</td>
            <td>{f.reg}</td>
            <td className="codes">{f.issues}</td>
            <td>
              <span className="pips" aria-label={`${f.lob} lobbyists, ${f.ex} former officials`}>
                {Array.from({ length: f.lob }, (_, i) => <i key={i} className={i < f.ex ? "ex" : ""} />)}
              </span>
            </td>
            <td className="r num strong">{fmtMoney(f.amt)}</td>
            <td className="bar-col"><span className="cell-bar"><i style={{ width: `${(f.amt / max) * 100}%` }} /></span></td>
            <td className="r num dim">{f.id}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><td colSpan={7}>Filled marks are lobbyists who held a federal post in the previous five years.</td></tr>
      </tfoot>
    </table>
  );
}

export function EmailViewer() {
  return (
    <article className="doc">
      <header className="doc-h">
        <p className="doc-src">
          <span className="tag">FOIA 2026-0417</span>
          <span>Page 212 of 1,804</span>
          <span className="tag ok">Verified against release index</span>
        </p>
        <h3 className="doc-subject">Re: Thursday follow-up on evaluation criteria</h3>
        <dl className="doc-meta">
          <div><dt>From</dt><dd><Ent kind="person" sector="inter">Petra Voss</Ent> <span className="dim">pvoss@kestrelrow.example</span></dd></div>
          <div><dt>To</dt><dd><Ent kind="official" sector="gov">Imani Calder</Ent> <span className="dim">imani.calder@ool.example</span></dd></div>
          <div><dt>Cc</dt><dd><Ent kind="person" sector="inter">Owen Liang</Ent></dd></div>
          <div><dt>Sent</dt><dd className="num">Tue 14 Oct 2025, 07:42 <span className="dim">23 days before the award</span></dd></div>
        </dl>
      </header>
      <div className="doc-cols">
        <div className="doc-body">
          <p>Imani,</p>
          <p>
            Thank you for making time on Thursday. As discussed, <Ent kind="corp" sector="corp">Halvorsen</Ent> can meet the revised cadence
            requirement <mark>if the past-performance weighting stays at the level in the September draft</mark><sup>1</sup>. Graham will be at the
            Summit dinner and would welcome ten minutes with you and <mark>the Senator's office</mark><sup>2</sup>.
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
          <li>The weighting in Amendment 3, issued nine days later, matches the September draft.</li>
          <li>Nadia Ferreira, chief of staff to Sen. Whitcombe, sat at the Halvorsen table at the Summit dinner.</li>
          <li className="plain">Voss left this office 19 months before writing. Her cooling-off period ended six months before.</li>
        </ol>
      </div>
    </article>
  );
}

export function DocList() {
  return (
    <ul className="doclist">
      {DOCS.map((d) => (
        <li key={d.id} className={d.open ? "sel" : ""} tabIndex={0}>
          <span className={`doctype t-${d.type.toLowerCase()}`}>{d.type}</span>
          <span className="doc-title">{d.title}</span>
          <span className="doc-line">
            <span className="num">{d.date}</span>
            <span>{d.src}</span>
            <span>{d.ents} entities</span>
          </span>
          <span className="rel" title={`Relevance ${Math.round(d.rel * 100)}%`}><i style={{ width: `${d.rel * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

export function Finding() {
  return (
    <div className="finding">
      <p className="finding-n">Finding 3 of 7</p>
      <h3 className="finding-t">Contacts with the procurement office rose sharply in the 90 days before the award.</h3>
      <p className="finding-p">
        Voss and her colleagues reached the Office of Orbital Logistics or the Senator's office {WINDOW_CONTACTS} times between 8 Aug and 6 Nov 2025,
        against {PRIOR_CONTACTS} in the 90 days before that. The weighting she asked for appears unchanged in Amendment 3.
      </p>
      <div className="conf">
        <span className="conf-l">Confidence</span>
        <span className="conf-m" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={4} aria-label="Confidence 4 of 5"><i className="on" /><i className="on" /><i className="on" /><i className="on" /><i /></span>
        <span className="conf-t">High. Three independent sources agree. No statement from Kestrel Row yet.</span>
      </div>
      <ul className="evidence">
        <li><button type="button" className="chip">E-0212 Email</button></li>
        <li><button type="button" className="chip">F-84672 Filing</button></li>
        <li><button type="button" className="chip">C-0031 Amendment 3</button></li>
        <li><button type="button" className="chip">Office calendar, 11 entries</button></li>
      </ul>
      <div className="actions">
        <button type="button" className="btn primary">Add to brief</button>
        <button type="button" className="btn">Open evidence</button>
        <button type="button" className="btn quiet">Dismiss</button>
      </div>
    </div>
  );
}

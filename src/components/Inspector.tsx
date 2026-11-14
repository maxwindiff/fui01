import { useEffect, useRef } from "react";
import { dossier, entity } from "../data";
import { useWorkspace } from "../workspace";
import { Ent, Glyph, PartyChip } from "./primitives";

export function Inspector() {
  const ws = useWorkspace();
  const id = ws.trail[ws.trail.length - 1];
  const body = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    body.current?.scrollTo(0, 0);
    if (id && !wasOpen.current) body.current?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    wasOpen.current = !!id;
  }, [id]);
  if (!id) return null;
  const d = dossier(id);
  const max = Math.max(...d.groups.flatMap((g) => g.rows.map((r) => r.w)), 1);
  const item = `Dossier: ${d.e.name}`;
  const inBrief = ws.brief.includes(item);
  return (
    <aside className="inspector" aria-label="Dossier">
      <header className="insp-h">
        <ol className="trail">
          {ws.trail.map((t, i) => (
            <li key={`${t}${i}`}>
              {i < ws.trail.length - 1
                ? <button type="button" onClick={() => ws.jump(i)} data-tip={`Back to ${entity(t)!.name}`}>{entity(t)!.name}</button>
                : <span aria-current="true">{entity(t)!.name}</span>}
            </li>
          ))}
        </ol>
        <button type="button" className="panel-x" aria-label="Close the dossier" data-tip="Close (Esc)" onClick={ws.closeInspector}>
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>
        </button>
      </header>
      <div className="insp-b" ref={body}>
        <div className="insp-page" key={id}>
          <p className="insp-kind"><Glyph kind={d.e.kind} sector={d.e.sector} size={15} />{d.e.sector === "gov" ? "Government" : d.e.sector === "corp" ? "Company side" : d.e.sector === "inter" ? "Intermediary" : "Event"}</p>
          <h3 className="person-name" tabIndex={-1}>{d.e.name}</h3>
          {d.e.role ? <p className="person-role">{d.e.role}</p> : null}
          {d.e.party ? <div className="tags"><PartyChip party={d.e.party} long /></div> : null}
          <dl className="facts three">
            <div><dt>Ties</dt><dd><b>{d.ties}</b></dd></div>
            <div><dt>Kinds of tie</dt><dd><b>{d.groups.length}</b></dd></div>
            <div><dt>Documents</dt><dd><b>{d.docs.length}</b></dd></div>
          </dl>
          <div className="actions">
            <button type="button" className={`btn${inBrief ? " done" : " primary"}`} aria-pressed={inBrief} onClick={() => ws.toggleBrief(item)}>{inBrief ? "In brief" : "Add to brief"}</button>
            <button type="button" className="btn" onClick={() => ws.reveal("01")}>Show in network</button>
          </div>
          {d.groups.map((g) => (
            <section key={g.key}>
              <h4 className="sub-h">{g.label} <span className="num dim">{g.rows.length + g.minor}</span></h4>
              <ol className="ties">
                {g.rows.map((r, i) => (
                  <li key={`${r.other.id}${i}`}>
                    <Ent kind={r.other.kind} sector={r.other.sector} id={r.other.id}>{r.other.name}</Ent>
                    <span className="ties-note">{r.note}</span>
                    <span className="ties-bar" data-tip={`Strength ${r.w} of 10`}><i style={{ width: `${(r.w / max) * 100}%` }} /></span>
                  </li>
                ))}
              </ol>
              {g.minor ? <p className="sub">{g.rows.length ? "and " : ""}{g.minor} minor {g.minor === 1 ? "tie" : "ties"} to background entities</p> : null}
            </section>
          ))}
          {d.docs.length ? (
            <section>
              <h4 className="sub-h">Documents <span className="num dim">{d.docs.length}</span></h4>
              <ul className="insp-docs">
                {d.docs.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" onClick={() => ws.openDoc(doc.id)}>
                      <span className="doctype">{doc.type}</span>
                      <span className="doc-title">{doc.title}</span>
                      <span className="doc-line num">{doc.date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

import { useEffect, useRef } from "react";
import { dossier } from "../data";
import { Glyph, PartyChip } from "../components/primitives";
import { ws } from "../workspace";
import { eventsOf } from "./entities";
import { fmtDate } from "./format";

const SIDE: Record<string, string> = { gov: "Government", corp: "Company side", inter: "Go-between", event: "Event" };

// A short card for the entity behind a mark. The full dossier opens in the drawer the case board uses.
export function EntityPop({ id, x, y, w, h, selected, onAsk, onSelect, onClose }: { id: string; x: number; y: number; w: number; h: number; selected: boolean; onAsk: (q: string) => void; onSelect: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const d = dossier(id);
  const events = eventsOf(id);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node) && !(e.target as Element).closest?.("[data-id]")) onClose(); };
    addEventListener("keydown", key);
    addEventListener("pointerdown", off);
    box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    return () => { removeEventListener("keydown", key); removeEventListener("pointerdown", off); };
  }, [onClose]);
  const top = d.groups.flatMap((g) => g.rows.map((r) => ({ name: r.other.name, note: r.note, w: r.w }))).sort((p, q) => q.w - p.w).slice(0, 4);
  const left = x + 330 > w ? Math.max(8, x - 330) : x + 14;
  // The card's height is known only after it renders, so it starts near the mark and moves up if it would run off.
  useEffect(() => {
    const el = box.current;
    if (el) el.style.top = `${Math.max(8, Math.min(y - 40, h - el.offsetHeight - 8))}px`;
  });
  return (
    <div className="ask-ent" ref={box} role="dialog" aria-label={d.e.name} style={{ left, top: Math.max(8, y - 40) }}>
      <header>
        <p className="insp-kind"><Glyph kind={d.e.kind} sector={d.e.sector} size={14} />{SIDE[d.e.sector]}</p>
        <button type="button" className="ask-x" aria-label="Close" onClick={onClose}><svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1 7 7M7 1 1 7" /></svg></button>
      </header>
      <h3>{d.e.name}</h3>
      {d.e.role ? <p className="note">{d.e.role}</p> : null}
      {d.e.party ? <div className="tags"><PartyChip party={d.e.party} long /></div> : null}
      <dl className="ask-ent-facts">
        <div><dt>Ties</dt><dd>{d.ties}</dd></div>
        <div><dt>Events</dt><dd>{events.length}</dd></div>
        <div><dt>Documents</dt><dd>{d.docs.length}</dd></div>
      </dl>
      {top.length ? <ul className="ask-ent-list">{top.map((t) => <li key={t.name}><b>{t.name}</b><span>{t.note}</span></li>)}</ul> : null}
      {events.length ? <ul className="ask-ent-list">{events.slice(0, 3).map((e) => <li key={e.id}><span className="num">{fmtDate(Date.parse(e.starts))}</span><b>{e.title}</b></li>)}</ul> : null}
      <div className="ask-ent-acts">
        <button type="button" className="btn primary" onClick={() => { onClose(); ws.inspect(id); }}>Open dossier</button>
        <button type="button" className="btn" onClick={() => onAsk(`Who is ${d.e.name} connected to?`)}>Show their ties</button>
        <button type="button" className="btn quiet" aria-pressed={selected} onClick={onSelect}>{selected ? "Deselect" : "Select"}</button>
      </div>
    </div>
  );
}

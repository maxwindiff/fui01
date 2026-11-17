import { useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { T0, T1, TL_CAREER, TL_CONTACTS, TL_COOLING, TL_EVENTS, TL_GIFTS, TL_HILL, TL_WINDOW, WINDOW_CONTACTS, fmtMoney } from "../data";
import { tip, TipRow } from "../tip";
import { usePanel, useSize } from "./primitives";
import { board } from "../ask/board";
import { useLinks } from "../links";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 864e5;
const fmtDay = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

function measure(a: number, b: number) {
  return {
    contacts: TL_CONTACTS.filter((c) => c.t >= a && c.t <= b).reduce((n, c) => n + c.n, 0),
    gifts: TL_GIFTS.filter((g) => g.t >= a && g.t <= b).reduce((n, g) => n + g.v, 0),
    steps: TL_HILL.filter((e) => e.t >= a && e.t <= b),
    events: TL_EVENTS.filter((e) => e.b >= a && e.a <= b),
  };
}

export function Timeline() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const { staged } = usePanel();
  const k = staged ? 1.9 : 1;
  const [at, setAt] = useState<number | null>(null);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const drag = useRef<number | null>(null);
  const links = useLinks("05");
  const left = 128, right = 18;
  const x = (t: number) => left + ((t - T0) / (T1 - T0)) * (w - left - right);
  const time = (px: number) => Math.max(T0, Math.min(T1, T0 + ((px - left) / (w - left - right)) * (T1 - T0)));

  const local = (e: RPointerEvent<SVGRectElement>) => time(e.clientX - e.currentTarget.ownerSVGElement!.getBoundingClientRect().left);
  // The mark under the pointer: the lane comes from the height, and the nearest item in that lane within a few pixels.
  const markAt = (e: RPointerEvent<SVGRectElement>): { ids: string[]; label: string } | null => {
    const py = e.clientY - e.currentTarget.ownerSVGElement!.getBoundingClientRect().top;
    const l = lanes.find((x) => py >= x.y && py < x.y + x.h + 6);
    if (!l) return null;
    const px = x(local(e));
    const near = <T,>(xs: T[], t: (v: T) => number, slack = 6) => xs.map((v) => ({ v, d: Math.abs(x(t(v)) - px) })).filter((c) => c.d <= slack).sort((a, b) => a.d - b.d)[0]?.v;
    const within = <T extends { a: number; b: number }>(xs: T[]) => xs.find((v) => px >= x(v.a) - 3 && px <= Math.max(x(v.b), x(v.a) + 4) + 3);
    if (l.key === "contacts") { const c = near(TL_CONTACTS, (v) => v.t, 4); return c ? { ids: c.ids, label: `Contacts, week of ${fmtDay(c.t)}` } : null; }
    if (l.key === "gifts") { const g = near(TL_GIFTS, (v) => v.t); return g ? { ids: g.ids, label: `Gifts to Whitcombe, report of ${fmtDay(g.t)}` } : null; }
    if (l.key === "hill") { const h = near(TL_HILL, (v) => v.t); return h ? { ids: [h.id], label: h.text } : null; }
    if (l.key === "events") { const ev = within(TL_EVENTS); return ev ? { ids: [ev.id], label: ev.text } : null; }
    const c = within(TL_CAREER.map((v) => ({ ...v, a: Math.max(v.a, T0) })));
    return c ? { ids: [c.id], label: `${c.text}, ${c.sub}` } : null;
  };
  const down = (e: RPointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = local(e);
    tip.hide();
  };
  const move = (e: RPointerEvent<SVGRectElement>) => {
    const t = local(e);
    setAt(t);
    if (drag.current !== null) {
      if (Math.abs(x(t) - x(drag.current)) > 3) setBrush({ a: Math.min(drag.current, t), b: Math.max(drag.current, t) });
      return;
    }
    const hit = markAt(e);
    board.hover(hit ? { ids: hit.ids, from: "mark", at: "05" } : null);
    const near = measure(t - 4 * DAY, t + 4 * DAY);
    const gift = TL_GIFTS.find((g) => Math.abs(g.t - t) < 5 * DAY);
    tip.show({ x: e.clientX, y: e.clientY }, (
      <>
        <b>Week of {fmtDay(t - 3 * DAY)}</b>
        <TipRow k="Contacts" v={near.contacts} strong={near.contacts > 0} />
        {gift ? <TipRow k="Gift filed" v={fmtMoney(gift.v)} strong /> : null}
        {near.steps.map((s) => <TipRow key={s.text} k="Hill or agency" v={s.text} />)}
        {near.events.map((ev, i) => <TipRow key={i} k="Event" v={ev.text} />)}
      </>
    ));
  };
  const up = (e: RPointerEvent<SVGRectElement>) => {
    if (drag.current !== null && Math.abs(x(local(e)) - x(drag.current)) <= 3) {
      setBrush(null);
      const hit = markAt(e);
      if (hit) links.on(hit.ids, hit.label).onClick();
    }
    drag.current = null;
  };
  const m = brush ? measure(brush.a, brush.b) : null;
  const lanes = [
    { key: "contacts", label: "Contacts", sub: "per week", y: 34, h: 44 },
    { key: "gifts", label: "Gifts to Whitcombe", sub: "per filing", y: 90, h: 50 },
    { key: "hill", label: "Hill and agency", sub: "", y: 152, h: 57 },
    { key: "events", label: "Events", sub: "", y: 221, h: 40 },
    { key: "career", label: "Petra Voss", sub: "career", y: 277, h: 66 },
  ].map((l) => ({ ...l, y: 22 + (l.y - 22) * k, h: l.h * k }));
  const H = 22 + 333 * k;
  const months: number[] = [];
  for (let y = 2024, m = 0; Date.UTC(y, m, 1) <= T1; m++, m === 12 && ((m = 0), y++)) months.push(Date.UTC(y, m, 1));
  const maxGift = Math.max(...TL_GIFTS.map((g) => g.v));
  // Bars in the contacts lane are 7.5px a contact, less when the busiest week would overflow the lane.
  const perContact = Math.min(7.5 * k, (lanes[0].h - 4) / Math.max(...TL_CONTACTS.map((c) => c.n)));
  const lane = (k: string) => lanes.find((l) => l.key === k)!;

  return (
    <div ref={ref} className="chart timeline">
      <p className="tl-readout" aria-live="polite">
        {brush && m ? (
          <>
            <b>{fmtDay(brush.a)} to {fmtDay(brush.b)}</b>
            <span>{Math.round((brush.b - brush.a) / DAY)} days</span>
            <span><b className="num">{m.contacts}</b> {m.contacts === 1 ? "contact" : "contacts"}</span>
            <span><b className="num">{fmtMoney(m.gifts)}</b> in gifts</span>
            <span><b className="num">{m.steps.length}</b> Hill or agency {m.steps.length === 1 ? "step" : "steps"}</span>
            <span><b className="num">{m.events.length}</b> {m.events.length === 1 ? "event" : "events"}</span>
            <button type="button" className="btn quiet" onClick={() => setBrush(null)}>Clear</button>
          </>
        ) : (
          <>
            <span data-note="measure">Drag to measure</span>
            <button type="button" className="btn quiet" onClick={() => setBrush(TL_WINDOW)}>90 days before the award</button>
          </>
        )}
      </p>
      {w > 0 ? (
        <svg className="wipe" width={w} height={H} data-lk={links.root} role="img" aria-label="Timeline of contacts, gifts, legislative steps, events and Petra Voss's career, January 2024 to June 2026">
          <rect className="tl-window" x={x(TL_WINDOW.a)} y={22} width={x(TL_WINDOW.b) - x(TL_WINDOW.a)} height={H - 22} />
          {months.map((t, i) => {
            const d = new Date(t);
            const jan = d.getUTCMonth() === 0;
            const q = d.getUTCMonth() % 3 === 0;
            return (
              <g key={i}>
                <path className={jan ? "c-tick strong" : "c-tick"} d={`M${x(t).toFixed(1)} ${jan ? 4 : q ? 12 : 17}V22`} />
                {jan ? <text className="c-label strong" x={x(t) + 5} y={12}>{d.getUTCFullYear()}</text> : null}
                {q && !jan ? <text className="c-label" x={x(t) + 4} y={12}>{MONTH[d.getUTCMonth()]}</text> : null}
              </g>
            );
          })}
          <path className="c-axis" d={`M${left} 22.5H${w - right}`} />
          {lanes.map((l) => (
            <g key={l.key}>
              <text className="tl-lane" x={0} y={l.y + 13}>{l.label}</text>
              {l.sub ? <text className="c-label" x={0} y={l.y + 28}>{l.sub}</text> : null}
              <path className="c-rule" d={`M${left} ${l.y + l.h + 0.5}H${w - right}`} />
            </g>
          ))}

          {TL_HILL.map((e, i) => (
            <path key={i} className={`tl-drop${e.key ? " key" : ""}`} d={`M${x(e.t).toFixed(1)} 22V${H}`} />
          ))}

          {TL_CONTACTS.map((c, i) => (
            <rect key={i} style={{ ["--k" as string]: i }} className={`${links.mark(c.ids)} tl-contact${c.key ? " key" : ""}`} x={x(c.t) - 1.25} y={lane("contacts").y + lane("contacts").h - c.n * perContact} width={2.5} height={c.n * perContact} />
          ))}
          <text className="c-label strong accent" x={x(TL_WINDOW.a) - 6} y={lane("contacts").y + 10} textAnchor="end">
            {WINDOW_CONTACTS} contacts in the 90 days before the award
          </text>

          {TL_GIFTS.map((g, i) => {
            const l = lane("gifts");
            const top = l.y + l.h - 4 - Math.sqrt(g.v / maxGift) * (l.h - 14);
            return (
              <g key={i} className={`${links.mark(g.ids)} tl-gift`} style={{ ["--k" as string]: i * 3 }}>
                <path d={`M${x(g.t).toFixed(1)} ${l.y + l.h}V${top.toFixed(1)}`} />
                <circle cx={x(g.t)} cy={top} r={2 + Math.sqrt(g.v / maxGift) * 3.2} />
                {g.v === maxGift ? <text className="c-label strong" x={x(g.t) - 9} y={top + 4} textAnchor="end">{fmtMoney(g.v)}</text> : null}
              </g>
            );
          })}

          {(() => {
            // Each flag takes the first of three rows where its label clears the labels already placed, to the right
            // of the flag and then to the left, and the row with the fewest flags otherwise.
            const l = lane("hill");
            const ends: { r: number; l: number }[][] = [[], [], []];
            return TL_HILL.map((e, i) => {
              const px = x(e.t), tw = e.text.length * 6.6 + (e.key ? 6 : 0);
              const fits = (row: number, a: number, b: number) => ends[row].every((s) => b < s.l - 4 || a > s.r + 4);
              const tries = [[0, 1], [1, 1], [0, -1], [1, -1], [2, 1], [2, -1]] as const;
              const pick = tries.find(([row, side]) => fits(row, side > 0 ? px - 5 : px - tw - 9, side > 0 ? px + tw + 9 : px + 5)) ?? [[0, 1, 2].sort((p, q) => ends[p].length - ends[q].length)[0], 1];
              const [r, side] = pick;
              ends[r].push(side > 0 ? { l: px - 5, r: px + tw + 9 } : { l: px - tw - 9, r: px + 5 });
              const row = r * k;
              return (
                <g key={i} className={`${links.mark([e.id])} tl-flag ${e.kind}${e.key ? " key" : ""}`}>
                  <rect x={px - 3.5} y={l.y + 6 + row * 17} width={7} height={7} transform={`rotate(45 ${px} ${l.y + 9.5 + row * 17})`} />
                  <text className={e.key ? "c-label strong" : "c-label ink"} x={side > 0 ? px + 9 : px - 9} y={l.y + 13.5 + row * 17} textAnchor={side > 0 ? "start" : "end"}>{e.text}</text>
                </g>
              );
            });
          })()}

          {TL_EVENTS.map((e, i) => {
            const l = lane("events");
            return (
              <g key={i} className={`${links.mark([e.id])} tl-event`}>
                <rect x={x(e.a)} y={l.y + 5 + (i % 2) * 17 * k} width={Math.max(4, x(e.b) - x(e.a))} height={11} />
                <text className="c-label ink" x={x(e.a) + Math.max(4, x(e.b) - x(e.a)) + 5} y={l.y + 14.5 + (i % 2) * 17 * k}>{e.text}</text>
              </g>
            );
          })}

          <g className={links.mark([TL_COOLING.id])}>
            <rect className="tl-cooling" x={x(TL_COOLING.a)} y={lane("career").y + 5} width={x(TL_COOLING.b) - x(TL_COOLING.a)} height={14} fill="url(#hatch)" />
            <text className="c-label ink halo" x={x(TL_COOLING.a) + 8} y={lane("career").y + 16}>{TL_COOLING.text}</text>
          </g>
          {TL_CAREER.map((c, i) => {
            const l = lane("career");
            const xa = Math.max(left, x(c.a));
            const wide = x(c.b) - xa > c.text.length * 7 + 16;
            return (
              <g key={i} className={`${links.mark([c.id])} tl-career sec-${c.sector}`} style={{ ["--k" as string]: i * 6 }}>
                <rect x={xa} y={l.y + 5 + i * 20 * k} width={x(c.b) - xa} height={14} />
                {wide ? <text className="tl-career-label" x={xa + 6} y={l.y + 16 + i * 20 * k}>{c.text}<tspan className="tl-career-sub" dx="10">{c.sub}</tspan></text> : null}
              </g>
            );
          })}

          {brush ? (
            <g className="tl-brush">
              <rect x={x(brush.a)} y={22} width={x(brush.b) - x(brush.a)} height={H - 22} />
              <path d={`M${x(brush.a).toFixed(1)} 16V${H}M${x(brush.b).toFixed(1)} 16V${H}`} />
              <path className="tl-handle" d={`M${x(brush.a) - 3.5} 16h7v8h-7zM${x(brush.b) - 3.5} 16h7v8h-7z`} />
            </g>
          ) : null}
          {at !== null && drag.current === null ? (
            <g className="c-probe">
              <path className="c-cross" d={`M${x(at).toFixed(1)} 22V${H}`} />
              <text className="c-label strong halo" x={x(at)} y={12} textAnchor="middle">{fmtDay(at)}</text>
            </g>
          ) : null}
          <rect
            className="c-hit brushable" x={left} y={0} width={Math.max(0, w - left - right)} height={H}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => { setAt(null); tip.hide(); board.hover(null); }}
          />
        </svg>
      ) : null}
    </div>
  );
}

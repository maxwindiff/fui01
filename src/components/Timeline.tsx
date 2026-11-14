import { T0, T1, TL_CAREER, TL_CONTACTS, TL_COOLING, TL_EVENTS, TL_GIFTS, TL_HILL, TL_WINDOW, WINDOW_CONTACTS, fmtMoney } from "../data";
import { useSize } from "./primitives";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Timeline() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const left = 128, right = 18;
  const x = (t: number) => left + ((t - T0) / (T1 - T0)) * (w - left - right);
  const lanes = [
    { key: "contacts", label: "Contacts", sub: "per week", y: 34, h: 44 },
    { key: "gifts", label: "Gifts to Whitcombe", sub: "per filing", y: 90, h: 50 },
    { key: "hill", label: "Hill and agency", sub: "", y: 152, h: 40 },
    { key: "events", label: "Events", sub: "", y: 204, h: 40 },
    { key: "career", label: "Petra Voss", sub: "career", y: 260, h: 66 },
  ];
  const H = 338;
  const months: number[] = [];
  for (let y = 2024, m = 0; Date.UTC(y, m, 1) <= T1; m++, m === 12 && ((m = 0), y++)) months.push(Date.UTC(y, m, 1));
  const maxGift = Math.max(...TL_GIFTS.map((g) => g.v));
  const lane = (k: string) => lanes.find((l) => l.key === k)!;

  return (
    <div ref={ref} className="chart timeline">
      {w > 0 ? (
        <svg width={w} height={H} role="img" aria-label="Timeline of contacts, gifts, legislative steps, events and Petra Voss's career, January 2024 to June 2026">
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
            <rect key={i} className={`tl-contact${c.key ? " key" : ""}`} x={x(c.t) - 1.25} y={lane("contacts").y + lane("contacts").h - c.n * 7.5} width={2.5} height={c.n * 7.5} />
          ))}
          <text className="c-label strong accent" x={x(TL_WINDOW.a) - 6} y={lane("contacts").y + 10} textAnchor="end">
            {WINDOW_CONTACTS} contacts in the 90 days before the award
          </text>

          {TL_GIFTS.map((g, i) => {
            const l = lane("gifts");
            const top = l.y + l.h - 4 - Math.sqrt(g.v / maxGift) * (l.h - 14);
            return (
              <g key={i} className="tl-gift">
                <path d={`M${x(g.t).toFixed(1)} ${l.y + l.h}V${top.toFixed(1)}`} />
                <circle cx={x(g.t)} cy={top} r={2 + Math.sqrt(g.v / maxGift) * 3.2} />
                {g.v === maxGift ? <text className="c-label strong" x={x(g.t) - 9} y={top + 4} textAnchor="end">{fmtMoney(g.v)}</text> : null}
              </g>
            );
          })}

          {TL_HILL.map((e, i) => {
            const l = lane("hill");
            const row = i % 2;
            return (
              <g key={i} className={`tl-flag ${e.kind}${e.key ? " key" : ""}`}>
                <rect x={x(e.t) - 3.5} y={l.y + 6 + row * 17} width={7} height={7} transform={`rotate(45 ${x(e.t)} ${l.y + 9.5 + row * 17})`} />
                <text className={e.key ? "c-label strong" : "c-label ink"} x={x(e.t) + 9} y={l.y + 13.5 + row * 17}>{e.text}</text>
              </g>
            );
          })}

          {TL_EVENTS.map((e, i) => {
            const l = lane("events");
            return (
              <g key={i} className="tl-event">
                <rect x={x(e.a)} y={l.y + 5 + (i % 2) * 17} width={Math.max(4, x(e.b) - x(e.a))} height={11} />
                <text className="c-label ink" x={x(e.a) + Math.max(4, x(e.b) - x(e.a)) + 5} y={l.y + 14.5 + (i % 2) * 17}>{e.text}</text>
              </g>
            );
          })}

          <g>
            <rect className="tl-cooling" x={x(TL_COOLING.a)} y={lane("career").y + 5} width={x(TL_COOLING.b) - x(TL_COOLING.a)} height={14} fill="url(#hatch)" />
            <text className="c-label ink halo" x={x(TL_COOLING.a) + 8} y={lane("career").y + 16}>Left the Office of Orbital Logistics. Cooling-off period to 15 Apr 2025</text>
          </g>
          {TL_CAREER.map((c, i) => {
            const l = lane("career");
            const xa = Math.max(left, x(c.a));
            const wide = x(c.b) - xa > c.text.length * 7 + 16;
            return (
              <g key={i} className={`tl-career sec-${c.sector}`}>
                <rect x={xa} y={l.y + 5 + i * 20} width={x(c.b) - xa} height={14} />
                {wide ? <text className="tl-career-label" x={xa + 6} y={l.y + 16 + i * 20}>{c.text}<tspan className="tl-career-sub" dx="10">{c.sub}</tspan></text> : null}
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

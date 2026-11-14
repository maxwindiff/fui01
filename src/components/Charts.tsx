import { useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { FLOW_NODES, FLOWS, MULTIPLES, MULTIPLES_T0, QUARTERS, SLOPE, SPEND_HALVORSEN, SPEND_NOTES, SPEND_PEER_HI, SPEND_PEER_LO, SPEND_PEER_MED, fmtMoney } from "../data";
import { tip, TipRow } from "../tip";
import { ws } from "../workspace";
import { usePanel, useSize } from "./primitives";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SpendChart() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const { staged } = usePanel();
  const [at, setAt] = useState(-1);
  const H = staged ? 520 : 250, l = 40, r = 118, t = 24, b = 26;
  const n = QUARTERS.length;
  const x = (i: number) => l + (i / (n - 1)) * (w - l - r);
  const y = (v: number) => t + (1 - v / 3000) * (H - t - b);
  const line = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const band = `${line(SPEND_PEER_HI)}${SPEND_PEER_LO.map((v, i) => `L${x(n - 1 - i).toFixed(1)} ${y(SPEND_PEER_LO[n - 1 - i]).toFixed(1)}`).join("")}Z`;
  const peak = SPEND_HALVORSEN.indexOf(Math.max(...SPEND_HALVORSEN));
  const move = (e: RPointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - box.left - l) / (w - l - r)) * (n - 1))));
    setAt(i);
    const ha = SPEND_HALVORSEN[i], med = SPEND_PEER_MED[i];
    tip.show({ x: box.left + x(i), y: box.top + y(ha) }, (
      <>
        <b>{QUARTERS[i].y} Q{QUARTERS[i].q}</b>
        <TipRow k="Halvorsen" v={fmtMoney(ha)} strong />
        <TipRow k="Peer median" v={fmtMoney(med)} />
        <TipRow k="Ratio" v={`${(ha / med).toFixed(1)} to 1`} />
      </>
    ));
  };
  return (
    <div ref={ref} className="chart">
      {w > 0 ? (
        <svg width={w} height={H} role="img" aria-label="Quarterly lobbying spend, Halvorsen Aerodyne against five peer contractors, 2021 to 2026">
          {[0, 1000, 2000, 3000].map((v) => (
            <g key={v}>
              <path className="c-tick" d={`M${l - 5} ${y(v) + 0.5}H${l}`} />
              <text className="c-label" x={l - 8} y={y(v) + 4} textAnchor="end">{v ? `$${v / 1000}M` : "0"}</text>
            </g>
          ))}
          <path className="c-axis" d={`M${l + 0.5} ${y(Math.max(...SPEND_HALVORSEN))}V${y(0)}`} />
          {QUARTERS.map((q, i) => (
            <g key={i}>
              <path className="c-tick" d={`M${x(i).toFixed(1)} ${H - b}v${q.q === 1 ? 6 : 3}`} />
              {q.q === 1 ? <text className="c-label" x={x(i)} y={H - 6} textAnchor="middle">{q.y}</text> : null}
            </g>
          ))}
          <path className="c-band" d={band} />
          <path className="c-line thin" pathLength={1} d={line(SPEND_PEER_MED)} />
          {SPEND_NOTES.map((note) => {
            const px = x(note.i), py = y(SPEND_HALVORSEN[note.i]);
            const after = note.i > peak;
            return (
              <g key={note.i} className="c-note">
                <path d={after ? `M${px + 5} ${py}h14` : `M${px - 5} ${py}h-14`} />
                <text className="c-label ink" x={after ? px + 23 : px - 23} y={py + 4} textAnchor={after ? "start" : "end"}>{note.text}</text>
              </g>
            );
          })}
          <path className="c-line bold" pathLength={1} d={line(SPEND_HALVORSEN)} />
          {SPEND_HALVORSEN.map((v, i) => (
            <circle key={i} style={{ ["--k" as string]: i }} className={i === peak ? "c-dot peak" : "c-dot"} cx={x(i)} cy={y(v)} r={i === peak ? 3.4 : 1.7} />
          ))}
          <text className="c-label strong" x={x(peak)} y={y(SPEND_HALVORSEN[peak]) - 10} textAnchor="middle">{fmtMoney(SPEND_HALVORSEN[peak])}</text>
          <text className="c-label strong" x={x(n - 1) + 9} y={y(SPEND_HALVORSEN[n - 1]) + 1}>Halvorsen</text>
          <text className="c-label" x={x(n - 1) + 9} y={y(SPEND_HALVORSEN[n - 1]) + 15}>{fmtMoney(SPEND_HALVORSEN[n - 1])} last quarter</text>
          <text className="c-label ink" x={x(n - 1) + 9} y={y(SPEND_PEER_MED[n - 1]) + 12}>Peer median</text>
          <text className="c-label" x={x(n - 1) + 9} y={y(SPEND_PEER_MED[n - 1]) + 26}>band: 5 contractors</text>
          {at >= 0 ? (
            <g className="c-probe">
              <path className="c-cross" d={`M${x(at).toFixed(1)} ${t}V${H - b}`} />
              <circle className="c-probe-dot thin" cx={x(at)} cy={y(SPEND_PEER_MED[at])} r="3.2" />
              <circle className="c-probe-dot" cx={x(at)} cy={y(SPEND_HALVORSEN[at])} r="4.4" />
            </g>
          ) : null}
          <rect className="c-hit" x={l} y={t} width={Math.max(0, w - l - r)} height={H - t - b} onPointerMove={move} onPointerLeave={() => { setAt(-1); tip.hide(); }} />
        </svg>
      ) : null}
    </div>
  );
}

export function SlopeChart() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const { staged } = usePanel();
  const [hot, setHot] = useState<string | null>(null);
  const H = staged ? 520 : 250, t = 34, b = 14;
  const xa = 150, xb = w - 58;
  const y = (v: number) => t + (1 - v / 40) * (H - t - b);
  const spread = (key: "a" | "b") => {
    const rows = SLOPE.map((s) => ({ s, y: y(s[key]) })).sort((p, q) => p.y - q.y);
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < 14) rows[i].y = rows[i - 1].y + 14;
    return new Map(rows.map((r) => [r.s.name, r.y]));
  };
  const ya = spread("a"), yb = spread("b");
  return (
    <div ref={ref} className="chart">
      {w > 0 ? (
        <svg width={w} height={H} data-probing={hot !== null} role="img" aria-label="Share of the network's political giving by recipient, 2022 cycle against 2024 cycle">
          <text className="c-label" x={xa} y={14} textAnchor="end">2022 cycle</text>
          <text className="c-label" x={xb} y={14}>2024 cycle</text>
          {SLOPE.map((s) => (
            <g
              key={s.name} className={`slope${s.focus ? " focus" : ""}${hot === s.name ? " on" : ""}`}
              onPointerEnter={() => setHot(s.name)}
              onPointerMove={(e) => tip.show({ x: e.clientX, y: e.clientY }, (
                <>
                  <b>{s.name}</b>
                  <TipRow k="2022 cycle" v={`${s.a}%`} />
                  <TipRow k="2024 cycle" v={`${s.b}%`} />
                  <TipRow k="Change" v={`${s.b > s.a ? "up" : "down"} ${Math.abs(s.b - s.a)} points`} strong />
                </>
              ))}
              onPointerLeave={() => { setHot(null); tip.hide(); }}
            >
              <path className="c-hit" d={`M0 ${ya.get(s.name)}H${xa + 8}L${xb - 8} ${y(s.b).toFixed(1)}H${w}`} />
              <path pathLength={1} d={`M${xa + 8} ${y(s.a).toFixed(1)}L${xb - 8} ${y(s.b).toFixed(1)}`} />
              <circle cx={xa + 8} cy={y(s.a)} r="2.2" />
              <circle cx={xb - 8} cy={y(s.b)} r="2.2" />
              <text className={s.focus ? "c-label strong" : "c-label ink"} x={xa} y={ya.get(s.name)! + 4} textAnchor="end">{s.name} {s.a}%</text>
              <text className={s.focus ? "c-label strong" : "c-label ink"} x={xb} y={yb.get(s.name)! + 4}>{s.b}%</text>
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export function Multiples() {
  const [at, setAt] = useState(-1);
  const max = Math.max(...MULTIPLES.flatMap((m) => m.data));
  const len = MULTIPLES[0].data.length;
  const month = (i: number) => {
    const k = MULTIPLES_T0.m + i;
    return `${MONTH[k % 12]} ${MULTIPLES_T0.y + Math.floor(k / 12)}`;
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(0, Math.min(len - 1, Math.floor(((e.clientX - box.left) / box.width) * len))));
  };
  return (
    <div className="multiples" data-probing={at >= 0}>
      {MULTIPLES.map((m) => (
        <figure key={m.name}>
          <figcaption>
            <span>{m.name}</span>
            {at >= 0 ? <span className="mult-at"><span className="dim">{month(at)}</span><b className="num">{m.data[at]}</b></span> : <b className="num">{m.data.reduce((a, v) => a + v, 0)}</b>}
          </figcaption>
          <svg className="wipe" viewBox={`0 0 ${len * 4} ${max}`} preserveAspectRatio="none" aria-hidden="true" onPointerMove={move} onPointerLeave={() => setAt(-1)}>
            {at >= 0 ? <rect className="mult-col" x={at * 4} y={0} width={4} height={max} /> : null}
            {m.data.map((v, i) => (
              <rect key={i} style={{ ["--k" as string]: i }} className={`mult${i >= 10 && i <= 12 ? " key" : ""}${i === at ? " at" : ""}`} x={i * 4 + 0.5} y={max - v} width={3} height={v} />
            ))}
          </svg>
        </figure>
      ))}
    </div>
  );
}

// Every ribbon on a path into or out of a node. Each pass follows one direction, so a trace upstream stays upstream.
function trace(start: string[], dir: "up" | "down", found = new Set<number>()) {
  const seen = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const id = queue.shift()!;
    FLOWS.forEach((f, i) => {
      if ((dir === "up" ? f.t : f.s) !== id) return;
      found.add(i);
      const next = dir === "up" ? f.s : f.t;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    });
  }
  return found;
}

export function MoneyFlow() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const { staged } = usePanel();
  const [lit, setLit] = useState<Set<number> | null>(null);
  const H = staged ? 620 : 380, top = 46, nodeW = 9, gap = [16, 30, 12];
  const lm = 150, rm = 168;
  const total = (id: string, side: "s" | "t") => FLOWS.filter((f) => f[side] === id).reduce((a, f) => a + f.v, 0);
  const value = (id: string) => Math.max(total(id, "s"), total(id, "t"));
  const cols = [0, 1, 2].map((c) => FLOW_NODES.filter((nd) => nd.col === c));
  const scale = Math.min(...cols.map((col, c) => (H - top - 8 - gap[c] * (col.length - 1)) / col.reduce((a, nd) => a + value(nd.id), 0)));
  const xs = [lm, (lm + w - rm - nodeW) / 2, w - rm - nodeW];
  const box = new Map<string, { x: number; y: number; h: number; out: number; in: number }>();
  cols.forEach((col, c) => {
    const height = col.reduce((a, nd) => a + value(nd.id) * scale, 0) + gap[c] * (col.length - 1);
    let y = top + (H - top - 8 - height) / 2;
    for (const nd of col) {
      const h = value(nd.id) * scale;
      box.set(nd.id, { x: xs[c], y, h, out: 0, in: 0 });
      y += h + gap[c];
    }
  });
  const order = new Map(FLOW_NODES.map((nd, i) => [nd.id, i]));
  const name = (id: string) => FLOW_NODES.find((nd) => nd.id === id)!.name;
  const hot = new Set(["wh", "ad"]);
  const ribbons = FLOWS.map((f, i) => ({ f, i }))
    .sort((p, q) => order.get(p.f.s)! - order.get(q.f.s)! || order.get(p.f.t)! - order.get(q.f.t)!)
    .map(({ f, i }) => {
      const a = box.get(f.s)!, b = box.get(f.t)!;
      const h = f.v * scale;
      const y0 = a.y + a.out, y1 = b.y + b.in;
      a.out += h; b.in += h;
      const x0 = a.x + nodeW, x1 = b.x, mx = (x0 + x1) / 2;
      return {
        f, i,
        hot: hot.has(f.t),
        d: `M${x0} ${y0}C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}V${y1 + h}C${mx} ${y1 + h} ${mx} ${y0 + h} ${x0} ${y0 + h}Z`,
        mid: `M${x0} ${y0 + h / 2}C${mx} ${y0 + h / 2} ${mx} ${y1 + h / 2} ${x1} ${y1 + h / 2}`,
      };
    });
  const nodeLit = (id: string) => !lit || FLOWS.some((f, i) => lit.has(i) && (f.s === id || f.t === id));
  const leave = () => { setLit(null); tip.hide(); };
  return (
    <div ref={ref} className="chart flow">
      {w > 0 ? (
        <svg width={w} height={H} data-probing={lit !== null} role="img" aria-label="Money flow from four sources through four vehicles to seven recipients, 2024 cycle">
          <defs>
            <clipPath id="flow-wipe"><rect className="flow-wipe" x="0" y="0" width={w} height={H} /></clipPath>
          </defs>
          {["Source", "Vehicle", "Recipient"].map((label, c) => (
            <text key={label} className="c-label flow-head" style={{ ["--col" as string]: c }} x={c === 0 ? xs[0] + nodeW : c === 1 ? xs[1] : xs[2]} y={11} textAnchor={c === 0 ? "end" : "start"}>{label}</text>
          ))}
          <g clipPath="url(#flow-wipe)">
          {ribbons.map((rb) => (
            <path
              key={rb.i} className={`ribbon${rb.hot ? " hot" : ""}${lit?.has(rb.i) ? " on" : ""}`} d={rb.d}
              onPointerEnter={() => setLit(trace([rb.f.t], "down", trace([rb.f.s], "up", new Set([rb.i]))))}
              onPointerMove={(e) => tip.show({ x: e.clientX, y: e.clientY }, (
                <>
                  <b>{name(rb.f.s)} to {name(rb.f.t)}</b>
                  <TipRow k="Amount" v={fmtMoney(rb.f.v)} strong />
                  <TipRow k={`Share of what ${name(rb.f.s)} paid out`} v={`${Math.round((rb.f.v / total(rb.f.s, "s")) * 100)}%`} />
                </>
              ))}
              onPointerLeave={leave}
            />
          ))}
          {ribbons.map((rb) => (
            <path key={`s${rb.i}`} className={`flow-stream${rb.hot ? " hot" : ""}${lit?.has(rb.i) ? " on" : ""}`} d={rb.mid} />
          ))}
          </g>
          {FLOW_NODES.map((nd) => {
            const bx = box.get(nd.id)!;
            const v = value(nd.id);
            return (
              <g
                key={nd.id} className={`flow-node sec-${nd.sector}${hot.has(nd.id) ? " hot" : ""}${nodeLit(nd.id) ? "" : " off"}${nd.ent ? " link" : ""}`}
                style={{ ["--col" as string]: nd.col }}
                onPointerEnter={(e) => {
                  setLit(trace([nd.id], "down", trace([nd.id], "up")));
                  tip.show(e.currentTarget.querySelector("rect")!, (
                    <>
                      <b>{nd.name}</b>
                      {nd.col > 0 ? <TipRow k="Received" v={fmtMoney(total(nd.id, "t"))} /> : null}
                      {nd.col < 2 ? <TipRow k="Paid out" v={fmtMoney(total(nd.id, "s"))} /> : null}
                    </>
                  ));
                }}
                onPointerLeave={leave}
                onClick={nd.ent ? () => { tip.hide(); ws.inspect(nd.ent!); } : undefined}
              >
                <rect x={bx.x} y={bx.y} width={nodeW} height={Math.max(1.5, bx.h)} />
                {nd.col === 0 ? (
                  <>
                    <text className="c-label ink" x={bx.x - 8} y={bx.y + bx.h / 2 - 1} textAnchor="end">{nd.name}</text>
                    <text className="c-label" x={bx.x - 8} y={bx.y + bx.h / 2 + 13} textAnchor="end">{fmtMoney(v)}</text>
                  </>
                ) : nd.col === 1 ? (
                  <text className="c-label ink halo" x={bx.x} y={bx.y - 6}>{nd.name} <tspan className="dim">{fmtMoney(v)}</tspan></text>
                ) : (
                  <text className={hot.has(nd.id) ? "c-label strong" : "c-label ink"} x={bx.x + nodeW + 8} y={bx.y + bx.h / 2 + 4}>{nd.name} <tspan className="dim">{fmtMoney(v)}</tspan></text>
                )}
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

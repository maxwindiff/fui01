import { CONNECTIONS, fmtMoney, LEAN, LEAN_FOCUS, SEATS, SPARK_CONTACTS, SPARK_MONEY, VOTES } from "../data";
import { Count, Ent, PartyChip, Spark, useSize } from "./primitives";
import portrait from "../assets/portrait.jpg";

function Portrait() {
  return (
    <figure className="portrait">
      <div className="portrait-frame">
        <img src={portrait} alt="Dana Whitcombe" width="96" height="116" />
        <svg viewBox="0 0 96 116" aria-hidden="true">
          <path className="portrait-marks" d="M0 9V0h9M87 0h9v9M96 107v9h-9M9 116H0v-9" />
        </svg>
      </div>
      <figcaption className="portrait-id">File photo, 2017</figcaption>
    </figure>
  );
}

export function PersonCard() {
  const max = Math.max(...CONNECTIONS.map((c) => c.v));
  return (
    <div className="person">
      <div className="person-top">
        <Portrait />
        <div className="person-head">
          <h3 className="person-name">Dana Whitcombe</h3>
          <p className="person-role">Senator for Arizona since 2019. Chairs the Subcommittee on Space Procurement.</p>
          <div className="tags">
            <PartyChip party="R" state="AZ" long />
            <span className="tag">Seat up in 2026</span>
            <span className="tag alert">3 open findings</span>
          </div>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>From this network</dt>
          <dd><b><Count to={1960} fmt={fmtMoney} /></b><Spark data={SPARK_MONEY} kind="bar" accent /></dd>
          <dd className="sub">2024 cycle, gifts and ads. Peak in Sep 2025.</dd>
        </div>
        <div>
          <dt>Logged contacts</dt>
          <dd><b><Count to={74} /></b><Spark data={SPARK_CONTACTS} /></dd>
          <dd className="sub">Office calendar and lobbying reports, 16 months.</dd>
        </div>
      </dl>
      <h4 className="sub-h">Strongest ties</h4>
      <ol className="ties">
        {CONNECTIONS.map((c) => (
          <li key={c.id} style={{ ["--k" as string]: CONNECTIONS.indexOf(c) * 3 }}>
            <Ent kind={c.kind} sector={c.sector} id={c.id}>{c.name}</Ent>
            <span className="ties-note">{c.note}</span>
            <span className="ties-bar"><i style={{ width: `${(c.v / max) * 100}%` }} /></span>
            <span className="num">{fmtMoney(c.v)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LeanAxis() {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const h = 96;
  const x = (v: number) => 8 + ((v + 1) / 2) * (w - 16);
  const med = (p: string) => {
    const xs = LEAN.filter((d) => d.party === p).map((d) => d.x).sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)];
  };
  return (
    <div ref={ref} className="chart">
      {w > 0 ? (
        <svg className="wipe" width={w} height={h} role="img" aria-label="Voting record position of each senator, Whitcombe at plus 0.38">
          <path className="c-axis" d={`M8 50.5H${w - 8}`} />
          <path className="c-tick" d={`M${x(0)} 44V57`} />
          {LEAN.map((d, i) => (
            <path key={i} className={`rug party-${d.party}`} d={`M${x(d.x).toFixed(1)} 36V50`} />
          ))}
          {(["D", "R"] as const).map((p) => (
            <g key={p}>
              <path className={`rug-med party-${p}`} d={`M${x(med(p))} 26V50`} />
              <text className="c-label" x={x(med(p))} y={19} textAnchor="middle">{p === "D" ? "Democrat median" : "Republican median"}</text>
            </g>
          ))}
          <path className="c-focus-mark" d={`M${x(LEAN_FOCUS)} 53l5 9h-10z`} />
          <text className="c-label strong" x={x(LEAN_FOCUS)} y={76} textAnchor="middle">Whitcombe +0.38</text>
          <text className="c-label" x={8} y={92}>Most liberal</text>
          <text className="c-label" x={x(0)} y={92} textAnchor="middle">0</text>
          <text className="c-label" x={w - 8} y={92} textAnchor="end">Most conservative</text>
        </svg>
      ) : null}
    </div>
  );
}

const PARTY = { D: "Democrat", R: "Republican", I: "Independent" };

function Hemicycle() {
  const rows = [5, 7, 9];
  const radii = [36, 58, 80];
  const pos = rows.flatMap((n, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = Math.PI * (1 - (i + 0.5) / n);
      return { a, x: 96 + Math.cos(a) * radii[r], y: 92 - Math.sin(a) * radii[r] };
    }),
  ).sort((p, q) => q.a - p.a);
  return (
    <svg className="hemi" viewBox="0 0 192 100" role="img" aria-label="Subcommittee seats: 9 Democrat, 1 Independent, 11 Republican. 10 seats received money from this network.">
      <path className="c-axis" d="M4 96.500H188" />
      {pos.map((p, i) => {
        const s = SEATS[i];
        return (
          <g key={i} style={{ ["--k" as string]: i }} className={`seat party-${s.party}${s.focus ? " focus" : ""}`} data-tip-now="" data-tip={`${s.focus ? "Dana Whitcombe, chair. " : ""}${PARTY[s.party]} seat${s.funded ? ", took money from this network" : ", no money from this network"}`}>
            {s.funded ? <circle className="seat-ring" cx={p.x} cy={p.y} r="9.6" /> : null}
            <circle className="seat-dot" cx={p.x} cy={p.y} r="6" />
            {s.focus ? <path className="seat-mark" d={`M${p.x - 3} ${p.y}h6M${p.x} ${p.y - 3}v6`} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

function VoteStrip() {
  return (
    <svg className="votes wipe" viewBox={`0 0 ${VOTES.length * 6} 30`} preserveAspectRatio="none" role="img" aria-label="Last 56 votes, with or against party">
      <path className="c-axis" d={`M0 15H${VOTES.length * 6}`} vectorEffect="non-scaling-stroke" />
      {VOTES.map((v, i) =>
        <g key={i} style={{ ["--k" as string]: i }} data-tip-now="" data-tip={`Vote ${i + 1} of ${VOTES.length}: ${v.v === 0 ? "absent" : v.v > 0 ? "with the party" : "against the party"}${v.key ? ", on S. 2114" : ""}`}>
          <rect className="c-hit" x={i * 6} y={0} width={6} height={30} />
          {v.v === 0
            ? <rect className="vote absent" x={i * 6 + 1.5} y={14} width={2} height={2} />
            : <rect className={`vote${v.key ? " key" : ""}${v.v < 0 ? " against" : ""}`} x={i * 6 + 1} y={v.v > 0 ? 3 : 15} width={3} height={12} />}
        </g>,
      )}
    </svg>
  );
}

export function Affiliation() {
  return (
    <div className="affil">
      <section>
        <h4 className="sub-h">Position in the Senate, by voting record</h4>
        <LeanAxis />
      </section>
      <section className="affil-row">
        <Hemicycle />
        <div>
          <h4 className="sub-h">Subcommittee on Space Procurement</h4>
          <p className="seat-count"><PartyChip party="D" /> <b className="num">9</b> <PartyChip party="I" /> <b className="num">1</b> <PartyChip party="R" /> <b className="num">11</b></p>
          <p className="note">Ringed seats took money from this network: 6 of 11 Republicans, 3 of 9 Democrats and the Independent.</p>
        </div>
      </section>
      <section>
        <h4 className="sub-h">Last 56 votes</h4>
        <VoteStrip />
        <p className="note">Marked votes concern S. 2114. She broke with her party on one.</p>
      </section>
    </div>
  );
}

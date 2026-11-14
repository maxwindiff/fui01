import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Kind, Party, Sector } from "../data";

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.w - width) < 0.5 && Math.abs(s.h - height) < 0.5 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const HOLLOW: Kind[] = ["official", "agency"];

export function Glyph({ kind, sector, size = 12 }: { kind: Kind; sector: Sector; size?: number }) {
  const hollow = HOLLOW.includes(kind);
  const cls = `glyph sec-${sector}${hollow ? " hollow" : ""}`;
  const shape = (() => {
    switch (kind) {
      case "corp": return <rect x="2.2" y="2.2" width="9.6" height="9.6" />;
      case "firm": return <path d="M7 1.2 12.8 7 7 12.8 1.2 7Z" />;
      case "pac": return <path d="M7 1.6 12.6 11.6H1.4Z" />;
      case "agency": return <path d="M7 1.3 12 4.15v5.7L7 12.7 2 9.85v-5.7Z" />;
      case "event": return <path className="spoke" d="M7 1.2v11.6M2 4.1l10 5.8M12 4.1 2 9.9" />;
      default: return <circle cx="7" cy="7" r="4.9" />;
    }
  })();
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      {shape}
    </svg>
  );
}

export function Ent({ kind, sector, children }: { kind: Kind; sector: Sector; children: ReactNode }) {
  return (
    <span className="ent">
      <Glyph kind={kind} sector={sector} />
      <span>{children}</span>
    </span>
  );
}

const PARTY_NAME: Record<Party, string> = { D: "Democrat", R: "Republican", I: "Independent" };
export function PartyChip({ party, state, long }: { party: Party; state?: string; long?: boolean }) {
  return (
    <span className={`party party-${party}`} title={PARTY_NAME[party]}>
      <i />
      {long ? PARTY_NAME[party] : party}
      {state ? `-${state}` : ""}
    </span>
  );
}

export function Spark({ data, w = 96, h = 22, kind = "line", accent }: { data: number[]; w?: number; h?: number; kind?: "line" | "bar"; accent?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data, 0);
  const px = (i: number) => 2 + (i / (data.length - 1)) * (w - 4);
  const py = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 5);
  const peak = data.indexOf(max);
  if (kind === "bar") {
    const bw = Math.max(1, (w - 4) / data.length - 1);
    return (
      <svg className={`spark${accent ? " accent" : ""}`} width={w} height={h} aria-hidden="true">
        {data.map((v, i) => (
          <rect key={i} className={i === peak ? "spark-peak" : "spark-bar"} x={2 + (i * (w - 4)) / data.length} y={py(v)} width={bw} height={Math.max(0.75, h - 2 - py(v))} />
        ))}
      </svg>
    );
  }
  return (
    <svg className={`spark${accent ? " accent" : ""}`} width={w} height={h} aria-hidden="true">
      <path className="spark-line" pathLength={1} d={data.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join("")} />
      <circle className="spark-peak" cx={px(peak)} cy={py(max)} r="1.9" />
      <circle className="spark-end" cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="1.6" />
    </svg>
  );
}

export function Panel({
  fig, title, meta, tools, span = 12, className = "", children, flush, style,
}: {
  fig: string; title: string; meta?: ReactNode; tools?: ReactNode; span?: number; className?: string; children: ReactNode; flush?: boolean; style?: CSSProperties;
}) {
  return (
    <section className={`panel ${className}`} style={{ gridColumn: `span ${span}`, ["--i" as string]: parseInt(fig, 10), ...style }}>
      <header className="panel-h">
        <span className="panel-fig" aria-hidden="true">{fig}</span>
        <h2 className="panel-title">{title}</h2>
        {meta ? <span className="panel-meta">{meta}</span> : null}
        {tools ? <div className="panel-tools">{tools}</div> : null}
      </header>
      <div className={`panel-b${flush ? " flush" : ""}`}>{children}</div>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { entity, GRAPH } from "../data";
import type { Kind, Party, Sector } from "../data";
import { motion } from "../motion";
import { tip } from "../tip";
import { useWs, ws } from "../workspace";
import { PanelIcon } from "../icons";

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

const KIND_NAME: Record<Kind, string> = { official: "Official", person: "Person", corp: "Company", firm: "Lobbying firm", pac: "PAC", agency: "Agency or committee", event: "Event" };

export function EntCard({ id }: { id: string }) {
  const e = entity(id)!;
  const ties = GRAPH.ties.filter((t) => t.s === id || t.t === id).length;
  return (
    <>
      <span className="tip-ent"><Glyph kind={e.kind} sector={e.sector} size={13} /><b>{e.name}</b></span>
      {e.role ? <span>{e.role}</span> : null}
      <span className="tip-foot">{KIND_NAME[e.kind]}, {ties} ties</span>
    </>
  );
}

// With an id the name becomes a control: pointing at it shows a card and selecting it opens the dossier.
export function Ent({ kind, sector, id, bare, children }: { kind: Kind; sector: Sector; id?: string; bare?: boolean; children: ReactNode }) {
  const on = useWs((s) => s.trail[s.trail.length - 1] === id);
  if (!id) {
    return (
      <span className="ent">
        <Glyph kind={kind} sector={sector} />
        <span>{children}</span>
      </span>
    );
  }
  return (
    <button
      type="button" className={`ent link${on ? " on" : ""}`}
      onClick={(e) => { e.stopPropagation(); tip.hide(); ws.inspect(id); }}
      onPointerEnter={(e) => tip.show(e.currentTarget, <EntCard id={id} />, { card: true, wait: true })}
      onPointerLeave={tip.hide}
    >
      {bare ? null : <Glyph kind={kind} sector={sector} />}
      <span>{children}</span>
    </button>
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
          <rect key={i} className={i === peak ? "spark-bar spark-peak" : "spark-bar"} style={{ ["--k" as string]: i }} x={2 + (i * (w - 4)) / data.length} y={py(v)} width={bw} height={Math.max(0.75, h - 2 - py(v))} />
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

const PanelCtx = createContext({ staged: false, plays: 0 });
export const usePanel = () => useContext(PanelCtx);

// One observer serves every panel, so panels that come into view together arrive in the same batch and can be staggered.
type Seen = (visible: boolean, order: number) => void;
const watchers = new Map<Element, Seen>();
const inView = new Set<string>();
let observer: IntersectionObserver | null = null;
function watch(el: Element, fn: Seen) {
  observer ??= new IntersectionObserver((batch) => {
    let k = 0;
    for (const e of batch) watchers.get(e.target)?.(e.isIntersecting, e.isIntersecting ? k++ : 0);
  }, { threshold: 0.05 });
  watchers.set(el, fn);
  observer.observe(el);
  return () => { watchers.delete(el); observer!.unobserve(el); };
}

// A panel renders at its place on the board, on the stage, or as a tile in the rail beside the stage.
// Its entry plays when it first comes into view ("frame") and again when it goes onto the stage ("content").
export function Panel({
  fig, title, meta, glance, ask, span = 12, children, flush,
}: {
  fig: string; title: string; meta?: ReactNode; glance?: ReactNode; ask?: string; span?: number; children: ReactNode; flush?: boolean;
}) {
  const staged = useWs((s) => s.stage === fig);
  const tile = useWs((s) => s.stage !== null && s.stage !== fig);
  const replays = useWs((s) => s.replays);
  const el = useRef<HTMLElement>(null);
  const [enter, setEnter] = useState<"frame" | "content" | null>(null);
  const [pending, setPending] = useState(motion.level >= 2);
  const [order, setOrder] = useState(0);
  const [plays, setPlays] = useState(0);
  const st = useRef({ seen: false, visible: false, tile, staged, timer: 0, raf: 0 });
  st.current.tile = tile;
  st.current.staged = staged;

  const arm = useCallback((kind: "frame" | "content", k: number) => {
    const s = st.current;
    if (motion.level < 2) return;
    s.seen = true;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    setEnter(null);
    // The attribute goes on a frame later, which restarts the animations when an entry is still running.
    s.raf = requestAnimationFrame(() => {
      setPending(false);
      setOrder(k);
      setEnter(kind);
      setPlays((n) => n + 1);
      s.timer = window.setTimeout(() => setEnter(null), 5200);
    });
  }, []);

  // The observer reports a panel as hidden while its own entry clips it to nothing, so the panel's box decides.
  const onscreen = useCallback(() => {
    const r = el.current!.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }, []);

  useEffect(() => {
    const s = st.current;
    const stop = watch(el.current!, (hit, k) => {
      const on = hit || onscreen();
      s.visible = on;
      if (on) inView.add(fig); else inView.delete(fig);
      if (s.tile) return;
      if (on && !s.seen) arm("frame", k);
      if (!on && motion.level === 3 && s.seen) { s.seen = false; setPending(true); }
    });
    return () => { stop(); inView.delete(fig); clearTimeout(s.timer); cancelAnimationFrame(s.raf); };
  }, [fig, arm, onscreen]);

  const was = useRef({ tile, staged, replays });
  useEffect(() => {
    const s = st.current, prev = was.current;
    was.current = { tile, staged, replays };
    if (motion.level < 2) { setPending(false); setEnter(null); s.seen = true; return; }
    if (replays !== prev.replays) {
      s.seen = false;
      if (onscreen() && !tile) arm(staged ? "content" : "frame", [...inView].filter((f) => f < fig).length);
      else setPending(true);
    } else if (staged && !prev.staged) arm("content", 0);
    else if (prev.tile && !tile && onscreen() && !s.seen) arm("content", 0);
  }, [tile, staged, replays, fig, arm, onscreen]);

  const ctx = useMemo(() => ({ staged, plays }), [staged, plays]);
  // In a tight board the wide panel of a pair gives up a column and the narrow one gains it.
  const tight = span === 8 ? 7 : span === 4 ? 5 : span < 12 ? 6 : 12;
  const style = { ["--span"]: span, ["--span-tight"]: tight, viewTransitionName: `panel-${fig}`, ["--i"]: order } as CSSProperties;
  return (
    <section
      ref={el} className={`panel${staged ? " staged" : ""}${tile ? " tile" : ""}`} data-panel={fig} style={style}
      data-enter={enter ?? undefined} data-pending={pending && !enter ? "" : undefined}
      onClick={tile ? () => ws.setStage(fig) : undefined}
    >
      <header className="panel-h">
        <PanelIcon fig={fig} />
        <h2 className="panel-title" data-note={tile ? undefined : "entry"}>{title}</h2>
        {meta && !tile ? <span className="panel-meta">{meta}</span> : null}
        {ask && !tile ? (
          <button type="button" className="panel-ask" aria-label={`Ask: ${ask}`} data-tip="Ask about this on the Ask page" onClick={(e) => { e.stopPropagation(); ws.askAbout(ask); }}>
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 4.5 6.5 7.5 3 10.5M7.5 11h4" /></svg>
          </button>
        ) : null}
        <button
          type="button" className="panel-x" aria-label={staged ? `Return ${title} to the board` : `Open ${title} at full size`}
          data-tip={staged ? "Return to the board (Esc)" : "Open at full size"} data-note="full"
          onClick={(e) => { e.stopPropagation(); ws.setStage(staged ? null : fig); }}
        >
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            {staged ? <path d="M5.5 1.5v4h-4M8.5 12.5v-4h4" /> : <path d="M8.5 1.5h4v4M5.5 12.5h-4v-4" />}
          </svg>
        </button>
        {tile && glance ? <p className="panel-glance">{glance}</p> : null}
      </header>
      <PanelCtx.Provider value={ctx}>
        <div className={`panel-b${flush ? " flush" : ""}`} inert={tile}>{children}</div>
      </PanelCtx.Provider>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
    </section>
  );
}

// A figure that counts up from zero each time its panel plays an entry, at the Lively level.
export function Count({ to, fmt = (v) => String(Math.round(v)) }: { to: number; fmt?: (v: number) => string }) {
  const { plays } = usePanel();
  const [v, setV] = useState(to);
  useEffect(() => {
    if (motion.level < 3 || !plays) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + 300;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / 900));
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [plays, to]);
  return <>{fmt(v)}</>;
}

// A region that opens in place. The row template animates from 0fr to 1fr, so the height needs no measuring.
export function Fold({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`fold ${className}`} data-open={open}>
      <div inert={!open}>{children}</div>
    </div>
  );
}

// Moves reordered children from their old places to their new ones. capture() goes before the state change.
export function useFlip<T extends HTMLElement>(order: unknown) {
  const ref = useRef<T>(null);
  const before = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    if (!was || !ref.current || motion.level === 0) return;
    const css = getComputedStyle(document.documentElement);
    const duration = parseFloat(css.getPropertyValue("--dur-sort")) || 320;
    const easing = css.getPropertyValue("--ease").trim() || "ease";
    [...ref.current.querySelectorAll<HTMLElement>("[data-flip]")].forEach((el, k) => {
      const dy = (was.get(el.dataset.flip!) ?? el.offsetTop) - el.offsetTop;
      if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration, delay: k * 14, easing, fill: "backwards" });
    });
  }, [order]);
  const capture = () => {
    before.current = new Map([...(ref.current?.querySelectorAll<HTMLElement>("[data-flip]") ?? [])].map((el) => [el.dataset.flip!, el.offsetTop]));
  };
  return [ref, capture] as const;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; tip?: string; note?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} data-tip={o.tip} data-note={o.note} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

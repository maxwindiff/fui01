import { useEffect, useRef, useState } from "react";
import { getGpu, reducedMotion, Scene, TOP_DOWN } from "../gpu/scene";
import { buildMapBuffers, loadMap, MAP_H, MAP_W, spikeHeight, stateAt } from "../gpu/map";
import type { MapModel } from "../gpu/map";
import { fmtMoney, MAP_EVENTS, STATE_GIVING } from "../data";
import { rgba } from "../themes";
import type { Theme } from "../themes";
import { Segmented } from "./primitives";

interface Tip { x: number; y: number; name: string; value: number }
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function MapView({ theme }: { theme: Theme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const deep = theme.gpu.deep;
  const [tip, setTip] = useState<Tip | null>(null);
  const [space, setSpace] = useState<"flat" | "deep">(deep ? "deep" : "flat");
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const api = useRef<{ setDeep: (on: boolean) => void } | null>(null);

  useEffect(() => {
    let gone = false;
    let scene: Scene | null = null;
    let model: MapModel | null = null;
    let hover = -1;
    let on = !!deep;
    let lift = on ? 1 : 0;
    let glide: { from: number; to: number; t0: number } | null = null;
    let idle = 0;
    let hovering = false;
    let drag: { x: number; y: number } | null = null;
    let turn = 0, tilt = 0;
    const el = canvas.current!;
    const labelBox = labels.current!;
    const nodes: { el: HTMLElement; x: number; y: number; z: number; side: string }[] = [];

    const place = () => {
      if (!scene) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const sway = deep && on && !reducedMotion ? deep.sway * 0.5 * Math.sin((idle / deep.swayPeriod) * Math.PI * 2) : 0;
      const pitch = TOP_DOWN + ((deep?.mapPitch ?? TOP_DOWN) + tilt - TOP_DOWN) * lift;
      const k = 1 + 0.04 * lift;
      scene.lift = lift;
      scene.aperture = (deep?.aperture ?? 0) * 0.6 * lift;
      scene.fogFloor = 1 - (1 - (deep?.fogFloor ?? 1)) * 0.7 * lift;
      scene.cam = {
        tx: MAP_W / 2 - 14, ty: MAP_H / 2 + 6 + 30 * lift, tz: 24 * lift,
        yaw: ((deep?.mapYaw ?? 0) + turn + sway) * lift, pitch: Math.max(0.25, Math.min(TOP_DOWN, pitch)),
        scale: Math.min(w / (MAP_W + 170), h / (MAP_H + 30)) * k, fov: scene.cam.fov,
      };
      scene.dirty = true;
      const fr = scene.frustum();
      for (const n of nodes) {
        const [sx, sy] = scene.project(n.x, n.y, n.z, fr);
        n.el.style.transform = n.side === "l"
          ? `translate(${sx - 9}px, ${sy}px) translate(-100%, -50%)`
          : n.side === "t"
            ? `translate(${sx}px, ${sy - 24}px) translate(-50%, -100%)`
            : n.side === "b"
              ? `translate(${sx}px, ${sy + 8}px) translate(-50%, 0)`
              : n.side === "s"
                ? `translate(${sx + 6}px, ${sy}px) translate(0, -50%)`
                : n.side === "e"
                  ? `translate(${sx + 20}px, ${sy}px) translate(0, -50%)`
                : `translate(${sx + 9}px, ${sy}px) translate(0, -50%)`;
      }
    };
    const push = () => {
      if (!scene || !model) return;
      const b = buildMapBuffers(model, theme, hover);
      scene.setLayer(0, b.quads.data, b.quads.count);
      scene.setLayer(1, b.dots, b.dotCount);
      scene.setLayer(2, b.lines.data, b.lines.count);
      scene.setLayer(3, b.top, b.topCount);
      return b;
    };
    const move = (e: PointerEvent) => {
      if (!scene || !model) return;
      if (drag) {
        turn -= (e.clientX - drag.x) * 0.005;
        tilt = Math.max(-0.4, Math.min(0.6, tilt + (e.clientY - drag.y) * 0.004));
        drag = { x: e.clientX, y: e.clientY };
        place();
        return;
      }
      const g = scene.ground(e.offsetX, e.offsetY);
      const s = g ? stateAt(model, g[0], g[1]) : -1;
      if (s !== hover) { hover = s; push(); }
      setTip(s >= 0 ? { x: e.offsetX, y: e.offsetY, name: model.states[s].name, value: model.states[s].value } : null);
    };
    const down = (e: PointerEvent) => {
      if (!deep || !on) return;
      el.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { drag = null; };
    const enter = () => { hovering = true; };
    const leave = () => {
      hovering = false;
      if (hover !== -1) { hover = -1; push(); }
      setTip(null);
    };
    const ro = new ResizeObserver(place);

    api.current = {
      setDeep(next) {
        on = next;
        if (reducedMotion) { lift = next ? 1 : 0; place(); return; }
        glide = { from: lift, to: next ? 1 : 0, t0: performance.now() };
      },
    };

    Promise.all([getGpu(), loadMap()]).then(([gpu, m]) => {
      if (gone) return;
      model = m;
      scene = new Scene(gpu, el, [
        { kind: "quads" },
        { kind: "marks", blend: theme.gpu.additive ? "additive" : "premultiplied" },
        { kind: "segs" },
        { kind: "marks" },
      ]);
      scene.bg = rgba(theme.gpu.vizBg);
      scene.animated = true;
      scene.onTick = (now, dt) => {
        if (glide) {
          const t = Math.min(1, (now - glide.t0) / theme.motion.morph);
          lift = glide.from + (glide.to - glide.from) * easeInOut(t);
          if (t >= 1) glide = null;
          place();
        } else if (deep && on && !hovering && !drag && !reducedMotion) {
          idle += dt / 1000;
          place();
        }
      };
      const add = (cls: string, text: string, x: number, y: number, z: number, side: string) => {
        const span = document.createElement("span");
        span.className = cls;
        span.textContent = text;
        labelBox.appendChild(span);
        nodes.push({ el: span, x, y, z, side });
      };
      for (const c of Object.values(m.cities)) add("map-label", c.name, c.x, c.y, 0, c.side);
      for (const ev of MAP_EVENTS) add("map-label event", ev.text, m.cities[ev.city].x, m.cities[ev.city].y, deep?.form === "armillary" ? 80 : 0, deep?.form === "armillary" ? "e" : "t");
      const b = push()!;
      if (deep?.form === "strata")
        for (const i of [...b.spikes].sort((p, q) => m.states[q].value - m.states[p].value).slice(0, 7))
          add("map-label spike", `${m.states[i].code} ${fmtMoney(m.states[i].value)}`, m.states[i].cx, m.states[i].cy, spikeHeight(m, i), "s");
      place();
      scene.playReveal(theme.motion.reveal);
      ro.observe(el);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      setStatus("ready");
    }).catch((err) => {
      console.error(err);
      if (!gone) setStatus("unsupported");
    });

    return () => {
      gone = true;
      ro.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      labelBox.replaceChildren();
      scene?.dispose();
    };
  }, [theme]);

  const all = Object.entries(STATE_GIVING);
  const top = all.slice(0, 8);
  const sum = (xs: [string, number][]) => xs.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="map-wrap">
      <div className="viz map" data-space={space}>
        <canvas ref={canvas} aria-label="Map of giving by state" />
        <div className="viz-labels" ref={labels} />
        {status === "unsupported" ? <p className="viz-msg">This view draws with WebGPU, which this browser does not provide.</p> : null}
        {deep ? (
          <div className="viz-tr">
            <Segmented label="Arrangement" value={space} onChange={(v) => { setSpace(v); api.current?.setDeep(v === "deep"); }} options={[{ value: "flat", label: "Flat" }, { value: "deep", label: deep.form === "strata" ? "Spikes" : "Terrain" }]} />
          </div>
        ) : null}
        {tip ? (
          <div className="tip" style={{ transform: `translate(${tip.x + 14}px, ${tip.y + 14}px)` }}>
            <b>{tip.name}</b>
            <span>{tip.value ? fmtMoney(tip.value) : "No recorded giving"}</span>
          </div>
        ) : null}
      </div>
      <aside className="map-side">
        <h4 className="sub-h">Largest donor states</h4>
        <ol className="rank">
          {top.map(([code, v]) => (
            <li key={code}>
              <span className="num">{code}</span>
              <span className="rank-bar"><i style={{ width: `${(v / top[0][1]) * 100}%` }} /></span>
              <span className="num">{fmtMoney(v)}</span>
            </li>
          ))}
        </ol>
        <p className="note">Eight states gave {Math.round((sum(top) / sum(all)) * 100)}% of the {fmtMoney(sum(all))} total.</p>
        <ul className="map-key">
          <li className="key-dots"><span><i /><i /><i /></span>{deep?.form === "armillary" ? "Dot height and size are giving" : deep?.form === "strata" ? "Spike height is giving" : "Dot size is giving, $6K to $2.1M"}</li>
          <li className="key-line money"><i />Transfer between cities</li>
          <li className="key-ring"><i />Event</li>
        </ul>
      </aside>
    </div>
  );
}

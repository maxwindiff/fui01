import { useEffect, useRef, useState } from "react";
import { getGpu, Scene, TOP_DOWN } from "../gpu/scene";
import { motion } from "../motion";
import { buildMapBuffers, loadMap, MAP_H, MAP_W, spikeHeight, stateAt } from "../gpu/map";
import type { MapEmph, MapModel } from "../gpu/map";
import { fmtMoney, MAP_EVENTS, MAP_FLOWS, STATE_GIVING, STATE_IDS } from "../data";
import { board, getBoard } from "../ask/board";
import { emphasis, useLinks } from "../links";
import { rgba } from "../themes";
import type { Theme } from "../themes";
import { Segmented } from "./primitives";
import { tip } from "../tip";
import { useWs } from "../workspace";

// The map's states and arcs by the classes their gifts would take, as alphas for the GPU.
let codes: string[] = [];
function emphOf(links: ReturnType<typeof useLinks>, model: MapModel | null): MapEmph | null {
  if (model) codes = model.states.map((s) => s.code);
  if (!links.root || !codes.length) return null;
  return {
    state: Float32Array.from(codes, (c) => emphasis(links.mark(STATE_IDS[c] ?? []), links.root).alpha),
    arc: Float32Array.from(MAP_FLOWS, (f) => emphasis(links.mark(f.ids), links.root).alpha),
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function MapView({ theme }: { theme: Theme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const deep = theme.gpu.deep;
  const [lit, setLit] = useState<string | null>(null);
  const [space, setSpace] = useState<"flat" | "deep">("deep");
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const api = useRef<{ setDeep: (on: boolean) => void; light: (code: string | null) => void; replay: () => void; emph: (e: MapEmph | null) => void } | null>(null);
  const links = useLinks("04");
  const linksRef = useRef(links);
  linksRef.current = links;
  const replays = useWs((s) => s.replays);

  useEffect(() => {
    let gone = false;
    let scene: Scene | null = null;
    let model: MapModel | null = null;
    let hover = -1;
    let emph: MapEmph | null = null;
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
      const sway = deep && on && motion.level >= 2 ? deep.sway * (motion.level === 3 ? 0.9 : 0.5) * Math.sin((idle / deep.swayPeriod) * Math.PI * 2) : 0;
      const pitch = TOP_DOWN + ((deep?.mapPitch ?? TOP_DOWN) + tilt - TOP_DOWN) * lift;
      const k = 1 + ((deep?.mapScale ?? 1.04) - 1) * lift;
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
      const b = buildMapBuffers(model, theme, hover, emph);
      scene.setLayer("quads", b.quads.data, b.quads.count);
      scene.setLayer("dots", b.dots, b.dotCount);
      scene.setLayer("lines", b.lines.data, b.lines.count);
      scene.setLayer("shadows", b.shadows.data, b.shadows.count);
      scene.setLayer("boxes", b.boxes.data, b.boxes.count);
      scene.setLayer("arcs", b.arcs.data, b.arcs.count);
      scene.setLayer("top", b.top, b.topCount);
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
      if (s !== hover) {
        hover = s;
        push();
        const code = s >= 0 ? model.states[s].code : null;
        setLit(code);
        board.hover(code && STATE_IDS[code] ? { ids: STATE_IDS[code], from: "mark", at: "04" } : null);
      }
      if (s < 0) { tip.hide(); return; }
      const st = model.states[s];
      tip.show({ x: e.clientX, y: e.clientY }, <><b>{st.name}</b><span>{st.value ? fmtMoney(st.value) : "No recorded giving"}</span></>);
    };
    let pressed: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      pressed = { x: e.clientX, y: e.clientY };
      if (!deep || !on) return;
      el.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY };
    };
    // A click without a drag selects the gifts from the state under the pointer.
    const up = (e: PointerEvent) => {
      drag = null;
      if (!pressed || Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 4 || !model) return;
      pressed = null;
      const st = hover >= 0 ? model.states[hover] : null;
      const ids = st ? STATE_IDS[st.code] : undefined;
      const sel = getBoard().sel;
      if (!st || !ids || (sel.from === "04" && sel.label === st.name)) board.clearSelection();
      else board.select({ ids, label: st.name, from: "04" });
    };
    const enter = () => { hovering = true; };
    const leave = () => {
      hovering = false;
      if (hover !== -1) { hover = -1; push(); }
      setLit(null);
      board.hover(null);
      tip.hide();
    };
    const ro = new ResizeObserver(place);

    api.current = {
      setDeep(next) {
        on = next;
        if (motion.level === 0) { lift = next ? 1 : 0; place(); return; }
        glide = { from: lift, to: next ? 1 : 0, t0: performance.now() };
      },
      replay() { scene?.playReveal(theme.motion.reveal); },
      emph(e) { emph = e; push(); },
      light(code) {
        const next = code && model ? model.states.findIndex((st) => st.code === code) : -1;
        if (next !== hover) { hover = next; push(); }
        setLit(code);
      },
    };

    Promise.all([getGpu(), loadMap()]).then(([gpu, m]) => {
      if (gone) return;
      model = m;
      const g = theme.gpu;
      scene = new Scene(gpu, el, [
        { kind: "quads", name: "quads" },
        { kind: "marks", name: "dots", blend: g.additive ? "additive" : "premultiplied" },
        { kind: "segs", name: "lines", blend: g.additiveBase ? "additive" : "premultiplied", glow: (g.glow ?? 0) * (g.additiveBase ? 0.7 : 0) },
        ...(g.block ? [{ kind: "quads", name: "shadows", blend: "darken" }, { kind: "boxes", name: "boxes" }] as const : []),
        { kind: "segs", name: "arcs", blend: g.additive ? "additive" : "premultiplied", glow: g.glow },
        { kind: "marks", name: "top" },
      ], { solid: !!g.block });
      if (deep?.fov) scene.cam.fov = deep.fov;
      scene.bg = rgba(theme.gpu.vizBg);
      scene.animated = true;
      scene.onTick = (now, dt) => {
        if (glide) {
          const t = Math.min(1, (now - glide.t0) / theme.motion.morph);
          lift = glide.from + (glide.to - glide.from) * easeInOut(t);
          if (t >= 1) glide = null;
          place();
        } else if (deep && on && !hovering && !drag && motion.level >= 2) {
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
      emph = emphOf(linksRef.current, m);
      const b = push()!;
      // At the low angle of a relief New York would sit on top of Washington, so its label goes above the mark.
      for (const [id, c] of Object.entries(m.cities)) add("map-label", c.name, c.x, c.y, b.cityZ[id], deep?.form === "relief" && id === "nyc" ? "t" : c.side);
      for (const ev of MAP_EVENTS) add("map-label event", ev.text, m.cities[ev.city].x, m.cities[ev.city].y, deep?.form === "armillary" ? 80 : b.cityZ[ev.city], deep?.form === "armillary" ? "e" : "t");
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

  useEffect(() => {
    if (replays) api.current?.replay();
  }, [replays]);
  useEffect(() => { if (status === "ready") api.current?.emph(emphOf(links, null)); }, [links, status]);

  const all = Object.entries(STATE_GIVING).sort((a, b) => b[1] - a[1]);
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
            <Segmented label="Arrangement" value={space} onChange={(v) => { setSpace(v); api.current?.setDeep(v === "deep"); }} options={[{ value: "flat", label: "Flat" }, { value: "deep", label: deep.mapLabel, note: "morph rest" }]} />
          </div>
        ) : null}
      </div>
      <aside className="map-side" data-lk={links.root}>
        <h4 className="sub-h" data-note="linked">Largest donor states</h4>
        <ol className="rank">
          {top.map(([code, v]) => (
            <li
              key={code} style={{ ["--k" as string]: top.findIndex(([c]) => c === code) * 2 }} className={`${links.mark(STATE_IDS[code] ?? [])}${lit === code ? " on" : ""}`}
              onPointerEnter={() => { api.current?.light(code); board.hover({ ids: STATE_IDS[code] ?? [], from: "mark", at: "04" }); }}
              onPointerLeave={() => { api.current?.light(null); board.hover(null); }}
              onClick={() => links.on(STATE_IDS[code] ?? [], code).onClick()}
            >
              <span className="num">{code}</span>
              <span className="rank-bar"><i style={{ width: `${(v / top[0][1]) * 100}%` }} /></span>
              <span className="num">{fmtMoney(v)}</span>
            </li>
          ))}
        </ol>
        <p className="note">Eight states gave {Math.round((sum(top) / sum(all)) * 100)}% of the {fmtMoney(sum(all))} total.</p>
        <ul className="map-key">
          <li className="key-dots"><span><i /><i /><i /></span>{deep.mapKey}</li>
          <li className="key-line money" data-note="money"><i />Transfer</li>
          <li className="key-ring"><i />Event</li>
        </ul>
      </aside>
    </div>
  );
}

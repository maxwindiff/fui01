import { useEffect, useRef, useState } from "react";
import { getGpu, gpuState, Scene, TOP_DOWN } from "../gpu/scene";
import { motion } from "../motion";
import type { Camera } from "../gpu/scene";
import { buildCoreModel, buildNetBuffers, buildStressModel, pick } from "../gpu/network";
import type { Emph, NetModel } from "../gpu/network";
import { rgba } from "../themes";
import type { RGBA, Theme } from "../themes";
import { Glyph, Segmented, usePanel } from "./primitives";
import type { Kind, Sector } from "../data";
import { board, useBoard } from "../ask/board";
import { cssColor, emphasis, useLinks } from "../links";
import { useWs, ws } from "../workspace";

type Density = "case" | "5k" | "100k";
interface Readout { id?: string; name: string; role?: string; ties: number }
interface Stats { n: number; m: number; segs: number }
interface Pose { cam: Camera; lift: number }
type Box = [number, number, number, number];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class NetController {
  scene: Scene;
  model!: NetModel;
  selected = -1;
  deepOn: boolean;
  private deep: Theme["gpu"]["deep"];
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private hovering = false;
  private hovered = -1;
  private lk: (id: string) => string = () => "";
  private tween: { from: Pose; to: Pose; t0: number; ms: number } | null = null;
  private idle = 0;
  private restYaw = 0;
  private labelEls: HTMLElement[] = [];
  private labelSize: [number, number][] = [];
  private anchors: { el: HTMLElement; p: [number, number, number]; center?: boolean }[] = [];
  private keepouts: Box[] = [];
  private ro: ResizeObserver;
  private fitted = false;
  private fitW = 0;
  private fitH = 0;

  constructor(
    gpu: Awaited<ReturnType<typeof getGpu>>, private canvas: HTMLCanvasElement, private labels: HTMLElement,
    private hoverEl: HTMLElement, private theme: Theme,
    private cb: { select: (r: Readout | null) => void; stats: (s: Stats) => void; frame: (ms: number) => void; hover?: (id: string | null) => void },
  ) {
    this.deep = theme.gpu.deep;
    this.deepOn = !!this.deep;
    const g = theme.gpu;
    this.scene = new Scene(gpu, canvas, [
      { kind: "quads", name: "quads" },
      { kind: "marks", name: "surface", blend: g.additive ? "additive" : "premultiplied" },
      { kind: "segs", name: "base", blend: g.additiveBase ? "additive" : "premultiplied", glow: (g.glow ?? 0) * 0.7 },
      { kind: "segs", name: "flows", blend: g.additive ? "additive" : "premultiplied", glow: g.glow },
      ...(g.block ? [{ kind: "quads", name: "shadows", blend: "darken" }, { kind: "boxes", name: "boxes" }] as const : []),
      { kind: "marks", name: "marks" },
    ], { solid: !!g.block });
    if (this.deep?.fov) this.scene.cam.fov = this.deep.fov;
    this.scene.bg = rgba(theme.gpu.vizBg);
    this.scene.animated = true;
    let last = 0;
    this.scene.onFrame = (ms) => {
      const now = performance.now();
      if (now - last > 400) { last = now; cb.frame(ms); }
    };
    this.scene.onTick = this.tick;
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointerenter", this.enter);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.ro = new ResizeObserver(() => {
      if (!this.model) return;
      this.measure();
      const s = this.scene;
      if (!this.fitted) this.apply(this.pose(this.deepOn));
      else if (s.width && (Math.abs(s.width - this.fitW) > 8 || Math.abs(s.height - this.fitH) > 8)) {
        // A layout transition is already moving the frame, so the camera settles in place.
        if (gpuState.paused) this.apply(this.pose(this.deepOn));
        else this.glide(this.pose(this.deepOn), 420);
      }
      this.fitW = s.width;
      this.fitH = s.height;
      this.layout();
    });
    this.ro.observe(canvas);
  }

  setModel(model: NetModel, revealMs: number) {
    this.model = model;
    this.selected = -1;
    this.cb.select(null);
    this.labels.replaceChildren();
    const add = (cls: string, text: string) => {
      const el = document.createElement("span");
      el.className = cls;
      el.textContent = text;
      this.labels.appendChild(el);
      return el;
    };
    this.labelEls = model.labels.map((i) => add("net-label" + (i === model.focus ? " focus" : ""), model.names[i] ?? ""));
    this.applyLinks();
    this.anchors = [];
    model.rings.slice(0, 3).forEach((r, k) =>
      this.anchors.push({ el: add("net-ring-label", ["1st degree", "2nd degree", "3rd degree"][k]), p: [0, -r, model.ringZ[k]], center: true }));
    const [x0, , , y1] = model.bounds;
    for (const s of model.sheets)
      this.anchors.push({ el: add("net-sheet-label", `${s.name}, ${s.n.toLocaleString()}`), p: [x0 - 46, y1 + 46, s.z] });
    this.measure();
    this.tween = null;
    this.apply(this.pose(this.deepOn));
    this.rebuild();
    this.scene.playReveal(revealMs);
  }

  measure() {
    const host = this.canvas.getBoundingClientRect();
    this.labelSize = this.labelEls.map((el) => [el.offsetWidth, el.offsetHeight]);
    this.keepouts = [...this.canvas.parentElement!.querySelectorAll<HTMLElement>("[data-keepout]")].flatMap((el) => {
      const r = el.getBoundingClientRect();
      return r.width ? [[r.left - host.left - 6, r.top - host.top - 6, r.right - host.left + 6, r.bottom - host.top + 6] as Box] : [];
    });
  }

  // Camera and lift for the flat or the deep arrangement, fitted to the canvas.
  private pose(deep: boolean): Pose {
    const m = this.model, s = this.scene;
    const keep = { cam: { ...s.cam }, lift: s.lift };
    const ringR = m.domeR ? m.domeR + 26 : m.rings.length ? m.rings[m.rings.length - 1] + 30 : 0;
    const pad = m.sheets.length ? 46 : this.deep?.form === "blocks" ? 46 : 0;
    const [x0, y0, x1, y1] = ringR ? [-ringR, -ringR, ringR, ringR] : [m.bounds[0] - pad, m.bounds[1] - pad, m.bounds[2] + pad, m.bounds[3] + pad];
    const [zLo, zHi] = deep ? m.zRange : [0, 0];
    s.lift = deep ? 1 : 0;
    s.cam = {
      tx: (x0 + x1) / 2, ty: (y0 + y1) / 2, tz: (zLo + zHi) / 2,
      yaw: deep ? this.deep!.yaw : 0, pitch: deep ? this.deep!.pitch : TOP_DOWN, scale: 1, fov: s.cam.fov,
    };
    const w = s.width || 800, h = s.height || 600;
    const fill = m.dense && !m.sheets.length ? 0.94 : deep ? 0.84 : 0.86;
    // A ring layout is fitted to its outer circle, which is tighter than the bounding square once the view is turned.
    const hull: [number, number][] = ringR
      ? Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2) * ringR, Math.sin((i / 24) * Math.PI * 2) * ringR])
      : [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    const extent = () => {
      const fr = s.frustum();
      let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
      for (const [cx, cy] of hull) for (const cz of [zLo, zHi]) {
        const [px, py] = s.project(cx, cy, cz, fr);
        sx0 = Math.min(sx0, px); sx1 = Math.max(sx1, px); sy0 = Math.min(sy0, py); sy1 = Math.max(sy1, py);
      }
      return [sx0, sx1, sy0, sy1];
    };
    for (let pass = 0; pass < 5; pass++) {
      const [sx0, sx1, sy0, sy1] = extent();
      s.cam.scale *= Math.min((w * fill) / (sx1 - sx0), (h * fill) / (sy1 - sy0));
      const [cx0, cx1, cy0, cy1] = extent();
      const dx = w / 2 + (m.dense ? 0 : 24) - (cx0 + cx1) / 2, dy = h / 2 - (cy0 + cy1) / 2;
      if (s.cam.pitch < 1.2) {
        s.pan(dx, 0);
        s.cam.tz += dy / (s.cam.scale * Math.cos(s.cam.pitch));
      } else {
        s.pan(dx, dy);
      }
    }
    const out = { cam: { ...s.cam }, lift: s.lift };
    s.cam = keep.cam;
    s.lift = keep.lift;
    return out;
  }

  private apply(p: Pose) {
    const s = this.scene;
    if (!s.width) return;
    s.cam = { ...p.cam };
    s.lift = p.lift;
    s.aperture = (this.deep?.aperture ?? 0) * p.lift;
    s.fogFloor = 1 - (1 - (this.deep?.fogFloor ?? 1)) * p.lift;
    this.restYaw = p.cam.yaw;
    if (!this.fitted) { this.fitW = s.width; this.fitH = s.height; }
    this.fitted = true;
    s.dirty = true;
    this.layout();
  }

  fit() {
    this.glide(this.pose(this.deepOn), 500);
  }

  setDeep(on: boolean) {
    this.deepOn = on;
    this.glide(this.pose(on), this.theme.motion.morph);
  }

  private glide(to: Pose, ms: number) {
    if (motion.level === 0) { this.apply(to); return; }
    this.tween = { from: { cam: { ...this.scene.cam }, lift: this.scene.lift }, to, t0: performance.now(), ms };
  }

  zoom(factor: number, sx?: number, sy?: number) {
    const s = this.scene;
    const px = sx ?? s.width / 2, py = sy ?? s.height / 2;
    const before = s.ground(px, py, s.cam.tz * s.lift);
    s.cam.scale *= factor;
    const after = s.ground(px, py, s.cam.tz * s.lift);
    if (before && after) { s.cam.tx += before[0] - after[0]; s.cam.ty += before[1] - after[1]; }
    s.dirty = true;
    this.layout();
  }

  private tick = (now: number, dt: number) => {
    const s = this.scene;
    if (this.tween) {
      const { from, to, t0, ms } = this.tween;
      const t = Math.min(1, (now - t0) / ms);
      const k = easeInOut(t);
      const mix = (a: number, b: number) => a + (b - a) * k;
      this.apply({
        cam: {
          tx: mix(from.cam.tx, to.cam.tx), ty: mix(from.cam.ty, to.cam.ty), tz: mix(from.cam.tz, to.cam.tz),
          yaw: mix(from.cam.yaw, to.cam.yaw), pitch: mix(from.cam.pitch, to.cam.pitch),
          scale: Math.exp(mix(Math.log(from.cam.scale), Math.log(to.cam.scale))), fov: to.cam.fov,
        },
        lift: mix(from.lift, to.lift),
      });
      if (t >= 1) this.tween = null;
      return;
    }
    if (!this.deep || !this.deepOn || this.hovering || this.drag || motion.level < 2) return;
    this.idle += dt / 1000;
    s.cam.yaw = this.restYaw + this.deep.sway * (motion.level === 3 ? 1.8 : 1) * Math.sin((this.idle / this.deep.swayPeriod) * Math.PI * 2);
    this.layout();
  };

  private rebuild() {
    const b = buildNetBuffers(this.model, this.theme, this.selected, this.model.dense ? null : this.emph);
    this.scene.setLayer("quads", b.quads.data, b.quads.count);
    this.scene.setLayer("surface", b.surface, b.surfaceCount);
    this.scene.setLayer("base", b.base.data, b.base.count);
    this.scene.setLayer("flows", b.flows.data, b.flows.count);
    this.scene.setLayer("shadows", b.shadows.data, b.shadows.count);
    this.scene.setLayer("boxes", b.boxes.data, b.boxes.count);
    this.scene.setLayer("marks", b.marks, b.markCount);
    this.cb.stats({ n: this.model.n, m: this.model.m, segs: b.base.count + b.flows.count });
  }

  layout() {
    const m = this.model, s = this.scene;
    const w = s.width, h = s.height;
    if (!w || !m) return;
    const fr = s.frustum();
    const taken: Box[] = [...this.keepouts];
    const hits = (b: Box) => taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
    const at = m.labels.map((i) => {
      const [sx, sy, d] = s.project(m.x[i], m.y[i], m.z[i], fr);
      return { sx, sy, r: (m.radius[i] * this.theme.gpu.node.scale * fr.focal) / d };
    });
    for (const p of at) taken.push([p.sx - p.r - 2, p.sy - p.r - 2, p.sx + p.r + 2, p.sy + p.r + 2]);
    for (const a of this.anchors) {
      const [sx, sy] = s.project(a.p[0], a.p[1], a.p[2], fr);
      a.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      if (a.center) {
        a.el.style.opacity = String(1 - s.lift);
        if (s.lift < 0.5) taken.push([sx - 40, sy - 8, sx + 40, sy + 8]);
      } else {
        a.el.style.opacity = String(hits([sx, sy, sx + 150, sy + 22]) ? 0 : s.lift);
      }
    }
    const rank = (k: number) => (m.labels[k] === this.selected ? 2 : m.labels[k] === m.focus ? 1 : 0);
    const order = m.labels.map((i, k) => k).sort((p, q) => rank(q) - rank(p) || m.radius[m.labels[q]] - m.radius[m.labels[p]]);
    for (const k of order) {
      const el = this.labelEls[k];
      const { sx, sy } = at[k];
      const [lw, lh] = this.labelSize[k] ?? [0, 0];
      const r = at[k].r + 6;
      const right: Box = [sx + r, sy - lh / 2, sx + r + lw, sy + lh / 2];
      const left: Box = [sx - r - lw, sy - lh / 2, sx - r, sy + lh / 2];
      const above: Box = [sx - lw / 2, sy - r - lh, sx + lw / 2, sy - r];
      const below: Box = [sx - lw / 2, sy + r, sx + lw / 2, sy + r + lh];
      const options = (m.rings.length ? sx < w / 2 : sx < w * 0.36) ? [left, right, above, below] : [right, left, above, below];
      const spot = options.find((b) => b[0] > 2 && b[2] < w - 2 && b[1] > 2 && b[3] < h - 2 && !hits(b)) ?? (rank(k) ? above : undefined);
      el.style.opacity = spot ? "1" : "0";
      el.classList.toggle("sel", m.labels[k] === this.selected);
      if (!spot) continue;
      taken.push(spot);
      el.style.transform = `translate(${spot[0].toFixed(1)}px, ${spot[1].toFixed(1)}px)`;
    }
  }

  private hit(sx: number, sy: number) {
    const m = this.model, s = this.scene;
    if (s.lift < 0.01 && Math.abs(s.cam.pitch - TOP_DOWN) < 0.01 && Math.abs(s.cam.yaw) < 0.01) {
      const g = s.ground(sx, sy);
      return g ? pick(m, g[0], g[1], 7 / s.cam.scale) : -1;
    }
    const fr = s.frustum();
    let best = -1, bestD = Infinity;
    for (let i = 0; i < m.n; i++) {
      const [px, py, d] = s.project(m.x[i], m.y[i], m.z[i], fr);
      const gap = Math.hypot(px - sx, py - sy) - (m.radius[i] * fr.focal) / d;
      if (gap < 7 && gap < bestD) { bestD = gap; best = i; }
    }
    return best;
  }
  private down = (e: PointerEvent) => {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have no capture target */ }
    this.drag = { x: e.clientX, y: e.clientY, moved: false };
    this.tween = null;
  };
  private move = (e: PointerEvent) => {
    const s = this.scene;
    if (this.drag) {
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      if (this.deep && this.deepOn && !e.shiftKey) {
        s.cam.yaw -= dx * 0.006;
        s.cam.pitch = Math.max(0.16, Math.min(TOP_DOWN, s.cam.pitch + dy * 0.005));
        this.restYaw = s.cam.yaw;
        this.idle = 0;
        s.dirty = true;
      } else {
        s.pan(dx, dy);
      }
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.layout();
      this.hoverEl.hidden = true;
      this.hoverAt(-1);
      return;
    }
    const i = this.hit(e.offsetX, e.offsetY);
    this.hoverAt(i);
    this.canvas.style.cursor = i >= 0 ? "pointer" : "grab";
    if (i < 0) { this.hoverEl.hidden = true; return; }
    const m = this.model;
    const fr = s.frustum();
    const [sx, sy, d] = s.project(m.x[i], m.y[i], m.z[i], fr);
    const ties = m.adjStart[i + 1] - m.adjStart[i];
    this.hoverEl.hidden = false;
    this.hoverEl.style.transform = `translate(${sx}px, ${sy}px)`;
    this.hoverEl.style.setProperty("--r", `${(m.radius[i] * this.theme.gpu.node.scale * fr.focal) / d + 4}px`);
    this.hoverEl.querySelector("b")!.textContent = m.names[i] ?? `Entity ${i.toLocaleString()}`;
    this.hoverEl.querySelector("em")!.textContent = `${m.roles[i] ? m.roles[i] + ", " : ""}${ties} ${ties === 1 ? "tie" : "ties"}`;
  };
  private up = (e: PointerEvent) => {
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.moved) return;
    const i = this.hit(e.offsetX, e.offsetY);
    this.select(i === this.selected ? -1 : i);
  };
  select(i: number) {
    if (i === this.selected) return;
    this.selected = i;
    const m = this.model;
    this.cb.select(i < 0 ? null : {
      id: m.names[i] ? m.ids[i] : undefined,
      name: m.names[i] ?? `Entity ${i.toLocaleString()}`,
      role: m.roles[i],
      ties: m.adjStart[i + 1] - m.adjStart[i],
    });
    this.rebuild();
    this.layout();
  }
  selectId(id: string) {
    const i = this.model.ids.indexOf(id);
    if (i >= 0) this.select(i);
  }
  private enter = () => { this.hovering = true; };
  private leave = () => { this.hovering = false; this.hoverEl.hidden = true; this.hoverAt(-1); };
  // Only named entities are records, so hovering the unnamed crowd reports nothing.
  private hoverAt(i: number) {
    if (i === this.hovered) return;
    this.hovered = i;
    const m = this.model;
    this.cb.hover?.(i >= 0 && m.names[i] ? m.ids[i] : null);
  }
  // Classes from the shared selection, lenses and hover go on the labels. The nodes take the same classes as an
  // alpha and an outline ring each, read from the classes the way the stylesheet reads them for other panels.
  private emph: Emph | null = null;
  private emphKey = "";
  setLinks(lk: (id: string) => string, root = "") {
    this.lk = lk;
    this.applyLinks();
    const m = this.model;
    if (!root || m.dense) {
      if (this.emph) { this.emph = null; this.emphKey = ""; this.rebuild(); }
      return;
    }
    const alpha = new Float32Array(m.n).fill(1);
    const rings: Emph["rings"] = [];
    const colors = new Map<string, RGBA>();
    const color = (v: string) => { let c = colors.get(v); if (!c) { c = cssColor(this.canvas, v); colors.set(v, c); } return c; };
    for (let i = 0; i < m.n; i++) {
      const e = emphasis(lk(m.ids[i] ?? ""), root);
      alpha[i] = e.alpha;
      if (e.ring && e.alpha > 0) rings.push({ i, color: color(e.ring) });
    }
    const key = `${root}|${[...alpha].join()}|${rings.map((r) => `${r.i}:${r.color.join()}`).join()}`;
    if (key === this.emphKey) return;
    this.emphKey = key;
    this.emph = { alpha, rings };
    this.rebuild();
  }
  private applyLinks() {
    const m = this.model;
    this.labelEls.forEach((el, k) => {
      for (const c of [...el.classList]) if (c === "lk" || c.startsWith("lk-")) el.classList.remove(c);
      const cls = this.lk(m.ids[m.labels[k]]);
      if (cls) el.classList.add(...cls.split(" "));
    });
  }
  private wheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.zoom(Math.exp(-e.deltaY * 0.01), e.offsetX, e.offsetY);
  };

  dispose() {
    this.ro.disconnect();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointerenter", this.enter);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.scene.dispose();
  }
}

const KEY: { kind: Kind; sector: Sector; label: string }[] = [
  { kind: "official", sector: "gov", label: "Official" },
  { kind: "agency", sector: "gov", label: "Agency, committee" },
  { kind: "person", sector: "corp", label: "Person" },
  { kind: "corp", sector: "corp", label: "Company" },
  { kind: "firm", sector: "inter", label: "Lobbying firm" },
  { kind: "pac", sector: "inter", label: "PAC" },
  { kind: "event", sector: "event", label: "Event" },
];

export function NetworkView({ theme }: { theme: Theme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const hover = useRef<HTMLDivElement>(null);
  const ctl = useRef<NetController | null>(null);
  const deep = theme.gpu.deep;
  const { staged } = usePanel();
  const inspected = useWs((s) => s.trail[s.trail.length - 1]);
  const replays = useWs((s) => s.replays);
  const [density, setDensity] = useState<Density>("case");
  const [space, setSpace] = useState<"flat" | "deep">("deep");
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const [readout, setReadout] = useState<Readout | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let gone = false;
    getGpu().then((gpu) => {
      if (gone) return;
      ctl.current = new NetController(gpu, canvas.current!, labels.current!, hover.current!, theme, {
        select: setReadout, stats: setStats, frame: setFrame,
        hover: (id) => board.hover(id ? { ids: [id], from: "mark", at: "01" } : null),
      });
      ctl.current.setModel(buildCoreModel(theme.gpu), theme.motion.reveal);
      setStatus("ready");
      document.fonts.ready.then(() => { ctl.current?.measure(); ctl.current?.layout(); });
    }).catch((err) => {
      console.error(err);
      if (!gone) setStatus("unsupported");
    });
    return () => {
      gone = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, [theme]);

  useEffect(() => {
    ctl.current?.measure();
    ctl.current?.layout();
  }, [readout, space, density, staged]);

  useEffect(() => {
    if (replays) ctl.current?.scene.playReveal(theme.motion.reveal);
  }, [replays]);

  // The dossier and the network follow one another while the dossier is open.
  useEffect(() => {
    if (inspected && status === "ready") ctl.current?.selectId(inspected);
  }, [inspected, status]);
  useEffect(() => {
    if (readout?.id && inspected) ws.inspect(readout.id);
  }, [readout]);
  // A selected entity is the page's selection, and the selection, lenses and hovered records elsewhere mark the
  // labels of the entities they involve.
  useEffect(() => {
    if (readout?.id) board.select({ ids: [readout.id], label: readout.name, from: "01" });
  }, [readout]);
  const links = useLinks("01");
  const selFrom = useBoard((s) => s.sel.from);
  // The network's own selection already lights the selected entity and its ties.
  useEffect(() => { ctl.current?.setLinks((id) => links.mark([id]), (links.root ?? "").split(" ").filter((f) => f !== "sel" || selFrom !== "01").join(" ")); }, [links, status, selFrom]);

  const change = (d: Density) => {
    setDensity(d);
    ctl.current?.setModel(d === "case" ? buildCoreModel(theme.gpu) : buildStressModel(d === "5k" ? 5000 : 100000, theme.gpu), 700);
  };
  const changeSpace = (v: "flat" | "deep") => {
    setSpace(v);
    ctl.current?.setDeep(v === "deep");
  };

  return (
    <div className="viz net" data-dense={density !== "case"}>
      <canvas ref={canvas} aria-label="Relationship network" />
      <div className="viz-labels" ref={labels} data-lk={links.root} />
      <div className="net-hover" ref={hover} hidden>
        <i />
        <span><b /><em /></span>
      </div>
      {status === "unsupported" ? <p className="viz-msg">This view draws with WebGPU, which this browser does not provide.</p> : null}
      <ul className="viz-key" data-keepout>
        {KEY.map((k) => (
          <li key={k.label}><Glyph kind={k.kind} sector={k.sector} />{k.label}</li>
        ))}
        <li className="key-line money" data-note="money"><i />Money</li>
        <li className="key-line contact"><i />Contact</li>
        {deep?.form === "armillary" ? <li className="key-line stem"><i />Stem height is weight</li> : null}
      </ul>
      <div className="viz-tr" data-keepout>
        {deep ? <Segmented label="Arrangement" value={space} onChange={changeSpace} options={[{ value: "flat", label: deep.labels[0], tip: "Drag to pan" }, { value: "deep", label: deep.labels[1], tip: "Drag to turn, Shift-drag to pan", note: "morph rest" }]} /> : null}
        <Segmented label="Graph size" value={density} onChange={change} options={[{ value: "case", label: "Case file" }, { value: "5k", label: "5,000" }, { value: "100k", label: "100,000" }]} />
        <div className="viz-zoom">
          <button type="button" aria-label="Zoom in" data-tip="Zoom in (Ctrl-scroll)" onClick={() => ctl.current?.zoom(1.35)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => ctl.current?.zoom(1 / 1.35)}>&minus;</button>
          <button type="button" className="wide" data-tip="Fit to view" onClick={() => ctl.current?.fit()}>Fit</button>
        </div>
      </div>
      <div className="viz-bl" data-keepout>
        {readout ? (
          <p className="readout">
            <b>{readout.name}</b>
            <span>{readout.role ? `${readout.role}. ` : ""}{readout.ties} ties</span>
            {readout.id && inspected !== readout.id ? <button type="button" className="btn" data-note="dossier" onClick={() => ws.inspect(readout.id!)}>Open dossier</button> : null}
          </p>
        ) : null}
      </div>
      <dl className="viz-br" data-keepout data-note="reveal">
        {stats ? (
          <>
            <div><dt>Entities</dt><dd>{stats.n.toLocaleString()}</dd></div>
            <div><dt>Ties</dt><dd>{stats.m.toLocaleString()}</dd></div>
            <div><dt>Segments</dt><dd>{stats.segs.toLocaleString()}</dd></div>
            <div><dt>Frame</dt><dd>{frame ? `${frame.toFixed(1)} ms` : "n/a"}</dd></div>
          </>
        ) : null}
      </dl>
    </div>
  );
}

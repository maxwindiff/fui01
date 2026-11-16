import { useEffect, useRef, useState } from "react";
import { BoxWriter, getGpu, MARK_FLOATS, QuadWriter, Scene as GpuScene, SegWriter, SHAPE, TOP_DOWN, writeMark } from "../gpu/scene";
import type { Stroke } from "../gpu/scene";
import { motion } from "../motion";
import { rgba } from "../themes";
import type { RGBA, Theme } from "../themes";
import { fmtValue } from "./format";
import type { MapData } from "./map";
import type { MarkT, Scene } from "./render";
import type { Answer } from "./spec";

// The current view in three dimensions, drawn with the WebGPU scene the case board uses. The ground is the plot area
// of the flat chart in the same units, so the camera starts straight above it at one world unit per pixel and the
// two line up. Height then carries a number the flat chart showed by length or size:
//   bars       a grid of columns, one row per bar and one column per part of a split
//   map        a column on each state
//   points     a stem up to each point, for a size field
//   network    one level per tone, so each group sits on its own sheet

type P3 = [number, number, number];
interface Box { m: MarkT; x: number; y: number; half: number; h: number }
interface Dot { m: MarkT; x: number; y: number; z: number; r: number }
interface Line { a: P3; b: P3; tone: string; w: number; alpha: number; tie?: "plain" | "dir" }
interface Label { text: string; at: P3; side: "l" | "r" | "t" | "b"; cls: string }
interface Sheet { x0: number; y0: number; x1: number; y1: number; z: number }
export interface Model { boxes: Box[]; dots: Dot[]; lines: Line[]; labels: Label[]; sheets: Sheet[]; top: number; bounds: [number, number, number, number]; fit?: P3[] }

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const toneOf = (cls: string) => /\bt-(\w+)/.exec(cls)?.[1] ?? "ink";
function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
}

// Ticks up a height axis in the back left corner, with lines along the back edge at each tick.
function heightAxis(out: Model, a: Answer, field: string, vmax: number, hs: number, x0: number, x1: number, y0: number) {
  const step = niceStep(vmax, 4);
  out.lines.push({ a: [x0, y0, 0], b: [x0, y0, hs * 1.04], tone: "rule-strong", w: 1, alpha: 1 });
  for (let v = step; v <= vmax * 1.001; v += step) {
    const z = (v / vmax) * hs;
    out.lines.push({ a: [x0, y0, z], b: [x1, y0, z], tone: "rule", w: 1, alpha: 0.45 });
    out.labels.push({ text: fmtValue(a, field, v), at: [x0, y0, z], side: "l", cls: "dim" });
  }
}

export function build(sc: Scene, a: Answer, map: MapData | null): Model | null {
  const f = sc.frame;
  if (!f) return null;
  const out: Model = { boxes: [], dots: [], lines: [], labels: [], sheets: [], top: 0, bounds: [f.x0, f.y0, f.x1, f.y1] };
  const pw = f.x1 - f.x0, ph = f.y1 - f.y0;
  const hs = Math.max(pw, ph) * 0.36;
  const layerOf = (m: MarkT) => a.layers[m.layer];
  const ground = () => {
    out.sheets.push({ x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, z: 0 });
    for (const t of f.xt) {
      if (!f.xBand) out.lines.push({ a: [t.p, f.y0, 0], b: [t.p, f.y1, 0], tone: "rule", w: 1, alpha: 0.7 });
      out.labels.push({ text: t.label, at: [t.p, f.y1, 0], side: "b", cls: "" });
    }
    for (const t of f.yt) {
      if (!f.yBand) out.lines.push({ a: [f.x0, t.p, 0], b: [f.x1, t.p, 0], tone: "rule", w: 1, alpha: 0.7 });
      out.labels.push({ text: t.label, at: [f.x0, t.p, 0], side: "l", cls: f.yBand ? "ink" : "" });
    }
  };

  // Network: points with links. Each tone takes a level, the largest group at the bottom.
  if (sc.links.length) {
    const nodes = sc.marks.filter((m) => layerOf(m).mark === "point");
    const tones = [...new Set(nodes.map((m) => toneOf(m.cls)))].sort((p, q) => nodes.filter((m) => toneOf(m.cls) === q).length - nodes.filter((m) => toneOf(m.cls) === p).length);
    const gap = tones.length > 1 ? Math.min(hs * 0.45, hs / (tones.length - 1)) : 0;
    const zOf = new Map<string, number>();
    for (const m of nodes) zOf.set(m.id, tones.indexOf(toneOf(m.cls)) * gap);
    const at = new Map(nodes.map((m) => [m.id, m]));
    for (const l of sc.links) {
      const p = at.get(l.a), q = at.get(l.b);
      if (!p || !q) continue;
      out.lines.push({ a: [p.x, p.y, zOf.get(p.id)!], b: [q.x, q.y, zOf.get(q.id)!], tone: /\bt-/.test(l.cls) ? toneOf(l.cls) : "rule-strong", w: Math.max(0.8, l.w), alpha: /w-ghost/.test(l.cls) ? 0.25 : /w-quiet/.test(l.cls) ? 0.5 : 0.85, tie: l.dir ? "dir" : "plain" });
    }
    // The camera fits the nodes themselves. A box around the levels leaves its empty corners on screen.
    out.fit = nodes.map((m) => [m.x, m.y, zOf.get(m.id)!]);
    for (const m of nodes) {
      out.dots.push({ m, x: m.x, y: m.y, z: zOf.get(m.id)!, r: Math.max(2.5, m.w / 2) });
      if (m.label) out.labels.push({ text: m.label.text, at: [m.x, m.y, zOf.get(m.id)!], side: "r", cls: "ink" });
    }
    out.top = (tones.length - 1) * gap;
    const xs = nodes.map((m) => m.x), ys = nodes.map((m) => m.y);
    out.bounds = [Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30];
    return out;
  }

  // Map: a column on each state, from the state's centroid.
  const placeLayer = a.layers.find((l) => l.encoding.place?.field);
  if (placeLayer && map && f.map) {
    const { ox, oy, s } = f.map;
    out.bounds = [ox, oy, ox + map.w * s, oy + map.h * s];
    for (const line of map.lines) for (let i = 1; i < line.length; i++)
      out.lines.push({ a: [ox + line[i - 1][0] * s, oy + line[i - 1][1] * s, 0], b: [ox + line[i][0] * s, oy + line[i][1] * s, 0], tone: "rule-strong", w: 0.8, alpha: 0.9 });
    const field = placeLayer.encoding.place!.field!, size = placeLayer.encoding.size?.field;
    const ms = sc.marks.filter((m) => layerOf(m) === placeLayer);
    const vmax = Math.max(1, ...ms.map((m) => (size ? num(m.row[size]) : 0)));
    for (const m of ms) {
      const c = map.cent[String(m.row[field])];
      if (!c) continue;
      const x = ox + c[0] * s, y = oy + c[1] * s;
      if (size) out.boxes.push({ m, x, y, half: Math.max(4, 10 * s), h: (num(m.row[size]) / vmax) * hs });
      else out.dots.push({ m, x, y, z: 0, r: m.w / 2 });
    }
    const top = [...out.boxes].sort((p, q) => q.h - p.h).slice(0, 8);
    for (const b of top) out.labels.push({ text: `${b.m.row[field]} ${fmtValue(a, size!, b.m.row[size!])}`, at: [b.x, b.y, b.h], side: "t", cls: "ink" });
    out.top = hs;
    return out;
  }

  // Bars: a grid of columns. Rows hold the bars of the flat chart, columns the parts of a split.
  const spans = sc.marks.filter((m) => layerOf(m).mark === "span");
  if (spans.length && spans.length >= sc.marks.length / 2) {
    const L = layerOf(spans[0]);
    const flat = spans[0].w >= spans[0].h;
    const band = (flat ? L.encoding.y : L.encoding.x)?.field, value = (flat ? L.encoding.x : L.encoding.y)?.field;
    if (band && value) {
      const part = L.encoding.tone?.field && L.encoding.tone.field !== band ? L.encoding.tone.field : null;
      const bands = [...new Set([...spans].sort((p, q) => (flat ? p.y - q.y : p.x - q.x)).map((m) => String(m.row[band])))];
      let parts = part ? [...new Set(spans.map((m) => String(m.row[part])))] : [""];
      // Years and other numbers run in order, with Other at the end.
      if (parts.every((v) => v === "Other" || /^-?\d+(\.\d+)?$/.test(v))) parts = parts.sort((p, q) => (p === "Other" ? 1 : q === "Other" ? -1 : Number(p) - Number(q)));
      const grid = parts.length > 1;
      const nx = grid ? parts.length : bands.length, ny = grid ? bands.length : 1;
      const cw = pw / nx, rh = grid ? ph / ny : Math.min(ph, cw * 1.6);
      const gy0 = grid ? f.y0 : f.y0 + (ph - rh) / 2;
      const half = Math.min(cw, rh) * 0.3;
      const vmax = Math.max(...spans.map((m) => num(m.row[value])));
      for (const m of spans) {
        const bi = bands.indexOf(String(m.row[band])), pi = part ? parts.indexOf(String(m.row[part])) : 0;
        const x = f.x0 + ((grid ? pi : bi) + 0.5) * cw, y = gy0 + ((grid ? bi : 0) + 0.5) * rh;
        out.boxes.push({ m, x, y, half, h: (num(m.row[value]) / vmax) * hs });
      }
      out.sheets.push({ x0: f.x0, y0: gy0, x1: f.x1, y1: gy0 + rh * ny, z: 0 });
      out.bounds = [f.x0, gy0, f.x1, gy0 + rh * ny];
      for (let i = 1; i < nx; i++) out.lines.push({ a: [f.x0 + i * cw, gy0, 0], b: [f.x0 + i * cw, gy0 + rh * ny, 0], tone: "rule", w: 1, alpha: 0.7 });
      for (let j = 1; j < ny; j++) out.lines.push({ a: [f.x0, gy0 + j * rh, 0], b: [f.x1, gy0 + j * rh, 0], tone: "rule", w: 1, alpha: 0.7 });
      if (grid) {
        bands.forEach((b, j) => out.labels.push({ text: b, at: [f.x0, gy0 + (j + 0.5) * rh, 0], side: "l", cls: "ink" }));
        parts.forEach((p, i) => out.labels.push({ text: p, at: [f.x0 + (i + 0.5) * cw, gy0 + rh * ny, 0], side: "b", cls: "" }));
      } else bands.forEach((b, i) => out.labels.push({ text: b, at: [f.x0 + (i + 0.5) * cw, gy0 + rh, 0], side: "b", cls: "ink" }));
      for (const b of [...out.boxes].sort((p, q) => q.h - p.h).slice(0, 12)) if (b.h > 2) out.labels.push({ text: fmtValue(a, value, b.m.row[value]), at: [b.x, b.y, b.h], side: "t", cls: "ink value" });
      heightAxis(out, a, value, vmax, hs, f.x0, f.x1, gy0);
      out.top = hs;
      return out;
    }
  }

  // Points with a number on y: the number becomes height, and the ground keeps x with one lane per tone.
  const pts = sc.marks.filter((m) => layerOf(m).mark === "point");
  const yField = pts.length ? layerOf(pts[0]).encoding.y?.field : undefined;
  if (pts.length && yField && !f.yBand && !f.map && f.yt.length) {
    const toneField = layerOf(pts[0]).encoding.tone?.field;
    const lanes = toneField ? [...new Set(pts.map((m) => String(m.row[toneField])))] : [""];
    const lh = Math.min(70, ph / lanes.length);
    const gy0 = f.y0 + (ph - lh * lanes.length) / 2;
    const vals = pts.map((m) => num(m.row[yField])).filter(Number.isFinite);
    const lo = Math.min(0, ...vals), vmax = Math.max(...vals);
    out.sheets.push({ x0: f.x0, y0: gy0, x1: f.x1, y1: gy0 + lh * lanes.length, z: 0 });
    out.bounds = [f.x0, gy0, f.x1, gy0 + lh * lanes.length];
    for (const t of f.xt) {
      out.lines.push({ a: [t.p, gy0, 0], b: [t.p, gy0 + lh * lanes.length, 0], tone: "rule", w: 1, alpha: 0.7 });
      out.labels.push({ text: t.label, at: [t.p, gy0 + lh * lanes.length, 0], side: "b", cls: "" });
    }
    lanes.forEach((l, j) => {
      if (j) out.lines.push({ a: [f.x0, gy0 + j * lh, 0], b: [f.x1, gy0 + j * lh, 0], tone: "rule", w: 1, alpha: 0.5 });
      if (l) out.labels.push({ text: l, at: [f.x0, gy0 + (j + 0.5) * lh, 0], side: "l", cls: "ink" });
    });
    for (const m of pts) {
      const v = num(m.row[yField]);
      if (!Number.isFinite(v)) continue;
      const h = ((v - lo) / (vmax - lo || 1)) * hs;
      const j = toneField ? lanes.indexOf(String(m.row[toneField])) : 0;
      const y = gy0 + (j + 0.5) * lh + (((m.y - f.y0) / ph) - 0.5) * lh * 0.15;
      out.lines.push({ a: [m.x, y, 0], b: [m.x, y, h], tone: toneOf(m.cls), w: 1, alpha: 0.55 });
      out.dots.push({ m, x: m.x, y, z: h, r: Math.max(2.5, Math.min(5, m.w / 2)) });
    }
    heightAxis(out, a, yField, vmax, hs, f.x0, f.x1, gy0);
    out.top = hs;
    return out;
  }

  // Anything else: the flat layout on the ground. A size field rises as a stem with the point on top.
  ground();
  const sizeLayer = a.layers.find((l) => l.mark === "point" && l.encoding.size?.field);
  const size = sizeLayer?.encoding.size?.field;
  const sized = sc.marks.filter((m) => size && layerOf(m) === sizeLayer);
  const vmax = Math.max(1, ...sized.map((m) => num(m.row[size!])));
  for (const m of sc.marks) {
    const l = layerOf(m);
    if (l.mark === "span" || l.mark === "cell") { out.boxes.push({ m, x: m.x, y: m.y, half: Math.min(m.w, m.h) / 2, h: 3 }); continue; }
    const h = size && l === sizeLayer ? (num(m.row[size]) / vmax) * hs : 0;
    if (h > 0) out.lines.push({ a: [m.x, m.y, 0], b: [m.x, m.y, h], tone: toneOf(m.cls), w: 1, alpha: 0.6 });
    out.dots.push({ m, x: m.x, y: m.y, z: h, r: h > 0 ? 3.2 : Math.max(2.5, m.w / 2) });
  }
  if (size) heightAxis(out, a, size, vmax, hs, f.x0, f.x1, f.y0);
  out.top = size ? hs : 0;
  return out;
}

// Theme colours, read from the page's custom properties and turned into numbers through a one-pixel canvas.
const swatch = (() => {
  let ctx: CanvasRenderingContext2D | null = null;
  return (css: string): RGBA => {
    ctx ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css || "#888";
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255, 1];
  };
})();
function palette(el: Element) {
  const cs = getComputedStyle(el);
  const v = (name: string) => swatch(cs.getPropertyValue(name).trim());
  const bg = v("--surface-solid").every((c, i) => i === 3 || c === 0) ? v("--bg") : v("--surface-solid");
  const tones: Record<string, RGBA> = { ink: v("--ink-2"), accent: v("--accent"), t1: v("--t1"), t2: v("--t2"), t3: v("--t3"), t4: v("--t4"), t5: v("--t5"), t6: v("--t6") };
  return { bg, ink: v("--ink"), rule: v("--rule"), ruleStrong: v("--rule-strong"), tones };
}
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Columns take the form of the theme's own 3D views: solid blocks where the theme builds with them, glowing stems on
// the dark instrument themes, and stacks of dots on the survey theme.
type Build = "pen" | "block" | "stem" | "dots";
function buildOf(t: Theme): Build {
  if (t.gpu.block) return "block";
  if (t.gpu.deep.form === "relief") return "dots";
  if (t.gpu.deep.form === "armillary" || t.gpu.deep.form === "dome") return "stem";
  return "pen";
}

export function Deep({ sc, a, map, theme, sel, leaving, onLeft, onHover, onPick }: {
  sc: Scene; a: Answer; map: MapData | null; theme: Theme; sel: Set<string>; leaving: boolean;
  onLeft: () => void; onHover: (m: MarkT | null, at: { x: number; y: number }) => void; onPick: (m: MarkT, at: { x: number; y: number }) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labelBox = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  const api = useRef<{ update: (sc: Scene, a: Answer, sel: Set<string>) => void; leave: (done: () => void) => void } | null>(null);
  const latest = useRef({ onHover, onPick });
  latest.current = { onHover, onPick };

  useEffect(() => {
    let gone = false;
    let scene: GpuScene | null = null;
    let model: Model | null = null;
    let selected = new Set<string>();
    let hover: string | null = null;
    // Camera state: t runs from the flat view at 0 to the resting angle at 1.
    const deepT = theme.gpu.deep, block = theme.gpu.block, form = buildOf(theme);
    const REST = { yaw: Math.sign(deepT.yaw || -1) * 0.5, pitch: Math.max(0.72, Math.min(1.05, deepT.pitch + 0.15)) };
    let t = 0, yaw = REST.yaw, pitch = REST.pitch, zoom = 1;
    let glide: { from: number; to: number; t0: number; ms: number; done?: () => void } | null = null;
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const el = canvas.current!;
    const box = labelBox.current!;
    let spans: { el: HTMLElement; at: P3; side: Label["side"] }[] = [];
    let center: [number, number] = [0, 0];

    // The camera at the resting angle, scaled and moved so the box around the model fills the canvas, below the key.
    let fitted: { tx: number; ty: number; tz: number; scale: number } | null = null;
    const fit = () => {
      if (!scene || !model) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const b = model.bounds;
      const corners: P3[] = model.fit ? [...model.fit] : [];
      if (!model.fit) for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) for (const z of [0, model.top]) corners.push([x, y, z]);
      scene.lift = 1;
      scene.cam = { tx: (b[0] + b[2]) / 2, ty: (b[1] + b[3]) / 2, tz: model.top * 0.4, yaw: REST.yaw, pitch: REST.pitch, scale: 1, fov: deepT.fov ?? 0.5 };
      const box = () => {
        const fr = scene!.frustum();
        const ps = corners.map((c) => scene!.project(c[0], c[1], c[2], fr));
        const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      };
      const top = Math.min(h * 0.25, legendH() + 16);
      for (let i = 0; i < 3; i++) {
        const [x0, y0, x1, y1] = box();
        scene.cam.scale *= Math.min((w - 150) / (x1 - x0), (h - top - 40) / (y1 - y0));
        const [a0, b0, a1, b1] = box();
        scene.pan(w / 2 - (a0 + a1) / 2, top + (h - top - 20) / 2 - (b0 + b1) / 2);
      }
      fitted = { tx: scene.cam.tx, ty: scene.cam.ty, tz: scene.cam.tz, scale: scene.cam.scale };
    };
    const legendH = () => {
      const g = el.closest(".ask-stage")?.querySelector(".ask-legend");
      return g ? (g as SVGGraphicsElement).getBBox().height + 6 : 0;
    };

    const place = () => {
      if (!scene || !model) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const k = ease(t);
      scene.lift = k;
      scene.aperture = deepT.aperture * 0.35 * k;
      scene.fogFloor = 1 - (1 - deepT.fogFloor) * 0.45 * k;
      // Looking straight down, the camera targets the middle of the canvas, so the ground lines up with the flat chart.
      // It moves to the fitted target as it tilts.
      const fit = fitted ?? { tx: center[0], ty: center[1], tz: 0, scale: 0.8 };
      scene.cam = {
        tx: w / 2 + (fit.tx - w / 2) * k, ty: h / 2 + (fit.ty - h / 2) * k, tz: fit.tz * k,
        yaw: yaw * k, pitch: TOP_DOWN + (pitch - TOP_DOWN) * k,
        scale: 1 + (fit.scale * zoom - 1) * k, fov: deepT.fov ?? 0.5,
      };
      scene.dirty = true;
      const fr = scene.frustum();
      for (const s of spans) {
        const [sx, sy, d] = scene.project(s.at[0], s.at[1], s.at[2], fr);
        s.el.style.visibility = d > 0 ? "" : "hidden";
        s.el.style.transform = s.side === "l" ? `translate(${sx - 8}px, ${sy}px) translate(-100%, -50%)`
          : s.side === "r" ? `translate(${sx + 8}px, ${sy}px) translate(0, -50%)`
            : s.side === "t" ? `translate(${sx}px, ${sy - 12}px) translate(-50%, -100%)`
              : `translate(${sx}px, ${sy + 6}px) translate(-50%, 0)`;
      }
    };

    const push = () => {
      if (!scene || !model) return;
      const p = palette(el);
      const any = selected.size > 0;
      const tone = (name: string) => (name === "rule" ? p.rule : name === "rule-strong" ? p.ruleStrong : p.tones[name] ?? p.tones.ink);
      const look = (m: MarkT) => {
        let c = tone(toneOf(m.cls));
        if (/w-quiet/.test(m.cls)) c = mix(c, p.bg, 0.45);
        if (/w-ghost/.test(m.cls)) c = mix(c, p.bg, 0.8);
        if (any && !selected.has(m.id)) c = mix(c, p.bg, 0.7);
        return c;
      };
      const boxes = new BoxWriter(Math.max(1, model.boxes.length));
      const extra: { x: number; y: number; z: number; r: number; c: RGBA; shape: number; fill: number }[] = [];
      const stems: { a: P3; b: P3; c: RGBA }[] = [];
      const storey = model.top / 12;
      for (const [i, b] of model.boxes.entries()) {
        const c = look(b.m);
        const on = selected.has(b.m.id), lit = b.m.id === hover || on;
        const edge = lit ? (on ? p.tones.accent : p.ink) : null;
        const delay = Math.min(0.8, (i / Math.max(1, model.boxes.length)) * 0.8);
        const h = Math.max(0.5, b.h);
        if (form === "block" && block) {
          const hh = block.stepped ? Math.max(storey, Math.round(h / storey) * storey) : h;
          const top = block.paint === "plain" ? mix(c, rgba(block.top), 0.55) : c;
          const side = block.paint === "plain" ? c : mix(c, [0, 0, 0, 1], 0.18);
          boxes.box(b.x, b.y, 0, b.half, hh, top, side, edge ?? rgba(block.ink, block.inkAlpha), lit ? 2 : block.outline, 0, delay, block.keys?.lamp ?? (block.stepped ? 0.25 : 0));
        } else if (form === "stem" && h > 1) {
          stems.push({ a: [b.x, b.y, 0], b: [b.x, b.y, h], c });
          extra.push({ x: b.x, y: b.y, z: h, r: 5, c: edge ?? c, shape: SHAPE.diamond, fill: 1 });
          extra.push({ x: b.x, y: b.y, z: 0, r: 2, c, shape: SHAPE.circle, fill: 1 });
        } else if (form === "dots") {
          const pitchZ = Math.max(4, b.half * 0.9);
          for (let z = pitchZ / 2; z <= h; z += pitchZ) extra.push({ x: b.x, y: b.y, z, r: Math.max(1.6, b.half * 0.35), c: edge ?? c, shape: SHAPE.circle, fill: 1 });
        } else {
          // Pen on film: a pale body with the outline in the mark's colour.
          boxes.box(b.x, b.y, 0, b.half, h, mix(c, p.bg, 0.7), mix(c, p.bg, 0.78), edge ?? c, lit ? 2 : 1.1, 0, delay);
        }
      }
      const dots = new Float32Array(Math.max(1, model.dots.length + extra.length) * MARK_FLOATS);
      extra.forEach((d, i) => writeMark(dots, model!.dots.length + i, d.x, d.y, d.z, d.r, d.shape, d.c, 0.6, d.fill, form === "stem" ? 3 : 0, 0, 0.3));
      model.dots.forEach((d, i) => {
        const c = look(d.m);
        const hollow = /f-hollow/.test(d.m.cls);
        const lit = d.m.id === hover || selected.has(d.m.id);
        writeMark(dots, i, d.x, d.y, d.z, d.r, /diamond/.test(d.m.cls) || d.m.rot ? SHAPE.diamond : d.m.rx < d.m.w / 2 - 0.5 ? SHAPE.square : SHAPE.circle, lit ? (selected.has(d.m.id) ? p.tones.accent : p.ink) : c, lit ? 2 : hollow ? 1.2 : 0.6, hollow && !lit ? -1 : 1, 0, 0, Math.min(0.8, (i / Math.max(1, model!.dots.length)) * 0.8));
      });
      const segs = new SegWriter(Math.max(16, model.lines.length + stems.length));
      for (const st of stems) segs.line(st.a, st.b, { color: [st.c[0], st.c[1], st.c[2], 0.9], width: 1.6 });
      // Ties bend like the case board's, and directed ones carry its moving dashes or pulses.
      const bend = Math.max(0.08, theme.gpu.edge.curve * 0.5), pulse = theme.gpu.money.mode === "pulse";
      model.lines.forEach((l, i) => {
        const c = tone(l.tone);
        const s: Stroke = { color: [c[0], c[1], c[2], l.alpha], width: l.w };
        if (!l.tie) { segs.line(l.a, l.b, s); return; }
        if (l.tie === "dir") Object.assign(s, pulse ? { flow: 0.16 + ((i * 0.618) % 1) * 0.14, pulse: 1.5, phase: (i * 0.382) % 1 } : { dash: 8, flow: 0.9 });
        segs.curve(l.a, l.b, l.tie === "dir" ? bend : bend * 0.6, l.tie === "dir" ? 0.12 : 0.04, s, 22);
      });
      scene.animated = model.lines.some((l) => l.tie === "dir");
      const quads = new QuadWriter();
      for (const s of model.sheets) quads.sheet(s.x0 - 10, s.y0 - 10, s.x1 + 10, s.y1 + 10, s.z, [...mix(p.bg, p.rule, 0.25).slice(0, 3), 0.55] as RGBA, p.ruleStrong, 0, 0, 0.7, 1);
      scene.bg = p.bg;
      scene.setLayer("sheets", quads.data, quads.count);
      scene.setLayer("lines", segs.data, segs.count);
      scene.setLayer("boxes", boxes.data, boxes.count);
      scene.setLayer("dots", dots, model.dots.length + extra.length);
    };

    const relabel = () => {
      box.replaceChildren();
      spans = (model?.labels ?? []).map((l) => {
        const s = document.createElement("span");
        s.className = `ask-deep-l ${l.cls}`;
        s.textContent = l.text;
        box.appendChild(s);
        return { el: s, at: l.at, side: l.side };
      });
    };

    let sc0 = sc;
    const setModel = (next: Scene, a: Answer) => {
      sc0 = next;
      model = build(next, a, map);
      center = next.frame ? [(next.frame.x0 + next.frame.x1) / 2, (next.frame.y0 + next.frame.y1) / 2] : [el.clientWidth / 2, el.clientHeight / 2];
      fit();
      relabel();
      push();
      place();
    };

    // Nearest mark to the pointer on screen: the segment from the foot to the top of a column, or a point.
    const pickAt = (sx: number, sy: number): MarkT | null => {
      if (!scene || !model) return null;
      const fr = scene.frustum();
      let best: MarkT | null = null, bd = 14;
      for (const b of model.boxes) {
        const p = scene.project(b.x, b.y, 0, fr), q = scene.project(b.x, b.y, b.h, fr);
        const dx = q[0] - p[0], dy = q[1] - p[1], len = dx * dx + dy * dy || 1;
        const u = Math.max(0, Math.min(1, ((sx - p[0]) * dx + (sy - p[1]) * dy) / len));
        const wpx = (b.half * scene.cam.scale) / Math.max(0.3, p[2] / scene.frustum().dist);
        const d = Math.hypot(sx - p[0] - dx * u, sy - p[1] - dy * u) - wpx;
        if (d < bd) { bd = d; best = b.m; }
      }
      for (const d of model.dots) {
        const p = scene.project(d.x, d.y, d.z, fr);
        const dist = Math.hypot(sx - p[0], sy - p[1]) - d.r;
        if (dist < bd) { bd = dist; best = d.m; }
      }
      return best;
    };

    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        yaw -= dx * 0.006;
        pitch = Math.max(0.3, Math.min(TOP_DOWN - 0.02, pitch + dy * 0.004));
        drag.x = e.clientX; drag.y = e.clientY;
        place();
        return;
      }
      const m = pickAt(e.offsetX, e.offsetY);
      if ((m?.id ?? null) !== hover) { hover = m?.id ?? null; push(); }
      latest.current.onHover(m, { x: e.clientX, y: e.clientY });
    };
    const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const up = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      if (d && !d.moved) { const m = pickAt(e.offsetX, e.offsetY); if (m) latest.current.onPick(m, { x: e.offsetX, y: e.offsetY }); }
    };
    const leave = () => { if (hover) { hover = null; push(); } latest.current.onHover(null, { x: 0, y: 0 }); };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(0.5, Math.min(3, zoom * Math.exp(-e.deltaY * 0.0015)));
      place();
    };
    const ro = new ResizeObserver(() => { fit(); place(); });

    api.current = {
      update(next, a, s) { selected = s; setModel(next, a); },
      leave(done) {
        if (motion.level === 0) { done(); return; }
        glide = { from: t, to: 0, t0: performance.now(), ms: 650, done };
      },
    };

    getGpu().then((gpu) => {
      if (gone) return;
      scene = new GpuScene(gpu, el, [
        { kind: "quads", name: "sheets" },
        { kind: "segs", name: "lines" },
        { kind: "boxes", name: "boxes" },
        { kind: "marks", name: "dots", blend: theme.gpu.additive ? "additive" : "premultiplied" },
      ], { depth: true });
      scene.animated = false;
      scene.onTick = (now) => {
        if (!glide) return;
        const k = Math.min(1, (now - glide.t0) / glide.ms);
        t = glide.from + (glide.to - glide.from) * k;
        place();
        if (k >= 1) { const d = glide.done; glide = null; d?.(); }
      };
      setModel(sc0, a);
      if (motion.level === 0) { t = 1; place(); } else glide = { from: 0, to: 1, t0: performance.now(), ms: 900 };
      ro.observe(el);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", leave);
      el.addEventListener("wheel", wheel, { passive: false });
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
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
      box.replaceChildren();
      scene?.dispose();
    };
  }, [map, theme]);

  useEffect(() => { api.current?.update(sc, a, sel); }, [sc, a, sel]);
  useEffect(() => { if (leaving) api.current?.leave(onLeft); }, [leaving]);

  return (
    <div className="ask-deep" data-status={status}>
      <canvas ref={canvas} aria-label="The current view in three dimensions" />
      <div className="ask-deep-labels" ref={labelBox} />
      {status === "unsupported" ? <p className="ask-deep-msg note">The 3D view draws with WebGPU, which this browser does not provide.</p> : null}
    </div>
  );
}

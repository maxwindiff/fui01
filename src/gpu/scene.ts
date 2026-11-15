import { draw, frameLoop, init, storage, surface } from "vgpu";
import type { Draw, Gpu, StorageBuffer, Surface } from "vgpu";
import marksShader from "./shaders/marks.wgsl";
import segsShader from "./shaders/segments.wgsl";
import quadsShader from "./shaders/quads.wgsl";
import boxesShader from "./shaders/boxes.wgsl";
import type { RGBA } from "../themes";
import { motion, onMotionChange } from "../motion";

export const MARK_FLOATS = 16;
export const SEG_FLOATS = 20;
export const QUAD_FLOATS = 28;
export const BOX_FLOATS = 28;
export const SHAPE = { circle: 0, square: 1, diamond: 2, hexagon: 3, triangle: 4, asterisk: 5, plus: 6 } as const;

type Kind = "marks" | "segs" | "quads" | "boxes";
const KINDS = {
  marks: { shader: marksShader, floats: MARK_FLOATS, binding: "marks", vertices: 6 },
  segs: { shader: segsShader, floats: SEG_FLOATS, binding: "segs", vertices: 6 },
  quads: { shader: quadsShader, floats: QUAD_FLOATS, binding: "quads", vertices: 6 },
  boxes: { shader: boxesShader, floats: BOX_FLOATS, binding: "boxes", vertices: 30 },
} as const;
const BLENDS = {
  premultiplied: "premultiplied",
  additive: "additive",
  darken: { color: { src: "one", dst: "one", op: "min" }, alpha: { src: "one", dst: "one", op: "max" } },
} as const;

export interface LayerSpec {
  kind: Kind;
  name: string;
  blend?: keyof typeof BLENDS;
  glow?: number;
}
// Boxes are solid and sort themselves through a depth buffer. An opaque scene clears to its ground colour, which the
// darken blend of cast shadows relies on.
export interface SceneOptions {
  solid?: boolean;
}
interface Layer extends LayerSpec {
  draw: Draw;
  buffer: StorageBuffer;
  capacity: number;
  count: number;
}

// scale is CSS pixels per world unit at the target. pitch of a quarter turn looks straight down.
export interface Camera {
  tx: number; ty: number; tz: number;
  yaw: number; pitch: number;
  scale: number;
  fov: number;
}
export const TOP_DOWN = Math.PI / 2;

interface Frustum {
  m: Float32Array;
  eye: [number, number, number];
  r: [number, number, number];
  u: [number, number, number];
  f: [number, number, number];
  dist: number;
  focal: number;
}

let gpuPromise: Promise<Gpu> | null = null;
export function getGpu(): Promise<Gpu> {
  if (!gpuPromise) {
    gpuPromise = init().then((gpu) => {
      gpu.onError((e) => console.error("[gpu]", e));
      start(gpu);
      return gpu;
    });
  }
  return gpuPromise;
}

const scenes = new Set<Scene>();
// Set while a layout transition runs, so the views draw only when something changes.
export const gpuState = { paused: false };
export function wakeScenes() { for (const scene of scenes) scene.dirty = true; }
onMotionChange(wakeScenes);

function start(gpu: Gpu) {
  // Seconds of travel for dashes and pulses. The clock runs faster at the Lively level and stops below Standard.
  let travel = 0;
  let prev = performance.now();
  frameLoop(gpu, (frame) => {
    const now = performance.now();
    const ambient = motion.level >= 2;
    const moving = ambient && !gpuState.paused;
    if (moving) travel += (Math.min(100, now - prev) / 1000) * (motion.level === 3 ? 1.6 : 1);
    prev = now;
    for (const scene of scenes) {
      if (!scene.visible) continue;
      scene.tick(now);
      if (!scene.dirty && !(scene.animated && moving)) continue;
      scene.encode(frame, ambient ? travel : 0, now);
    }
  });
}

export class Scene {
  cam: Camera = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: TOP_DOWN, scale: 1, fov: 0.5 };
  lift = 0;
  aperture = 0;
  fogFloor = 1;
  fade = 1;
  reveal = 1;
  pivot: [number, number] = [0, 0];
  bg: RGBA = [0, 0, 0, 1];
  visible = true;
  dirty = true;
  animated = false;
  frameMs = 0;
  onFrame?: (ms: number) => void;
  onTick?: (now: number, dt: number) => void;
  readonly surface: Surface;
  private layers: Layer[];
  private last = 0;
  private lastTick = 0;
  private revealFrom = 0;
  private revealMs = 0;
  private observer: IntersectionObserver;
  private offResize: () => void;

  constructor(private gpu: Gpu, readonly canvas: HTMLCanvasElement, specs: LayerSpec[], private opts: SceneOptions = {}) {
    this.surface = surface(gpu, canvas, { dpr: [1, 2], alphaMode: "premultiplied", depth: !!opts.solid, msaa: !!opts.solid });
    this.layers = specs.map((spec) => {
      const kind = KINDS[spec.kind];
      const buffer = storage(gpu, kind.floats * 4, "read");
      const d = draw(gpu, {
        shader: kind.shader, vertices: kind.vertices, instances: 0, blend: BLENDS[spec.blend ?? "premultiplied"],
        depth: spec.kind === "boxes" ? { write: true, compare: "less-equal" } : false,
      });
      d.set({ [kind.binding]: buffer });
      return { ...spec, draw: d, buffer, capacity: 1, count: 0 };
    });
    this.offResize = this.surface.onResize(() => {
      this.dirty = true;
    });
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.dirty = true;
      this.last = 0;
    });
    this.observer.observe(canvas);
    scenes.add(this);
  }

  // A scene without a layer of that name ignores the write, so builders can emit every kind of geometry.
  setLayer(name: string, data: Float32Array, count: number) {
    const layer = this.layers.find((l) => l.name === name);
    if (!layer) return;
    const kind = KINDS[layer.kind];
    if (count > layer.capacity) {
      layer.capacity = Math.ceil(count * 1.25);
      layer.buffer = storage(this.gpu, layer.capacity * kind.floats * 4, "read");
      layer.draw.set({ [kind.binding]: layer.buffer });
    }
    if (count > 0) layer.buffer.write(data.subarray(0, count * kind.floats) as Float32Array<ArrayBuffer>);
    layer.count = count;
    this.dirty = true;
  }

  playReveal(ms: number) {
    if (motion.level < 2 || ms <= 0) { this.reveal = 1; this.revealMs = 0; this.dirty = true; return; }
    this.reveal = 0;
    this.revealFrom = 0;
    this.revealMs = ms;
    this.dirty = true;
  }

  tick(now: number) {
    const dt = this.lastTick ? Math.min(100, now - this.lastTick) : 16;
    this.lastTick = now;
    if (this.revealMs) {
      // The reveal waits while the panel around the canvas is still hidden, then starts once its frame has begun to draw.
      if (!this.revealFrom && !this.canvas.closest("[data-pending]")) this.revealFrom = now + 300;
      if (this.revealFrom) {
        const t = (now - this.revealFrom) / this.revealMs;
        this.reveal = Math.max(0, Math.min(1, t));
        if (t >= 1) this.revealMs = 0;
      }
      this.dirty = true;
    }
    this.onTick?.(now, dt);
  }

  get width() { return this.canvas.clientWidth; }
  get height() { return this.canvas.clientHeight; }

  frustum(): Frustum {
    const { tx, ty, tz, yaw, pitch, scale, fov } = this.cam;
    const w = this.width || 1, h = this.height || 1;
    const focal = h / 2 / Math.tan(fov / 2);
    const dist = focal / scale;
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const eye: [number, number, number] = [tx + dist * sy * cp, ty + dist * cy * cp, tz + dist * sp];
    const r: [number, number, number] = [cy, -sy, 0];
    const u: [number, number, number] = [-sy * sp, -cy * sp, cp];
    const f: [number, number, number] = [-sy * cp, -cy * cp, -sp];
    const fy = 1 / Math.tan(fov / 2), fx = (fy * h) / w;
    const dot = (a: number[]) => a[0] * eye[0] + a[1] * eye[1] + a[2] * eye[2];
    const near = dist * 0.05, far = dist * 20;
    const za = far / (far - near), zb = (-near * far) / (far - near);
    const m = new Float32Array([
      fx * r[0], fy * u[0], za * f[0], f[0],
      fx * r[1], fy * u[1], za * f[1], f[1],
      fx * r[2], fy * u[2], za * f[2], f[2],
      -fx * dot(r), -fy * dot(u), -za * dot(f) + zb, -dot(f),
    ]);
    return { m, eye, r, u, f, dist, focal };
  }

  // World point to CSS pixels and view depth.
  project(x: number, y: number, z: number, fr = this.frustum()): [number, number, number] {
    const vx = x - fr.eye[0], vy = y - fr.eye[1], vz = z * this.lift - fr.eye[2];
    const d = vx * fr.f[0] + vy * fr.f[1] + vz * fr.f[2];
    const sx = (vx * fr.r[0] + vy * fr.r[1] + vz * fr.r[2]) / d;
    const sy = (vx * fr.u[0] + vy * fr.u[1] + vz * fr.u[2]) / d;
    return [this.width / 2 + sx * fr.focal, this.height / 2 - sy * fr.focal, d];
  }

  // CSS pixel to the point under it on the horizontal plane at height z.
  ground(sx: number, sy: number, z = 0, fr = this.frustum()): [number, number] | null {
    const a = (sx - this.width / 2) / fr.focal, b = -(sy - this.height / 2) / fr.focal;
    const dir = [0, 1, 2].map((k) => fr.f[k] + fr.r[k] * a + fr.u[k] * b);
    if (Math.abs(dir[2]) < 1e-6) return null;
    const t = (z - fr.eye[2]) / dir[2];
    return t > 0 ? [fr.eye[0] + dir[0] * t, fr.eye[1] + dir[1] * t] : null;
  }

  pan(dx: number, dy: number) {
    const fr = this.frustum();
    const k = 1 / this.cam.scale;
    const flat = Math.hypot(fr.u[0], fr.u[1]) || 1;
    this.cam.tx += (-fr.r[0] * dx + (fr.u[0] / flat) * dy) * k;
    this.cam.ty += (-fr.r[1] * dx + (fr.u[1] / flat) * dy) * k;
    this.dirty = true;
  }

  encode(frame: Parameters<Parameters<typeof frameLoop>[1]>[0], time: number, now: number) {
    if (this.surface.disposed) return;
    const fr = this.frustum();
    const dpr = this.surface.dpr;
    const view = {
      proj: fr.m,
      bg: this.bg,
      size: [this.surface.size[0], this.surface.size[1]],
      pivot: this.pivot,
      fog: [fr.dist * 0.95, fr.dist * 1.7],
      focal: fr.focal * dpr,
      dpr,
      time,
      fade: this.fade,
      lift: this.lift,
      focus: fr.dist,
      aperture: this.aperture,
      reveal: this.reveal,
      fogFloor: this.fogFloor,
      glow: 0,
    };
    frame.pass({ target: this.surface, clear: this.opts.solid ? [this.bg[0], this.bg[1], this.bg[2], 1] : [0, 0, 0, 0] }, (pass) => {
      for (const layer of this.layers) {
        if (layer.count === 0) continue;
        view.glow = layer.glow ?? 0;
        layer.draw.set({ view });
        pass.draw(layer.draw, { instances: layer.count });
      }
    });
    this.dirty = false;
    if (this.last) {
      this.frameMs = this.frameMs * 0.9 + (now - this.last) * 0.1;
      this.onFrame?.(this.frameMs);
    }
    this.last = now;
  }

  dispose() {
    scenes.delete(this);
    this.observer.disconnect();
    this.offResize();
    for (const layer of this.layers) layer.draw.dispose();
    this.surface.dispose();
  }
}

export function writeMark(
  out: Float32Array, i: number, x: number, y: number, z: number, radius: number, shape: number,
  color: RGBA, stroke: number, fill: number, halo = 0, world = 0, delay = 0,
) {
  const o = i * MARK_FLOATS;
  out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = radius;
  out[o + 4] = color[0]; out[o + 5] = color[1]; out[o + 6] = color[2]; out[o + 7] = color[3];
  out[o + 8] = stroke; out[o + 9] = fill; out[o + 10] = halo; out[o + 11] = shape;
  out[o + 12] = world; out[o + 13] = delay;
}

export interface Stroke {
  color: RGBA;
  width: number;
  dash?: number;
  flow?: number;
  pulse?: number;
  phase?: number;
  spin?: number;
  delay?: number;
}
type P3 = [number, number, number];

export class SegWriter {
  data: Float32Array;
  count = 0;
  constructor(capacity = 1024) {
    this.data = new Float32Array(capacity * SEG_FLOATS);
  }
  private grow(n: number) {
    if ((this.count + n) * SEG_FLOATS <= this.data.length) return;
    const next = new Float32Array(Math.max(this.data.length * 2, (this.count + n) * SEG_FLOATS));
    next.set(this.data);
    this.data = next;
  }
  private put(a: P3, b: P3, s: Stroke, t0: number, t1: number, total: number) {
    const o = this.count++ * SEG_FLOATS, d = this.data, c = s.color;
    d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; d[o + 3] = s.width;
    d[o + 4] = b[0]; d[o + 5] = b[1]; d[o + 6] = b[2]; d[o + 7] = s.dash ?? 0;
    d[o + 8] = c[0]; d[o + 9] = c[1]; d[o + 10] = c[2]; d[o + 11] = c[3];
    d[o + 12] = s.flow ?? 0; d[o + 13] = s.pulse ?? 0; d[o + 14] = t0; d[o + 15] = t1;
    d[o + 16] = total; d[o + 17] = s.phase ?? 0; d[o + 18] = s.spin ?? 0; d[o + 19] = s.delay ?? 0;
  }
  line(a: P3, b: P3, s: Stroke) {
    this.grow(1);
    this.put(a, b, s, 0, 1, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  path(f: (t: number) => P3, steps: number, s: Stroke) {
    const pts: P3[] = [];
    for (let i = 0; i <= steps; i++) pts.push(f(i / steps));
    this.poly(pts, s);
  }
  // Straight runs through the given points, with dashes and flow carried across the corners.
  poly(pts: P3[], s: Stroke) {
    const steps = pts.length - 1;
    this.grow(steps);
    let total = 0;
    const acc = [0];
    for (let i = 1; i <= steps; i++)
      acc.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])));
    for (let i = 0; i < steps; i++) this.put(pts[i], pts[i + 1], s, acc[i] / total, acc[i + 1] / total, total);
  }
  // Quadratic curve. bend offsets the control point sideways in the ground plane, rise lifts it. Both scale with length.
  curve(a: P3, b: P3, bend: number, rise: number, s: Stroke, steps = 22) {
    if (bend === 0 && rise === 0) return this.line(a, b, s);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
    const my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
    const mz = (a[2] + b[2]) / 2 + len * rise;
    this.path((t) => {
      const u = 1 - t;
      return [u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1], u * u * a[2] + 2 * u * t * mz + t * t * b[2]];
    }, steps, s);
  }
  circle(cx: number, cy: number, z: number, r: number, s: Stroke, steps = 96) {
    this.path((t) => [cx + Math.cos(t * Math.PI * 2) * r, cy + Math.sin(t * Math.PI * 2) * r, z], steps, s);
  }
}

export class QuadWriter {
  data = new Float32Array(8 * QUAD_FLOATS);
  count = 0;
  // A horizontal sheet at height z.
  sheet(x0: number, y0: number, x1: number, y1: number, z: number, color: RGBA, ink: RGBA, grid: number, dotAlpha: number, borderAlpha: number, borderPx: number, delay = 0) {
    const o = this.count++ * QUAD_FLOATS, d = this.data;
    d.set([x0, y0, z, x1 - x0, x1, y0, z, y1 - y0, x0, y1, z, delay, x1, y1, z, 0], o);
    d.set(color, o + 16);
    d.set(ink, o + 20);
    d.set([grid, dotAlpha, borderAlpha, borderPx], o + 24);
  }
  private grow() {
    if ((this.count + 1) * QUAD_FLOATS <= this.data.length) return;
    const next = new Float32Array(this.data.length * 2);
    next.set(this.data);
    this.data = next;
  }
  // The shadow of the edge from a to b on a block of the given height, thrown along dir.
  shadow(a: [number, number], b: [number, number], height: number, dir: [number, number], color: RGBA, delay = 0) {
    this.grow();
    const o = this.count++ * QUAD_FLOATS, d = this.data;
    d.set([a[0], a[1], 0, 0, b[0], b[1], 0, 0, a[0], a[1], height, delay, b[0], b[1], height, 0], o);
    d.set(color, o + 16);
    d.set([dir[0], dir[1], 0, 0, -1, 0, 0, 0], o + 20);
  }
}

export class BoxWriter {
  data: Float32Array;
  count = 0;
  constructor(capacity = 256) {
    this.data = new Float32Array(capacity * BOX_FLOATS);
  }
  // band is a stripe of colour around the sides, bandH its height in world units. lamp brightens the middle of the top.
  box(x: number, y: number, z0: number, half: number, height: number, top: RGBA, side: RGBA, ink: RGBA, outline: number, shade = 0, delay = 0, band?: RGBA, bandH = 0, lamp = 0) {
    if ((this.count + 1) * BOX_FLOATS > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const o = this.count++ * BOX_FLOATS, d = this.data;
    d.set([x, y, z0, half, height, delay, outline, shade], o);
    d.set(top, o + 8);
    d.set(side, o + 12);
    d.set(ink, o + 16);
    d.set(band ?? side, o + 20);
    d.set([band ? bandH : 0, lamp, 0, 0], o + 24);
  }
}

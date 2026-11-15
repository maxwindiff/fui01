import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from "d3-force";
import { FOCUS, GRAPH, mulberry32 } from "../data";
import type { Kind, Sector } from "../data";
import { rgba } from "../themes";
import type { GpuStyle, RGBA, Theme } from "../themes";
import { BoxWriter, MARK_FLOATS, QuadWriter, SegWriter, SHAPE, writeMark } from "./scene";
import type { Stroke } from "./scene";
import { blur, contour, makeField, rim, sample, scaleTo, splat } from "./field";
import type { Field } from "./field";

export const KIND_SHAPE: Record<Kind, number> = {
  official: SHAPE.circle,
  person: SHAPE.circle,
  corp: SHAPE.square,
  firm: SHAPE.diamond,
  pac: SHAPE.triangle,
  agency: SHAPE.hexagon,
  event: SHAPE.asterisk,
};
const SECTORS: Sector[] = ["gov", "corp", "inter", "event"];
const EDGE = { plain: 0, money: 1, contact: 2, attend: 3 } as const;
const STRATA_GAP = 150;
const STRATA_Z = [STRATA_GAP, -STRATA_GAP, 0, 0];
const STRATA_NAMES = ["Government", "Intermediaries", "Companies and donors"];
const PLATE_STEP = 26;
const DOME_RISE = 0.62;
// Offset of a cast shadow per unit of height. It falls to the right of a block and toward the viewer at the resting angle.
export const SUN: [number, number] = [0.85, 1.2];

export interface NetModel {
  n: number;
  m: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  zBase: Float32Array;
  delay: Float32Array;
  radius: Float32Array;
  shape: Uint8Array;
  sector: Uint8Array;
  hollow: Uint8Array;
  es: Uint32Array;
  et: Uint32Array;
  etype: Uint8Array;
  ew: Float32Array;
  ids: string[];
  names: (string | undefined)[];
  roles: (string | undefined)[];
  labels: number[];
  focus: number;
  rings: number[];
  ringZ: number[];
  sheets: { z: number; name: string; n: number }[];
  // Radius of the wire dome, and the height field under a relief.
  domeR: number;
  terrain?: Field;
  zRange: [number, number];
  bounds: [number, number, number, number];
  // Pitch of the lattice the entities stand on, where the arrangement is a board of keys.
  keys?: number;
  half: number;
  dense: boolean;
  adjStart: Uint32Array;
  adj: Uint32Array;
  grid: { cell: number; cols: number; start: Uint32Array; items: Uint32Array };
}
type Draft = Omit<NetModel, "adjStart" | "adj" | "grid" | "z" | "zBase" | "delay" | "sheets" | "bounds" | "ringZ" | "domeR" | "terrain" | "zRange"> & { depth?: Uint8Array; weight?: Float32Array };

function finish(d: Draft, g: GpuStyle): NetModel {
  const form = g.deep?.form;
  const { n, m, es, et, x, y, half } = d;
  const deg = new Uint32Array(n + 1);
  for (let e = 0; e < m; e++) { deg[es[e] + 1]++; deg[et[e] + 1]++; }
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const adj = new Uint32Array(m * 2);
  const fill = deg.slice(0, n);
  for (let e = 0; e < m; e++) { adj[fill[es[e]]++] = et[e]; adj[fill[et[e]]++] = es[e]; }

  const cols = Math.max(8, Math.min(256, Math.round(Math.sqrt(n) / 2)));
  const cell = (half * 2) / cols;
  const at = (i: number) => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor((x[i] + half) / cell)));
    const cy = Math.max(0, Math.min(cols - 1, Math.floor((y[i] + half) / cell)));
    return cy * cols + cx;
  };
  const start = new Uint32Array(cols * cols + 1);
  for (let i = 0; i < n; i++) start[at(i) + 1]++;
  for (let c = 0; c < cols * cols; c++) start[c + 1] += start[c];
  const items = new Uint32Array(n);
  const cur = start.slice(0, cols * cols);
  for (let i = 0; i < n; i++) items[cur[at(i)]++] = i;

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < x0) x0 = x[i];
    if (x[i] > x1) x1 = x[i];
    if (y[i] < y0) y0 = y[i];
    if (y[i] > y1) y1 = y[i];
  }
  const reach = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1));

  const z = new Float32Array(n), zBase = new Float32Array(n), delay = new Float32Array(n);
  const domeR = form === "dome" ? (d.rings.length ? d.rings[d.rings.length - 1] + 46 : reach * 1.06) : 0;
  const dome = (r: number) => DOME_RISE * Math.sqrt(Math.max(0, domeR * domeR - r * r));
  const ringZ = d.rings.map((r, k) => (form === "dome" ? dome(r) : (1 - k) * PLATE_STEP));
  let terrain: Field | undefined;
  if (form === "relief") {
    const span = Math.max(x1 - x0, y1 - y0);
    const pad = span * 0.16;
    const cell = Math.max(7, span / 110);
    terrain = makeField(x0 - pad, y0 - pad, x1 + pad, y1 + pad, cell);
    for (let i = 0; i < n; i++) splat(terrain, x[i], y[i], d.weight ? d.weight[i] : d.radius[i] > 4 ? 5 : 0.5);
    blur(terrain, Math.max(2, Math.round((d.dense ? span / 30 : 52) / cell)));
    scaleTo(terrain, d.dense ? span * 0.11 : Math.min(170, span * 0.2));
  }
  const count = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const far = Math.hypot(x[i], y[i]) / reach;
    if (d.depth) {
      const turn = (Math.atan2(x[i], -y[i]) / (Math.PI * 2) + 1) % 1;
      delay[i] = Math.min(1, d.depth[i] * 0.2 + turn * 0.22);
    } else {
      delay[i] = Math.min(1, 0.15 + far * 0.8);
    }
    if (form === "strata") {
      zBase[i] = z[i] = STRATA_Z[d.sector[i]];
      count[d.sector[i] === 0 ? 0 : d.sector[i] === 1 ? 2 : 1]++;
    } else if (form === "armillary") {
      const plate = d.depth ? (d.depth[i] === 0 ? 2 * PLATE_STEP : ringZ[Math.min(d.depth[i], ringZ.length) - 1]) : 0;
      zBase[i] = plate;
      z[i] = plate + (d.weight ? 14 + d.weight[i] * 11 : d.radius[i] * (d.radius[i] > 4 ? 9 : 2.2));
    } else if (form === "blocks" && d.keys) {
      z[i] = 8 + Math.min(3, Math.floor(Math.sqrt(d.weight![i]))) * 7;
    } else if (form === "blocks") {
      const h = d.weight ? 8 + d.weight[i] * 11 : d.radius[i] > 4 ? d.radius[i] * 9 : 0;
      z[i] = g.block?.stepped ? Math.ceil(h / 22) * 22 : h;
    } else if (form === "relief") {
      zBase[i] = sample(terrain!, x[i], y[i]);
      z[i] = zBase[i] + (d.weight ? 12 + d.weight[i] * 3.4 : d.radius[i] > 4 ? 16 : 2);
    } else if (form === "dome") {
      zBase[i] = z[i] = dome(Math.hypot(x[i], y[i]));
    }
  }
  let zLo = 0, zHi = 0;
  for (let i = 0; i < n; i++) { if (z[i] < zLo) zLo = z[i]; if (z[i] > zHi) zHi = z[i]; }
  if (form === "armillary" && d.rings.length) { zLo = Math.min(...ringZ) - 20; zHi = Math.min(zHi, 90); }
  if (form === "dome") zHi = dome(0);
  if (form === "relief") zHi *= 0.7;
  const sheets = form === "strata" ? [STRATA_GAP, 0, -STRATA_GAP].map((sz, k) => ({ z: sz, name: STRATA_NAMES[k], n: count[k] })) : [];
  const { depth: _depth, weight: _weight, ...rest } = d;
  return { ...rest, z, zBase, delay, ringZ, sheets, domeR, terrain, zRange: [zLo, zHi], bounds: [x0, y0, x1, y1], adjStart: deg, adj, grid: { cell, cols, start, items } };
}

export function pick(model: NetModel, wx: number, wy: number, slack: number): number {
  const { cell, cols, start, items } = model.grid;
  const cx = Math.floor((wx + model.half) / cell);
  const cy = Math.floor((wy + model.half) / cell);
  const reach = Math.max(1, Math.ceil(slack / cell));
  let best = -1;
  let bestD = Infinity;
  for (let gy = cy - reach; gy <= cy + reach; gy++) {
    if (gy < 0 || gy >= cols) continue;
    for (let gx = cx - reach; gx <= cx + reach; gx++) {
      if (gx < 0 || gx >= cols) continue;
      const c = gy * cols + gx;
      for (let k = start[c]; k < start[c + 1]; k++) {
        const i = items[k];
        const d = Math.hypot(model.x[i] - wx, model.y[i] - wy) - model.radius[i];
        if (d < slack && d < bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

export function buildCoreModel(g: GpuStyle): NetModel {
  const layout = g.layout;
  const { entities, ties } = GRAPH;
  const n = entities.length;
  const index = new Map(entities.map((e, i) => [e.id, i]));
  const focus = index.get(FOCUS)!;
  const m = ties.length;
  const es = new Uint32Array(m), et = new Uint32Array(m), etype = new Uint8Array(m), ew = new Float32Array(m);
  ties.forEach((t, e) => {
    es[e] = index.get(t.s)!; et[e] = index.get(t.t)!; ew[e] = t.w;
    etype[e] = t.type === "money" || t.type === "lobby" ? EDGE.money : t.type === "contact" ? EDGE.contact : t.type === "attend" ? EDGE.attend : EDGE.plain;
  });
  const radius = Float32Array.from(entities, (e) => 2.6 + Math.sqrt(e.weight) * 2.5);

  type N = { i: number; x?: number; y?: number; depth: number };
  const nodes: N[] = entities.map((_, i) => ({ i, depth: 9 }));
  const links = ties.map((t, e) => ({ source: es[e], target: et[e], w: t.w }));
  let rings: number[] = [];
  let depth: Uint8Array | undefined;

  if (layout === "orbit") {
    const nbr: number[][] = entities.map(() => []);
    for (let e = 0; e < m; e++) { nbr[es[e]].push(et[e]); nbr[et[e]].push(es[e]); }
    nodes[focus].depth = 0;
    const queue = [focus];
    while (queue.length) {
      const a = queue.shift()!;
      for (const b of nbr[a]) if (nodes[b].depth > nodes[a].depth + 1) { nodes[b].depth = nodes[a].depth + 1; queue.push(b); }
    }
    rings = [128, 238, 338, 420];
    const ringOf = (d: number) => (d === 0 ? 0 : rings[Math.min(d, rings.length) - 1]);
    const sim = forceSimulation(nodes as any)
      .force("link", forceLink(links as any).distance(70).strength(0.06))
      .force("charge", forceManyBody().strength(-34))
      .force("radial", forceRadial((d: any) => ringOf(d.depth), 0, 0).strength(1.4))
      .force("collide", forceCollide((d: any) => radius[d.i] + 3.5).iterations(2))
      .stop();
    for (let i = 0; i < 520; i++) sim.tick();
    for (const node of nodes) {
      const r = ringOf(node.depth);
      const a = Math.atan2(node.y!, node.x!);
      node.x = Math.cos(a) * r;
      node.y = Math.sin(a) * r;
    }
    depth = Uint8Array.from(nodes, (d) => Math.min(d.depth, rings.length));
  } else {
    const sim = forceSimulation(nodes as any)
      .force("link", forceLink(links as any).distance((l: any) => 44 + 92 / Math.sqrt(l.w)).strength((l: any) => 0.2 + l.w * 0.045))
      .force("charge", forceManyBody().strength((d: any) => -150 - radius[d.i] * 30).distanceMax(520))
      .force("x", forceX(0).strength(0.022))
      .force("y", forceY(0).strength(0.078))
      .force("collide", forceCollide((d: any) => radius[d.i] + 8).iterations(2))
      .stop();
    for (let i = 0; i < 600; i++) sim.tick();
  }

  const keys = g.block?.keys?.pitch;
  if (keys) {
    // Heavier entities choose first, and each takes the free place nearest to where the layout put it.
    const taken = new Set<number>();
    const order = nodes.map((d) => d.i).sort((a, b) => entities[b].weight - entities[a].weight);
    for (const i of order) {
      const fx = (nodes[i].x! * 0.6) / keys, fy = (nodes[i].y! * 0.6) / keys;
      let best: [number, number] | null = null;
      for (let r = 0; !best; r++) {
        let bd = Infinity;
        for (let cy = Math.round(fy) - r; cy <= Math.round(fy) + r; cy++)
          for (let cx = Math.round(fx) - r; cx <= Math.round(fx) + r; cx++) {
            if (Math.max(Math.abs(cx - Math.round(fx)), Math.abs(cy - Math.round(fy))) !== r || taken.has((cy + 512) * 1024 + cx + 512)) continue;
            const dd = Math.hypot(cx - fx, cy - fy);
            if (dd < bd) { bd = dd; best = [cx, cy]; }
          }
      }
      taken.add((best[1] + 512) * 1024 + best[0] + 512);
      nodes[i].x = best[0] * keys;
      nodes[i].y = best[1] * keys;
      radius[i] = keys * 0.36;
    }
  }
  const x = Float32Array.from(nodes, (d) => d.x!);
  const y = Float32Array.from(nodes, (d) => d.y!);
  let half = 0;
  for (let i = 0; i < n; i++) half = Math.max(half, Math.abs(x[i]), Math.abs(y[i]));
  return finish({
    n, m, x, y, radius, es, et, etype, ew, depth,
    weight: Float32Array.from(entities, (e) => e.weight),
    shape: Uint8Array.from(entities, (e) => KIND_SHAPE[e.kind]),
    sector: Uint8Array.from(entities, (e) => SECTORS.indexOf(e.sector)),
    hollow: Uint8Array.from(entities, (e) => (e.kind === "official" || e.kind === "agency" ? 1 : 0)),
    ids: entities.map((e) => e.id),
    names: entities.map((e) => (e.name === e.id ? undefined : e.name)),
    roles: entities.map((e) => e.role),
    labels: entities.flatMap((e, i) => (e.label ? [i] : [])),
    focus, rings, keys, half: half + 30, dense: false,
  }, g);
}

export function buildStressModel(n: number, g: GpuStyle): NetModel {
  const rand = mulberry32(n);
  const gauss = () => (rand() + rand() + rand() + rand() + rand() + rand() - 3) * 0.82;
  const clusters = Math.max(6, Math.round(Math.sqrt(n) / 3.2));
  const half = Math.sqrt(n) * 7.4;
  const sizes = Array.from({ length: clusters }, (_, c) => 1 / Math.pow(c + 2, 0.72));
  const total = sizes.reduce((a, b) => a + b, 0);
  const x = new Float32Array(n), y = new Float32Array(n), radius = new Float32Array(n);
  const shape = new Uint8Array(n), sector = new Uint8Array(n), hollow = new Uint8Array(n);
  const cstart: number[] = [0];
  let i = 0;
  for (let c = 0; c < clusters; c++) {
    const count = c === clusters - 1 ? n - i : Math.min(n - i, Math.round((sizes[c] / total) * n));
    const a = c * 2.39996;
    const rr = half * 0.84 * Math.sqrt((c + 0.6) / clusters);
    const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr;
    const sigma = Math.sqrt(count) * 2.5;
    const major = Math.floor(rand() * 3);
    const squash = 0.55 + rand() * 0.45, tilt = rand() * Math.PI;
    for (let k = 0; k < count; k++, i++) {
      const gx = gauss() * sigma, gy = gauss() * sigma * squash;
      x[i] = cx + gx * Math.cos(tilt) - gy * Math.sin(tilt);
      y[i] = cy + gx * Math.sin(tilt) + gy * Math.cos(tilt);
      const hub = rand() < 0.012;
      radius[i] = hub ? 5 + rand() * 4 : 1.5 + rand() * 1.6;
      const s = rand() < 0.78 ? major : Math.floor(rand() * 4);
      sector[i] = s;
      shape[i] = s === 3 ? SHAPE.asterisk : [SHAPE.circle, SHAPE.circle, SHAPE.square, SHAPE.diamond, SHAPE.triangle, SHAPE.hexagon][Math.floor(rand() * 6)];
      hollow[i] = s === 0 && hub ? 1 : 0;
    }
    cstart.push(i);
  }
  const m = n * 3;
  const es = new Uint32Array(m), et = new Uint32Array(m), etype = new Uint8Array(m), ew = new Float32Array(m);
  let e = 0;
  for (let c = 0; c < clusters; c++) {
    const a = cstart[c], b = cstart[c + 1];
    for (let s = a; s < b; s++) {
      for (let k = 0; k < 3; k++, e++) {
        es[e] = s;
        const far = rand() < 0.035;
        et[e] = far ? Math.floor(rand() * n) : a + Math.floor(rand() * (b - a));
        const r = rand();
        etype[e] = r < 0.07 ? EDGE.money : r < 0.16 ? EDGE.contact : EDGE.plain;
        ew[e] = 1 + rand() * 4;
      }
    }
  }
  return finish({
    n, m, x, y, radius, shape, sector, hollow, es, et, etype, ew,
    ids: [], names: [], roles: [], labels: [], focus: -1, rings: [], half: half * 1.12, dense: true,
  }, g);
}

export interface NetBuffers {
  quads: QuadWriter;
  surface: Float32Array;
  surfaceCount: number;
  base: SegWriter;
  flows: SegWriter;
  shadows: QuadWriter;
  boxes: BoxWriter;
  marks: Float32Array;
  markCount: number;
}

const mixRgb = (a: RGBA, b: RGBA, k: number): RGBA => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, 1];
const shadeRgb = (c: RGBA, k: number): RGBA => [c[0] * k, c[1] * k, c[2] * k, 1];

// The lit point field of a relief: a hexagonal lattice lifted onto the height field, brighter and larger with height
// and on the slopes that face the light.
export function reliefDots(f: Field, color: RGBA, step: number): { data: Float32Array; count: number } {
  const w = (f.cols - 1) * f.step, h = (f.rows - 1) * f.step;
  let peak = 1;
  for (const v of f.h) if (v > peak) peak = v;
  const rows = Math.floor(h / (step * 0.866)), cols = Math.floor(w / step);
  const data = new Float32Array((rows + 1) * (cols + 1) * 2 * MARK_FLOATS);
  const rand = mulberry32(29);
  const cx = f.x0 + w / 2, cy = f.y0 + h / 2;
  let c = 0;
  for (let r = 0; r <= rows; r++) {
    const y = f.y0 + r * step * 0.866;
    for (let k = 0; k <= cols; k++) {
      const x = f.x0 + k * step + (r % 2 ? step / 2 : 0);
      const z = sample(f, x, y);
      const hn = z / peak;
      const lit = rim(f, x, y);
      const edge = Math.max(Math.abs(x - cx) / (w / 2), Math.abs(y - cy) / (h / 2));
      const fade = 1 - Math.min(1, Math.max(0, (edge - 0.72) / 0.28));
      const a = (0.1 + 0.55 * Math.pow(hn, 0.7) + 0.5 * lit * Math.min(1, hn * 3)) * fade;
      if (a < 0.02) continue;
      const rr = step * (0.07 + 0.1 * hn + 0.16 * lit * Math.min(1, hn * 3));
      const delay = Math.min(1, Math.hypot(x - cx, y - cy) / (w * 0.6));
      writeMark(data, c++, x, y, z, rr, SHAPE.circle, [color[0], color[1], color[2], Math.min(1, a)], 0, 1, 0, 1, delay);
      if (hn > 0.55 && rand() < 0.16)
        writeMark(data, c++, x + (rand() - 0.5) * step, y + (rand() - 0.5) * step, z + 6 + rand() * 34 * hn, step * 0.06, SHAPE.circle, [color[0], color[1], color[2], 0.5 * rand()], 0, 1, 0, 1, Math.min(1, delay + 0.2));
    }
  }
  return { data, count: c };
}

export function buildNetBuffers(model: NetModel, theme: Theme, selected: number): NetBuffers {
  const g = theme.gpu;
  const form = g.deep?.form;
  const clockwork = theme.family === "orrery";
  const { n, m, x, y, z, es, et, etype, ew } = model;
  const colors: RGBA[] = g.sectors ? g.sectors.map((c) => rgba(c)) : SECTORS.map((s) => rgba(theme.vars[`--${s}`]));
  const density = model.dense ? Math.max(0.1, Math.min(1, Math.sqrt(1400 / m))) : 1;
  const widthScale = model.dense ? 0.8 : 1;
  // Ties run along the ground between blocks, and from mark to mark everywhere else.
  const grounded = form === "blocks";
  const P = (i: number): [number, number, number] => [x[i], y[i], grounded ? 0 : z[i]];

  const near = new Uint8Array(n);
  if (selected >= 0) {
    near[selected] = 1;
    for (let k = model.adjStart[selected]; k < model.adjStart[selected + 1]; k++) near[model.adj[k]] = 1;
  }
  const lit = (i: number) => selected < 0 || near[i] === 1;
  const edgeLit = (e: number) => (selected < 0 || es[e] === selected || et[e] === selected ? 1 : 0.13);
  const dim = (c: RGBA, k: number): RGBA => [c[0], c[1], c[2], c[3] * k];

  const quads = new QuadWriter();
  const shadows = new QuadWriter();
  const boxes = new BoxWriter(model.dense ? 1024 : n);
  const base = new SegWriter(model.dense ? m : m * 26 + 4096);
  const flows = new SegWriter(model.dense ? Math.ceil(m * 0.1) : 4096);
  const guide = rgba(g.guide.color, g.guide.alpha);
  const faint = rgba(g.guide.color, g.guide.alpha * 0.55);
  const bg = rgba(g.vizBg);
  let surface: Float32Array = new Float32Array(0);
  let surfaceCount = 0;

  if (form === "strata") {
    const [x0, y0, x1, y1] = model.bounds;
    const pad = model.dense ? 40 : 46;
    const film = rgba("#F6F9F3", 0.6);
    const ink = rgba(g.guide.color, 1);
    [...model.sheets].reverse().forEach((s, k) => quads.sheet(x0 - pad, y0 - pad, x1 + pad, y1 + pad, s.z, film, ink, model.dense ? 0 : 26, 0.22, 0.8, 1, k * 0.12));
    for (const [cx, cy] of [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x0 - pad, y1 + pad], [x1 + pad, y1 + pad]])
      base.line([cx, cy, -STRATA_GAP], [cx, cy, STRATA_GAP], { color: rgba(g.guide.color, 0.3), width: 0.8, dash: 4, delay: 0.3 });
  }

  const keys = model.keys ? g.block!.keys! : undefined;
  if (form === "blocks" && !keys) {
    const [x0, y0, x1, y1] = model.bounds;
    const pad = model.dense ? 40 : 46;
    quads.sheet(x0 - pad, y0 - pad, x1 + pad, y1 + pad, 0, [bg[0], bg[1], bg[2], 0], rgba(g.guide.color, 1), model.dense ? 0 : 24, g.guide.alpha, g.guide.alpha * 1.6, 1, 0);
    const corner = rgba(g.guide.color, Math.min(1, g.guide.alpha * 3));
    for (const [cx, cy, sx, sy] of [[x0 - pad, y0 - pad, 1, 1], [x1 + pad, y0 - pad, -1, 1], [x0 - pad, y1 + pad, 1, -1], [x1 + pad, y1 + pad, -1, -1]]) {
      base.line([cx - 14 * sx, cy, 0], [cx + 22 * sx, cy, 0], { color: corner, width: 1.4, delay: 0.1 });
      base.line([cx, cy - 14 * sy, 0], [cx, cy + 22 * sy, 0], { color: corner, width: 1.4, delay: 0.1 });
    }
  }

  if (form === "relief" && model.terrain) {
    const f = model.terrain;
    const span = (f.cols - 1) * f.step;
    const dots = reliefDots(f, rgba(g.map.dot.color), Math.max(f.step * 0.9, span / 150));
    surface = dots.data;
    surfaceCount = dots.count;
    const cx = f.x0 + span / 2, cy = f.y0 + ((f.rows - 1) * f.step) / 2;
    if (g.contour) {
      let peak = 1;
      for (const v of f.h) if (v > peak) peak = v;
      const cc = rgba(g.contour.color);
      for (let l = 1; l <= g.contour.levels; l++) {
        const v = (peak * l) / (g.contour.levels + 0.7);
        const index = l % 3 === 0;
        contour(f, v, (ax, ay, bx, by) => {
          const far = Math.hypot(ax - cx, ay - cy) / (span * 0.6);
          base.line([ax, ay, v + 0.6], [bx, by, v + 0.6], { color: [cc[0], cc[1], cc[2], g.contour!.alpha * (index ? 1 : 0.5)], width: index ? 1 : 0.7, delay: Math.min(1, far) });
        });
      }
      // A survey grid on the datum, running out past the landform into the haze.
      const reach = span * 0.95, pitch = span / 10;
      const gc = rgba(g.guide.color, g.guide.alpha * 0.28);
      for (let k = -9; k <= 9; k++) {
        base.line([cx + k * pitch, cy - reach, 0], [cx + k * pitch, cy + reach, 0], { color: gc, width: 0.6, delay: 0.5 });
        base.line([cx - reach, cy + k * pitch, 0], [cx + reach, cy + k * pitch, 0], { color: gc, width: 0.6, delay: 0.5 });
      }
    }
    if (g.contour) {
      // The volume the landform is projected into: a box of light with ticks up its near edges.
      const [bx0, by0, bx1, by1] = [f.x0, f.y0, f.x0 + span, f.y0 + (f.rows - 1) * f.step];
      let top = 1;
      for (const v of f.h) if (v > top) top = v;
      top *= 1.12;
      const vc = rgba(g.contour.color, 0.34), vf = rgba(g.contour.color, 0.14);
      const ring = (zz: number, c: RGBA, dash: number) => base.poly([[bx0, by0, zz], [bx1, by0, zz], [bx1, by1, zz], [bx0, by1, zz], [bx0, by0, zz]], { color: c, width: 0.9, dash, delay: 0.1 });
      ring(0, vc, 0);
      ring(top, vf, 5);
      for (const [px, py] of [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]]) {
        base.line([px, py, 0], [px, py, top], { color: vf, width: 0.8, delay: 0.2 });
        for (let t = 1; t <= 4; t++) base.line([px - 5, py, (top * t) / 5], [px + 5, py, (top * t) / 5], { color: vc, width: 0.8, delay: 0.3 });
      }
    }
    if (g.dust) {
      // Motes hang in the air over the landform. The camera's drift and the depth of field do the rest.
      const rand = mulberry32(41), dc = rgba(g.dust.color);
      const grown = new Float32Array(surface.length + g.dust.count * MARK_FLOATS);
      grown.set(surface.subarray(0, surfaceCount * MARK_FLOATS));
      for (let k = 0; k < g.dust.count; k++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * span * 0.75;
        writeMark(grown, surfaceCount++, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 8 + rand() * span * 0.3, span * (0.0012 + rand() * 0.0022), SHAPE.circle, [dc[0], dc[1], dc[2], 0.12 + rand() * 0.4], 0, 1, 0, 1, 0.3 + rand() * 0.7);
      }
      surface = grown;
    }
  }

  if (form === "dome") {
    const R = model.domeR;
    const dome = (r: number) => DOME_RISE * Math.sqrt(Math.max(0, R * R - r * r));
    const frame = rgba(g.edge.color, 0.75);
    const lats = model.rings.length ? model.rings : [0.3, 0.55, 0.78].map((k) => k * R);
    lats.forEach((r, k) => base.circle(0, 0, dome(r), r, { color: model.rings.length ? frame : faint, width: 1, delay: (k + 1) * 0.14 }, 160));
    base.circle(0, 0, 0, R, { color: guide, width: 1.1, delay: 0.62 }, 200);
    base.circle(0, 0, 0, R + 8, { color: faint, width: 0.8, dash: 7, delay: 0.7 }, 200);
    for (let t = 0; t < 72; t++) {
      const a = (t / 72) * Math.PI * 2;
      const len = t % 6 === 0 ? 16 : 6;
      base.line([Math.cos(a) * (R + 8), Math.sin(a) * (R + 8), 0], [Math.cos(a) * (R + 8 + len), Math.sin(a) * (R + 8 + len), 0],
        { color: t % 6 === 0 ? guide : faint, width: 0.9, spin: -Math.PI / 150, delay: 0.7 + (t / 72) * 0.25 });
    }
    const meridians = model.dense ? 8 : 12;
    for (let k = 0; k < meridians; k++) {
      const a = (k / meridians) * Math.PI * 2;
      base.path((t) => [Math.cos(a) * t * R, Math.sin(a) * t * R, dome(t * R)], 30, { color: faint, width: 0.8, spin: Math.PI / 75, delay: 0.2 + t01(k, meridians) * 0.3 });
    }
    const top = dome(0);
    base.line([0, 0, top], [0, 0, top + 46], { color: guide, width: 0.9, delay: 0.2 });
    for (let h = 12; h <= 46; h += 12) base.line([-4, 0, top + h], [4, 0, top + h], { color: guide, width: 0.9, delay: 0.3 });
  }

  if (model.rings.length && form !== "dome") {
    model.rings.forEach((r, k) => {
      const rz = model.ringZ[k];
      const ringDelay = (k + 1) * 0.14;
      const rate = clockwork ? ((k % 2 ? -1 : 1) * Math.PI * 2) / (240 + k * 160) : 0;
      base.circle(0, 0, rz, r, { color: guide, width: 0.8, delay: ringDelay }, 160);
      const ticks = 72 * (k + 1);
      for (let t = 0; t < ticks; t++) {
        const a = (t / ticks) * Math.PI * 2 - Math.PI / 2;
        const long = t % (6 * (k + 1)) === 0;
        const len = long ? 9 : t % (k + 1) === 0 ? 4.5 : 2.5;
        base.line([Math.cos(a) * r, Math.sin(a) * r, rz], [Math.cos(a) * (r + len), Math.sin(a) * (r + len), rz],
          { color: long ? guide : faint, width: 0.8, spin: rate, delay: Math.min(1, ringDelay + (t / ticks) * 0.3) });
      }
    });
    const last = model.rings.length - 1;
    const outer = model.rings[last] + 22;
    const oz = model.ringZ[last] - PLATE_STEP;
    base.circle(0, 0, oz, outer, { color: guide, width: 0.8, delay: 0.75 }, 200);
    base.circle(0, 0, oz, outer + 4, { color: faint, width: 0.8, dash: 3, delay: 0.8 }, 200);
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      base.line([Math.cos(a) * 26, Math.sin(a) * 26, oz], [Math.cos(a) * outer, Math.sin(a) * outer, oz], { color: rgba(g.guide.color, g.guide.alpha * 0.3), width: 0.6, delay: 0.6 + t * 0.02 });
    }
    if (form === "armillary") {
      const cage = outer + 26;
      const tilt = 0.41;
      const cageStroke: Stroke = { color: rgba(g.guide.color, g.guide.alpha * 0.5), width: 0.8, delay: 0.85 };
      base.path((t) => [Math.cos(t * Math.PI * 2) * cage, 0, Math.sin(t * Math.PI * 2) * cage * 0.62], 120, cageStroke);
      base.path((t) => {
        const a = t * Math.PI * 2;
        return [Math.cos(a) * cage, Math.sin(a) * cage * Math.cos(tilt), Math.sin(a) * cage * Math.sin(tilt)];
      }, 160, { ...cageStroke, dash: 5 });
      const top = 150;
      base.line([0, 0, oz], [0, 0, top], { color: guide, width: 0.8, delay: 0.2 });
      for (let h = 0; h <= top; h += 25) base.line([-5, 0, h], [5, 0, h], { color: guide, width: 0.8, delay: 0.3 });
    }
  }

  const stemmed = form === "armillary" || form === "relief";
  if (stemmed) {
    const stem = rgba(g.guide.color, model.dense ? 0.16 : form === "relief" ? 0.7 : 0.5);
    for (let i = 0; i < n; i++) {
      if (model.dense && model.radius[i] < 4) continue;
      base.line([x[i], y[i], model.zBase[i]], [x[i], y[i], z[i]], { color: dim(stem, lit(i) ? 1 : 0.25), width: 0.8, delay: model.delay[i] });
    }
  }

  const edgeC = rgba(g.edge.color, g.edge.alpha * density * (model.dense && g.additiveBase ? 0.5 : 1));
  const contactC = rgba(g.contact.color, g.contact.alpha * Math.min(1, density * 1.6));
  const moneyC = rgba(g.money.color, g.money.alpha * (model.dense ? Math.min(1, density * 3) : 1));
  const bend = model.dense ? 0 : g.edge.curve;
  const rise = (form === "armillary" || form === "relief") && !model.dense ? 0.07 : 0;
  const steps = 22;
  const money: number[] = [];
  const edgeDelay = (e: number) => Math.max(0, Math.min(model.delay[es[e]], model.delay[et[e]]) - 0.08);

  // On a board of keys a tie leaves its source sideways, runs along the gaps between the keys and enters its target
  // from above or below. An offset inside the gap keeps ties that share a run apart.
  const route = (e: number): [number, number, number][] => {
    const p = keys!.pitch, a = es[e], b = et[e];
    const dx = x[b] >= x[a] ? 1 : -1, dy = y[b] >= y[a] ? 1 : -1;
    const o1 = (((e * 0.618) % 1) - 0.5) * p * 0.2, o2 = (((e * 0.382) % 1) - 0.5) * p * 0.2;
    const gx = x[a] + dx * p * 0.5 + o1, gy = y[b] - dy * p * 0.5 + o2;
    return [[x[a] + dx * p * 0.36, y[a], 0], [gx, y[a], 0], [gx, gy, 0], [x[b], gy, 0], [x[b], y[b] - dy * p * 0.36, 0]];
  };

  for (let e = 0; e < m; e++) {
    const type = etype[e];
    if (type === EDGE.money) { money.push(e); continue; }
    const k = edgeLit(e);
    const s: Stroke = type === EDGE.contact
      ? { color: dim(contactC, k), width: g.contact.width * widthScale, dash: g.contact.dash, delay: edgeDelay(e) }
      : { color: dim(edgeC, type === EDGE.attend ? k * 0.7 : k), width: g.edge.width * widthScale, dash: type === EDGE.attend ? 3 : 0, delay: edgeDelay(e) };
    if (keys) base.poly(route(e), s);
    else base.curve(P(es[e]), P(et[e]), bend, rise, s, steps);
  }

  const rand = mulberry32(3);
  const strong = (e: number) => model.dense || ew[e] >= 2;
  const mw = (e: number) => (model.dense ? 1 : strong(e) ? g.money.width * (0.5 + ew[e] * 0.085) : g.money.weak);
  const lift = model.dense || grounded ? 0 : form === "armillary" || form === "relief" ? 0.24 : form === "dome" ? 0.2 : 0;
  for (const e of money) {
    const color = dim(moneyC, edgeLit(e) * (strong(e) ? 1 : g.money.weakAlpha));
    const s: Stroke = { color, width: mw(e) * (strong(e) ? widthScale : 1), phase: rand(), delay: edgeDelay(e) };
    if (strong(e)) {
      if (g.money.mode === "pulse") { s.flow = 0.16 + rand() * 0.14; s.pulse = 1.5; }
      else { s.dash = model.dense ? 6 : 8; s.flow = 0.9; }
    }
    if (keys) flows.poly(route(e), s);
    else flows.curve(P(es[e]), P(et[e]), bend, strong(e) ? lift : rise, s, steps);
  }

  const blk = form === "blocks" ? g.block : undefined;
  if (blk) {
    const ink = rgba(blk.ink, blk.inkAlpha);
    const shade = rgba(blk.shadowColor, blk.shadow);
    if (keys) {
      const p = keys.pitch, [x0, y0, x1, y1] = model.bounds;
      const blank = rgba(keys.blank), used = new Set<number>();
      for (let i = 0; i < n; i++) used.add(Math.round(y[i] / p) * 4096 + Math.round(x[i] / p));
      for (let cy = Math.round(y0 / p) - 1; cy <= Math.round(y1 / p) + 1; cy++)
        for (let cx = Math.round(x0 / p) - 1; cx <= Math.round(x1 / p) + 1; cx++)
          if (!used.has(cy * 4096 + cx)) boxes.box(cx * p, cy * p, 0, p * 0.36, 4, blank, shadeRgb(blank, 0.7), ink, blk.outline, 0, Math.min(1, Math.hypot(cx * p, cy * p) / model.half));
    }
    for (let i = 0; i < n; i++) {
      if (model.dense && model.radius[i] < 4) continue;
      const half = keys ? keys.pitch * 0.36 : model.radius[i] * blk.width;
      const hot = i === model.focus && blk.focus;
      let top = hot ? rgba(blk.focus!) : blk.paint === "sector" ? colors[model.sector[i]] : rgba(blk.top);
      let side = hot ? rgba(blk.focus!) : blk.paint === "sector" ? shadeRgb(colors[model.sector[i]], 0.82) : rgba(blk.side);
      if (!lit(i)) { top = mixRgb(top, bg, 0.72); side = mixRgb(side, bg, 0.72); }
      const band = blk.band && !hot ? (lit(i) ? colors[model.sector[i]] : mixRgb(colors[model.sector[i]], bg, 0.72)) : undefined;
      boxes.box(x[i], y[i], 0, half, z[i], top, side, ink, blk.outline, 0, model.delay[i], band, half * 2 * (blk.band ?? 0), keys && lit(i) ? keys.lamp : 0);
      if (blk.shadow > 0 && lit(i)) shadows.shadow([x[i] - half, y[i] + half], [x[i] + half, y[i] - half], z[i], SUN, shade, model.delay[i]);
    }
  }

  const marks = new Float32Array((n * (stemmed ? 2 : 1) + 4) * MARK_FLOATS);
  let c = 0;
  if (stemmed) {
    const foot = rgba(g.guide.color, 0.75);
    for (let i = 0; i < n; i++) {
      if (model.dense && model.radius[i] < 4) continue;
      writeMark(marks, c++, x[i], y[i], model.zBase[i], 1.3, SHAPE.circle, dim(foot, lit(i) ? 1 : 0.25), 0, 1, 0, 1, model.delay[i]);
    }
  }
  const glyph = blk?.glyph ? rgba(blk.glyph) : null;
  for (let i = 0; i < n; i++) {
    const boxed = blk && !(model.dense && model.radius[i] < 4);
    const own = boxed && i === model.focus && blk.focus ? rgba("#FFFFFF") : boxed && glyph ? glyph : colors[model.sector[i]];
    const col = dim(own, lit(i) ? 1 : 0.2);
    const r = model.radius[i] * (boxed ? g.node.scale : blk ? 1 : g.node.scale);
    const hollow = model.shape[i] !== SHAPE.asterisk && (g.node.hollowAll || (g.node.hollowOfficials && model.hollow[i] === 1));
    const knock = boxed ? 0 : -1;
    writeMark(marks, c++, x[i], y[i], z[i], r, model.shape[i], col, hollow ? g.node.stroke : 0, hollow ? knock : 1, model.dense ? 0 : g.node.halo, 1, Math.min(1, model.delay[i] + 0.1));
  }
  const reach = (i: number) => (keys ? keys.pitch * 0.5 : blk ? model.radius[i] * blk.width * 1.2 : model.radius[i] * g.node.scale);
  const ring = (i: number, pad: number, width: number, color: RGBA) =>
    writeMark(marks, c++, x[i], y[i], z[i], reach(i) + pad, SHAPE.circle, color, width, 0, 0, 1, model.delay[i]);
  if (model.focus >= 0 && selected !== model.focus) ring(model.focus, 5, g.focus.ring, rgba(g.focus.color, selected < 0 ? 1 : 0.4));
  if (selected >= 0) {
    ring(selected, 5, g.focus.ring * 1.3, rgba(g.focus.color));
    ring(selected, 9.5, 0.8, rgba(g.focus.color, 0.55));
  }
  return { quads, surface, surfaceCount, base, flows, shadows, boxes, marks, markCount: c };
}

const t01 = (k: number, n: number) => k / Math.max(1, n - 1);

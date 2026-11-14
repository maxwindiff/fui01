import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from "d3-force";
import { FOCUS, GRAPH, mulberry32 } from "../data";
import type { Kind, Sector } from "../data";
import { rgba } from "../themes";
import type { DeepSpace, RGBA, Theme } from "../themes";
import { MARK_FLOATS, QuadWriter, SegWriter, SHAPE, writeMark } from "./scene";
import type { Stroke } from "./scene";

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
  names: (string | undefined)[];
  roles: (string | undefined)[];
  labels: number[];
  focus: number;
  rings: number[];
  ringZ: number[];
  sheets: { z: number; name: string; n: number }[];
  bounds: [number, number, number, number];
  half: number;
  dense: boolean;
  adjStart: Uint32Array;
  adj: Uint32Array;
  grid: { cell: number; cols: number; start: Uint32Array; items: Uint32Array };
}
type Draft = Omit<NetModel, "adjStart" | "adj" | "grid" | "z" | "zBase" | "delay" | "sheets" | "bounds" | "ringZ"> & { depth?: Uint8Array; weight?: Float32Array };

function finish(d: Draft, form: DeepSpace["form"] | undefined): NetModel {
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
  const ringZ = d.rings.map((_, k) => (1 - k) * PLATE_STEP);
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
    }
  }
  const sheets = form === "strata" ? [STRATA_GAP, 0, -STRATA_GAP].map((sz, k) => ({ z: sz, name: STRATA_NAMES[k], n: count[k] })) : [];
  const { depth: _depth, weight: _weight, ...rest } = d;
  return { ...rest, z, zBase, delay, ringZ, sheets, bounds: [x0, y0, x1, y1], adjStart: deg, adj, grid: { cell, cols, start, items } };
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

export function buildCoreModel(layout: "force" | "orbit", form?: DeepSpace["form"]): NetModel {
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
    names: entities.map((e) => (e.name === e.id ? undefined : e.name)),
    roles: entities.map((e) => e.role),
    labels: entities.flatMap((e, i) => (e.label ? [i] : [])),
    focus, rings, half: half + 30, dense: false,
  }, form);
}

export function buildStressModel(n: number, form?: DeepSpace["form"]): NetModel {
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
    names: [], roles: [], labels: [], focus: -1, rings: [], half: half * 1.12, dense: true,
  }, form);
}

export interface NetBuffers {
  quads: QuadWriter;
  base: SegWriter;
  flows: SegWriter;
  marks: Float32Array;
  markCount: number;
}

export function buildNetBuffers(model: NetModel, theme: Theme, selected: number): NetBuffers {
  const g = theme.gpu;
  const form = g.deep?.form;
  const clockwork = theme.family === "orrery";
  const { n, m, x, y, z, es, et, etype, ew } = model;
  const colors: RGBA[] = SECTORS.map((s) => rgba(theme.vars[`--${s}`]));
  const density = model.dense ? Math.max(0.1, Math.min(1, Math.sqrt(1400 / m))) : 1;
  const widthScale = model.dense ? 0.8 : 1;
  const P = (i: number): [number, number, number] => [x[i], y[i], z[i]];

  const near = new Uint8Array(n);
  if (selected >= 0) {
    near[selected] = 1;
    for (let k = model.adjStart[selected]; k < model.adjStart[selected + 1]; k++) near[model.adj[k]] = 1;
  }
  const lit = (i: number) => selected < 0 || near[i] === 1;
  const edgeLit = (e: number) => (selected < 0 || es[e] === selected || et[e] === selected ? 1 : 0.13);
  const dim = (c: RGBA, k: number): RGBA => [c[0], c[1], c[2], c[3] * k];

  const quads = new QuadWriter();
  const base = new SegWriter(model.dense ? m : m * 26 + 4096);
  const flows = new SegWriter(model.dense ? Math.ceil(m * 0.1) : 4096);
  const guide = rgba(g.guide.color, g.guide.alpha);
  const faint = rgba(g.guide.color, g.guide.alpha * 0.55);

  if (form === "strata") {
    const [x0, y0, x1, y1] = model.bounds;
    const pad = model.dense ? 40 : 46;
    const film = rgba("#F6F9F3", 0.6);
    const ink = rgba(g.guide.color, 1);
    [...model.sheets].reverse().forEach((s, k) => quads.sheet(x0 - pad, y0 - pad, x1 + pad, y1 + pad, s.z, film, ink, model.dense ? 0 : 26, 0.22, 0.8, 1, k * 0.12));
    for (const [cx, cy] of [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x0 - pad, y1 + pad], [x1 + pad, y1 + pad]])
      base.line([cx, cy, -STRATA_GAP], [cx, cy, STRATA_GAP], { color: rgba(g.guide.color, 0.3), width: 0.8, dash: 4, delay: 0.3 });
  }

  if (model.rings.length) {
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

  if (form === "armillary") {
    const stem = rgba(g.guide.color, model.dense ? 0.16 : 0.5);
    for (let i = 0; i < n; i++) {
      if (model.dense && model.radius[i] < 4) continue;
      base.line([x[i], y[i], model.zBase[i]], P(i), { color: dim(stem, lit(i) ? 1 : 0.25), width: 0.8, delay: model.delay[i] });
    }
  }

  const edgeC = rgba(g.edge.color, g.edge.alpha * density);
  const contactC = rgba(g.contact.color, g.contact.alpha * Math.min(1, density * 1.6));
  const moneyC = rgba(g.money.color, g.money.alpha * (model.dense ? Math.min(1, density * 3) : 1));
  const bend = model.dense ? 0 : g.edge.curve;
  const rise = form === "armillary" && !model.dense ? 0.07 : 0;
  const steps = 22;
  const money: number[] = [];
  const edgeDelay = (e: number) => Math.max(0, Math.min(model.delay[es[e]], model.delay[et[e]]) - 0.08);

  for (let e = 0; e < m; e++) {
    const type = etype[e];
    if (type === EDGE.money) { money.push(e); continue; }
    const k = edgeLit(e);
    const s: Stroke = type === EDGE.contact
      ? { color: dim(contactC, k), width: g.contact.width * widthScale, dash: g.contact.dash, delay: edgeDelay(e) }
      : { color: dim(edgeC, type === EDGE.attend ? k * 0.7 : k), width: g.edge.width * widthScale, dash: type === EDGE.attend ? 3 : 0, delay: edgeDelay(e) };
    base.curve(P(es[e]), P(et[e]), bend, rise, s, steps);
  }

  const rand = mulberry32(3);
  const strong = (e: number) => model.dense || ew[e] >= 2;
  const mw = (e: number) => (model.dense ? 1 : strong(e) ? g.money.width * (0.5 + ew[e] * 0.085) : g.money.weak);
  const lift = form === "armillary" && !model.dense ? 0.24 : 0;
  for (const e of money) {
    const color = dim(moneyC, edgeLit(e) * (strong(e) ? 1 : g.money.weakAlpha));
    const s: Stroke = { color, width: mw(e) * (strong(e) ? widthScale : 1), phase: rand(), delay: edgeDelay(e) };
    if (strong(e)) {
      if (g.money.mode === "pulse") { s.flow = 0.16 + rand() * 0.14; s.pulse = 1.5; }
      else { s.dash = model.dense ? 6 : 8; s.flow = 0.9; }
    }
    flows.curve(P(es[e]), P(et[e]), bend, strong(e) ? lift : rise, s, steps);
  }

  const marks = new Float32Array((n * (form === "armillary" ? 2 : 1) + 4) * MARK_FLOATS);
  let c = 0;
  if (form === "armillary") {
    const foot = rgba(g.guide.color, 0.75);
    for (let i = 0; i < n; i++) {
      if (model.dense && model.radius[i] < 4) continue;
      writeMark(marks, c++, x[i], y[i], model.zBase[i], 1.3, SHAPE.circle, dim(foot, lit(i) ? 1 : 0.25), 0, 1, 0, 1, model.delay[i]);
    }
  }
  for (let i = 0; i < n; i++) {
    const col = dim(colors[model.sector[i]], lit(i) ? 1 : 0.2);
    const r = model.radius[i] * g.node.scale;
    const hollow = g.node.hollowOfficials && model.hollow[i] === 1 && model.shape[i] !== SHAPE.asterisk;
    writeMark(marks, c++, x[i], y[i], z[i], r, model.shape[i], col, hollow ? g.node.stroke : 0, hollow ? -1 : 1, 0, 1, Math.min(1, model.delay[i] + 0.1));
  }
  const ring = (i: number, pad: number, width: number, color: RGBA) =>
    writeMark(marks, c++, x[i], y[i], z[i], model.radius[i] * g.node.scale + pad, SHAPE.circle, color, width, 0, 0, 1, model.delay[i]);
  if (model.focus >= 0 && selected !== model.focus) ring(model.focus, 5, g.focus.ring, rgba(g.focus.color, selected < 0 ? 1 : 0.4));
  if (selected >= 0) {
    ring(selected, 5, g.focus.ring * 1.3, rgba(g.focus.color));
    ring(selected, 9.5, 0.8, rgba(g.focus.color, 0.55));
  }
  return { quads, base, flows, marks, markCount: c };
}

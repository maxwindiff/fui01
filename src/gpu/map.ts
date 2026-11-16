import { geoAlbersUsa } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { CITIES, MAP_EVENTS, MAP_FLOWS, STATE_GIVING, mulberry32 } from "../data";
import { rgba } from "../themes";
import type { RGBA, Theme } from "../themes";
import { BoxWriter, MARK_FLOATS, QuadWriter, SegWriter, SHAPE, writeMark } from "./scene";
import type { Stroke } from "./scene";
import { blur, makeField, rim, sample, scaleTo, splat } from "./field";
import type { Field } from "./field";
import { SUN } from "./network";

export const MAP_W = 975;
export const MAP_H = 610;

export const POSTAL: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

export interface MapModel {
  states: { name: string; code: string; value: number; cx: number; cy: number }[];
  ids: Uint8Array;
  borders: [number, number][][];
  dots: { x: number; y: number; state: number }[];
  // A square lattice for the block arrangements, with a lookup from lattice position to cell.
  cells: { x: number; y: number; state: number; col: number; row: number }[];
  cellAt: Int32Array;
  cellCols: number;
  cellStep: number;
  outlines: { state: number; ring: [number, number][] }[];
  // Giving spread across state lines into a surface from 0 to 1.
  field: Field;
  cities: Record<string, { x: number; y: number; name: string; side: string }>;
  max: number;
}

let cached: Promise<MapModel> | null = null;
export function loadMap(): Promise<MapModel> {
  return (cached ??= build());
}

async function build(): Promise<MapModel> {
  const us = (await import("us-atlas/states-albers-10m.json")).default as unknown as Topology;
  const fc = feature(us, us.objects.states as GeometryCollection<{ name: string }>);
  const states = fc.features.map((f) => {
    const code = POSTAL[f.properties.name] ?? "";
    return { name: f.properties.name, code, value: STATE_GIVING[code] ?? 0, cx: 0, cy: 0 };
  });

  const canvas = new OffscreenCanvas(MAP_W, MAP_H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  fc.features.forEach((f, i) => {
    // Ids are spaced four apart so that the rounding of a partly covered pixel still decodes to the right state.
    ctx.fillStyle = `rgb(${(i + 1) * 4},0,0)`;
    ctx.beginPath();
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const poly of polys) for (const ring of poly) {
      ring.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    }
    ctx.fill("evenodd");
  });
  const img = ctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const raw = new Uint8Array(MAP_W * MAP_H);
  for (let p = 0; p < raw.length; p++) raw[p] = img[p * 4 + 3] > 200 ? Math.round(img[p * 4] / 4) : 0;
  // Antialiasing blends the ids of two neighbouring states along their border into the id of a third. Each pixel takes
  // the commonest id among its eight neighbours, which removes those one-pixel seams.
  const ids = new Uint8Array(raw);
  const near = [-MAP_W - 1, -MAP_W, -MAP_W + 1, -1, 1, MAP_W - 1, MAP_W, MAP_W + 1];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const p = y * MAP_W + x;
      let best = raw[p], bestN = 0;
      for (let a = 0; a < 8; a++) {
        const v = raw[p + near[a]];
        let n = 0;
        for (let b = 0; b < 8; b++) if (raw[p + near[b]] === v) n++;
        if (n > bestN) { bestN = n; best = v; }
      }
      if (bestN >= 3) ids[p] = best;
    }
  }

  const step = 6.2;
  const dots: MapModel["dots"] = [];
  for (let row = 0, y = 6; y < MAP_H; y += step * 0.866, row++) {
    for (let x = 6 + (row % 2 ? step / 2 : 0); x < MAP_W; x += step) {
      const id = ids[Math.round(y) * MAP_W + Math.round(x)];
      if (id) dots.push({ x, y, state: id - 1 });
    }
  }

  const cellStep = 8.6;
  const cellCols = Math.ceil(MAP_W / cellStep), cellRows = Math.ceil(MAP_H / cellStep);
  const cells: MapModel["cells"] = [];
  const cellAt = new Int32Array(cellCols * cellRows).fill(-1);
  for (let row = 0; row < cellRows; row++) {
    for (let col = 0; col < cellCols; col++) {
      const x = (col + 0.5) * cellStep, y = (row + 0.5) * cellStep;
      const id = x < MAP_W && y < MAP_H ? ids[Math.round(y) * MAP_W + Math.round(x)] : 0;
      if (!id) continue;
      cellAt[row * cellCols + col] = cells.length;
      cells.push({ x, y, state: id - 1, col, row });
    }
  }

  const outlines: MapModel["outlines"] = [];
  fc.features.forEach((f, i) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const poly of polys) {
      const src = poly[0] as [number, number][];
      const ring: [number, number][] = [src[0]];
      for (let k = 1; k < src.length; k++) {
        const last = ring[ring.length - 1];
        if (k === src.length - 1 || Math.hypot(src[k][0] - last[0], src[k][1] - last[1]) > 3.2) ring.push(src[k]);
      }
      if (ring.length > 5) outlines.push({ state: i, ring });
    }
  });

  const tally = states.map(() => [0, 0, 0]);
  for (const d of dots) { tally[d.state][0] += d.x; tally[d.state][1] += d.y; tally[d.state][2]++; }
  states.forEach((st, i) => { if (tally[i][2]) { st.cx = tally[i][0] / tally[i][2]; st.cy = tally[i][1] / tally[i][2]; } });

  const lines = mesh(us, us.objects.states as GeometryCollection).coordinates as [number, number][][];
  const borders = lines.map((line) => {
    const out: [number, number][] = [line[0]];
    for (let k = 1; k < line.length; k++) {
      const last = out[out.length - 1];
      if (k === line.length - 1 || Math.hypot(line[k][0] - last[0], line[k][1] - last[1]) > 1.4) out.push(line[k]);
    }
    return out;
  });

  const project = geoAlbersUsa().scale(1300).translate([487.5, 305]);
  const cities: MapModel["cities"] = {};
  for (const c of CITIES) {
    const p = project([c.lon, c.lat])!;
    cities[c.id] = { x: p[0], y: p[1], name: c.name, side: c.side };
  }
  const max = Math.max(...states.map((s) => s.value));
  const field = makeField(0, 0, MAP_W, MAP_H, 6);
  for (const d of dots) splat(field, d.x, d.y, Math.sqrt(states[d.state].value / max));
  blur(field, 3);
  scaleTo(field, 1);
  return { states, ids, borders, dots, cells, cellAt, cellCols, cellStep, outlines, field, cities, max };
}

export function stateAt(model: MapModel, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return -1;
  return model.ids[Math.round(y) * MAP_W + Math.round(x)] - 1;
}

export const SPIKE = 170;
export const spikeHeight = (model: MapModel, state: number) => (model.states[state].value / model.max) * SPIKE;
const RELIEF = 120;
const STOREYS = [2, 18, 36, 56, 78];

const lerpRgb = (a: RGBA, b: RGBA, k: number): RGBA => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, 1];

export function buildMapBuffers(model: MapModel, theme: Theme, hover: number) {
  const m = theme.gpu.map;
  const form = theme.gpu.deep?.form;
  const blk = form === "blocks" ? theme.gpu.block : undefined;
  const share = (state: number) => Math.sqrt(model.states[state].value / model.max);
  const storey = (state: number) => (model.states[state].value ? 1 + Math.min(3, Math.floor(share(state) * 4)) : 0);
  // Height of a state where the arrangement gives every point of it the same height.
  const plateau = (state: number) =>
    form === "armillary" ? share(state) * 58
      : form === "dome" ? (model.states[state].value ? 6 + share(state) * 104 : 0)
        : blk ? (blk.stepped ? STOREYS[storey(state)] : 2 + share(state) * 92)
          : 0;
  const ground = (x: number, y: number) => {
    if (form === "relief") return sample(model.field, x, y) * RELIEF;
    const s = stateAt(model, x, y);
    return s >= 0 ? plateau(s) : 0;
  };
  const dotC = rgba(m.dot.color, m.dot.alpha);
  const rand = mulberry32(17);
  const quads = new QuadWriter();
  const shadows = new QuadWriter();
  const boxes = new BoxWriter(blk ? model.cells.length : 1);
  const lines = new SegWriter(24576);

  if (form === "strata") quads.sheet(-26, -22, MAP_W + 26, MAP_H + 22, 0, rgba("#F5F8F2", 0.5), rgba(m.border.color), 26, 0.16, 0.5, 0.9, 0);

  let dotCount = 0;
  const dots = new Float32Array((m.dot.alpha > 0 && !blk ? model.dots.length : 0) * MARK_FLOATS);
  const stem = rgba(m.dot.color, 0.1);
  if (dots.length) model.dots.forEach((d, i) => {
    const v = share(d.state);
    const lit = hover === d.state;
    const delay = Math.min(1, (d.x / MAP_W) * 0.6 + 0.1);
    if (form === "relief") {
      const hn = sample(model.field, d.x, d.y);
      const light = rim(model.field, d.x, d.y) * Math.min(1, hn * 4) * 2.4;
      const a = Math.min(1, 0.16 + 0.5 * Math.pow(hn, 0.7) + 0.6 * light) * (hover >= 0 && !lit ? 0.55 : 1);
      const r = m.dot.min + (m.dot.max - m.dot.min) * Math.min(1, 0.5 * hn + 0.6 * light);
      writeMark(dots, dotCount++, d.x, d.y, hn * RELIEF, lit ? r + 0.4 : r, m.dot.shape, [dotC[0], dotC[1], dotC[2], dotC[3] * a], 0, 1, 0, 1, delay);
      return;
    }
    const j = m.dot.jitter ? 1 - m.dot.jitter + Math.pow(rand(), 2.2) * m.dot.jitter * 2.2 : 1;
    const r = (m.dot.min + (m.dot.max - m.dot.min) * v) * Math.min(1.25, j);
    const a = (0.3 + 0.7 * v) * Math.min(1, 0.35 + j * 0.65) * (hover >= 0 && !lit ? 0.5 : 1);
    const z = plateau(d.state) * (0.9 + 0.1 * j);
    writeMark(dots, dotCount++, d.x, d.y, z, lit ? r + 0.5 : r, m.dot.shape, [dotC[0], dotC[1], dotC[2], Math.min(1, dotC[3] * a)], 0, 1, m.dot.halo * v * Math.max(0, j - 0.7), 1, delay);
    if (form === "armillary" && z > 6 && i % 2 === 0) lines.line([d.x, d.y, 0], [d.x, d.y, z], { color: stem, width: 0.8, delay });
  });

  if (blk) {
    const ramp = blk.ramp.map((c) => rgba(c));
    const ink = rgba(blk.ink, blk.inkAlpha);
    const shade = rgba(blk.shadowColor, blk.shadow);
    // A coarse lattice keeps every other row and column and doubles the cell.
    const stride = blk.coarse ? 2 : 1;
    const half = (model.cellStep * stride) / 2;
    const shift = ((stride - 1) * model.cellStep) / 2;
    const reach = Math.hypot(SUN[0], SUN[1]);
    const ux = SUN[0] / reach, uy = SUN[1] / reach;
    const cellH = (col: number, row: number) => {
      const k = col < 0 || row < 0 || col >= model.cellCols ? -1 : model.cellAt[row * model.cellCols + col] ?? -1;
      return k < 0 ? -1 : plateau(model.cells[k].state);
    };
    for (const c of model.cells) {
      if (c.col % stride || c.row % stride) continue;
      const h = plateau(c.state);
      const v = share(c.state);
      let top: RGBA;
      if (hover === c.state) top = rgba(blk.hover);
      else if (blk.stepped) top = ramp[storey(c.state)];
      else {
        const t = v * (ramp.length - 1), k = Math.min(ramp.length - 2, Math.floor(t));
        top = lerpRgb(ramp[k], ramp[k + 1], t - k);
      }
      const side = blk.paint === "sector" ? lerpRgb(top, rgba(theme.gpu.vizBg), 0.3) : hover === c.state ? top : rgba(blk.side);
      // A taller block toward the sun puts this top in shade.
      let dark = 0;
      if (blk.shadow > 0) for (let d = 1; d <= 9 && !dark; d++) {
        const other = cellH(Math.round(c.col - ux * d), Math.round(c.row - uy * d));
        if (other - h > (d * model.cellStep) / reach) dark = 0.17;
      }
      const delay = Math.min(1, (c.x / MAP_W) * 0.6 + 0.1);
      boxes.box(c.x + shift, c.y + shift, 0, half, h, top, side, ink, blk.outline, dark, delay);
      if (blk.shadow > 0 && h > 4 && (cellH(c.col + 1, c.row) < 0 || cellH(c.col, c.row + 1) < 0 || cellH(c.col + 1, c.row + 1) < 0))
        shadows.shadow([c.x - half, c.y + half], [c.x + half, c.y - half], h, SUN, shade, delay);
    }
  }

  if (m.border.alpha > 0) {
    const c = rgba(m.border.color, m.border.alpha);
    const drape = form === "relief";
    for (const line of model.borders)
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1], b = line[k];
        lines.line([a[0], a[1], drape ? ground(a[0], a[1]) + 0.8 : 0], [b[0], b[1], drape ? ground(b[0], b[1]) + 0.8 : 0], { color: c, width: m.border.width, delay: (b[0] / MAP_W) * 0.6 });
      }
  }

  if (form === "dome") {
    for (const o of model.outlines) {
      const h = plateau(o.state);
      if (!h) continue;
      const lit = hover === o.state;
      const k = hover >= 0 && !lit ? 0.4 : 1;
      const top = lit ? rgba(m.arc.color) : rgba(m.border.color, (0.5 + 0.5 * share(o.state)) * k);
      const strut = rgba(m.border.color, 0.3 * k);
      const delay = Math.min(1, 0.25 + (o.ring[0][0] / MAP_W) * 0.5);
      for (let j = 1; j < o.ring.length; j++) {
        const a = o.ring[j - 1], b = o.ring[j];
        lines.line([a[0], a[1], h], [b[0], b[1], h], { color: top, width: lit ? 1.5 : 1, delay });
        if (j % 5 === 0) lines.line([b[0], b[1], 0], [b[0], b[1], h], { color: strut, width: 0.8, delay });
      }
    }
  }

  const spikes: number[] = [];
  if (form === "strata") {
    const ink = rgba(m.border.color, 0.9);
    model.states.forEach((st, i) => {
      if (st.value < 60 || !st.cx) return;
      spikes.push(i);
      lines.line([st.cx, st.cy, 0], [st.cx, st.cy, spikeHeight(model, i)], { color: ink, width: 1.5, delay: 0.5 + (st.cx / MAP_W) * 0.3 });
    });
  }

  // Cities stand on the surface: on a short stem over a relief, at the top of their block or plateau elsewhere.
  const poled = form === "relief" || form === "dome";
  const cityZ: Record<string, number> = {};
  for (const [id, p] of Object.entries(model.cities)) cityZ[id] = form === "armillary" || form === "strata" || !form ? 0 : ground(p.x, p.y) + (form === "dome" ? 26 : form === "relief" ? 13 : 0);

  const arcs = new SegWriter(2048);
  const arcC = rgba(m.arc.color, m.arc.alpha);
  const maxFlow = Math.max(...MAP_FLOWS.map((f) => f.v));
  const rise = form ? 0.3 : 0;
  MAP_FLOWS.forEach((f, i) => {
    const a = model.cities[f.s], b = model.cities[f.t];
    const bend = (b.x > a.x ? -1 : 1) * (0.16 + (i % 3) * 0.04);
    const s: Stroke = { color: arcC, width: m.arc.width * (0.5 + 1.1 * Math.sqrt(f.v / maxFlow)), phase: (i * 0.37) % 1, delay: 0.55 + i * 0.03 };
    if (m.arc.mode === "pulse") { s.flow = 0.22; s.pulse = 1.5; } else { s.dash = 8; s.flow = 0.9; }
    if (form === "strata" || form === "armillary") lines.curve([a.x, a.y, 0], [b.x, b.y, 0], bend, 0, { color: rgba(m.border.color, 0.16), width: 1, delay: s.delay }, 40);
    arcs.curve([a.x, a.y, cityZ[f.s]], [b.x, b.y, cityZ[f.t]], bend, rise, s, 40);
  });

  const cityList = Object.entries(model.cities);
  const top = new Float32Array((cityList.length * 2 + MAP_EVENTS.length * 4 + spikes.length) * MARK_FLOATS);
  let c = 0;
  const eventC = rgba(m.event.color);
  for (const e of MAP_EVENTS) {
    const p = model.cities[e.city];
    const z = cityZ[e.city];
    if (form === "armillary") {
      lines.line([p.x, p.y, 0], [p.x, p.y, 80], { color: rgba(m.event.color, 0.7), width: 0.9, dash: 3, delay: 0.8 });
      [30, 55, 80].forEach((h, k) => writeMark(top, c++, p.x, p.y, h, 7 + k * 3.5, SHAPE.hexagon, [eventC[0], eventC[1], eventC[2], 0.5 + k * 0.25], 1.1, 0, 0, 0, 0.8 + k * 0.05));
    }
    writeMark(top, c++, p.x, p.y, z, 13, SHAPE.circle, eventC, 1.2, 0, 0, 0, 0.8);
    if (form !== "armillary") writeMark(top, c++, p.x, p.y, z, 19, SHAPE.circle, [eventC[0], eventC[1], eventC[2], 0.45], 0.8, 0, 0, 0, 0.85);
  }
  const cityC = rgba(m.city.color);
  for (const [id, p] of cityList) {
    if (poled) {
      const foot = ground(p.x, p.y);
      arcs.line([p.x, p.y, foot], [p.x, p.y, cityZ[id]], { color: rgba(m.city.color, 0.7), width: 0.9, delay: 0.65 });
      writeMark(top, c++, p.x, p.y, foot, 1.6, SHAPE.circle, rgba(m.city.color, 0.8), 0, 1, 0, 0, 0.65);
    }
    writeMark(top, c++, p.x, p.y, cityZ[id], m.city.shape === SHAPE.hexagon ? 5.4 : 4.2, m.city.shape, cityC, m.city.fill < 0 ? 1.3 : 0, m.city.fill, 0, 0, 0.7);
  }
  for (const i of spikes) {
    const st = model.states[i];
    writeMark(top, c++, st.cx, st.cy, spikeHeight(model, i), 2.6, SHAPE.circle, rgba(m.border.color), 0, 1, 0, 0, 0.8);
  }
  return { quads, dots, dotCount, lines, arcs, shadows, boxes, top, topCount: c, spikes, cityZ };
}

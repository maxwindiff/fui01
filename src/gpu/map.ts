import { geoAlbersUsa } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { CITIES, MAP_EVENTS, MAP_FLOWS, STATE_GIVING, mulberry32 } from "../data";
import { rgba } from "../themes";
import type { Theme } from "../themes";
import { MARK_FLOATS, QuadWriter, SegWriter, SHAPE, writeMark } from "./scene";
import type { Stroke } from "./scene";

export const MAP_W = 975;
export const MAP_H = 610;

const POSTAL: Record<string, string> = {
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
    ctx.fillStyle = `rgb(${i + 1},0,0)`;
    ctx.beginPath();
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const poly of polys) for (const ring of poly) {
      ring.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    }
    ctx.fill("evenodd");
  });
  const img = ctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const ids = new Uint8Array(MAP_W * MAP_H);
  for (let p = 0; p < ids.length; p++) ids[p] = img[p * 4 + 3] > 200 ? img[p * 4] : 0;

  const step = 6.2;
  const dots: MapModel["dots"] = [];
  for (let row = 0, y = 6; y < MAP_H; y += step * 0.866, row++) {
    for (let x = 6 + (row % 2 ? step / 2 : 0); x < MAP_W; x += step) {
      const id = ids[Math.round(y) * MAP_W + Math.round(x)];
      if (id) dots.push({ x, y, state: id - 1 });
    }
  }

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
  return { states, ids, borders, dots, cities, max: Math.max(...states.map((s) => s.value)) };
}

export function stateAt(model: MapModel, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return -1;
  return model.ids[Math.round(y) * MAP_W + Math.round(x)] - 1;
}

export const SPIKE = 170;
export const spikeHeight = (model: MapModel, state: number) => (model.states[state].value / model.max) * SPIKE;

export function buildMapBuffers(model: MapModel, theme: Theme, hover: number) {
  const m = theme.gpu.map;
  const form = theme.gpu.deep?.form;
  const terrain = (state: number) => (form === "armillary" ? Math.sqrt(model.states[state].value / model.max) * 58 : 0);
  const dotC = rgba(m.dot.color, m.dot.alpha);
  const rand = mulberry32(17);
  const quads = new QuadWriter();
  const lines = new SegWriter(24576);

  if (form === "strata") quads.sheet(-26, -22, MAP_W + 26, MAP_H + 22, 0, rgba("#F5F8F2", 0.5), rgba(m.border.color), 26, 0.16, 0.5, 0.9, 0);

  const dots = new Float32Array(model.dots.length * MARK_FLOATS);
  const stem = rgba(m.dot.color, 0.1);
  model.dots.forEach((d, i) => {
    const v = Math.sqrt(model.states[d.state].value / model.max);
    const lit = hover === d.state;
    const j = m.dot.jitter ? 1 - m.dot.jitter + Math.pow(rand(), 2.2) * m.dot.jitter * 2.2 : 1;
    const r = (m.dot.min + (m.dot.max - m.dot.min) * v) * Math.min(1.25, j);
    const a = (0.3 + 0.7 * v) * Math.min(1, 0.35 + j * 0.65) * (hover >= 0 && !lit ? 0.5 : 1);
    const z = terrain(d.state) * (0.9 + 0.1 * j);
    const delay = Math.min(1, (d.x / MAP_W) * 0.6 + 0.1);
    writeMark(dots, i, d.x, d.y, z, lit ? r + 0.5 : r, m.dot.shape, [dotC[0], dotC[1], dotC[2], Math.min(1, dotC[3] * a)], 0, 1, m.dot.halo * v * Math.max(0, j - 0.7), 1, delay);
    if (form === "armillary" && z > 6 && i % 2 === 0) lines.line([d.x, d.y, 0], [d.x, d.y, z], { color: stem, width: 0.8, delay });
  });

  if (m.border.alpha > 0) {
    const c = rgba(m.border.color, m.border.alpha);
    for (const line of model.borders)
      for (let k = 1; k < line.length; k++)
        lines.line([line[k - 1][0], line[k - 1][1], 0], [line[k][0], line[k][1], 0], { color: c, width: m.border.width, delay: (line[k][0] / MAP_W) * 0.6 });
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

  const arcC = rgba(m.arc.color, m.arc.alpha);
  const maxFlow = Math.max(...MAP_FLOWS.map((f) => f.v));
  const rise = form ? 0.3 : 0;
  MAP_FLOWS.forEach((f, i) => {
    const a = model.cities[f.s], b = model.cities[f.t];
    const bend = (b.x > a.x ? -1 : 1) * (0.16 + (i % 3) * 0.04);
    const s: Stroke = { color: arcC, width: m.arc.width * (0.5 + 1.1 * Math.sqrt(f.v / maxFlow)), phase: (i * 0.37) % 1, delay: 0.55 + i * 0.03 };
    if (m.arc.mode === "pulse") { s.flow = 0.22; s.pulse = 1.5; } else { s.dash = 8; s.flow = 0.9; }
    if (form) lines.curve([a.x, a.y, 0], [b.x, b.y, 0], bend, 0, { color: rgba(m.border.color, 0.16), width: 1, delay: s.delay }, 40);
    lines.curve([a.x, a.y, 0], [b.x, b.y, 0], bend, rise, s, 40);
  });

  const cityList = Object.values(model.cities);
  const top = new Float32Array((cityList.length + MAP_EVENTS.length * 4 + spikes.length) * MARK_FLOATS);
  let c = 0;
  const eventC = rgba(m.event.color);
  for (const e of MAP_EVENTS) {
    const p = model.cities[e.city];
    if (form === "armillary") {
      lines.line([p.x, p.y, 0], [p.x, p.y, 80], { color: rgba(m.event.color, 0.7), width: 0.9, dash: 3, delay: 0.8 });
      [30, 55, 80].forEach((z, k) => writeMark(top, c++, p.x, p.y, z, 7 + k * 3.5, SHAPE.hexagon, [eventC[0], eventC[1], eventC[2], 0.5 + k * 0.25], 1.1, 0, 0, 0, 0.8 + k * 0.05));
    }
    writeMark(top, c++, p.x, p.y, 0, 13, SHAPE.circle, eventC, 1.2, 0, 0, 0, 0.8);
    if (form !== "armillary") writeMark(top, c++, p.x, p.y, 0, 19, SHAPE.circle, [eventC[0], eventC[1], eventC[2], 0.45], 0.8, 0, 0, 0, 0.85);
  }
  const cityC = rgba(m.city.color);
  for (const p of cityList) writeMark(top, c++, p.x, p.y, 0, m.city.shape === SHAPE.hexagon ? 5.4 : 4.2, m.city.shape, cityC, m.city.fill < 0 ? 1.3 : 0, m.city.fill, 0, 0, 0.7);
  for (const i of spikes) {
    const st = model.states[i];
    writeMark(top, c++, st.cx, st.cy, spikeHeight(model, i), 2.6, SHAPE.circle, rgba(m.border.color), 0, 1, 0, 0, 0.8);
  }
  return { quads, dots, dotCount: model.dots.length, lines, top, topCount: c, spikes };
}

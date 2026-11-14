export type Sector = "gov" | "corp" | "inter" | "event";
export type Kind = "official" | "person" | "corp" | "firm" | "pac" | "agency" | "event";
export type Party = "D" | "R" | "I";
export type TieType = "money" | "lobby" | "employ" | "contact" | "attend" | "board";

export interface Entity {
  id: string;
  name: string;
  role?: string;
  kind: Kind;
  sector: Sector;
  party?: Party;
  weight: number;
  label?: boolean;
}
export interface Tie {
  s: string;
  t: string;
  type: TieType;
  w: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FOCUS = "whitcombe";

const core: Entity[] = [
  { id: "whitcombe", name: "Dana Whitcombe", role: "Senator, Arizona", kind: "official", sector: "gov", party: "R", weight: 10, label: true },
  { id: "brandt", name: "Arlo Brandt", role: "Senator, Washington", kind: "official", sector: "gov", party: "D", weight: 6, label: true },
  { id: "arandia", name: "Luis Arandia", role: "Representative, Texas", kind: "official", sector: "gov", party: "D", weight: 6, label: true },
  { id: "yates", name: "Corinne Yates", role: "Representative, Florida", kind: "official", sector: "gov", party: "R", weight: 5, label: true },
  { id: "solheim", name: "Mira Solheim", role: "Senator, Maine", kind: "official", sector: "gov", party: "I", weight: 4, label: true },
  { id: "kell", name: "Tobias Kell", role: "Representative, Alabama", kind: "official", sector: "gov", party: "R", weight: 4 },
  { id: "okafor", name: "June Okafor", role: "Senator, Colorado", kind: "official", sector: "gov", party: "D", weight: 4 },
  { id: "calder", name: "Imani Calder", role: "Deputy Director, Office of Orbital Logistics", kind: "official", sector: "gov", weight: 6, label: true },
  { id: "ferreira", name: "Nadia Ferreira", role: "Chief of staff, Sen. Whitcombe", kind: "official", sector: "gov", weight: 4, label: true },
  { id: "voss", name: "Petra Voss", role: "Partner, Kestrel Row Partners", kind: "person", sector: "inter", weight: 7, label: true },
  { id: "liang", name: "Owen Liang", role: "Managing partner, Kestrel Row Partners", kind: "person", sector: "inter", weight: 4 },
  { id: "tolliver", name: "Graham Tolliver", role: "Chief executive, Halvorsen Aerodyne", kind: "person", sector: "corp", weight: 6, label: true },
  { id: "adeyemi", name: "Ruth Adeyemi", role: "General counsel, Halvorsen Aerodyne", kind: "person", sector: "corp", weight: 3 },
  { id: "marchetti", name: "Silas Marchetti", role: "Partner, Northgate Capital", kind: "person", sector: "corp", weight: 4 },
  { id: "halvorsen", name: "Halvorsen Aerodyne", role: "Launch and logistics contractor", kind: "corp", sector: "corp", weight: 10, label: true },
  { id: "meridian", name: "Meridian Orbital", role: "Launch contractor", kind: "corp", sector: "corp", weight: 6, label: true },
  { id: "tessaly", name: "Tessaly Systems", role: "Halvorsen subsidiary", kind: "corp", sector: "corp", weight: 4 },
  { id: "northgate", name: "Northgate Capital", role: "Investor", kind: "corp", sector: "corp", weight: 5, label: true },
  { id: "kestrel", name: "Kestrel Row Partners", role: "Lobbying firm", kind: "firm", sector: "inter", weight: 8, label: true },
  { id: "alder", name: "Alder & Finch", role: "Law and lobbying firm", kind: "firm", sector: "inter", weight: 4, label: true },
  { id: "forward", name: "Forward Lift PAC", role: "Political action committee", kind: "pac", sector: "inter", weight: 6, label: true },
  { id: "liberty", name: "Liberty Orbit Fund", role: "Independent expenditure committee", kind: "pac", sector: "inter", weight: 6, label: true },
  { id: "ool", name: "Office of Orbital Logistics", role: "Federal agency", kind: "agency", sector: "gov", weight: 8, label: true },
  { id: "subcmte", name: "Subcommittee on Space Procurement", role: "Senate subcommittee", kind: "agency", sector: "gov", weight: 7, label: true },
  { id: "caucus", name: "Transit and Launch Caucus", role: "House caucus", kind: "agency", sector: "gov", weight: 4 },
  { id: "summit", name: "Aerospace Futures Summit", role: "Las Vegas, annual", kind: "event", sector: "event", weight: 6, label: true },
  { id: "expo", name: "Gulf Launch Expo", role: "Houston", kind: "event", sector: "event", weight: 4, label: true },
  { id: "dinner", name: "Spaceport Industry Dinner", role: "Washington", kind: "event", sector: "event", weight: 3 },
];

const coreTies: Tie[] = [
  { s: "halvorsen", t: "kestrel", type: "lobby", w: 9 },
  { s: "halvorsen", t: "alder", type: "lobby", w: 4 },
  { s: "meridian", t: "alder", type: "lobby", w: 4 },
  { s: "halvorsen", t: "forward", type: "money", w: 6 },
  { s: "halvorsen", t: "liberty", type: "money", w: 4 },
  { s: "meridian", t: "liberty", type: "money", w: 3 },
  { s: "northgate", t: "liberty", type: "money", w: 5 },
  { s: "forward", t: "whitcombe", type: "money", w: 6 },
  { s: "forward", t: "arandia", type: "money", w: 4 },
  { s: "forward", t: "yates", type: "money", w: 3 },
  { s: "liberty", t: "whitcombe", type: "money", w: 8 },
  { s: "tolliver", t: "whitcombe", type: "money", w: 2 },
  { s: "marchetti", t: "liberty", type: "money", w: 3 },
  { s: "forward", t: "kell", type: "money", w: 2 },
  { s: "forward", t: "brandt", type: "money", w: 2 },
  { s: "tolliver", t: "halvorsen", type: "employ", w: 5 },
  { s: "adeyemi", t: "halvorsen", type: "employ", w: 3 },
  { s: "tessaly", t: "halvorsen", type: "board", w: 4 },
  { s: "marchetti", t: "northgate", type: "employ", w: 4 },
  { s: "northgate", t: "halvorsen", type: "board", w: 5 },
  { s: "voss", t: "kestrel", type: "employ", w: 5 },
  { s: "liang", t: "kestrel", type: "employ", w: 4 },
  { s: "voss", t: "ool", type: "employ", w: 3 },
  { s: "voss", t: "halvorsen", type: "board", w: 3 },
  { s: "calder", t: "ool", type: "employ", w: 5 },
  { s: "ferreira", t: "whitcombe", type: "employ", w: 5 },
  { s: "whitcombe", t: "subcmte", type: "employ", w: 6 },
  { s: "brandt", t: "subcmte", type: "employ", w: 4 },
  { s: "solheim", t: "subcmte", type: "employ", w: 3 },
  { s: "okafor", t: "subcmte", type: "employ", w: 3 },
  { s: "arandia", t: "caucus", type: "employ", w: 3 },
  { s: "yates", t: "caucus", type: "employ", w: 3 },
  { s: "kell", t: "caucus", type: "employ", w: 3 },
  { s: "voss", t: "calder", type: "contact", w: 8 },
  { s: "voss", t: "ferreira", type: "contact", w: 6 },
  { s: "voss", t: "whitcombe", type: "contact", w: 3 },
  { s: "liang", t: "arandia", type: "contact", w: 3 },
  { s: "tolliver", t: "calder", type: "contact", w: 2 },
  { s: "subcmte", t: "ool", type: "contact", w: 4 },
  { s: "tolliver", t: "summit", type: "attend", w: 3 },
  { s: "calder", t: "summit", type: "attend", w: 3 },
  { s: "voss", t: "summit", type: "attend", w: 3 },
  { s: "whitcombe", t: "summit", type: "attend", w: 3 },
  { s: "ferreira", t: "dinner", type: "attend", w: 2 },
  { s: "liang", t: "dinner", type: "attend", w: 2 },
  { s: "arandia", t: "expo", type: "attend", w: 2 },
  { s: "meridian", t: "expo", type: "attend", w: 2 },
  { s: "halvorsen", t: "summit", type: "attend", w: 3 },
  { s: "halvorsen", t: "ool", type: "contact", w: 4 },
  { s: "meridian", t: "ool", type: "contact", w: 3 },
];

function buildGraph() {
  const rand = mulberry32(11);
  const entities = [...core];
  const ties = [...coreTies];
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const add = (prefix: string, n: number, kind: Kind, sector: Sector, attach: () => [string, TieType][]) => {
    for (let i = 0; i < n; i++) {
      const id = `${prefix}${i}`;
      entities.push({ id, name: id, kind, sector, weight: 1 + Math.floor(rand() * 2) });
      for (const [t, type] of attach()) ties.push({ s: id, t, type, w: 1 });
    }
  };
  const officials = ["whitcombe", "brandt", "arandia", "yates", "solheim", "kell", "okafor"];
  add("donor", 46, "person", "corp", () => {
    const out: [string, TieType][] = [[pick(["forward", "forward", "liberty", "whitcombe", "arandia", "yates"]), "money"]];
    if (rand() < 0.45) out.push([pick(["halvorsen", "halvorsen", "meridian", "northgate", "tessaly"]), "employ"]);
    return out;
  });
  add("staff", 30, "official", "gov", () => {
    const out: [string, TieType][] = [[pick([...officials, "ool", "ool", "subcmte", "caucus"]), "employ"]];
    if (rand() < 0.3) out.push([pick(["voss", "liang", "kestrel", "alder"]), "contact"]);
    return out;
  });
  add("sub", 18, "corp", "corp", () => [[pick(["halvorsen", "halvorsen", "meridian", "northgate", "tessaly"]), "board"]]);
  add("lob", 20, "person", "inter", () => {
    const out: [string, TieType][] = [[pick(["kestrel", "kestrel", "alder"]), "employ"]];
    if (rand() < 0.5) out.push([pick([...officials, "calder", "ool"]), "contact"]);
    return out;
  });
  add("pac", 12, "pac", "inter", () => [
    [pick(officials), "money"],
    [pick(["halvorsen", "meridian", "northgate", "forward"]), "money"],
  ]);
  add("member", 14, "official", "gov", () => {
    const out: [string, TieType][] = [[pick(["subcmte", "caucus"]), "employ"]];
    if (rand() < 0.6) out.push([pick(["forward", "liberty"]), "money"]);
    return out;
  });
  add("guest", 16, "person", "corp", () => [
    [pick(["summit", "summit", "expo", "dinner"]), "attend"],
    [pick(["halvorsen", "meridian", "kestrel", "ool", "northgate"]), "employ"],
  ]);
  return { entities, ties };
}

export const GRAPH = buildGraph();

export const fmtMoney = (k: number) =>
  k >= 1000 ? `$${(k / 1000).toFixed(k >= 10000 ? 1 : 2).replace(/\.?0+$/, "")}M` : `$${Math.round(k)}K`;

// Lobbying spend per quarter in $K, 2021 Q1 through 2026 Q3
export const QUARTERS = Array.from({ length: 23 }, (_, i) => ({ y: 2021 + Math.floor(i / 4), q: (i % 4) + 1 }));
export const SPEND_HALVORSEN = [420, 440, 430, 470, 510, 540, 520, 600, 640, 690, 720, 810, 880, 1240, 1580, 1910, 2260, 2710, 2940, 2480, 1620, 1310, 1180];
export const SPEND_PEER_MED = [560, 570, 590, 580, 610, 640, 630, 650, 670, 700, 690, 720, 740, 770, 760, 800, 840, 880, 860, 830, 810, 820, 800];
export const SPEND_PEER_LO = SPEND_PEER_MED.map((v, i) => Math.round(v * (0.62 + 0.03 * Math.sin(i))));
export const SPEND_PEER_HI = SPEND_PEER_MED.map((v, i) => Math.round(v * (1.42 + 0.05 * Math.cos(i * 0.7))));
export const SPEND_NOTES = [
  { i: 13, text: "Voss joins Kestrel Row" },
  { i: 15, text: "RFP issued" },
  { i: 17, text: "Markup" },
  { i: 19, text: "Award" },
];

export const SLOPE = [
  { name: "Whitcombe", a: 4, b: 19, focus: true },
  { name: "Arandia", a: 7, b: 12 },
  { name: "Yates", a: 10, b: 9 },
  { name: "Brandt", a: 13, b: 6 },
  { name: "Party committees", a: 37, b: 31 },
  { name: "All others", a: 29, b: 23 },
];

export interface FlowNode { id: string; name: string; col: 0 | 1 | 2; sector: Sector; ent?: string }
export const FLOW_NODES: FlowNode[] = [
  { id: "ha", name: "Halvorsen Aerodyne", col: 0, sector: "corp", ent: "halvorsen" },
  { id: "mo", name: "Meridian Orbital", col: 0, sector: "corp", ent: "meridian" },
  { id: "ng", name: "Northgate Capital", col: 0, sector: "corp", ent: "northgate" },
  { id: "ex", name: "Halvorsen executives", col: 0, sector: "corp", ent: "tolliver" },
  { id: "lob", name: "Lobbying contracts", col: 1, sector: "inter" },
  { id: "fl", name: "Forward Lift PAC", col: 1, sector: "inter", ent: "forward" },
  { id: "lo", name: "Liberty Orbit Fund", col: 1, sector: "inter", ent: "liberty" },
  { id: "dir", name: "Direct gifts", col: 1, sector: "inter" },
  { id: "kr", name: "Kestrel Row Partners", col: 2, sector: "inter", ent: "kestrel" },
  { id: "af", name: "Alder & Finch", col: 2, sector: "inter", ent: "alder" },
  { id: "wh", name: "Whitcombe for Senate", col: 2, sector: "gov", ent: "whitcombe" },
  { id: "ad", name: "Ads backing Whitcombe", col: 2, sector: "gov", ent: "whitcombe" },
  { id: "ar", name: "Arandia for Congress", col: 2, sector: "gov", ent: "arandia" },
  { id: "ya", name: "Yates Victory", col: 2, sector: "gov", ent: "yates" },
  { id: "pc", name: "Party committees", col: 2, sector: "gov" },
];
export const FLOWS: { s: string; t: string; v: number }[] = [
  { s: "ha", t: "lob", v: 3400 }, { s: "ha", t: "fl", v: 950 }, { s: "ha", t: "lo", v: 500 },
  { s: "mo", t: "lob", v: 1100 }, { s: "mo", t: "lo", v: 300 },
  { s: "ng", t: "lo", v: 800 }, { s: "ng", t: "fl", v: 100 },
  { s: "ex", t: "fl", v: 700 }, { s: "ex", t: "dir", v: 420 },
  { s: "lob", t: "kr", v: 3600 }, { s: "lob", t: "af", v: 900 },
  { s: "fl", t: "wh", v: 620 }, { s: "fl", t: "ar", v: 380 }, { s: "fl", t: "ya", v: 250 }, { s: "fl", t: "pc", v: 500 },
  { s: "lo", t: "ad", v: 1150 }, { s: "lo", t: "pc", v: 450 },
  { s: "dir", t: "wh", v: 190 }, { s: "dir", t: "ar", v: 130 }, { s: "dir", t: "ya", v: 100 },
];

export const T0 = Date.UTC(2024, 0, 1);
export const T1 = Date.UTC(2026, 5, 30);
const d = (y: number, m: number, day: number) => Date.UTC(y, m - 1, day);

export const TL_CONTACTS = (() => {
  const rand = mulberry32(5);
  const weeks: { t: number; n: number; key?: boolean }[] = [];
  const award = d(2025, 11, 6);
  for (let t = d(2024, 5, 6); t < d(2026, 5, 1); t += 7 * 864e5) {
    const daysTo = (award - t) / 864e5;
    let rate = 0.35;
    if (daysTo > 0 && daysTo < 90) rate = 1.5;
    else if (daysTo >= 90 && daysTo < 240) rate = 0.7;
    else if (daysTo <= 0) rate = 0.18;
    const n = Math.min(4, Math.floor(rand() * rate * 2.4 + (rand() < rate * 0.4 ? 1 : 0)));
    if (n > 0) weeks.push({ t, n, key: daysTo > 0 && daysTo < 90 });
  }
  return weeks;
})();
export const TL_GIFTS = [
  { t: d(2024, 3, 28), v: 45 }, { t: d(2024, 6, 27), v: 80 }, { t: d(2024, 9, 30), v: 120 },
  { t: d(2024, 12, 20), v: 95 }, { t: d(2025, 3, 31), v: 210 }, { t: d(2025, 5, 12), v: 340 },
  { t: d(2025, 6, 30), v: 280 }, { t: d(2025, 9, 9), v: 460 }, { t: d(2025, 10, 22), v: 390 },
  { t: d(2025, 12, 18), v: 150 }, { t: d(2026, 3, 30), v: 70 },
];
export const TL_HILL = [
  { t: d(2024, 10, 14), text: "RFP issued", kind: "agency" as const },
  { t: d(2025, 2, 26), text: "Hearing", kind: "hill" as const },
  { t: d(2025, 5, 21), text: "Markup, S. 2114", kind: "hill" as const },
  { t: d(2025, 9, 17), text: "Floor vote", kind: "hill" as const },
  { t: d(2025, 11, 6), text: "Award, $2.1B", kind: "agency" as const, key: true },
];
export const TL_EVENTS = [
  { a: d(2024, 9, 9), b: d(2024, 9, 12), text: "Summit, Las Vegas" },
  { a: d(2025, 3, 18), b: d(2025, 3, 20), text: "Gulf Launch Expo" },
  { a: d(2025, 6, 3), b: d(2025, 6, 4), text: "Industry dinner" },
  { a: d(2025, 9, 8), b: d(2025, 9, 11), text: "Summit, Las Vegas" },
];
export const TL_CAREER = [
  { a: d(2024, 0, 1), b: d(2024, 3, 15), text: "Office of Orbital Logistics", sub: "Deputy director, acquisition", sector: "gov" as Sector },
  { a: d(2024, 5, 6), b: T1, text: "Kestrel Row Partners", sub: "Partner", sector: "inter" as Sector },
  { a: d(2025, 1, 15), b: T1, text: "Halvorsen advisory board", sub: "Member", sector: "corp" as Sector },
];
export const TL_WINDOW = { a: d(2025, 8, 8), b: d(2025, 11, 6) };
export const TL_COOLING = { a: d(2024, 3, 15), b: d(2025, 3, 15) };

export const SEATS: { party: Party; funded: boolean; focus?: boolean }[] = (() => {
  const order: Party[] = [...Array(9).fill("D"), "I", ...Array(11).fill("R")];
  const funded = new Set([1, 4, 7, 9, 11, 12, 14, 15, 17, 19]);
  return order.map((party, i) => ({ party, funded: funded.has(i), focus: i === 15 }));
})();

export const LEAN = (() => {
  const rand = mulberry32(21);
  const g = () => (rand() + rand() + rand() + rand() - 2) / 2;
  const out: { x: number; party: Party }[] = [];
  for (let i = 0; i < 47; i++) out.push({ x: Math.max(-0.95, Math.min(-0.05, -0.42 + g() * 0.32)), party: "D" });
  for (let i = 0; i < 51; i++) out.push({ x: Math.max(0.05, Math.min(0.95, 0.47 + g() * 0.34)), party: "R" });
  out.push({ x: -0.12, party: "I" }, { x: -0.31, party: "I" });
  return out;
})();
export const LEAN_FOCUS = 0.38;

export const VOTES = (() => {
  const rand = mulberry32(8);
  return Array.from({ length: 56 }, (_, i) => {
    const r = rand();
    const key = [31, 38, 44, 49].includes(i);
    return { v: key ? (i === 44 ? -1 : 1) : r < 0.86 ? 1 : r < 0.96 ? -1 : 0, key };
  });
})();

export const SPARK_CONTACTS = [2, 1, 3, 2, 2, 4, 3, 5, 4, 6, 9, 14, 11, 5, 3, 2];
export const SPARK_MONEY = [45, 80, 120, 95, 210, 340, 280, 460, 390, 150, 70];

export const CONNECTIONS = [
  { id: "liberty", name: "Liberty Orbit Fund", kind: "pac" as Kind, sector: "inter" as Sector, v: 1150, note: "ads" },
  { id: "forward", name: "Forward Lift PAC", kind: "pac" as Kind, sector: "inter" as Sector, v: 620, note: "gifts" },
  { id: "voss", name: "Petra Voss", kind: "person" as Kind, sector: "inter" as Sector, v: 410, note: "17 contacts" },
  { id: "tolliver", name: "Graham Tolliver", kind: "person" as Kind, sector: "corp" as Sector, v: 190, note: "gifts" },
  { id: "halvorsen", name: "Halvorsen Aerodyne", kind: "corp" as Kind, sector: "corp" as Sector, v: 120, note: "2 hops" },
];

export interface Filing { q: string; reg: string; regId: string; client: string; amt: number; lob: number; ex: number; issues: string; id: string; focus?: boolean }
export const FILINGS: Filing[] = [
  { q: "2026 Q2", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 980, lob: 4, ex: 1, issues: "AER BUD", id: "LD2-88213" },
  { q: "2026 Q1", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 1240, lob: 5, ex: 1, issues: "AER BUD", id: "LD2-87140" },
  { q: "2025 Q4", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 1960, lob: 7, ex: 2, issues: "AER DEF BUD", id: "LD2-85991" },
  { q: "2025 Q3", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 2310, lob: 9, ex: 3, issues: "AER DEF BUD TRA", id: "LD2-84672", focus: true },
  { q: "2025 Q3", reg: "Alder & Finch", regId: "alder", client: "Meridian Orbital", amt: 630, lob: 3, ex: 0, issues: "AER GOV", id: "LD2-84688" },
  { q: "2025 Q2", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 2080, lob: 8, ex: 3, issues: "AER DEF BUD", id: "LD2-83355" },
  { q: "2025 Q1", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 1710, lob: 6, ex: 2, issues: "AER DEF", id: "LD2-82019" },
  { q: "2024 Q4", reg: "Kestrel Row Partners", regId: "kestrel", client: "Halvorsen Aerodyne", amt: 1420, lob: 6, ex: 2, issues: "AER DEF", id: "LD2-80744" },
  { q: "2024 Q3", reg: "Alder & Finch", regId: "alder", client: "Halvorsen Aerodyne", amt: 410, lob: 2, ex: 0, issues: "AER", id: "LD2-79530" },
];

export const ISSUE_CODES: Record<string, string> = {
  AER: "Aerospace",
  DEF: "Defense",
  BUD: "Budget and appropriations",
  TRA: "Transportation",
  GOV: "Government issues",
};

const ROSTER: Record<string, { name: string; id?: string; prior?: string }[]> = {
  kestrel: [
    { name: "Petra Voss", id: "voss", prior: "Office of Orbital Logistics, to Apr 2024" },
    { name: "Marguerite Ashby", prior: "Senate Armed Services staff, to 2022" },
    { name: "Dev Raghunathan", prior: "House Science Committee counsel, to 2023" },
    { name: "Owen Liang", id: "liang" },
    { name: "Colm Brannigan" },
    { name: "Yusra Haddad" },
    { name: "Tessa Lindqvist" },
    { name: "Jerome Okonkwo" },
    { name: "Bea Castellanos" },
  ],
  alder: [{ name: "Hollis Finch" }, { name: "Priya Venkataraman" }, { name: "Anders Roth" }],
};
const OFFICES = ["Senate", "House of Representatives", "Office of Orbital Logistics", "Office of Management and Budget"];

// The named lobbyists and the offices contacted on a filing. Former officials come first, as on the form.
export function filingDetail(f: Filing) {
  const pool = ROSTER[f.regId];
  const former = pool.filter((p) => p.prior).slice(0, f.ex);
  const rest = pool.filter((p) => !p.prior).slice(0, f.lob - former.length);
  return {
    lobbyists: [...former, ...rest],
    issues: f.issues.split(" ").map((code) => ({ code, name: ISSUE_CODES[code] })),
    offices: OFFICES.slice(0, Math.min(OFFICES.length, 1 + f.issues.split(" ").length)),
    series: FILINGS.filter((g) => g.regId === f.regId).sort((p, q) => p.q.localeCompare(q.q)),
  };
}

export interface Doc { id: string; type: string; title: string; date: string; src: string; rel: number; ents: number; about: string[]; excerpt: string[] }
export const DOCS: Doc[] = [
  {
    id: "E-0212", type: "Email", title: "Re: Thursday follow-up on evaluation criteria", date: "14 Oct 2025", src: "FOIA 2026-0417", rel: 0.96, ents: 5,
    about: ["voss", "calder", "liang", "halvorsen", "ferreira"],
    excerpt: ["Halvorsen can meet the revised cadence requirement if the past-performance weighting stays at the level in the September draft."],
  },
  {
    id: "E-0198", type: "Email", title: "Summit dinner seating", date: "02 Sep 2025", src: "FOIA 2026-0417", rel: 0.81, ents: 7,
    about: ["voss", "ferreira", "tolliver", "calder", "summit"],
    excerpt: [
      "Nadia, the Halvorsen table has two open seats on the ninth. Graham would like the Deputy Director on his left and your office on his right, if the Senator's schedule allows.",
      "We will send cars to the hotel at six. Nothing about this needs to go on the official calendar, as it is an industry dinner.",
    ],
  },
  {
    id: "F-84672", type: "Filing", title: "LD-2 quarterly report, Kestrel Row for Halvorsen", date: "20 Oct 2025", src: "Senate Office of Public Records", rel: 0.78, ents: 12,
    about: ["kestrel", "halvorsen", "voss", "liang", "ool", "subcmte"],
    excerpt: [
      "Income relating to lobbying activities for this reporting period was $2,310,000. Nine lobbyists are listed, three of whom report a covered position in the last five years.",
      "Specific issues: evaluation criteria for solicitation OOL-25-R-0090, launch cadence provisions of S. 2114, and fiscal 2026 appropriations for orbital logistics.",
    ],
  },
  {
    id: "C-0031", type: "Contract", title: "Amendment 3 to RFP OOL-25-R-0090", date: "23 Oct 2025", src: "Federal procurement notices", rel: 0.74, ents: 3,
    about: ["ool", "calder", "halvorsen"],
    excerpt: [
      "Section M is amended. Past performance remains weighted at 35 percent of the technical score. The minimum demonstrated launch cadence is revised from eighteen to twelve per year.",
      "Offerors must acknowledge this amendment with their proposals. The closing date is unchanged.",
    ],
  },
  {
    id: "M-0107", type: "Memo", title: "Past-performance weighting options", date: "19 Sep 2025", src: "FOIA 2026-0417", rel: 0.66, ents: 4,
    about: ["calder", "ool", "halvorsen", "meridian"],
    excerpt: [
      "Option A keeps past performance at 35 percent. Option B lowers it to 20 percent and raises price to 40 percent, which would favour offerors with fewer completed missions.",
      "Staff recommend Option B. The Deputy Director has asked for one more week before the amendment is drafted.",
    ],
  },
  {
    id: "T-0044", type: "Transcript", title: "Subcommittee markup of S. 2114", date: "21 May 2025", src: "Congressional record", rel: 0.52, ents: 16,
    about: ["whitcombe", "brandt", "solheim", "okafor", "subcmte"],
    excerpt: [
      "The Chair offered an amendment in the nature of a substitute. It strikes the eighteen-launch minimum in section 4 and directs the Office to set cadence requirements by rule.",
      "Senator Brandt asked which contractors met the eighteen-launch minimum at present. The Chair said she would supply the answer for the record.",
    ],
  },
  {
    id: "E-0149", type: "Email", title: "Calendar hold, Phoenix site visit", date: "11 Jun 2025", src: "FOIA 2026-0417", rel: 0.41, ents: 4,
    about: ["ferreira", "tolliver", "whitcombe", "halvorsen"],
    excerpt: [
      "Please hold the morning of the twenty-seventh for a visit to the Halvorsen integration facility. The company will handle ground transport.",
      "Press will not be invited. Graham Tolliver will lead the tour himself.",
    ],
  },
];

// Monthly counts from Oct 2024 through Mar 2026
export const MULTIPLES_T0 = { y: 2024, m: 9 };
export const MULTIPLES = [
  { name: "Office of Orbital Logistics", data: [1, 0, 2, 1, 1, 2, 3, 2, 4, 3, 5, 7, 9, 6, 2, 1, 1, 0] },
  { name: "Sen. Whitcombe", data: [0, 1, 0, 1, 2, 1, 1, 3, 2, 2, 4, 5, 4, 3, 1, 1, 0, 1] },
  { name: "Subcommittee staff", data: [1, 1, 0, 0, 1, 2, 2, 4, 3, 1, 2, 2, 3, 1, 1, 0, 0, 0] },
  { name: "Rep. Arandia", data: [0, 0, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 1, 0, 0] },
  { name: "Rep. Yates", data: [0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 0, 0, 1, 0] },
  { name: "Sen. Brandt", data: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0] },
];

// State totals in $K given to subcommittee members, 2024 cycle
export const STATE_GIVING: Record<string, number> = {
  WA: 2140, CA: 1830, TX: 1510, VA: 1320, NY: 1260, AZ: 980, FL: 890, CO: 820, AL: 760, MD: 640,
  IL: 420, MA: 380, GA: 310, OH: 260, PA: 250, NV: 240, NC: 210, NJ: 200, UT: 180, NM: 170,
  MI: 150, MO: 120, TN: 110, MN: 100, OR: 95, LA: 90, OK: 80, WI: 70, IN: 65, SC: 60,
  CT: 60, KS: 45, KY: 40, IA: 35, AR: 30, MS: 30, NE: 25, NH: 25, ID: 20, ME: 20,
  DE: 18, RI: 15, WV: 12, MT: 12, WY: 10, SD: 8, ND: 8, VT: 6,
};
export const CITIES = [
  { id: "sea", name: "Seattle", lon: -122.33, lat: 47.61, side: "r" },
  { id: "la", name: "Los Angeles", lon: -118.24, lat: 34.05, side: "l" },
  { id: "nyc", name: "New York", lon: -74.0, lat: 40.71, side: "r" },
  { id: "dc", name: "Washington", lon: -77.04, lat: 38.9, side: "r" },
  { id: "phx", name: "Phoenix", lon: -112.07, lat: 33.45, side: "b" },
  { id: "hou", name: "Houston", lon: -95.37, lat: 29.76, side: "r" },
  { id: "tpa", name: "Tampa", lon: -82.46, lat: 27.95, side: "r" },
  { id: "den", name: "Denver", lon: -104.99, lat: 39.74, side: "r" },
  { id: "hsv", name: "Huntsville", lon: -86.59, lat: 34.73, side: "r" },
  { id: "las", name: "Las Vegas", lon: -115.14, lat: 36.17, side: "r" },
];
export const MAP_FLOWS = [
  { s: "sea", t: "phx", v: 1150 }, { s: "sea", t: "dc", v: 950 }, { s: "la", t: "dc", v: 300 },
  { s: "nyc", t: "phx", v: 800 }, { s: "dc", t: "phx", v: 620 }, { s: "dc", t: "hou", v: 380 },
  { s: "dc", t: "tpa", v: 250 }, { s: "den", t: "dc", v: 210 }, { s: "hsv", t: "dc", v: 160 },
];
export const MAP_EVENTS = [
  { city: "las", text: "Summit, 8 to 11 Sep" },
  { city: "hou", text: "Expo, 18 to 20 Mar" },
];

export const WINDOW_CONTACTS = TL_CONTACTS.filter((w) => w.key).reduce((a, w) => a + w.n, 0);
export const PRIOR_CONTACTS = TL_CONTACTS.filter((w) => {
  const days = (TL_WINDOW.a - w.t) / 864e5;
  return days > 0 && days <= 90;
}).reduce((a, w) => a + w.n, 0);

const BY_ID = new Map(GRAPH.entities.map((e) => [e.id, e]));
export const entity = (id: string) => BY_ID.get(id);
export const named = (e: Entity) => e.name !== e.id;

const TIE_GROUPS: { key: string; label: string; types: TieType[]; out: string; back: string }[] = [
  { key: "money", label: "Money", types: ["money"], out: "gives to", back: "receives from" },
  { key: "lobby", label: "Lobbying", types: ["lobby"], out: "retains", back: "retained by" },
  { key: "post", label: "People and posts", types: ["employ"], out: "post at", back: "has as staff or member" },
  { key: "board", label: "Ownership and boards", types: ["board"], out: "holds a stake or seat in", back: "has as owner or adviser" },
  { key: "contact", label: "Contacts", types: ["contact"], out: "in contact with", back: "in contact with" },
  { key: "event", label: "Events", types: ["attend"], out: "attended", back: "attended by" },
];

// The ties of an entity, grouped by kind. Background entities without a name are counted and left off the lists.
export function dossier(id: string) {
  const e = BY_ID.get(id)!;
  const mine = GRAPH.ties.filter((t) => t.s === id || t.t === id);
  const groups = TIE_GROUPS.map((g) => {
    const ties = mine.filter((t) => g.types.includes(t.type)).map((t) => ({ other: BY_ID.get(t.s === id ? t.t : t.s)!, w: t.w, note: t.s === id ? g.out : g.back }));
    const rows = ties.filter((t) => named(t.other)).sort((p, q) => q.w - p.w);
    return { key: g.key, label: g.label, rows, minor: ties.length - rows.length };
  }).filter((g) => g.rows.length + g.minor > 0);
  return { e, ties: mine.length, groups, docs: DOCS.filter((d) => d.about.includes(id)) };
}

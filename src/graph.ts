// The entities and ties of the case, generated with a fixed seed: the named parties and a crowd of donors, staff,
// subsidiaries and guests around them.

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

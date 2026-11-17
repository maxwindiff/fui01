import { GRAPH } from "./graph";
import type { Entity, Kind, Party, Sector, TieType } from "./graph";
import { CONTACTS, DOCUMENTS, EVENTS, FILINGS as FILING_ROWS, GIFTS, MENTIONS, SENATORS, TRANSFERS, VOTES as VOTE_ROWS } from "./tables";

// What the case panels draw, worked out from the tables in tables.ts. Money is in thousands of dollars here, since
// every panel shows it that way. The tables keep dollars.

export { FOCUS, GRAPH, mulberry32 } from "./graph";
export type { Entity, Kind, Party, Sector, Tie, TieType } from "./graph";

export const fmtMoney = (k: number) =>
  k >= 1000 ? `$${(k / 1000).toFixed(k >= 10000 ? 1 : 2).replace(/\.?0+$/, "")}M` : `$${Math.round(k)}K`;

const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const K = (dollars: number) => dollars / 1000;
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const DAY = 864e5;
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const quarterOf = (iso: string) => ({ y: +iso.slice(0, 4), q: Math.floor((+iso.slice(5, 7) - 1) / 3) + 1 });
const quarterName = (iso: string) => { const { y, q } = quarterOf(iso); return `${y} Q${q}`; };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
// The 2024 election cycle, which runs through 2023 and 2024.
const inCycle = (iso: string, y = 2024) => iso >= `${y - 1}-01-01` && iso < `${y + 1}-01-01`;
const event = (id: string) => EVENTS.find((e) => e.id === id)!;
const AWARD = ms(event("m19").starts);

// Lobbying spend per quarter from 2021: Halvorsen against the other clients in the filings.
const quarters = [...new Set(FILING_ROWS.map((f) => f.quarter))].filter((q) => q >= "2021-01-01").sort();
export const QUARTERS = quarters.map(quarterOf);
const spendOf = (client: string) => quarters.map((q) => K(sum(FILING_ROWS.filter((f) => f.client === client && f.quarter === q), (f) => f.amount)));
const PEER_NAMES = [...new Set(FILING_ROWS.map((f) => f.client))].filter((c) => c !== "Halvorsen Aerodyne");
const peers = PEER_NAMES.map(spendOf);
export const SPEND_PEERS = PEER_NAMES.length;
export const SPEND_HALVORSEN = spendOf("Halvorsen Aerodyne");
export const SPEND_IDS = quarters.map((q) => FILING_ROWS.filter((f) => f.client === "Halvorsen Aerodyne" && f.quarter === q).map((f) => f.id));
export const SPEND_PEER_MED = quarters.map((_, i) => median(peers.map((p) => p[i])));
export const SPEND_PEER_LO = quarters.map((_, i) => Math.min(...peers.map((p) => p[i])));
export const SPEND_PEER_HI = quarters.map((_, i) => Math.max(...peers.map((p) => p[i])));
const quarterIndex = (iso: string) => Math.max(0, Math.min(quarters.length - 1, quarters.findIndex((q, i) => iso >= q && (i === quarters.length - 1 || iso < quarters[i + 1]))));
export const SPEND_NOTES = ([["e3", "Voss joins Kestrel Row"], ["m6", "Draft solicitation"], ["m10", "Final solicitation"], ["m19", "Award"]] as const)
  .map(([id, text]) => ({ i: quarterIndex(event(id).starts), text }))
  .filter((n, k, all) => all.findIndex((m) => m.i === n.i) === k);

// Each recipient's share of aerospace and defense giving to the two senators, 2022 cycle against 2024 cycle.
const aero = GIFTS.filter((g) => g.sector === "Aerospace and defense");
const shareOf = (who: string, y: number) => {
  const all = aero.filter((g) => inCycle(g.date, y));
  return Math.round((100 * sum(all.filter((g) => g.recipient === who), (g) => g.amount)) / sum(all, (g) => g.amount));
};
const giftIds = (who: string, y: number) => aero.filter((g) => g.recipient === who && inCycle(g.date, y)).map((g) => g.id);
export const SLOPE = ["Whitcombe", "Brandt"].map((name) => ({ name, a: shareOf(name, 2022), b: shareOf(name, 2024), ids: [...giftIds(name, 2022), ...giftIds(name, 2024)], focus: name === "Whitcombe" }));

// Money in the 2024 cycle from companies and executives, through lobbying contracts, committees and direct gifts,
// to firms and campaigns. Lobbying comes from the filings, gifts from the gifts, and committee money from transfers.
export interface FlowNode { id: string; name: string; col: 0 | 1 | 2; sector: Sector; ent?: string; hot?: boolean }
const NODES: FlowNode[] = [
  { id: "Halvorsen Aerodyne", name: "Halvorsen Aerodyne", col: 0, sector: "corp", ent: "halvorsen" },
  { id: "Meridian Orbital", name: "Meridian Orbital", col: 0, sector: "corp", ent: "meridian" },
  { id: "Tessaly Systems", name: "Tessaly Systems", col: 0, sector: "corp", ent: "tessaly" },
  { id: "Northgate Capital", name: "Northgate Capital", col: 0, sector: "corp", ent: "northgate" },
  { id: "Halvorsen executives", name: "Halvorsen executives", col: 0, sector: "corp", ent: "tolliver" },
  { id: "Lobbying contracts", name: "Lobbying contracts", col: 1, sector: "inter" },
  { id: "Forward Lift PAC", name: "Forward Lift PAC", col: 1, sector: "inter", ent: "forward" },
  { id: "Liberty Orbit Fund", name: "Liberty Orbit Fund", col: 1, sector: "inter", ent: "liberty" },
  { id: "Direct gifts", name: "Direct gifts", col: 1, sector: "inter" },
  { id: "Kestrel Row Partners", name: "Kestrel Row Partners", col: 2, sector: "inter", ent: "kestrel" },
  { id: "Alder & Finch", name: "Alder & Finch", col: 2, sector: "inter", ent: "alder" },
  { id: "Whitcombe for Senate", name: "Whitcombe for Senate", col: 2, sector: "gov", ent: "whitcombe", hot: true },
  { id: "Ads backing Whitcombe", name: "Ads backing Whitcombe", col: 2, sector: "gov", ent: "whitcombe", hot: true },
  { id: "Brandt for Senate", name: "Brandt for Senate", col: 2, sector: "gov", ent: "brandt" },
  { id: "Arandia for Congress", name: "Arandia for Congress", col: 2, sector: "gov", ent: "arandia" },
  { id: "Yates Victory", name: "Yates Victory", col: 2, sector: "gov", ent: "yates" },
  { id: "Party committees", name: "Party committees", col: 2, sector: "gov" },
];
const flows = new Map<string, { s: string; t: string; v: number; ids: string[] }>();
const flow = (s: string, t: string, dollars: number, id: string) => {
  const k = `${s}>${t}`;
  const f = flows.get(k) ?? { s, t, v: 0, ids: [] };
  f.v += K(dollars);
  f.ids.push(id);
  flows.set(k, f);
};
for (const f of FILING_ROWS.filter((x) => inCycle(x.quarter))) { flow(f.client, "Lobbying contracts", f.amount, f.id); flow("Lobbying contracts", f.firm, f.amount, f.id); }
for (const g of GIFTS.filter((x) => inCycle(x.date))) {
  const campaign = `${g.recipient} for Senate`;
  if (g.donor_group === "Forward Lift PAC") flow("Forward Lift PAC", campaign, g.amount, g.id);
  else if (["Halvorsen Aerodyne", "Meridian Orbital", "Tessaly Systems"].includes(g.employer)) { flow(g.employer, "Direct gifts", g.amount, g.id); flow("Direct gifts", campaign, g.amount, g.id); }
}
for (const t of TRANSFERS) flow(t.source, t.target, t.amount, t.id);
// Ribbons carry the records they add up, as the marks of answers do.
export const FLOWS = [...flows.values()];
export const FLOW_NODES = NODES.filter((n) => FLOWS.some((f) => f.s === n.id || f.t === n.id));
export const FLOW_TOTAL = sum(FLOWS.filter((f) => FLOW_NODES.find((n) => n.id === f.s)?.col === 0), (f) => f.v);

// The timeline runs from January 2024 to June 2026. Its window is the 90 days before the award.
export const T0 = Date.UTC(2024, 0, 1);
export const T1 = Date.UTC(2026, 5, 30);
export const TL_WINDOW = { a: AWARD - 90 * DAY, b: AWARD };
const contactsIn = (a: number, b: number) => CONTACTS.filter((c) => ms(c.date) >= a && ms(c.date) < b);
export const WINDOW_CONTACTS = contactsIn(TL_WINDOW.a, TL_WINDOW.b).length;
export const PRIOR_CONTACTS = contactsIn(TL_WINDOW.a - 90 * DAY, TL_WINDOW.a).length;
// Contacts per week, each week starting on a Monday.
export const TL_CONTACTS = (() => {
  const weeks = new Map<number, string[]>();
  for (const c of CONTACTS) {
    const t = ms(c.date);
    const w = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
    weeks.set(w, [...(weeks.get(w) ?? []), c.id]);
  }
  return [...weeks].sort((a, b) => a[0] - b[0]).map(([t, ids]) => ({ t, n: ids.length, ids, key: t + 7 * DAY > TL_WINDOW.a && t < TL_WINDOW.b }));
})();
// Gifts to Whitcombe by the quarterly report they were filed in, dated at the end of the quarter.
export const TL_GIFTS = (() => {
  const by = new Map<number, { v: number; ids: string[] }>();
  for (const g of GIFTS.filter((x) => x.recipient === "Whitcombe")) {
    const { y, q } = quarterOf(g.date);
    const t = Date.UTC(y, q * 3, 0);
    if (t < T0 || t > T1) continue;
    const r = by.get(t) ?? { v: 0, ids: [] };
    r.v += K(g.amount);
    r.ids.push(g.id);
    by.set(t, r);
  }
  return [...by].sort((a, b) => a[0] - b[0]).map(([t, r]) => ({ t, ...r }));
})();
export const TL_HILL = EVENTS.filter((e) => ((["document", "hearing"].includes(e.kind)) || (e.kind === "vote" && e.actor === "Whitcombe") || (e.kind === "award" && e.actor === "Office of Orbital Logistics")) && ms(e.starts) >= T0 && ms(e.starts) <= T1)
  .map((e) => ({ id: e.id, t: ms(e.starts), text: e.label, kind: ["document", "award"].includes(e.kind) ? "agency" as const : "hill" as const, key: e.id === "m19" }));
export const TL_EVENTS = EVENTS.filter((e) => e.kind === "conference" && ms(e.ends ?? e.starts) >= T0 && ms(e.starts) <= T1)
  .map((e) => ({ id: e.id, a: ms(e.starts), b: ms(e.ends ?? e.starts), text: e.label }));
// Voss's posts. Each title reads "post, organisation".
export const TL_CAREER = EVENTS.filter((e) => e.actor === "Voss" && e.kind === "role" && ms(e.ends ?? "2099-01-01") >= T0).map((e) => {
  const [sub, ...org] = e.title.split(", ");
  const text = org.join(", ");
  return { id: e.id, a: ms(e.starts), b: e.ends ? ms(e.ends) : T1, text, sub, sector: (text.includes("Office") ? "gov" : text.includes("Kestrel") ? "inter" : "corp") as Sector };
});
const cooling = event("e2");
export const TL_COOLING = { id: cooling.id, a: ms(cooling.starts), b: ms(cooling.ends!), text: `Left the Office of Orbital Logistics. Cooling-off period to ${fmtDay(ms(cooling.ends!))}` };

// Contacts per office per month, October 2024 through March 2026.
export const MULTIPLES_T0 = { y: 2024, m: 9 };
const MONTHS = 18;
const monthIndex = (iso: string) => (+iso.slice(0, 4) - MULTIPLES_T0.y) * 12 + (+iso.slice(5, 7) - 1) - MULTIPLES_T0.m;
export const MULTIPLES = [...new Set(CONTACTS.map((c) => c.office))].map((name) => {
  const ids = Array.from({ length: MONTHS }, () => [] as string[]);
  for (const c of CONTACTS) if (c.office === name) { const i = monthIndex(c.date); if (i >= 0 && i < MONTHS) ids[i].push(c.id); }
  return { name, data: ids.map((x) => x.length), ids };
}).sort((a, b) => sum(b.data, (v) => v) - sum(a.data, (v) => v));
// The months that overlap the 90 days before the award.
export const MULTIPLES_KEY = Array.from({ length: MONTHS }, (_, i) => i).filter((i) => {
  const a = Date.UTC(MULTIPLES_T0.y, MULTIPLES_T0.m + i, 1), b = Date.UTC(MULTIPLES_T0.y, MULTIPLES_T0.m + i + 1, 1);
  return b > TL_WINDOW.a && a < TL_WINDOW.b;
});

// Whitcombe's card: money from the network in the 2024 cycle, her offices' logged contacts, and her strongest ties.
const toWhitcombe = aero.filter((g) => g.recipient === "Whitcombe" && inCycle(g.date));
const ads = TRANSFERS.filter((t) => t.target === "Ads backing Whitcombe");
const cycleQuarters = Array.from({ length: 8 }, (_, i) => `${2023 + Math.floor(i / 4)}-${String((i % 4) * 3 + 1).padStart(2, "0")}-01`);
const moneySpark = cycleQuarters.map((q, i) => {
  const next = cycleQuarters[i + 1] ?? "2025-01-01";
  return K(sum([...toWhitcombe.map((g) => ({ d: g.date, v: g.amount })), ...ads.map((t) => ({ d: t.date, v: t.amount }))].filter((x) => x.d >= q && x.d < next), (x) => x.v));
});
export const PERSON_MONEY = {
  total: K(sum(toWhitcombe, (g) => g.amount) + sum(ads, (t) => t.amount)),
  spark: moneySpark,
  peak: quarterName(cycleQuarters[moneySpark.indexOf(Math.max(...moneySpark))]),
};
const herContacts = CONTACTS.filter((c) => c.office === "Sen. Whitcombe" || c.office === "Subcommittee staff");
const contactMonths = [...new Set(CONTACTS.map((c) => c.date.slice(0, 7)))].sort();
export const PERSON_CONTACTS = {
  n: herContacts.length,
  months: contactMonths.length,
  spark: contactMonths.map((m) => herContacts.filter((c) => c.date.startsWith(m)).length),
};
const GROUP_ENTITY: Record<string, string> = { "Forward Lift PAC": "forward", "Halvorsen staff": "halvorsen", "Tessaly staff": "tessaly", "Meridian staff": "meridian" };
export const CONNECTIONS = (() => {
  const by = new Map<string, { v: number; n: number; note: string }>();
  const add = (id: string, dollars: number, note: string) => { const r = by.get(id) ?? { v: 0, n: 0, note }; r.v += K(dollars); r.n++; by.set(id, r); };
  for (const g of toWhitcombe) {
    const id = g.donor_id === "tolliver" ? "tolliver" : GROUP_ENTITY[g.donor_group];
    if (id) add(id, g.amount, "gifts");
  }
  for (const t of ads) add("liberty", t.amount, "ads");
  return [...by].sort((a, b) => b[1].v - a[1].v).slice(0, 5).map(([id, r]) => {
    const e = GRAPH.entities.find((x) => x.id === id)!;
    return { id, name: e.name, kind: e.kind, sector: e.sector, v: r.v, note: r.note === "gifts" ? `${r.n} ${r.n === 1 ? "gift" : "gifts"}` : r.note };
  });
})();

// The Senate by voting record, the subcommittee's seats, and Whitcombe's last 56 votes against her party's.
export const LEAN = SENATORS.map((s) => ({ x: s.lean, party: s.party as Party }));
export const LEAN_FOCUS = SENATORS.find((s) => s.id === "whitcombe")!.lean;
export const SEATS = SENATORS.filter((s) => s.subcommittee).sort((a, b) => a.seat! - b.seat!).map((s) => ({ id: s.id, name: s.name, party: s.party as Party, funded: s.network_money, focus: s.id === "whitcombe" }));
export const LAST_VOTES = VOTE_ROWS.filter((v) => v.senator === "Whitcombe").slice(-56).map((v) => ({
  id: v.id,
  title: v.title,
  v: v.position === "Not voting" ? 0 : v.position === v.party_position ? 1 : -1,
  key: v.title.includes("S. 2114"),
}));

// Lobbying filings for Halvorsen from the third quarter of 2024, newest first.
// code is a short name for the filing: the firm's initials and the quarter.
export interface Filing { q: string; reg: string; regId: string; client: string; amt: number; lob: number; ex: number; issues: string; id: string; code: string; focus?: boolean }
export const ISSUE_CODES: Record<string, string> = {
  AER: "Aerospace",
  DEF: "Defense",
  BUD: "Budget and appropriations",
  TRA: "Transportation",
  GOV: "Government issues",
};
const ISSUE_TO_CODES: Record<string, string> = { "Launch procurement": "AER", "Range fees": "AER TRA", "Sole-source authority": "AER GOV", "Defense appropriations": "DEF BUD" };
const FIRM_ID: Record<string, string> = { "Kestrel Row Partners": "kestrel", "Alder & Finch": "alder" };
const REPORT_ID = DOCUMENTS.find((d) => d.filing_id)?.filing_id;
const asFiling = (f: (typeof FILING_ROWS)[number]): Filing => ({
  q: quarterName(f.quarter), reg: f.firm, regId: FIRM_ID[f.firm], client: f.client, amt: K(f.amount), lob: f.lobbyists, ex: f.former_officials,
  issues: ISSUE_TO_CODES[f.issue] ?? "AER", id: f.id, code: `${f.firm.split(/\W+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("")}-${quarterName(f.quarter).slice(2).replace(" ", "")}`, focus: f.id === REPORT_ID,
});
export const FILINGS: Filing[] = FILING_ROWS.filter((f) => f.client === "Halvorsen Aerodyne" && f.quarter >= "2024-07-01").sort((a, b) => b.quarter.localeCompare(a.quarter) || a.firm.localeCompare(b.firm)).map(asFiling);
export const REPORT_FILING = FILINGS.find((f) => f.focus) ?? FILINGS[0];

const ROSTER: Record<string, { name: string; id?: string; prior?: string }[]> = {
  kestrel: [
    { name: "Marguerite Ashby", prior: "Senate Armed Services staff, to 2022" },
    { name: "Dev Raghunathan", prior: "House Science Committee counsel, to 2023" },
    { name: "Petra Voss", id: "voss", prior: `Office of Orbital Logistics, to ${fmtDay(ms(event("e1").ends!)).replace(/^\d+ /, "")}` },
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

// The named lobbyists and the offices contacted on a filing, and the same firm's filings for the client over the last
// three years. Former officials come first, as on the form.
export function filingDetail(f: Filing) {
  const pool = ROSTER[f.regId];
  const former = pool.filter((p) => p.prior).slice(0, f.ex);
  const rest = pool.filter((p) => !p.prior).slice(0, f.lob - former.length);
  return {
    lobbyists: [...former, ...rest],
    issues: f.issues.split(" ").map((code) => ({ code, name: ISSUE_CODES[code] })),
    offices: OFFICES.slice(0, Math.min(OFFICES.length, 1 + f.issues.split(" ").length)),
    series: FILING_ROWS.filter((g) => g.firm === f.reg && g.client === f.client).sort((p, q) => p.quarter.localeCompare(q.quarter)).slice(-12).map(asFiling),
  };
}

export interface Doc { id: string; type: string; title: string; date: string; src: string; rel: number; ents: number; about: string[]; excerpt: string[]; filing: string | null }
export const DOCS: Doc[] = DOCUMENTS.map((d) => {
  const about = MENTIONS.filter((m) => m.document_id === d.id).map((m) => m.entity_id);
  return { id: d.id, type: d.type, title: d.title, date: fmtDay(ms(d.date)), src: d.source, rel: d.relevance, ents: about.length, about, excerpt: d.excerpt.split("\n\n"), filing: d.filing_id };
});
// The office calendar's entries in the window, which the finding cites.
export const WINDOW_CALENDAR = contactsIn(TL_WINDOW.a, TL_WINDOW.b).filter((c) => c.source === "Office calendar").length;
export const WINDOW_TEXT = `${fmtDay(TL_WINDOW.a).replace(/ \d{4}$/, "")} and ${fmtDay(TL_WINDOW.b)}`;

// Giving to the two senators in the 2024 cycle, by the donor's state, and between the cities nearest to donors and
// to each senator.
export const STATE_GIVING: Record<string, number> = {};
export const STATE_IDS: Record<string, string[]> = {};
for (const g of GIFTS.filter((x) => inCycle(x.date))) {
  STATE_GIVING[g.state] = (STATE_GIVING[g.state] ?? 0) + K(g.amount);
  (STATE_IDS[g.state] ??= []).push(g.id);
}
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
const STATE_CITY: Record<string, string> = { WA: "sea", CA: "la", NY: "nyc", CT: "nyc", VA: "dc", MD: "dc", AZ: "phx", TX: "hou", OK: "hou", FL: "tpa", CO: "den", AL: "hsv", NV: "las" };
const SEAT_CITY: Record<string, string> = { Whitcombe: "phx", Brandt: "sea" };
export const MAP_FLOWS = (() => {
  const by = new Map<string, { v: number; ids: string[] }>();
  for (const g of GIFTS.filter((x) => inCycle(x.date))) {
    const s = STATE_CITY[g.state], t = SEAT_CITY[g.recipient];
    if (!s || !t || s === t) continue;
    const f = by.get(`${s}>${t}`) ?? { v: 0, ids: [] };
    f.v += K(g.amount);
    f.ids.push(g.id);
    by.set(`${s}>${t}`, f);
  }
  return [...by].map(([k, f]) => { const [s, t] = k.split(">"); return { s, t, ...f }; }).sort((a, b) => b.v - a.v).slice(0, 9);
})();
// The latest conference in each city on the map.
export const MAP_EVENTS = (() => {
  const out = new Map<string, { city: string; text: string }>();
  for (const e of EVENTS.filter((x) => x.kind === "conference" && x.place)) {
    const city = CITIES.find((c) => c.name === e.place)?.id;
    if (!city) continue;
    const a = new Date(ms(e.starts)), b = new Date(ms(e.ends ?? e.starts));
    out.set(city, { city, text: `${e.label.split(",")[0]}, ${a.getUTCDate()} to ${b.getUTCDate()} ${MONTH[b.getUTCMonth()]}` });
  }
  return [...out.values()];
})();

// One-line summaries of the panels, shown when a panel is a tile beside the one on stage.
const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const spendPeak = SPEND_HALVORSEN.indexOf(Math.max(...SPEND_HALVORSEN));
export const GLANCE = {
  affiliation: `Whitcombe at ${LEAN_FOCUS >= 0 ? "+" : ""}${LEAN_FOCUS.toFixed(2)} by voting record`,
  flow: `${fmtMoney(FLOW_TOTAL)} through ${words[FLOW_NODES.filter((n) => n.col === 1).length].toLowerCase()} vehicles`,
  spend: `Halvorsen peaked at ${fmtMoney(SPEND_HALVORSEN[spendPeak])} in ${QUARTERS[spendPeak].y} Q${QUARTERS[spendPeak].q}`,
  slope: `Whitcombe, ${SLOPE[0].a}% to ${SLOPE[0].b}%`,
  multiples: `${words[MULTIPLES.length]} offices over ${MONTHS} months`,
};

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


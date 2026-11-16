import { GRAPH, mulberry32 } from "../data";

// Base tables of the case, generated with fixed seeds and loaded into DuckDB when the Ask page opens.
// Dates are ISO strings so that DuckDB reads them as DATE and TIMESTAMP columns.

export interface Person { id: string; name: string; kind: string; role: string; employer: string; sector: string; age: number; state: string }
export interface Gift { id: string; donor_id: string; donor: string; employer: string; recipient: string; donor_group: string; sector: string; date: string; amount: number; state: string; vote_id: string | null; days_before_vote: number | null; source: string }
export interface Vote { id: string; date: string; title: string; senator: string; position: string }
export interface Filing { id: string; client: string; firm: string; quarter: string; amount: number; issue: string }
export interface Session { id: string; room: string; starts: string; ends: string; title: string; private: boolean; booked_by: string | null }
export interface Attendance { session_id: string; person_id: string }

const iso = (t: number) => {
  const y = Math.floor(t);
  return new Date(Date.UTC(y, 0, 1 + Math.floor((t - y) * 365))).toISOString().slice(0, 10);
};
const day = (s: string) => Date.parse(s) / 864e5;

export const VOTES: Vote[] = [
  [2019.216, "Amendment 412, competition for launch contracts"],
  [2020.55, "Defense bill, section 1601, launch procurement"],
  [2021.72, "S. 2792 markup, national security launch"],
  [2022.45, "Amendment on launch cadence reporting"],
  [2023.52, "S. 2226 markup, launch service lanes"],
  [2024.44, "Amendment on launch range fees"],
  [2025.386, "S. 2114 as amended, section 6 sole-source authority"],
].map(([t, title], i) => ({ id: `v${19 + i}`, date: iso(t as number), title: title as string, senator: "Whitcombe", position: "Aye" }));

const GROUPS: Record<string, { name: string; sector: string; employer: string; states: string[]; amounts: number[]; pac?: boolean }> = {
  hal: { name: "Halvorsen staff", sector: "Aerospace and defense", employer: "Halvorsen Aerodyne", states: ["WA", "WA", "WA", "AZ", "AZ"], amounts: [2700, 3300, 3300, 5000, 6600, 6600] },
  fwd: { name: "Forward Lift PAC", sector: "Aerospace and defense", employer: "Forward Lift PAC", states: ["VA"], amounts: [5000, 5000, 10000], pac: true },
  tes: { name: "Tessaly staff", sector: "Aerospace and defense", employer: "Tessaly Systems", states: ["AZ", "AZ", "CO"], amounts: [500, 1000, 1000, 1500, 2000, 2700, 3300] },
  mer: { name: "Meridian staff", sector: "Aerospace and defense", employer: "Meridian Orbital", states: ["TX", "TX", "CA"], amounts: [2700, 3300, 3300, 5000, 6600] },
  oth: { name: "Other aerospace", sector: "Aerospace and defense", employer: "aerospace supplier", states: ["CA", "AL", "FL", "CO", "WA"], amounts: [500, 1000, 1000, 1500, 2000, 2700] },
  fin: { name: "Finance", sector: "Finance", employer: "investment firm", states: ["NY", "NY", "IL", "CT", "AZ"], amounts: [500, 1000, 1000, 1500, 2000, 2700, 3300, 5000] },
  energy: { name: "Energy", sector: "Energy", employer: "utility", states: ["TX", "AZ", "OK", "AZ"], amounts: [500, 1000, 1500, 2000, 2700] },
  health: { name: "Health", sector: "Health", employer: "hospital group", states: ["AZ", "MA", "TN"], amounts: [500, 1000, 1000, 2000, 2700] },
  estate: { name: "Real estate", sector: "Real estate", employer: "developer", states: ["AZ", "AZ", "NV", "FL"], amounts: [1000, 1500, 2700, 3300] },
  lobby: { name: "Law and lobbying", sector: "Law and lobbying", employer: "law firm", states: ["VA", "MD", "VA"], amounts: [500, 1000, 1500, 2700, 3300] },
};
const FIRST = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "J.", "K.", "L.", "M.", "N.", "P.", "R.", "S.", "T.", "V.", "W."];
const SURNAMES = ["Abara", "Becker", "Castellan", "Dhillon", "Eastman", "Fonseca", "Gould", "Hartwell", "Ibarra", "Jessup", "Kowalski", "Lindqvist", "Mbeki", "Navarro", "Oyelaran", "Pruitt", "Quist", "Rasmussen", "Sato", "Thackeray", "Underhill", "Vance", "Whitlock", "Yoon", "Zamora"];

export const PEOPLE: Person[] = [
  { id: "whitcombe", name: "Dana Whitcombe", kind: "official", role: "Senator, Arizona", employer: "US Senate", sector: "Government", age: 58, state: "AZ" },
  { id: "brandt", name: "Arlo Brandt", kind: "official", role: "Senator, Washington", employer: "US Senate", sector: "Government", age: 63, state: "WA" },
  { id: "yates", name: "Corinne Yates", kind: "official", role: "Representative, Florida", employer: "US House", sector: "Government", age: 47, state: "FL" },
  { id: "calder", name: "Imani Calder", kind: "official", role: "Deputy Director, Office of Orbital Logistics", employer: "Office of Orbital Logistics", sector: "Government", age: 51, state: "VA" },
  { id: "ferreira", name: "Nadia Ferreira", kind: "official", role: "Chief of staff, Sen. Whitcombe", employer: "US Senate", sector: "Government", age: 39, state: "AZ" },
  { id: "voss", name: "Petra Voss", kind: "lobbyist", role: "Partner, Kestrel Row Partners", employer: "Kestrel Row Partners", sector: "Law and lobbying", age: 44, state: "VA" },
  { id: "liang", name: "Owen Liang", kind: "lobbyist", role: "Managing partner, Kestrel Row Partners", employer: "Kestrel Row Partners", sector: "Law and lobbying", age: 56, state: "VA" },
  { id: "tolliver", name: "Graham Tolliver", kind: "executive", role: "Chief executive, Halvorsen Aerodyne", employer: "Halvorsen Aerodyne", sector: "Aerospace and defense", age: 61, state: "WA" },
  { id: "adeyemi", name: "Ruth Adeyemi", kind: "executive", role: "General counsel, Halvorsen Aerodyne", employer: "Halvorsen Aerodyne", sector: "Aerospace and defense", age: 49, state: "WA" },
  { id: "marchetti", name: "Silas Marchetti", kind: "executive", role: "Partner, Northgate Capital", employer: "Northgate Capital", sector: "Finance", age: 53, state: "NY" },
];

function build() {
  const rnd = mulberry32(41);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const donors = new Map<string, Person[]>();
  const donorFor = (g: string) => {
    const pool = donors.get(g) ?? [];
    donors.set(g, pool);
    const G = GROUPS[g];
    if (G.pac) {
      if (!pool.length) pool.push({ id: `d-${g}`, name: G.name, kind: "committee", role: "Political action committee", employer: G.employer, sector: G.sector, age: 0, state: "VA" });
      return pool[0];
    }
    // Most gifts come from a donor who has given before, as in itemized filings.
    if (pool.length && rnd() < 0.55) return pick(pool);
    const age = Math.round(20 + ((rnd() + rnd()) / 2) * 54);
    const p: Person = { id: `d-${g}-${pool.length}`, name: `${pick(FIRST)} ${pick(SURNAMES)}`, kind: "donor", role: `Employee, ${G.employer}`, employer: G.employer, sector: G.sector, age, state: pick(G.states) };
    pool.push(p);
    return p;
  };
  const gifts: Gift[] = [];
  const add = (to: string, g: string, counts: number[], y0 = 2019) => {
    const pull = to === "Whitcombe" && ["hal", "fwd", "tes"].includes(g);
    counts.forEach((n, i) => {
      for (let k = 0; k < n; k++) {
        const y = y0 + i;
        const vote = VOTES.find((v) => v.date.startsWith(String(y)));
        const vt = vote ? y + (day(vote.date) - day(`${y}-01-01`)) / 365 : 0;
        // Gifts from Halvorsen and its committees bunch up in the weeks before a launch vote.
        const near = pull && vote && rnd() < (y === 2025 ? 0.62 : y >= 2022 ? 0.35 : 0.1);
        const t = near ? vt - (0.004 + rnd() * 0.074) : y + rnd() * (y === 2026 ? 0.44 : 0.98);
        const d = donorFor(g);
        gifts.push({ id: `g-${to[0].toLowerCase()}-${g}-${y}-${k}`, donor_id: d.id, donor: d.name, employer: d.employer, recipient: to, donor_group: GROUPS[g].name, sector: GROUPS[g].sector, date: iso(t), amount: pick(GROUPS[g].amounts), state: d.state, vote_id: null, days_before_vote: null, source: y === 2026 ? "FEC 2026 pre-primary" : to === "Brandt" ? "FEC Schedule A, Brandt" : "FEC Schedule A" });
      }
    });
  };
  add("Whitcombe", "hal", [1, 1, 3, 5, 6, 8, 11, 9]);
  add("Whitcombe", "fwd", [0, 1, 1, 2, 2, 3, 3, 3]);
  add("Whitcombe", "tes", [0, 0, 1, 2, 2, 3, 4, 3]);
  add("Whitcombe", "mer", [3, 3, 2, 0, 0, 0, 0, 0]);
  add("Whitcombe", "oth", [2, 2, 2, 3, 2, 3, 3, 3]);
  add("Whitcombe", "fin", [5, 5, 5, 5, 5, 5, 5, 5]);
  add("Whitcombe", "energy", [4, 4, 4, 4, 4, 4, 4, 4]);
  add("Whitcombe", "health", [3, 3, 3, 3, 3, 3, 3, 3]);
  add("Whitcombe", "estate", [3, 3, 3, 3, 3, 3, 3, 3]);
  add("Whitcombe", "lobby", [1, 1, 2, 3, 3, 4, 5, 5]);
  add("Brandt", "mer", [1, 1, 2, 4, 4, 5, 5, 4]);
  add("Brandt", "oth", [2, 2, 2, 2, 2, 2, 2, 2]);
  add("Brandt", "hal", [2, 1, 0, 0, 0, 0, 0, 0]);
  for (const g of gifts) {
    const next = VOTES.find((v) => day(v.date) >= day(g.date));
    if (!next || g.recipient !== "Whitcombe") continue;
    g.days_before_vote = Math.round(day(next.date) - day(g.date));
    g.vote_id = next.id;
  }
  return { gifts, donors: [...donors.values()].flat() };
}
const built = build();
export const GIFTS = built.gifts;
PEOPLE.push(...built.donors);

export const FILINGS: Filing[] = (() => {
  const rnd = mulberry32(7);
  const out: Filing[] = [];
  const pairs: [string, string, number, number][] = [
    ["Halvorsen Aerodyne", "Kestrel Row Partners", 180000, 0.14],
    ["Halvorsen Aerodyne", "Alder & Finch", 60000, 0.02],
    ["Tessaly Systems", "Kestrel Row Partners", 30000, 0.1],
    ["Meridian Orbital", "Alder & Finch", 90000, -0.02],
    ["Northgate Capital", "Alder & Finch", 20000, 0],
  ];
  const issues = ["Launch procurement", "Range fees", "Sole-source authority", "Defense appropriations"];
  for (let y = 2019; y <= 2025; y++)
    for (let q = 0; q < 4; q++)
      for (const [client, firm, base, growth] of pairs) {
        const amt = Math.round((base * Math.pow(1 + growth, y - 2019 + q / 4) * (0.8 + rnd() * 0.4)) / 1000) * 1000;
        out.push({ id: `ld-${client.split(" ")[0].toLowerCase()}-${firm.split(" ")[0].toLowerCase()}-${y}q${q + 1}`, client, firm, quarter: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, amount: amt, issue: issues[Math.floor(rnd() * issues.length)] });
      }
  return out;
})();

const at = (h: number) => `2025-09-09 ${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}:00`;
const SUMMIT: [string, string, number, number, string, string[], string?][] = [
  ["m1", "Main hall", 8.5, 9.75, "Opening keynote", ["whitcombe", "ferreira", "tolliver", "calder", "brandt", "yates", "marchetti", "voss", "liang"]],
  ["m2", "Ballroom A", 10.25, 11.25, "Panel on launch cadence", ["whitcombe", "tolliver", "calder"]],
  ["m3", "Ballroom B", 10.25, 11.25, "Panel on competition in launch", ["brandt", "marchetti", "yates"]],
  ["m4", "Suite 2", 12, 12.75, "Private meeting", ["whitcombe", "ferreira", "voss", "tolliver"], "Kestrel Row Partners"],
  ["m5", "Terrace", 13, 14, "Sponsors' lunch", ["yates", "liang", "marchetti", "adeyemi", "brandt"]],
  ["m6", "Suite 3", 14.25, 14.83, "Private meeting", ["calder", "voss"], "Kestrel Row Partners"],
  ["m7", "Exhibit floor", 15, 16.5, "Exhibit hours", ["tolliver", "adeyemi", "yates", "brandt", "marchetti", "calder"]],
  ["m8", "Terrace", 18, 20, "Halvorsen reception", ["whitcombe", "ferreira", "tolliver", "adeyemi", "voss", "liang", "calder", "yates"], "Halvorsen Aerodyne"],
];
export const SESSIONS: Session[] = SUMMIT.map(([id, room, a, b, title, , booked]) => ({ id, room, starts: at(a), ends: at(b), title, private: title === "Private meeting", booked_by: booked ?? null }));
export const ATTENDANCE: Attendance[] = SUMMIT.flatMap(([id, , , , , who]) => who.map((p) => ({ session_id: id, person_id: p })));

export interface Event { id: string; actor: string; kind: string; title: string; starts: string; ends: string | null; related: string | null; weight: number }
// Roles and registrations run from starts to ends, with no end while they continue. Everything else happened on one day.
export const EVENTS: Event[] = ([
  ["e1", "Voss", "role", "Deputy Director, Office of Orbital Logistics", "2017-02-01", "2022-08-31", null, 2],
  ["e2", "Voss", "cooling-off", "One-year ban on contact with the office", "2022-09-01", "2023-08-31", null, 3],
  ["e3", "Voss", "role", "Partner, Kestrel Row Partners", "2022-10-03", null, null, 2],
  ["e4", "Calder", "role", "Deputy Director, Office of Orbital Logistics", "2022-09-12", null, null, 2],
  ["e5", "Whitcombe", "role", "Chair, Subcommittee on Space Procurement", "2023-01-03", null, null, 2],
  ["e6", "Tolliver", "role", "Chief executive, Halvorsen Aerodyne", "2018-05-01", null, null, 1],
  ["e7", "Halvorsen Aerodyne", "registration", "Kestrel Row registered to lobby for Halvorsen", "2022-11-14", null, null, 2],
  ["m1", "Voss", "meeting", "Lunch with Calder, in the gift log", "2023-03-14", null, "m2", 3],
  ["m2", "Calder", "meeting", "Lunch with Voss", "2023-03-14", null, null, 1],
  ["m21", "Whitcombe", "vote", "Votes for the amendment on cadence reporting", "2022-06-14", null, null, 1],
  ["m3", "Whitcombe", "vote", "Votes for S. 2226, launch service lanes", "2023-07-10", null, null, 1],
  ["m22", "Halvorsen Aerodyne", "filing", "Lobbying spend passes $500K a quarter", "2023-10-20", null, null, 1],
  ["m6", "Office of Orbital Logistics", "document", "Draft solicitation, cadence weight 20%", "2024-02-20", null, null, 2],
  ["m4", "Tolliver", "gift", "Gives $6,600 to Whitcombe", "2024-05-30", null, "m5", 2],
  ["m5", "Whitcombe", "vote", "Votes for the amendment on range fees", "2024-06-10", null, null, 1],
  ["m7", "Voss", "meeting", "Meets Whitcombe and Ferreira", "2024-11-18", null, "m8", 2],
  ["m8", "Whitcombe", "meeting", "Meets Voss", "2024-11-18", null, null, 1],
  ["m11", "Calder", "meeting", "Call with Tolliver", "2025-01-22", null, "m12", 2],
  ["m12", "Tolliver", "meeting", "Call with Calder", "2025-01-22", null, null, 1],
  ["m9", "Whitcombe", "statement", "Op-ed backing sole-source launch", "2025-02-11", null, null, 1],
  ["m10", "Office of Orbital Logistics", "document", "Final solicitation, cadence weight 35%", "2025-03-04", null, "m6", 3],
  ["m14", "Halvorsen Aerodyne", "gift", "Forward Lift PAC gives Whitcombe $10,000", "2025-05-02", null, "m13", 2],
  ["m13", "Whitcombe", "vote", "Votes for S. 2114, sole-source authority", "2025-05-21", null, null, 3],
  ["m18", "Calder", "statement", "Declines to recuse from the evaluation", "2025-06-30", null, null, 2],
  ["m15", "Voss", "meeting", "Private meeting at the summit", "2025-09-09", null, "m16", 2],
  ["m16", "Whitcombe", "meeting", "Private meeting at the summit", "2025-09-09", null, "m17", 1],
  ["m17", "Tolliver", "meeting", "Private meeting at the summit", "2025-09-09", null, null, 1],
  ["m19", "Office of Orbital Logistics", "award", "Contract OOL-25-R-0090 awarded to Halvorsen", "2025-11-06", null, "m20", 3],
  ["m20", "Halvorsen Aerodyne", "award", "Wins OOL-25-R-0090", "2025-11-06", null, null, 1],
] as [string, string, string, string, string, string | null, string | null, number][]).map(([id, actor, kind, title, starts, ends, related, weight]) => ({ id, actor, kind, title, starts, ends, related, weight }));

// The named entities and ties of the case board, without the generated crowd around them.
const CROWD = /^(donor|staff|sub|lob|pac|member|guest)\d+$/;
export const ENTITIES = GRAPH.entities.filter((e) => !CROWD.test(e.id)).map((e) => ({ id: e.id, name: e.name, kind: e.kind, sector: e.sector, role: e.role ?? null, party: e.party ?? null }));
export const TIES = GRAPH.ties.filter((t) => !CROWD.test(t.s) && !CROWD.test(t.t)).map((t) => ({ source: t.s, target: t.t, type: t.type, weight: t.w }));

export const TABLES: { name: string; rows: object[]; columns: Record<string, string>; about: string }[] = [
  { name: "people", rows: PEOPLE, about: "Officials, lobbyists, executives and itemized donors", columns: { id: "VARCHAR", name: "VARCHAR", kind: "VARCHAR", role: "VARCHAR", employer: "VARCHAR", sector: "VARCHAR", age: "INTEGER", state: "VARCHAR" } },
  { name: "gifts", rows: GIFTS, about: "Itemized contributions to Whitcombe and Brandt, 2019 to June 2026", columns: { id: "VARCHAR", donor_id: "VARCHAR", donor: "VARCHAR", employer: "VARCHAR", recipient: "VARCHAR", donor_group: "VARCHAR", sector: "VARCHAR", date: "DATE", amount: "DOUBLE", state: "VARCHAR", vote_id: "VARCHAR", days_before_vote: "INTEGER", source: "VARCHAR" } },
  { name: "votes", rows: VOTES, about: "Whitcombe's roll-call votes on launch bills", columns: { id: "VARCHAR", date: "DATE", title: "VARCHAR", senator: "VARCHAR", position: "VARCHAR" } },
  { name: "filings", rows: FILINGS, about: "Quarterly lobbying disclosures (LD-2) by client and firm", columns: { id: "VARCHAR", client: "VARCHAR", firm: "VARCHAR", quarter: "DATE", amount: "DOUBLE", issue: "VARCHAR" } },
  { name: "summit_sessions", rows: SESSIONS, about: "Sessions at the Aerospace Futures Summit, 9 Sep 2025", columns: { id: "VARCHAR", room: "VARCHAR", starts: "TIMESTAMP", ends: "TIMESTAMP", title: "VARCHAR", private: "BOOLEAN", booked_by: "VARCHAR" } },
  { name: "events", rows: EVENTS, about: "Dated events and roles of the main actors, 2017 to 2025", columns: { id: "VARCHAR", actor: "VARCHAR", kind: "VARCHAR", title: "VARCHAR", starts: "DATE", ends: "DATE", related: "VARCHAR", weight: "INTEGER" } },
  { name: "entities", rows: ENTITIES, about: "People, companies, firms, committees, agencies and events on the case board", columns: { id: "VARCHAR", name: "VARCHAR", kind: "VARCHAR", sector: "VARCHAR", role: "VARCHAR", party: "VARCHAR" } },
  { name: "ties", rows: TIES, about: "Ties between entities, by type and strength", columns: { source: "VARCHAR", target: "VARCHAR", type: "VARCHAR", weight: "INTEGER" } },
  { name: "attendance", rows: ATTENDANCE, about: "Who attended each summit session", columns: { session_id: "VARCHAR", person_id: "VARCHAR" } },
];

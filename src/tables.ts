import { GRAPH, mulberry32 } from "./graph.js";

// The records of the case, generated with fixed seeds. The case panels are drawn from these tables, and the same
// tables are loaded into DuckDB for the queries of answers. Dates are ISO strings so that DuckDB reads them as DATE and
// TIMESTAMP columns. Amounts are in dollars.

export interface Person { id: string; name: string; kind: string; role: string; employer: string; sector: string; age: number; state: string }
export interface Gift { id: string; donor_id: string; donor: string; employer: string; recipient: string; donor_group: string; sector: string; date: string; amount: number; state: string; vote_id: string | null; days_before_vote: number | null; source: string }
export interface Vote { id: string; date: string; title: string; senator: string; position: string; party_position: string; launch: boolean }
export interface Filing { id: string; client: string; firm: string; quarter: string; amount: number; issue: string; lobbyists: number; former_officials: number }
export interface Session { id: string; room: string; starts: string; ends: string; title: string; private: boolean; booked_by: string | null }
export interface Attendance { session_id: string; person_id: string }

const iso = (t: number) => {
  const y = Math.floor(t);
  return new Date(Date.UTC(y, 0, 1 + Math.floor((t - y) * 365))).toISOString().slice(0, 10);
};
const day = (s: string) => Date.parse(s) / 864e5;

// Whitcombe's votes on launch bills since 2019. Gifts are matched to the next of these.
const LAUNCH_VOTES: Vote[] = [
  [2019.216, "Amendment 412, competition for launch contracts"],
  [2020.55, "Defense bill, section 1601, launch procurement"],
  [2021.72, "S. 2792 markup, national security launch"],
  [2022.45, "Amendment on launch cadence reporting"],
  [2023.52, "S. 2226 markup, launch service lanes"],
  [2024.44, "Amendment on launch range fees"],
  [2025.386, "S. 2114 as amended, section 6 sole-source authority"],
].map(([t, title], i) => ({ id: `v${19 + i}`, date: iso(t as number), title: title as string, senator: "Whitcombe", position: "Aye", party_position: "Aye", launch: true }));

// Her other roll calls in 2025. Three more concern S. 2114, and on one of them she voted against her party.
const ROLL_CALLS: Vote[] = (() => {
  const rnd = mulberry32(8);
  const subjects = ["Nomination, district judge", "Appropriations amendment", "Motion to table", "Cloture on nomination", "Resolution of disapproval", "Defense authorization amendment", "Budget point of order", "Nomination, assistant secretary"];
  const s2114: Record<number, [string, boolean]> = { 31: ["S. 2114, motion to proceed", true], 44: ["S. 2114, amendment 7 on competition in launch", false], 49: ["S. 2114, passage", true] };
  const out: Vote[] = [];
  for (let i = 0; i < 55; i++) {
    const date = new Date(Date.UTC(2025, 0, 8) + Math.round(i * 5.1) * 864e5).toISOString().slice(0, 10);
    const r = rnd();
    const party = rnd() < 0.7 ? "Aye" : "Nay";
    const key = s2114[i];
    const v = key ? (key[1] ? 1 : -1) : r < 0.86 ? 1 : r < 0.96 ? -1 : 0;
    const position = v === 0 ? "Not voting" : v > 0 ? party : party === "Aye" ? "Nay" : "Aye";
    out.push({ id: `rc25-${i + 1}`, date: key?.[0] === "S. 2114, passage" ? "2025-09-17" : date, title: key ? key[0] : subjects[Math.floor(rnd() * subjects.length)], senator: "Whitcombe", position, party_position: party, launch: !!key });
  }
  return out;
})();
export const VOTES: Vote[] = [...LAUNCH_VOTES, ...ROLL_CALLS].sort((a, b) => a.date.localeCompare(b.date));

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
        const vote = LAUNCH_VOTES.find((v) => v.date.startsWith(String(y)));
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
  gifts.push({ id: "g-w-tolliver-2024", donor_id: "tolliver", donor: "Graham Tolliver", employer: "Halvorsen Aerodyne", recipient: "Whitcombe", donor_group: "Halvorsen staff", sector: "Aerospace and defense", date: "2024-05-30", amount: 6600, state: "WA", vote_id: null, days_before_vote: null, source: "FEC Schedule A" });
  for (const g of gifts) {
    const next = LAUNCH_VOTES.find((v) => day(v.date) >= day(g.date));
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
        const quarter = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
        // Kestrel Row's team grows each year. Its former officials are Ashby from 2022, Raghunathan from 2023 and Voss
        // from the second quarter of 2024.
        const kr = firm === "Kestrel Row Partners";
        const lobbyists = kr ? Math.min(9, 3 + (y - 2019) + (q >= 2 ? 1 : 0)) : 2 + (y >= 2023 ? 1 : 0);
        const former = kr ? Number(y >= 2022) + Number(y >= 2023) + Number(quarter >= "2024-04-01") : 0;
        out.push({ id: `ld-${client.split(" ")[0].toLowerCase()}-${firm.split(" ")[0].toLowerCase()}-${y}q${q + 1}`, client, firm, quarter, amount: amt, issue: issues[Math.floor(rnd() * issues.length)], lobbyists, former_officials: former });
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

export interface Event { id: string; actor: string; kind: string; title: string; label: string; starts: string; ends: string | null; related: string | null; weight: number; place: string | null }
// Roles and registrations run from starts to ends, with no end while they continue. Everything else happened on one day.
// The report for the first quarter in which Halvorsen's lobbying spend passed $500K, due 20 days after the quarter.
const PAST_500K = (() => {
  const by = new Map<string, number>();
  for (const f of FILINGS) if (f.client === "Halvorsen Aerodyne") by.set(f.quarter, (by.get(f.quarter) ?? 0) + f.amount);
  const q = [...by].sort((a, b) => a[0].localeCompare(b[0])).find(([, v]) => v >= 500000)![0];
  const end = new Date(Date.UTC(+q.slice(0, 4), +q.slice(5, 7) + 2, 1));
  return new Date(end.getTime() + 19 * 864e5).toISOString().slice(0, 10);
})();

// Each event has a short label for charts. Conferences are listed under their own name, with the city.
export const EVENTS: Event[] = ([
  ["e1", "Voss", "role", "Deputy Director, Office of Orbital Logistics", "Deputy director, OOL", "2017-02-01", "2024-03-15", null, 2, null],
  ["e2", "Voss", "cooling-off", "One-year ban on contact with the office", "Cooling-off period", "2024-03-15", "2025-03-15", null, 3, null],
  ["e3", "Voss", "role", "Partner, Kestrel Row Partners", "Kestrel Row partner", "2024-05-06", null, null, 2, null],
  ["e8", "Voss", "role", "Member, Halvorsen advisory board", "Halvorsen advisory board", "2025-01-15", null, null, 2, null],
  ["e4", "Calder", "role", "Deputy Director, Office of Orbital Logistics", "Deputy director, OOL", "2024-04-01", null, null, 2, null],
  ["e5", "Whitcombe", "role", "Chair, Subcommittee on Space Procurement", "Subcommittee chair", "2023-01-03", null, null, 2, null],
  ["e6", "Tolliver", "role", "Chief executive, Halvorsen Aerodyne", "Halvorsen chief executive", "2018-05-01", null, null, 1, null],
  ["e7", "Halvorsen Aerodyne", "registration", "Kestrel Row registered to lobby for Halvorsen", "Kestrel Row registered", "2018-11-14", null, null, 2, null],
  ["m21", "Whitcombe", "vote", "Votes for the amendment on cadence reporting", "Cadence reporting vote", "2022-06-14", null, null, 1, null],
  ["m3", "Whitcombe", "vote", "Votes for S. 2226, launch service lanes", "S. 2226 vote", "2023-07-10", null, null, 1, null],
  ["m22", "Halvorsen Aerodyne", "filing", "Lobbying spend passes $500K a quarter", "Spend passes $500K", PAST_500K, null, null, 1, null],
  ["m6", "Office of Orbital Logistics", "document", "Draft solicitation, cadence weight 20%", "Draft solicitation", "2024-02-20", null, null, 2, null],
  ["m4", "Tolliver", "gift", "Gives $6,600 to Whitcombe", "Tolliver gives $6,600", "2024-05-30", null, "m5", 2, null],
  ["m5", "Whitcombe", "vote", "Votes for the amendment on range fees", "Range fees vote", "2024-06-10", null, null, 1, null],
  ["c1", "Aerospace Futures Summit", "conference", "Aerospace Futures Summit", "Summit, Las Vegas", "2024-09-09", "2024-09-12", null, 1, "Las Vegas"],
  ["m1", "Voss", "meeting", "Lunch with Calder, in the gift log", "Voss lunches with Calder", "2024-10-14", null, "m2", 3, "Washington"],
  ["m2", "Calder", "meeting", "Lunch with Voss", "Lunch with Voss", "2024-10-14", null, null, 1, "Washington"],
  ["m7", "Voss", "meeting", "Meets Whitcombe and Ferreira", "Voss meets Whitcombe", "2024-11-18", null, "m8", 2, "Washington"],
  ["m8", "Whitcombe", "meeting", "Meets Voss", "Meets Voss", "2024-11-18", null, null, 1, "Washington"],
  ["m11", "Calder", "meeting", "Call with Tolliver", "Call with Tolliver", "2025-01-22", null, "m12", 2, null],
  ["m12", "Tolliver", "meeting", "Call with Calder", "Call with Calder", "2025-01-22", null, null, 1, null],
  ["m9", "Whitcombe", "statement", "Op-ed backing sole-source launch", "Op-ed", "2025-02-11", null, null, 1, null],
  ["h1", "Subcommittee on Space Procurement", "hearing", "Hearing on competition in launch", "Hearing", "2025-02-26", null, null, 1, "Washington"],
  ["m10", "Office of Orbital Logistics", "document", "Final solicitation, cadence weight 35%", "Final solicitation", "2025-03-04", null, "m6", 3, null],
  ["c2", "Gulf Launch Expo", "conference", "Gulf Launch Expo", "Gulf Launch Expo", "2025-03-18", "2025-03-20", null, 1, "Houston"],
  ["m14", "Halvorsen Aerodyne", "gift", "Forward Lift PAC gives Whitcombe $10,000", "Forward Lift gives $10,000", "2025-05-02", null, "m13", 2, null],
  ["m13", "Whitcombe", "vote", "Votes for S. 2114, sole-source authority", "Markup, S. 2114", "2025-05-21", null, null, 3, "Washington"],
  ["c3", "Spaceport Industry Dinner", "conference", "Spaceport Industry Dinner", "Industry dinner", "2025-06-03", "2025-06-04", null, 1, "Washington"],
  ["m18", "Calder", "statement", "Declines to recuse from the evaluation", "Calder declines to recuse", "2025-06-30", null, null, 2, null],
  ["c4", "Aerospace Futures Summit", "conference", "Aerospace Futures Summit", "Summit, Las Vegas", "2025-09-08", "2025-09-11", null, 1, "Las Vegas"],
  ["m15", "Voss", "meeting", "Private meeting at the summit", "Private meeting", "2025-09-09", null, "m16", 2, "Las Vegas"],
  ["m16", "Whitcombe", "meeting", "Private meeting at the summit", "Private meeting", "2025-09-09", null, "m17", 1, "Las Vegas"],
  ["m17", "Tolliver", "meeting", "Private meeting at the summit", "Private meeting", "2025-09-09", null, null, 1, "Las Vegas"],
  ["m23", "Whitcombe", "vote", "Votes for S. 2114 on the floor", "Floor vote", "2025-09-17", null, null, 2, "Washington"],
  ["m19", "Office of Orbital Logistics", "award", "Contract OOL-25-R-0090 awarded to Halvorsen", "Award, $2.1B", "2025-11-06", null, "m20", 3, null],
  ["m20", "Halvorsen Aerodyne", "award", "Wins OOL-25-R-0090", "Wins the award", "2025-11-06", null, null, 1, null],
] as [string, string, string, string, string, string, string | null, string | null, number, string | null][]).map(([id, actor, kind, title, label, starts, ends, related, weight, place]) => ({ id, actor, kind, title, label, starts, ends, related, weight, place }));

export interface Contact { id: string; date: string; person_id: string; person: string; office: string; kind: string; source: string }
// Contacts logged between lobbyists or Halvorsen executives and public offices, June 2024 to April 2026. Counts per
// office and month rise through the summer of 2025 and fall away after the award.
export const CONTACTS: Contact[] = (() => {
  const rnd = mulberry32(5);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const PEAK: Record<string, number[]> = {
    "Office of Orbital Logistics": [1, 0, 2, 1, 1, 2, 3, 2, 4, 3, 5, 7, 9, 6, 2, 1, 1, 0],
    "Sen. Whitcombe": [0, 1, 0, 1, 2, 1, 1, 3, 2, 2, 4, 5, 4, 3, 1, 1, 0, 1],
    "Subcommittee staff": [1, 1, 0, 0, 1, 2, 2, 4, 3, 1, 2, 2, 3, 1, 1, 0, 0, 0],
    "Rep. Arandia": [0, 0, 1, 1, 0, 1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 1, 0, 0],
    "Rep. Yates": [0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 0, 0, 1, 0],
    "Sen. Brandt": [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  };
  const WHO: Record<string, string[]> = {
    "Office of Orbital Logistics": ["voss", "voss", "voss", "liang", "tolliver", "adeyemi"],
    "Sen. Whitcombe": ["voss", "voss", "liang", "tolliver"],
    "Subcommittee staff": ["voss", "liang", "liang", "adeyemi"],
    "Rep. Arandia": ["liang", "liang", "marchetti"],
    "Rep. Yates": ["liang", "marchetti"],
    "Sen. Brandt": ["marchetti", "liang"],
  };
  const names = new Map(PEOPLE.map((p) => [p.id, p.name]));
  const out: Contact[] = [];
  // The months in PEAK run from October 2024. Months before and after get a contact now and then.
  for (let k = -4; k < 22; k++) {
    const y = 2024 + Math.floor((9 + k) / 12), m = (9 + k) % 12;
    for (const [office, counts] of Object.entries(PEAK)) {
      const n = counts[k] ?? (office === "Office of Orbital Logistics" || office === "Sen. Whitcombe" ? Number(rnd() < 0.35) : 0);
      for (let i = 0; i < n; i++) {
        const who = pick(WHO[office]);
        const date = new Date(Date.UTC(y, m, 1 + Math.floor(rnd() * 28))).toISOString().slice(0, 10);
        const kind = pick(["meeting", "call", "call", "email"]);
        out.push({ id: "", date, person_id: who, person: names.get(who)!, office, kind, source: office === "Office of Orbital Logistics" ? "Visitor log" : office.startsWith("Sen.") || office.startsWith("Sub") ? "Office calendar" : "LD-2 report" });
      }
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  out.forEach((c, i) => { c.id = `c${i + 1}`; });
  return out;
})();

export interface Transfer { id: string; date: string; source: string; target: string; amount: number; kind: string }
// Money that moves through committees rather than straight to a candidate, 2024 cycle: contributions into Forward Lift
// PAC and Liberty Orbit Fund, the PAC's contributions to other candidates, and the fund's spending. The PAC's
// contributions to Whitcombe are itemized gifts, so they are in gifts. What goes into each committee matches what
// comes out.
export const TRANSFERS: Transfer[] = (() => {
  const rnd = mulberry32(13);
  const cycle = (g: Gift) => g.date >= "2023-01-01" && g.date < "2025-01-01";
  const toWhitcombe = GIFTS.filter((g) => g.donor_group === "Forward Lift PAC" && cycle(g)).reduce((a, g) => a + g.amount, 0);
  const pacOut: [string, number, string][] = [["Arandia for Congress", 380000, "PAC contribution"], ["Yates Victory", 250000, "PAC contribution"], ["Party committees", 500000, "PAC contribution"]];
  const pacIn = toWhitcombe + pacOut.reduce((a, r) => a + r[1], 0);
  const flows: [string, string, number, string][] = [
    ["Halvorsen Aerodyne", "Forward Lift PAC", pacIn * 0.54, "Contribution to a committee"],
    ["Northgate Capital", "Forward Lift PAC", pacIn * 0.06, "Contribution to a committee"],
    ["Halvorsen executives", "Forward Lift PAC", pacIn * 0.4, "Contribution to a committee"],
    ...pacOut.map(([t, v, k]) => ["Forward Lift PAC", t, v, k] as [string, string, number, string]),
    ["Halvorsen Aerodyne", "Liberty Orbit Fund", 500000, "Contribution to a committee"],
    ["Meridian Orbital", "Liberty Orbit Fund", 300000, "Contribution to a committee"],
    ["Northgate Capital", "Liberty Orbit Fund", 800000, "Contribution to a committee"],
    ["Liberty Orbit Fund", "Ads backing Whitcombe", 1150000, "Independent expenditure"],
    ["Liberty Orbit Fund", "Party committees", 450000, "Contribution to a committee"],
  ];
  // Each flow is reported in four parts over the cycle.
  const out: Transfer[] = [];
  for (const [source, target, total, kind] of flows) {
    const parts = [0.2, 0.25, 0.25, 0.3].map((w) => Math.round((total * w) / 100) * 100);
    parts[3] += Math.round(total) - parts.reduce((a, v) => a + v, 0);
    parts.forEach((amount, i) => {
      const date = new Date(Date.UTC(2023, 2 + i * 6 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 27))).toISOString().slice(0, 10);
      out.push({ id: `t${out.length + 1}`, date, source, target, amount, kind });
    });
  }
  return out;
})();

export interface Doc { id: string; type: string; title: string; date: string; source: string; relevance: number; excerpt: string; filing_id: string | null }
export interface Mention { document_id: string; entity_id: string }
const REPORT = FILINGS.find((f) => f.id === "ld-halvorsen-kestrel-2025q3")!;
const DOC_ROWS: [Doc, string[]][] = [
  [{ id: "E-0212", type: "Email", title: "Re: Thursday follow-up on evaluation criteria", date: "2025-10-14", source: "FOIA 2026-0417", relevance: 0.96, filing_id: null,
    excerpt: "Halvorsen can meet the revised cadence requirement if the past-performance weighting stays at the level in the September draft." }, ["voss", "calder", "liang", "halvorsen", "ferreira"]],
  [{ id: "E-0198", type: "Email", title: "Summit dinner seating", date: "2025-09-02", source: "FOIA 2026-0417", relevance: 0.81, filing_id: null,
    excerpt: "Nadia, the Halvorsen table has two open seats on the ninth. Graham would like the Deputy Director on his left and your office on his right, if the Senator's schedule allows.\n\nWe will send cars to the hotel at six. Nothing about this needs to go on the official calendar, as it is an industry dinner." }, ["voss", "ferreira", "tolliver", "calder", "summit"]],
  [{ id: "F-84672", type: "Filing", title: "LD-2 quarterly report, Kestrel Row for Halvorsen", date: "2025-10-20", source: "Senate Office of Public Records", relevance: 0.78, filing_id: REPORT.id,
    excerpt: `Income relating to lobbying activities for this reporting period was $${REPORT.amount.toLocaleString("en-US")}. ${["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][REPORT.lobbyists]} lobbyists are listed, ${["none", "one", "two", "three"][REPORT.former_officials]} of whom report a covered position in the last five years.\n\nSpecific issues: evaluation criteria for solicitation OOL-25-R-0090, launch cadence provisions of S. 2114, and fiscal 2026 appropriations for orbital logistics.` }, ["kestrel", "halvorsen", "voss", "liang", "ool", "subcmte"]],
  [{ id: "C-0031", type: "Contract", title: "Amendment 3 to RFP OOL-25-R-0090", date: "2025-10-23", source: "Federal procurement notices", relevance: 0.74, filing_id: null,
    excerpt: "Section M is amended. Past performance remains weighted at 35 percent of the technical score. The minimum demonstrated launch cadence is revised from eighteen to twelve per year.\n\nOfferors must acknowledge this amendment with their proposals. The closing date is unchanged." }, ["ool", "calder", "halvorsen"]],
  [{ id: "M-0107", type: "Memo", title: "Past-performance weighting options", date: "2025-09-19", source: "FOIA 2026-0417", relevance: 0.66, filing_id: null,
    excerpt: "Option A keeps past performance at 35 percent. Option B lowers it to 20 percent and raises price to 40 percent, which would favour offerors with fewer completed missions.\n\nStaff recommend Option B. The Deputy Director has asked for one more week before the amendment is drafted." }, ["calder", "ool", "halvorsen", "meridian"]],
  [{ id: "T-0044", type: "Transcript", title: "Subcommittee markup of S. 2114", date: "2025-05-21", source: "Congressional record", relevance: 0.52, filing_id: null,
    excerpt: "The Chair offered an amendment in the nature of a substitute. It strikes the eighteen-launch minimum in section 4 and directs the Office to set cadence requirements by rule.\n\nSenator Brandt asked which contractors met the eighteen-launch minimum at present. The Chair said she would supply the answer for the record." }, ["whitcombe", "brandt", "solheim", "okafor", "subcmte"]],
  [{ id: "E-0149", type: "Email", title: "Calendar hold, Phoenix site visit", date: "2025-06-11", source: "FOIA 2026-0417", relevance: 0.41, filing_id: null,
    excerpt: "Please hold the morning of the twenty-seventh for a visit to the Halvorsen integration facility. The company will handle ground transport.\n\nPress will not be invited. Graham Tolliver will lead the tour himself." }, ["ferreira", "tolliver", "whitcombe", "halvorsen"]],
];
export const DOCUMENTS: Doc[] = DOC_ROWS.map(([d]) => d);
export const MENTIONS: Mention[] = DOC_ROWS.flatMap(([d, ids]) => ids.map((entity_id) => ({ document_id: d.id, entity_id })));

export interface Senator { id: string; name: string; party: string; state: string; lean: number; subcommittee: boolean; seat: number | null; network_money: boolean }
// The Senate by voting record, from -1 (most liberal) to 1 (most conservative), and the 21 seats of the Subcommittee
// on Space Procurement with whether each member took money from the case network.
export const SENATORS: Senator[] = (() => {
  const rand = mulberry32(21);
  const g = () => (rand() + rand() + rand() + rand() - 2) / 2;
  const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
  const NAMED: Record<string, [string, string, string]> = { whitcombe: ["Dana Whitcombe", "R", "AZ"], brandt: ["Arlo Brandt", "D", "WA"], solheim: ["Mira Solheim", "I", "ME"], okafor: ["June Okafor", "D", "CO"] };
  const out: Senator[] = [];
  const add = (party: string, lean: number) => out.push({ id: `s${out.length + 1}`, name: "", party, state: "", lean: Math.round(lean * 100) / 100, subcommittee: false, seat: null, network_money: false });
  for (let i = 0; i < 47; i++) add("D", Math.max(-0.95, Math.min(-0.05, -0.42 + g() * 0.32)));
  for (let i = 0; i < 51; i++) add("R", Math.max(0.05, Math.min(0.95, 0.47 + g() * 0.34)));
  add("I", -0.12); add("I", -0.31);
  const named = (id: string, i: number) => { const [name, party, state] = NAMED[id]; Object.assign(out[i], { id, name, party, state }); };
  named("brandt", 1); named("okafor", 2); named("solheim", 98); named("whitcombe", 60);
  out[60].lean = 0.38;
  // Two seats per state, less the states the named senators hold.
  const free = STATES.flatMap((st) => [st, st]);
  for (const o of out) if (o.state) free.splice(free.indexOf(o.state), 1);
  for (const o of out) if (!o.state) o.state = free.shift()!;
  for (const o of out) if (!o.name) o.name = `${out.filter((x) => x.state === o.state).indexOf(o) === 0 ? "Senior" : "Junior"} senator, ${o.state}`;
  // Seats run from the left of the chamber: nine Democrats, the Independent from Maine, then eleven Republicans.
  const seats = [...out.filter((o) => o.party === "D").slice(0, 9), out[98], ...out.filter((o) => o.party === "R" && o.id !== "whitcombe").slice(5, 15), out[60]];
  seats.sort((a, b) => ({ D: 0, I: 1, R: 2 }[a.party]! - { D: 0, I: 1, R: 2 }[b.party]!) || a.lean - b.lean);
  const funded = new Set([1, 4, 7, 9, 11, 12, 14, 15, 17, 19]);
  const at = seats.indexOf(out[60]);
  [seats[at], seats[15]] = [seats[15], seats[at]];
  seats.forEach((o, i) => { o.subcommittee = true; o.seat = i; o.network_money = funded.has(i); });
  return out;
})();

// The named entities and ties of the case board, without the generated crowd around them.
const CROWD = /^(donor|staff|sub|lob|pac|member|guest)\d+$/;
export const ENTITIES = GRAPH.entities.filter((e) => !CROWD.test(e.id)).map((e) => ({ id: e.id, name: e.name, kind: e.kind, sector: e.sector, role: e.role ?? null, party: e.party ?? null }));
export const TIES = GRAPH.ties.filter((t) => !CROWD.test(t.s) && !CROWD.test(t.t)).map((t) => ({ source: t.s, target: t.t, type: t.type, weight: t.w }));

export const TABLES: { name: string; rows: object[]; columns: Record<string, string>; about: string }[] = [
  { name: "people", rows: PEOPLE, about: "Officials, lobbyists, executives and itemized donors", columns: { id: "VARCHAR", name: "VARCHAR", kind: "VARCHAR", role: "VARCHAR", employer: "VARCHAR", sector: "VARCHAR", age: "INTEGER", state: "VARCHAR" } },
  { name: "gifts", rows: GIFTS, about: "Itemized contributions to Whitcombe and Brandt, 2019 to June 2026", columns: { id: "VARCHAR", donor_id: "VARCHAR", donor: "VARCHAR", employer: "VARCHAR", recipient: "VARCHAR", donor_group: "VARCHAR", sector: "VARCHAR", date: "DATE", amount: "DOUBLE", state: "VARCHAR", vote_id: "VARCHAR", days_before_vote: "INTEGER", source: "VARCHAR" } },
  { name: "votes", rows: VOTES, about: "Whitcombe's roll-call votes: launch bills since 2019 and all her votes in 2025. launch marks votes on launch bills, party_position is how most of her party voted", columns: { id: "VARCHAR", date: "DATE", title: "VARCHAR", senator: "VARCHAR", position: "VARCHAR", party_position: "VARCHAR", launch: "BOOLEAN" } },
  { name: "filings", rows: FILINGS, about: "Quarterly lobbying disclosures (LD-2) by client and firm", columns: { id: "VARCHAR", client: "VARCHAR", firm: "VARCHAR", quarter: "DATE", amount: "DOUBLE", issue: "VARCHAR", lobbyists: "INTEGER", former_officials: "INTEGER" } },
  { name: "summit_sessions", rows: SESSIONS, about: "Sessions at the Aerospace Futures Summit, 9 Sep 2025", columns: { id: "VARCHAR", room: "VARCHAR", starts: "TIMESTAMP", ends: "TIMESTAMP", title: "VARCHAR", private: "BOOLEAN", booked_by: "VARCHAR" } },
  { name: "events", rows: EVENTS, about: "Dated events, roles and conferences of the main actors, 2017 to 2025, with a short label for charts and the city where known", columns: { id: "VARCHAR", actor: "VARCHAR", kind: "VARCHAR", title: "VARCHAR", label: "VARCHAR", starts: "DATE", ends: "DATE", related: "VARCHAR", weight: "INTEGER", place: "VARCHAR" } },
  { name: "entities", rows: ENTITIES, about: "People, companies, firms, committees, agencies and events on the case board", columns: { id: "VARCHAR", name: "VARCHAR", kind: "VARCHAR", sector: "VARCHAR", role: "VARCHAR", party: "VARCHAR" } },
  { name: "ties", rows: TIES, about: "Ties between entities, by type and strength", columns: { source: "VARCHAR", target: "VARCHAR", type: "VARCHAR", weight: "INTEGER" } },
  { name: "attendance", rows: ATTENDANCE, about: "Who attended each summit session", columns: { session_id: "VARCHAR", person_id: "VARCHAR" } },
  { name: "contacts", rows: CONTACTS, about: "Contacts logged between lobbyists or executives (person_id in people) and public offices, June 2024 to April 2026", columns: { id: "VARCHAR", date: "DATE", person_id: "VARCHAR", person: "VARCHAR", office: "VARCHAR", kind: "VARCHAR", source: "VARCHAR" } },
  { name: "transfers", rows: TRANSFERS, about: "Money through committees in the 2024 cycle: contributions into Forward Lift PAC and Liberty Orbit Fund, the PAC's contributions to other candidates, and the fund's spending. The PAC's gifts to Whitcombe are in gifts", columns: { id: "VARCHAR", date: "DATE", source: "VARCHAR", target: "VARCHAR", amount: "DOUBLE", kind: "VARCHAR" } },
  { name: "documents", rows: DOCUMENTS, about: "Emails, filings, memos, contracts and transcripts in the case file, with an excerpt", columns: { id: "VARCHAR", type: "VARCHAR", title: "VARCHAR", date: "DATE", source: "VARCHAR", relevance: "DOUBLE", excerpt: "VARCHAR", filing_id: "VARCHAR" } },
  { name: "mentions", rows: MENTIONS, about: "Which entities each document names", columns: { document_id: "VARCHAR", entity_id: "VARCHAR" } },
  { name: "senators", rows: SENATORS, about: "Senators by voting record from -1 (most liberal) to 1 (most conservative); subcommittee marks the 21 members of the Subcommittee on Space Procurement and network_money the members who took money from the case network", columns: { id: "VARCHAR", name: "VARCHAR", party: "VARCHAR", state: "VARCHAR", lean: "DOUBLE", subcommittee: "BOOLEAN", seat: "INTEGER", network_money: "BOOLEAN" } },
];

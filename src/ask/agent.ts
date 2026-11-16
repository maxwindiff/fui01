import { entityInText } from "./entities";
import { ENTITIES } from "./data";
import type { Answer, Layer } from "./spec";

// A scripted stand-in for the agent. It writes answers in the same format a model would, from a fixed set of
// questions, and uses the answer on screen for follow-ups. Each step carries the wait a real call would take.

export interface Context { current: Answer | null; selection: string[] }
export interface Reply { answer: Answer; ms: number; status: string }
interface Step { id: string; label: string; re: RegExp; ok: (c: Context) => boolean; ms: number; status: string; make: (q: string, c: Context) => Answer }

interface GiftState { recipients: string[]; aero: boolean; layout: "bars" | "time" | "map"; votes: boolean }
const giftState = (a: Answer | null): GiftState | null => (a?.notes?.gifts as GiftState | undefined) ?? null;

function giftAnswer(question: string, s: GiftState): Answer {
  const group = s.aero ? "donor_group" : "sector";
  const both = s.recipients.length > 1;
  const where = [
    both ? `recipient IN (${s.recipients.map((r) => `'${r}'`).join(", ")})` : `recipient = '${s.recipients[0]}'`,
    ...(s.aero ? ["sector = 'Aerospace and defense'"] : []),
    "date <= DATE '2025-12-31'",
  ].join("\n  AND ");
  const tables: Answer["tables"] = {};
  const layers: Layer[] = [];
  const unit: [string, string] = ["gift", "gifts"];
  if (s.layout === "bars") {
    const by = both ? `${group}, recipient` : group;
    tables.totals = { key: "key", sql: `SELECT ${by.split(", ").join(" || ':' || ")} AS key, ${by}, sum(amount) AS total, count(*) AS gifts, list(id) AS source_rows\nFROM gifts\nWHERE ${where}\nGROUP BY ${by}\nORDER BY sum(sum(amount)) OVER (PARTITION BY ${group}) DESC` };
    layers.push(
      { from: "totals", mark: "span", encoding: { y: { field: group }, x: { field: "total" }, tone: both ? { field: "recipient" } : s.aero ? { value: "accent" } : { field: "sector" } } },
      ...(both ? [] : [{ from: "totals", mark: "text" as const, encoding: { y: { field: group }, x: { field: "total" }, text: { field: "total" } } }]),
    );
  } else if (s.layout === "map") {
    tables.by_state = { key: "key", sql: `SELECT 'state:' || state AS key, state, sum(amount) AS total, count(*) AS gifts, list(id) AS source_rows\nFROM gifts\nWHERE ${where}\nGROUP BY state` };
    layers.push({ from: "by_state", mark: "point", encoding: { place: { field: "state", type: "place" }, size: { field: "total" }, tone: { value: "accent" } } });
  } else {
    tables.gift_list = { key: "id", sql: `SELECT id, donor, employer, donor_group, sector, recipient, date, amount, state, days_before_vote, source${s.votes ? ", days_before_vote <= 30 AS before_vote" : ""}\nFROM gifts\nWHERE ${where}\nORDER BY sum(amount) OVER (PARTITION BY ${group}) DESC, amount DESC` };
    const tone = s.votes ? { field: "before_vote", map: { true: "accent", false: "t6", null: "t6" } } : both ? { field: "recipient" } : s.aero ? { value: "accent" } : { field: "sector" };
    const fill = both && s.votes ? { fill: { field: "recipient", map: { Whitcombe: "tint", Brandt: "hollow" } } } : {};
    layers.push({ from: "gift_list", mark: "point", adjust: "dodge", encoding: { x: { field: "date" }, y: { field: both && !s.aero ? "recipient" : group }, size: { field: "amount" }, tone, ...fill } });
    if (s.votes) {
      tables.launch_votes = { key: "id", sql: "SELECT id, date, title, 'Launch votes' AS lane FROM votes\nWHERE senator = 'Whitcombe'" };
      layers.unshift({ from: "launch_votes", mark: "rule", encoding: { x: { field: "date" }, weight: { value: "quiet" } } });
      layers.push({ from: "launch_votes", mark: "point", encoding: { x: { field: "date" }, y: { field: "lane" }, shape: { value: "diamond" }, fill: { value: "solid" }, tone: { value: "t1" } } });
    }
  }
  const who = s.recipients.join(" and ");
  return {
    question,
    title: `${s.aero ? "Aerospace and defense gifts" : "Itemized gifts"} to ${who}${s.layout === "time" ? ", by date" : s.layout === "map" ? ", by donor's state" : s.aero ? ", by donor group" : ", by sector"}`,
    tables, layers, unit,
    labels: { donor_group: "Donor group", before_vote: "Within 30 days before a vote", days_before_vote: "Days before the next vote", lane: "", total: "Total given" },
    notes: { gifts: s },
  };
}

function ageAnswer(question: string, op: ">=" | "<", age: number): Answer {
  return {
    question,
    title: "Donors by age",
    tables: {
      ages: { key: "key", sql: `SELECT 'age:' || age AS key, age, count(*) AS donors, age ${op} ${age} AS in_range, list(id) AS source_rows\nFROM people\nWHERE kind = 'donor'\nGROUP BY age\nORDER BY age` },
      tally: { sql: "SELECT format('{} of {} donors', sum(donors) FILTER (WHERE in_range), sum(donors)) AS label FROM ages" },
    },
    layers: [
      { from: "tally", mark: "text", encoding: { text: { field: "label" } } },
      { from: "ages", mark: "span", encoding: { x: { field: "age", bin: { step: 1 } }, y: { field: "donors" }, tone: { field: "in_range", map: { true: "accent", false: "t6" } } } },
    ],
    unit: ["donor", "donors"],
    labels: { in_range: "In range", donors: "Donors" },
  };
}

const CLIENT_TONES = { "Halvorsen Aerodyne": "accent", "Meridian Orbital": "t1", "Tessaly Systems": "t3", "Northgate Capital": "t6" };
const SPEND_WHERE = "quarter >= DATE '2022-01-01'";
function spendAnswer(question: string): Answer {
  return {
    question,
    title: "Lobbying spend by client and quarter",
    tables: {
      spend: { key: "key", sql: `SELECT client || ' ' || strftime(quarter, '%Y-%m') AS key, client, quarter, sum(amount) AS amount, list(id) AS source_rows\nFROM filings\nWHERE ${SPEND_WHERE}\nGROUP BY client, quarter\nORDER BY quarter, client` },
    },
    layers: [{ from: "spend", mark: "span", adjust: "stack", encoding: { x: { field: "quarter" }, y: { field: "amount" }, tone: { field: "client", map: CLIENT_TONES } } }],
    unit: ["filing", "filings"],
  };
}
function filingAnswer(question: string, cur: Answer | null): Answer {
  const where = cur?.tables.spend?.sql.match(/WHERE ([^\n]+)/)?.[1] ?? SPEND_WHERE;
  return {
    question,
    title: "Lobbying filings by client, firm and quarter",
    tables: { filing_list: { key: "id", sql: `SELECT id, client, firm, quarter, amount, issue\nFROM filings\nWHERE ${where}\nORDER BY quarter, client, firm` } },
    layers: [{ from: "filing_list", mark: "span", adjust: "stack", encoding: { x: { field: "quarter" }, y: { field: "amount" }, tone: { field: "client", map: CLIENT_TONES }, fill: { field: "firm", map: { "Kestrel Row Partners": "solid", "Alder & Finch": "hatch" } } } }],
    unit: ["filing", "filings"],
  };
}

function summitAnswer(question: string): Answer {
  return {
    question,
    title: "Who attended each session of the Aerospace Futures Summit",
    tables: {
      seen: { key: "key", sql: "SELECT a.session_id || '-' || a.person_id AS key, strftime(s.starts, '%H:%M') || '  ' || s.title AS session, split_part(p.name, ' ', 2) AS person, p.kind, s.private, s.room, s.starts\nFROM attendance a\nJOIN summit_sessions s ON s.id = a.session_id\nJOIN people p ON p.id = a.person_id\nORDER BY s.starts, p.kind DESC, p.name" },
    },
    layers: [
      { from: "seen", mark: "cell", encoding: { x: { field: "person" }, y: { field: "session" }, tone: { field: "kind", map: { official: "t1", lobbyist: "accent", executive: "t3" } }, fill: { field: "private", map: { true: "solid", false: "tint" } } } },
    ],
    unit: ["person at a session", "attendances"],
    labels: { private: "Private meeting", kind: "Role" },
  };
}

const SIM_SQL = `WITH draws AS (
  SELECT i,
    sqrt(-2 * ln(1 - hash('a' || i) / 18446744073709551616.0)) * cos(2 * pi() * hash('b' || i) / 18446744073709551616.0) AS n_run,
    sqrt(-2 * ln(1 - hash('c' || i) / 18446744073709551616.0)) * cos(2 * pi() * hash('d' || i) / 18446744073709551616.0) AS n_cad,
    sqrt(-2 * ln(1 - hash('e' || i) / 18446744073709551616.0)) * cos(2 * pi() * hash('f' || i) / 18446744073709551616.0) AS n_tech,
    sqrt(-2 * ln(1 - hash('g' || i) / 18446744073709551616.0)) * cos(2 * pi() * hash('h' || i) / 18446744073709551616.0) AS n_price
  FROM range(400) t(i)
), runs AS (
  SELECT 'run-' || i AS id,
    getvariable('weight') / 100 * (36 + 3.6 * n_cad)
      + (1 - getvariable('weight') / 100) * (0.6 * (-6 + 3.6 * n_tech) + 0.4 * (-1.5 * getvariable('price') + 3.6 * n_price))
      + 3 * n_run AS margin
  FROM draws
)
SELECT id, margin, CASE WHEN margin > 0 THEN 'Halvorsen' ELSE 'Meridian' END AS winner, 'simulated' AS certainty
FROM runs`;
function simAnswer(question: string, weight: number): Answer {
  return {
    question,
    title: "Simulated margin of the source selection",
    tables: {
      sim: { key: "id", sql: SIM_SQL },
      share: { sql: "SELECT format('Halvorsen wins {}% of 400 runs', round(100 * avg(CAST(margin > 0 AS INTEGER)))) AS label FROM sim" },
      award: { sql: "SELECT 6.2 AS margin, 'Recorded margin' AS label" },
    },
    params: {
      weight: { value: weight, min: 10, max: 45, step: 1, label: "Weight on launch cadence", unit: "%" },
      price: { value: 8, min: 0, max: 16, step: 1, label: "Meridian's price advantage", unit: "%" },
    },
    layers: [
      { from: "share", mark: "text", encoding: { text: { field: "label" } } },
      { mark: "rule", encoding: { x: { datum: 0 }, weight: { value: "quiet" } } },
      { from: "award", mark: "rule", encoding: { x: { field: "margin" }, tone: { value: "t1" }, text: { field: "label" } } },
      { from: "sim", mark: "point", adjust: "stack", encoding: { x: { field: "margin", bin: { step: 1 }, title: "Halvorsen's margin over Meridian, points" }, tone: { field: "winner", map: { Halvorsen: "accent", Meridian: "t1" } } } },
    ],
    unit: ["run", "runs"],
  };
}

const LANES = ["Whitcombe", "Calder", "Voss", "Tolliver", "Office of Orbital Logistics", "Halvorsen Aerodyne"];
const KIND_SHAPE = { vote: "diamond", award: "diamond", document: "square", filing: "square", gift: "square", statement: "ring", meeting: "dot" };
const KIND_TONE = { vote: "t1", award: "t1", document: "t3", filing: "t3", gift: "accent", statement: "t4", meeting: "accent" };
function timelineAnswer(question: string): Answer {
  const lanes = LANES.map((l) => `'${l}'`).join(", ");
  return {
    question,
    title: "Roles, meetings and decisions leading to the award",
    tables: {
      timeline: { key: "id", sql: `SELECT id, actor, kind, title, starts, ends, related, weight, list_position([${lanes}], actor) AS lane\nFROM events\nWHERE starts >= DATE '2017-01-01'\n  AND actor IN (${lanes})` },
      periods: { key: "id", sql: "SELECT id, actor, kind AS period, title, starts, coalesce(ends, DATE '2025-12-31') AS ends\nFROM timeline\nWHERE ends IS NOT NULL OR kind IN ('role', 'registration')\nORDER BY lane, starts" },
      moments: { key: "id", sql: "SELECT id, actor, kind, title, starts AS date\nFROM timeline\nWHERE kind IN ('meeting', 'vote', 'gift', 'document', 'statement', 'award', 'filing')\nORDER BY weight DESC" },
      related: { sql: "SELECT id AS source, related AS target FROM timeline WHERE related IS NOT NULL" },
    },
    layers: [
      { from: "periods", mark: "span", encoding: { x: { field: "starts", title: "Date" }, x2: { field: "ends" }, y: { field: "actor" }, tone: { field: "period", map: { role: "t6", registration: "t3", "cooling-off": "t5" } }, fill: { field: "period", map: { role: "tint", registration: "tint", "cooling-off": "hatch" } }, text: { field: "title" } } },
      { from: "related", mark: "link", encoding: { source: { field: "source" }, target: { field: "target" }, tone: { value: "ink" }, weight: { value: "quiet" } } },
      { from: "moments", mark: "point", encoding: { x: { field: "date" }, y: { field: "actor" }, shape: { field: "kind", map: KIND_SHAPE }, tone: { field: "kind", map: KIND_TONE }, fill: { value: "solid" }, text: { field: "title" } } },
    ],
    unit: ["event", "events"],
    labels: { actor: "Actor", starts: "Started", ends: "Ended", date: "Date", kind: "Event", period: "Period" },
  };
}

const ALL_TIES = ["money", "lobby", "employ", "contact", "board", "attend"];
const TIE_TONE = { money: "accent", lobby: "t3", employ: "t6", contact: "t1", board: "t2", attend: "t6" };
function networkAnswer(question: string, types: string[], center = "Dana Whitcombe"): Answer {
  return {
    question,
    title: types.length === 1 && types[0] === "money" ? `Money within two steps of ${center.split(" ").pop()}` : `Who is within two steps of ${center.split(" ").pop()}`,
    tables: {
      reach: { sql: `WITH RECURSIVE walk(id, hops) AS (\n  SELECT id, 0 FROM entities WHERE name = '${center.replace(/'/g, "''")}'\n  UNION\n  SELECT CASE WHEN t.source = w.id THEN t.target ELSE t.source END, w.hops + 1\n  FROM walk w JOIN ties t ON w.id IN (t.source, t.target)\n  WHERE w.hops < 2\n)\nSELECT id, min(hops) AS hops FROM walk GROUP BY id` },
      tie_list: { key: "key", sql: `SELECT source || '>' || target || ':' || type AS key, source, target, type, weight\nFROM ties\nWHERE weight >= 1\n  AND source IN (SELECT id FROM reach)\n  AND target IN (SELECT id FROM reach)\n  AND type IN (${types.map((t) => `'${t}'`).join(", ")})` },
      nodes: { key: "id", sql: "SELECT e.id, e.name, e.role, r.hops,\n  CASE e.sector WHEN 'gov' THEN 'Government' WHEN 'corp' THEN 'Company' WHEN 'inter' THEN 'Go-between' ELSE 'Event' END AS side,\n  CASE WHEN e.kind IN ('official', 'person') THEN 'Person' WHEN e.kind IN ('firm', 'pac') THEN 'Firm or PAC' WHEN e.kind = 'event' THEN 'Event' ELSE 'Organization' END AS form,\n  (SELECT count(*) FROM tie_list l WHERE e.id IN (l.source, l.target)) AS ties\nFROM entities e JOIN reach r USING (id)\nWHERE r.hops = 0 OR e.id IN (SELECT source FROM tie_list UNION SELECT target FROM tie_list)" },
    },
    layers: [
      { from: "tie_list", mark: "link", encoding: { source: { field: "source" }, target: { field: "target" }, tone: { field: "type", map: TIE_TONE }, size: { field: "weight" }, shape: { field: "type", map: { money: "arrow" } } } },
      { from: "nodes", mark: "point", layout: "network", encoding: { size: { field: "ties" }, tone: { field: "side", map: { Government: "t1", Company: "t3", "Go-between": "accent", Event: "t6" } }, shape: { field: "form", map: { Person: "dot", Organization: "square", "Firm or PAC": "diamond", Event: "ring" } }, fill: { field: "hops", map: { 0: "solid", 1: "solid", 2: "tint" } }, weight: { field: "hops", map: { 0: "strong", 1: "normal", 2: "normal" } }, text: { field: "name" } } },
    ],
    unit: ["entity", "entities"],
    labels: { "w.hops": "Steps from the center", name: "Center", ties: "Ties", hops: "Steps from the center", side: "Side", form: "Kind", type: "Tie type" },
    notes: { net: { types, center } },
  };
}

const ageOf = (q: string): { op: ">=" | "<"; age: number } | null => {
  const m = q.match(/(\d{2})\s*(\+|or older|and older|and over|or over|plus)/) ?? q.match(/(?:over|older than|above|at least)\s*(\d{2})/);
  if (m) return { op: ">=", age: +m[1] };
  const u = q.match(/(?:under|younger than|below)\s*(\d{2})/);
  return u ? { op: "<", age: +u[1] } : null;
};

const STEPS: Step[] = [
  { id: "money", label: "Follow the money", re: /money|follow|flow|pays/, ok: (c) => !!c.current?.notes?.net && (c.current.notes.net as { types: string[] }).types.length > 1, ms: 900, status: "Keeping only ties that carry money", make: (q, c) => networkAnswer(q, ["money"], (c.current?.notes?.net as { center?: string } | undefined)?.center) },
  { id: "net", label: "Who is Whitcombe connected to?", re: /connect|network|ties|linked|relationship|knows/, ok: (c) => !c.current?.notes?.net, ms: 1500, status: "Walking ties out from the center", make: (q) => networkAnswer(q, ALL_TIES, ENTITIES.find((e) => e.id === entityInText(q))?.name) },
  { id: "age", label: "How many donors are 40 or older?", re: /\bage|aged|older|younger|over \d|under \d|\d+\s*\+/, ok: (c) => !c.current?.tables.donors, ms: 1100, status: "Matching donors to voter records for age", make: (q) => { const a = ageOf(q) ?? { op: ">=" as const, age: 40 }; return ageAnswer(q, a.op, a.age); } },
  { id: "fund", label: "Who funds Whitcombe?", re: /fund|donor|gave|gives|money|contribut|gifts/, ok: (c) => !giftState(c.current), ms: 1400, status: "Searching itemized contributions", make: (q) => giftAnswer(q, { recipients: ["Whitcombe"], aero: false, layout: "bars", votes: false }) },
  { id: "aero", label: "Only aerospace and defense", re: /only|defen[cs]e|aerospace/, ok: (c) => !!giftState(c.current) && !giftState(c.current)!.aero, ms: 700, status: "Narrowing to aerospace donors", make: (q, c) => giftAnswer(q, { ...giftState(c.current)!, aero: true }) },
  { id: "date", label: "By date", re: /\bwhen\b|date|over time|year|timeline/, ok: (c) => !!giftState(c.current) && giftState(c.current)!.layout !== "time", ms: 600, status: "Laying the gifts out by date", make: (q, c) => giftAnswer(q, { ...giftState(c.current)!, layout: "time" }) },
  { id: "votes", label: "Cross-check with her votes", re: /vote|cross|roll call/, ok: (c) => !!giftState(c.current) && !giftState(c.current)!.votes, ms: 1300, status: "Reading roll calls on launch bills", make: (q, c) => giftAnswer(q, { ...giftState(c.current)!, layout: "time", votes: true }) },
  { id: "brandt", label: "Compare with Brandt", re: /compare|brandt|versus|\bvs\b/, ok: (c) => !!giftState(c.current) && giftState(c.current)!.recipients.length === 1, ms: 1400, status: "Searching contributions to Brandt", make: (q, c) => giftAnswer(q, { ...giftState(c.current)!, recipients: ["Whitcombe", "Brandt"], aero: true }) },
  { id: "map", label: "On the map", re: /map|where|state|live/, ok: (c) => !!giftState(c.current) && giftState(c.current)!.layout !== "map", ms: 600, status: "Placing donors by state", make: (q, c) => giftAnswer(q, { ...giftState(c.current)!, layout: "map" }) },
  { id: "spend", label: "Lobbying spend by quarter", re: /lobby|spend|ld-?2|disclos/, ok: (c) => !c.current?.tables.spend, ms: 1500, status: "Reading quarterly lobbying disclosures", make: (q) => spendAnswer(q) },
  { id: "split", label: "Break it down by firm", re: /break|firm|split|filing|detail/, ok: (c) => !!c.current?.tables.spend, ms: 900, status: "Listing the filings behind each total", make: (q, c) => filingAnswer(q, c.current) },
  { id: "timeline", label: "What led up to the award?", re: /led up|timeline|chronolog|what happened|events|sequence/, ok: (c) => !c.current?.tables.timeline, ms: 1600, status: "Lining up roles, meetings and decisions", make: (q) => timelineAnswer(q) },
  { id: "summit", label: "Who was at each summit session?", re: /summit|session|venue|convention|attend|meeting/, ok: (c) => !c.current?.tables.seen, ms: 1600, status: "Reading the summit schedule and badge scans", make: (q) => summitAnswer(q) },
  { id: "sim", label: "What if Calder recuses?", re: /what if|simulat|recus|scenario|calder/, ok: (c) => !c.current?.tables.sim, ms: 1900, status: "Running a model of the source selection", make: (q) => simAnswer(q, 20) },
];

const ORDER = ["aero", "date", "votes", "brandt", "map", "money", "split", "fund", "net", "timeline", "age", "spend", "summit", "sim"];
export function suggest(c: Context): string[] {
  return ORDER.map((id) => STEPS.find((s) => s.id === id)!).filter((s) => s.ok(c)).slice(0, 7).map((s) => s.label);
}

export async function ask(q: string, c: Context): Promise<Reply | { error: string }> {
  const t = q.toLowerCase();
  const step = STEPS.find((s) => s.re.test(t) && s.ok(c)) ?? STEPS.find((s) => s.re.test(t));
  if (!step) return { error: "The scripted agent answers a fixed set of questions. The suggestions list the ones available from here." };
  return { answer: step.make(q, c), ms: step.ms, status: step.status };
}

import { PANEL_TITLES } from "../panels";
import { getState } from "../workspace";
import { board } from "./board";
import { ALL_TIES, CLIENT_TONES, networkAnswer, spendAnswer } from "./agent";
import type { Answer } from "./spec";

// The data behind each case panel, written as an answer over the tables. The queries pick the same rows the panel
// draws, so a question asked from a panel gets those rows as context, and the panel can be opened as an answer to be
// split, filtered or shown as a table.

const CYCLE = "DATE '2023-01-01' AND DATE '2024-12-31'";
const AWARD = "(SELECT starts FROM events WHERE id = 'm19')";

const person: Answer = {
  question: "Who gives Whitcombe the most?",
  title: "Whitcombe's strongest ties by money, 2024 cycle",
  tables: {
    strongest: { key: "key", sql: `SELECT 'tie:' || CASE WHEN donor_id = 'tolliver' THEN 'Graham Tolliver' ELSE donor_group END AS key, CASE WHEN donor_id = 'tolliver' THEN 'Graham Tolliver' ELSE donor_group END AS tie, 'gifts' AS kind, sum(amount) AS amount, count(*) AS records, list(id) AS source_rows\nFROM gifts\nWHERE recipient = 'Whitcombe'\n  AND sector = 'Aerospace and defense'\n  AND date BETWEEN ${CYCLE}\n  AND (donor_id = 'tolliver' OR donor_group IN ('Forward Lift PAC', 'Halvorsen staff', 'Tessaly staff', 'Meridian staff'))\nGROUP BY ALL\nUNION ALL\nSELECT 'tie:Liberty Orbit Fund', 'Liberty Orbit Fund', 'ads', sum(amount), count(*), list(id)\nFROM transfers\nWHERE target = 'Ads backing Whitcombe'\nORDER BY amount DESC` },
    her_contacts: { key: "key", sql: "SELECT 'pc:' || strftime(date_trunc('month', date), '%Y-%m') AS key, date_trunc('month', date) AS month, count(*) AS contacts, list(id) AS source_rows\nFROM contacts\nWHERE office IN ('Sen. Whitcombe', 'Subcommittee staff')\nGROUP BY ALL\nORDER BY month" },
  },
  layers: [
    { from: "strongest", mark: "span", encoding: { y: { field: "tie" }, x: { field: "amount" }, tone: { field: "kind", map: { gifts: "accent", ads: "t3" } } } },
    { from: "strongest", mark: "text", encoding: { y: { field: "tie" }, x: { field: "amount" }, text: { field: "amount" } } },
  ],
  unit: ["record", "records"],
  labels: { tie: "Tie", amount: "Given", kind: "Kind", contacts: "Contacts", month: "Month" },
  format: { amount: "usd" },
};

const affiliation: Answer = {
  question: "Where does Whitcombe sit among senators by voting record?",
  title: "Senators by voting record",
  tables: {
    senate: { key: "id", sql: "SELECT id, coalesce(nullif(name, ''), 'Senator ' || id) AS name, party, lean, subcommittee, network_money,\n  CASE WHEN subcommittee THEN 'Subcommittee' ELSE 'Rest of the Senate' END AS seat\nFROM senators\nORDER BY lean" },
    last_votes: { key: "id", sql: "SELECT id, date, title, position, party_position, position = party_position AS with_party, title LIKE '%S. 2114%' AS s2114\nFROM votes\nWHERE senator = 'Whitcombe'\nORDER BY date DESC\nLIMIT 56" },
  },
  layers: [
    { from: "senate", mark: "point", adjust: "jitter", encoding: { x: { field: "lean", title: "Voting record, liberal to conservative" }, y: { field: "seat" }, tone: { field: "party", map: { D: "t1", R: "accent", I: "t3" } }, fill: { field: "network_money", map: { true: "solid", false: "hollow" } } } },
  ],
  unit: ["senator", "senators"],
  labels: { lean: "Voting record", seat: "", party: "Party", network_money: "Took money from the network", with_party: "With the party" },
};

const byState: Answer = {
  question: "Which states do the senators' donors live in?",
  title: "Giving to Whitcombe and Brandt by donor's state, 2024 cycle",
  tables: { by_state: { key: "key", sql: `SELECT 'state:' || state AS key, state, sum(amount) AS total, count(*) AS gifts, list(id) AS source_rows\nFROM gifts\nWHERE date BETWEEN ${CYCLE}\nGROUP BY state` } },
  layers: [{ from: "by_state", mark: "point", encoding: { place: { field: "state", type: "place" }, size: { field: "total" }, tone: { value: "accent" } } }],
  unit: ["gift", "gifts"],
  labels: { total: "Total given" },
};

const timeline: Answer = {
  question: "What happened around the award?",
  title: "Contacts, gifts, decisions and Voss's posts, 2024 to mid-2026",
  tables: {
    weekly: { key: "key", sql: "SELECT 'cw:' || strftime(date_trunc('week', date), '%Y-%m-%d') AS key, date_trunc('week', date) AS week, 'Contacts per week' AS lane, count(*) AS contacts, list(id) AS source_rows\nFROM contacts\nGROUP BY ALL" },
    quarterly: { key: "key", sql: "SELECT 'gq:' || strftime(date_trunc('quarter', date), '%Y-%m') AS key, last_day(date_trunc('quarter', date) + INTERVAL 2 MONTH) AS reported, 'Gifts to Whitcombe' AS lane, sum(amount) AS amount, list(id) AS source_rows\nFROM gifts\nWHERE recipient = 'Whitcombe'\n  AND date BETWEEN DATE '2024-01-01' AND DATE '2026-06-30'\nGROUP BY ALL" },
    hill: { key: "id", sql: "SELECT id, starts AS date, label, kind, 'Hill and agency' AS lane\nFROM events\nWHERE (kind IN ('document', 'hearing') OR (kind = 'vote' AND actor = 'Whitcombe') OR (kind = 'award' AND actor = 'Office of Orbital Logistics'))\n  AND starts BETWEEN DATE '2024-01-01' AND DATE '2026-06-30'" },
    spans: { key: "id", sql: "SELECT id, greatest(starts, DATE '2024-01-01') AS starts, coalesce(ends, DATE '2026-06-30') AS ends, label, kind, CASE WHEN kind = 'conference' THEN 'Conferences' ELSE 'Voss' END AS lane\nFROM events\nWHERE (kind = 'conference' OR (actor = 'Voss' AND kind IN ('role', 'cooling-off')))\n  AND (ends IS NULL OR ends >= DATE '2024-01-01')\n  AND starts <= DATE '2026-06-30'" },
  },
  layers: [
    { from: "spans", mark: "span", encoding: { x: { field: "starts", title: "Date" }, x2: { field: "ends" }, y: { field: "lane" }, tone: { field: "kind", map: { role: "t6", "cooling-off": "t5", conference: "t3" } }, fill: { field: "kind", map: { role: "tint", "cooling-off": "hatch", conference: "tint" } }, text: { field: "label" } } },
    { from: "weekly", mark: "point", encoding: { x: { field: "week" }, y: { field: "lane" }, size: { field: "contacts" }, tone: { value: "t1" } } },
    { from: "quarterly", mark: "point", encoding: { x: { field: "reported" }, y: { field: "lane" }, size: { field: "amount" }, tone: { value: "accent" } } },
    { from: "hill", mark: "point", encoding: { x: { field: "date" }, y: { field: "lane" }, shape: { value: "diamond" }, tone: { field: "kind", map: { vote: "t1", hearing: "t1", document: "t3", award: "accent" } }, fill: { value: "solid" }, text: { field: "label" } } },
  ],
  unit: ["record", "records"],
  labels: { lane: "", week: "Week", reported: "Reported", contacts: "Contacts", amount: "Given", starts: "Started", ends: "Ended", label: "Event", kind: "Kind" },
};

const flow: Answer = {
  question: "Where does the money go?",
  title: "Money from companies to campaigns, 2024 cycle",
  tables: {
    moves: { sql: "SELECT id, quarter AS date, client AS source, 'Lobbying contracts' AS target, amount FROM filings\nUNION ALL SELECT id, quarter, 'Lobbying contracts', firm, amount FROM filings\nUNION ALL SELECT id, date, CASE WHEN donor_group = 'Forward Lift PAC' THEN 'Forward Lift PAC' ELSE 'Direct gifts' END, recipient || ' for Senate', amount FROM gifts WHERE donor_group = 'Forward Lift PAC' OR employer IN ('Halvorsen Aerodyne', 'Meridian Orbital', 'Tessaly Systems')\nUNION ALL SELECT id, date, employer, 'Direct gifts', amount FROM gifts WHERE donor_group <> 'Forward Lift PAC' AND employer IN ('Halvorsen Aerodyne', 'Meridian Orbital', 'Tessaly Systems')\nUNION ALL SELECT id, date, source, target, amount FROM transfers" },
    flows: { key: "key", sql: `SELECT source || ' > ' || target AS key, source, target, sum(amount) AS amount, list(id) AS source_rows\nFROM moves\nWHERE date BETWEEN ${CYCLE}\nGROUP BY ALL\nORDER BY amount DESC` },
    stops: { key: "id", sql: "SELECT name AS id, name, CASE WHEN name IN (SELECT target FROM flows) AND name IN (SELECT source FROM flows) THEN 'Vehicle' WHEN name IN (SELECT source FROM flows) THEN 'Source' ELSE 'Recipient' END AS role,\n  (SELECT sum(amount) FROM flows f WHERE f.target = n.name OR (f.source = n.name AND n.name NOT IN (SELECT target FROM flows))) AS amount\nFROM (SELECT source AS name FROM flows UNION SELECT target FROM flows) n" },
  },
  layers: [
    { from: "flows", mark: "link", encoding: { source: { field: "source" }, target: { field: "target" }, size: { field: "amount" }, tone: { value: "accent" }, shape: { value: "arrow" } } },
    { from: "stops", mark: "point", layout: "network", encoding: { size: { field: "amount" }, tone: { field: "role", map: { Source: "t3", Vehicle: "accent", Recipient: "t1" } }, shape: { field: "role", map: { Source: "square", Vehicle: "diamond", Recipient: "dot" } }, text: { field: "name" } } },
  ],
  unit: ["record", "records"],
  labels: { amount: "Amount", role: "Role" },
};

const slope: Answer = {
  question: "How did aerospace giving shift between the senators?",
  title: "Share of aerospace and defense giving, 2022 and 2024 cycles",
  tables: {
    shares: { key: "key", sql: "SELECT recipient || ':' || cycle AS key, recipient, cycle, round(100 * sum(amount) / any_value(cycle_total)) AS share, sum(amount) AS amount, list(id) AS source_rows\nFROM (SELECT *, sum(amount) OVER (PARTITION BY cycle) AS cycle_total FROM (SELECT *, CASE WHEN date BETWEEN DATE '2021-01-01' AND DATE '2022-12-31' THEN '2022 cycle' WHEN date BETWEEN DATE '2023-01-01' AND DATE '2024-12-31' THEN '2024 cycle' END AS cycle\n      FROM gifts WHERE sector = 'Aerospace and defense'))\nWHERE cycle IS NOT NULL\nGROUP BY ALL\nORDER BY cycle, recipient" },
    change: { sql: "SELECT a.key AS source, b.key AS target FROM shares a JOIN shares b ON a.recipient = b.recipient AND a.cycle = '2022 cycle' AND b.cycle = '2024 cycle'" },
  },
  layers: [
    { from: "change", mark: "link", encoding: { source: { field: "source" }, target: { field: "target" }, tone: { value: "ink" }, weight: { value: "quiet" } } },
    { from: "shares", mark: "point", encoding: { x: { field: "cycle", type: "ordinal" }, y: { field: "share", title: "Share of giving, %" }, tone: { field: "recipient" }, fill: { value: "solid" }, text: { field: "share" } } },
  ],
  unit: ["gift", "gifts"],
  labels: { share: "Share, %", cycle: "Cycle", amount: "Given" },
};

const multiples: Answer = {
  question: "Which offices did lobbyists contact, and when?",
  title: "Contacts by office per month, October 2024 to March 2026",
  tables: { monthly: { key: "key", sql: "SELECT office || ':' || strftime(month, '%Y-%m') AS key, office, month, count(*) AS contacts, list(id) AS source_rows\nFROM (SELECT *, date_trunc('month', date) AS month FROM contacts)\nWHERE month BETWEEN DATE '2024-10-01' AND DATE '2026-03-01'\nGROUP BY ALL\nORDER BY month, office" } },
  layers: [{ from: "monthly", mark: "span", adjust: "stack", encoding: { x: { field: "month" }, y: { field: "contacts" }, tone: { field: "office", map: { "Office of Orbital Logistics": "accent", "Sen. Whitcombe": "t1", "Subcommittee staff": "t3", "Rep. Arandia": "t4", "Rep. Yates": "t5", "Sen. Brandt": "t6" } } } }],
  unit: ["contact", "contacts"],
  labels: { contacts: "Contacts", month: "Month", office: "Office" },
};

const filings: Answer = {
  question: "Which firms filed lobbying disclosures for Halvorsen?",
  title: "Halvorsen's lobbying filings since mid-2024",
  tables: { filing_list: { key: "id", sql: "SELECT id, quarter, firm, amount, issue, lobbyists, former_officials\nFROM filings\nWHERE client = 'Halvorsen Aerodyne'\n  AND quarter >= DATE '2024-07-01'\nORDER BY quarter DESC, firm" } },
  layers: [{ from: "filing_list", mark: "span", adjust: "stack", encoding: { x: { field: "quarter" }, y: { field: "amount" }, tone: { field: "firm", map: { "Kestrel Row Partners": "accent", "Alder & Finch": "t1" } } } }],
  unit: ["filing", "filings"],
  labels: { former_officials: "Former officials" },
};

const finding: Answer = {
  question: "Did contacts rise before the award?",
  title: "Contacts per week in the 180 days before the award",
  tables: { weeks: { key: "key", sql: `SELECT 'fw:' || strftime(week, '%Y-%m-%d') AS key, week, period, count(*) AS contacts, count(*) FILTER (WHERE source = 'Office calendar') AS calendar, list(id) AS source_rows\nFROM (SELECT id, source, date_trunc('week', date) AS week,\n        CASE WHEN date >= ${AWARD} - INTERVAL 90 DAY THEN 'The 90 days before the award' ELSE 'The 90 days before that' END AS period\n      FROM contacts\n      WHERE date >= ${AWARD} - INTERVAL 180 DAY AND date < ${AWARD})\nGROUP BY ALL\nORDER BY week` } },
  layers: [{ from: "weeks", mark: "span", encoding: { x: { field: "week" }, y: { field: "contacts" }, tone: { field: "period", map: { "The 90 days before the award": "accent", "The 90 days before that": "t6" } } } }],
  unit: ["contact", "contacts"],
  labels: { contacts: "Contacts", week: "Week", period: "Period", calendar: "From the office calendar" },
};

const document = (id: string): Answer => ({
  question: "What does this document say?",
  title: "The open document and the entities it names",
  tables: { doc: { key: "id", sql: `SELECT d.id, d.type, d.title, d.date, d.source, d.excerpt, d.filing_id, string_agg(e.name, ', ') AS names\nFROM documents d\nLEFT JOIN mentions m ON m.document_id = d.id\nLEFT JOIN entities e ON e.id = m.entity_id\nWHERE d.id = '${id.replace(/'/g, "''")}'\nGROUP BY ALL` } },
  layers: [{ from: "doc", mark: "point", encoding: {} }],
  form: "table",
  unit: ["document", "documents"],
});

const documents: Answer = {
  question: "Which documents matter most?",
  title: "Documents in the case file by relevance",
  tables: { docs: { key: "id", sql: "SELECT d.id, d.date, d.type, d.title, d.source, d.relevance, count(m.entity_id) AS entities\nFROM documents d\nLEFT JOIN mentions m ON m.document_id = d.id\nGROUP BY ALL\nORDER BY relevance DESC" } },
  layers: [{ from: "docs", mark: "point", encoding: { x: { field: "date", title: "Date" }, y: { field: "type" }, size: { field: "relevance" }, tone: { value: "accent" }, text: { field: "title" } } }],
  unit: ["document", "documents"],
  labels: { relevance: "Relevance", entities: "Entities named" },
};

const SOURCES: Record<string, Answer> = {
  "01": networkAnswer("Who is Whitcombe connected to?", ALL_TIES),
  "02": person,
  "03": affiliation,
  "04": byState,
  "05": timeline,
  "06": flow,
  "07": { ...spendAnswer("How much did each client spend on lobbying per quarter?", "2021-01-01"), title: "Lobbying spend by client and quarter since 2021", layers: [{ from: "spend", mark: "span", adjust: "stack", encoding: { x: { field: "quarter" }, y: { field: "amount" }, tone: { field: "client", map: CLIENT_TONES } } }] },
  "08": slope,
  "09": multiples,
  "10": filings,
  "11": finding,
  "13": documents,
};

// The document panel shows one document at a time, so its answer is made for the document on screen. Answers are
// kept per document, since the page caches loaded rows by answer.
const docs = new Map<string, Answer>();
export function sourceFor(fig: string): Answer | null {
  if (fig !== "12") return SOURCES[fig] ?? null;
  const id = getState().doc;
  let a = docs.get(id);
  if (!a) { a = document(id); docs.set(id, a); }
  return a;
}

// Puts the data behind a panel beside it as an answer, as a table, where it can be filtered, split and charted.
export function showData(fig: string) {
  const a = sourceFor(fig);
  if (!a) return;
  const question = `The data behind ${PANEL_TITLES[fig]}`;
  board.place({ kind: "chart", title: a.title, question, parts: ["The data behind ", { kind: "panel", id: fig }], from: fig, height: 360, revs: [{ label: question, answer: { ...a, form: "table" } }], rev: 0 });
}

import { giftAnswer, filingAnswer, spendAnswer, timelineAnswer } from "./agent";
import { query } from "./db";
import { fmtUsd } from "./format";
import type { Answer } from "./spec";
import type { Member, SetDef, TextBody } from "./board";

// A scripted stand-in for the agent beside the case board. It answers a fixed set of questions with operations on the
// board, so the placement of each kind of answer can be tried without a model. Other questions go to the model.

export type Op =
  | { op: "edit"; label: string; answer: Answer }
  | { op: "view"; answer: Answer; span?: number; height?: number }
  | { op: "text"; title: string; body: TextBody }
  | { op: "lens"; name: string; set: SetDef }
  | { op: "stack"; title: string; members: Member[] };

// The focus is a case panel or an answer, with the answer that describes its data when there is one.
export interface AskContext { focus: { title: string; answer: Answer | null } | null; sel: { ids: string[]; label: string } }
interface Script { re: RegExp; kind: Op["op"]; ok?: (c: AskContext) => boolean; status: string; ms: number; make: (q: string, c: AskContext) => Promise<Op> | Op }

const idsOf = async (sql: string): Promise<SetDef> => ({ sql, ids: (await query(sql)).rows.map((r) => String(r.id)) });
const quarterName = (d: unknown) => { const t = new Date(d as string | number | Date); return `${t.getUTCFullYear()} Q${Math.floor(t.getUTCMonth() / 3) + 1}`; };
const hasTable = (c: AskContext, t: string) => !!c.focus?.answer?.tables[t];

async function spendText(): Promise<Op> {
  const per = await query("SELECT quarter, sum(amount) AS amount FROM filings WHERE client = 'Halvorsen Aerodyne' AND quarter >= DATE '2022-01-01' GROUP BY quarter ORDER BY quarter");
  const first = per.rows[0], last = per.rows[per.rows.length - 1];
  const a0 = Number(first.amount), a1 = Number(last.amount);
  const firms = await query("SELECT firm, sum(amount) AS amount FROM filings WHERE client = 'Halvorsen Aerodyne' AND quarter >= DATE '2022-01-01' GROUP BY firm ORDER BY amount DESC");
  const total = firms.rows.reduce((s, r) => s + Number(r.amount), 0);
  const top = firms.rows[0];
  const procurement = await query("SELECT count(*) FILTER (WHERE issue IN ('Launch procurement', 'Sole-source authority')) AS n, count(*) AS of FROM filings WHERE client = 'Halvorsen Aerodyne' AND firm = 'Kestrel Row Partners' AND quarter >= DATE '2024-01-01'");
  const p = procurement.rows[0];
  const refs: TextBody["refs"] = {
    rise: { label: "Halvorsen filings since 2022", set: await idsOf("SELECT id FROM filings WHERE client = 'Halvorsen Aerodyne' AND quarter >= DATE '2022-01-01'") },
    firm: { label: `${top.firm} filings for Halvorsen`, set: await idsOf(`SELECT id FROM filings WHERE client = 'Halvorsen Aerodyne' AND firm = '${String(top.firm).replace(/'/g, "''")}' AND quarter >= DATE '2022-01-01'`) },
    issue: { label: "Kestrel Row filings on procurement since 2024", set: await idsOf("SELECT id FROM filings WHERE client = 'Halvorsen Aerodyne' AND firm = 'Kestrel Row Partners' AND quarter >= DATE '2024-01-01' AND issue IN ('Launch procurement', 'Sole-source authority')") },
    voss: { label: "Voss joins Kestrel Row", set: { ids: ["e3", "voss"] } },
    draft: { label: "Draft solicitation", set: { ids: ["m6"] } },
    final: { label: "Final solicitation", set: { ids: ["m10"] } },
  };
  return {
    op: "text",
    title: "Why Halvorsen's lobbying spend keeps rising",
    body: {
      refs,
      paras: [
        ["Halvorsen's spend went ", { ref: "rise", text: `from ${fmtUsd(a0)} in ${quarterName(first.quarter)} to ${fmtUsd(a1)} in ${quarterName(last.quarter)}` }, `, ${(a1 / a0).toFixed(1)} times as much. The rise is steady rather than a jump in one quarter.`],
        [{ ref: "firm", text: String(top.firm) }, ` filed ${Math.round((Number(top.amount) / total) * 100)}% of it. Since 2024, `, { ref: "issue", text: `${p.n} of its ${p.of} reports for Halvorsen` }, " list launch procurement or sole-source authority as the issue."],
        ["Petra Voss ", { ref: "voss", text: "became a partner there in October 2022" }, ". The cadence weight went from 20% in the ", { ref: "draft", text: "draft solicitation" }, " to 35% in the ", { ref: "final", text: "final one" }, " while the spend kept growing. These records show the timing only, not what the filings asked for."],
      ],
    },
  };
}

const VOSS_SQL = `SELECT e.id, e.actor, e.title, e.starts AS date, e.related
FROM events e
WHERE e.kind = 'meeting'
  AND e.starts IN (SELECT starts FROM events WHERE actor = 'Voss' AND kind = 'meeting')`;
function vossMeetings(question: string): Answer {
  return {
    question,
    title: "Voss's meetings and who was there",
    tables: {
      met: { key: "id", sql: VOSS_SQL },
      pairs: { sql: "SELECT id AS source, related AS target FROM met WHERE related IS NOT NULL" },
    },
    layers: [
      { from: "pairs", mark: "link", encoding: { source: { field: "source" }, target: { field: "target" }, tone: { value: "ink" }, weight: { value: "quiet" } } },
      { from: "met", mark: "point", encoding: { x: { field: "date", title: "Date" }, y: { field: "actor" }, tone: { field: "actor", map: { Voss: "accent", Whitcombe: "t1", Calder: "t1", Tolliver: "t3" } }, fill: { value: "solid" }, text: { field: "title" } } },
    ],
    unit: ["meeting record", "meeting records"],
    labels: { actor: "Person", date: "Date", title: "Record" },
  };
}

const FROM_2022 = "DATE '2022-01-01'";
function stackMembers(): Member[] {
  const spend = spendAnswer("Lobbying spend by quarter");
  return [
    { height: 230, answer: { ...spend, title: "Lobbying spend by quarter", labels: { amount: "Spend", quarter: "Quarter" } } },
    { height: 190, answer: {
      question: "Aerospace gifts to Whitcombe by month",
      title: "Aerospace gifts to Whitcombe by month",
      tables: { monthly: { key: "key", sql: `SELECT 'gm:' || strftime(date_trunc('month', date), '%Y-%m') AS key, date_trunc('month', date) AS month, sum(amount) AS total, list(id) AS source_rows\nFROM gifts\nWHERE recipient = 'Whitcombe'\n  AND sector = 'Aerospace and defense'\n  AND date >= ${FROM_2022}\nGROUP BY ALL` } },
      layers: [{ from: "monthly", mark: "span", encoding: { x: { field: "month" }, y: { field: "total" }, tone: { value: "accent" } } }],
      unit: ["gift", "gifts"],
      labels: { total: "Given", month: "Month" },
    } },
    { height: 150, answer: {
      question: "Votes, solicitations and the award",
      title: "Votes, solicitations and the award",
      tables: { marks: { key: "id", sql: `SELECT id, kind, title, starts AS date, CASE WHEN kind = 'vote' THEN 'Whitcombe votes' ELSE 'Solicitation and award' END AS lane\nFROM events\nWHERE kind IN ('vote', 'document', 'award')\n  AND actor IN ('Whitcombe', 'Office of Orbital Logistics')\n  AND starts >= ${FROM_2022}` } },
      layers: [{ from: "marks", mark: "point", encoding: { x: { field: "date", title: "Date" }, y: { field: "lane" }, shape: { value: "diamond" }, tone: { field: "kind", map: { vote: "t1", document: "t3", award: "accent" } }, fill: { value: "solid" } } }],
      unit: ["event", "events"],
      labels: { lane: "", date: "Date", kind: "Event" },
    } },
  ];
}

const SCRIPTS: Script[] = [
  { re: /break.*firm|by firm|split.*firm/, kind: "edit", ok: (c) => hasTable(c, "spend"), status: "Listing the filings behind each total", ms: 900, make: (q, c) => ({ op: "edit", label: q, answer: { ...filingAnswer(q, c.focus?.answer ?? null), title: "Lobbying spend by client and firm" } }) },
  { re: /why|rising|rise|jump|grow/, kind: "text", status: "Reading quarterly lobbying disclosures", ms: 1500, make: () => spendText() },
  { re: /kestrel/, kind: "lens", status: "Collecting records that involve Kestrel Row", ms: 800, make: async () => ({ op: "lens", name: "Kestrel Row", set: await idsOf("SELECT 'kestrel' AS id UNION ALL SELECT 'voss' UNION ALL SELECT 'liang' UNION ALL SELECT id FROM filings WHERE firm = 'Kestrel Row Partners' UNION ALL SELECT id FROM events WHERE actor = 'Voss'") }) },
  { re: /30 days|before a vote|before votes/, kind: "lens", status: "Matching gifts to the next vote", ms: 900, make: async () => ({ op: "lens", name: "Gifts within 30 days of a vote", set: await idsOf("SELECT id FROM gifts WHERE days_before_vote <= 30") }) },
  { re: /time axis|same axis|line up|one axis|together/, kind: "stack", status: "Lining up spend, gifts and votes", ms: 1400, make: () => ({ op: "stack", title: "Spend, gifts and votes on one time axis", members: stackMembers() }) },
  { re: /voss.*(met|meet|contact)|(met|meet|meetings).*voss|who did (she|voss) meet/, kind: "view", status: "Reading meeting records", ms: 1100, make: (q) => ({ op: "view", answer: vossMeetings(q), span: 7, height: 300 }) },
  { re: /who funds|funds whitcombe|donors|gifts by sector/, kind: "view", status: "Searching itemized contributions", ms: 1200, make: (q) => ({ op: "view", answer: giftAnswer(q, { recipients: ["Whitcombe"], aero: false, layout: "bars", votes: false }), span: 6, height: 360 }) },
  { re: /led up|timeline|chronolog/, kind: "view", status: "Lining up roles, meetings and decisions", ms: 1200, make: (q) => ({ op: "view", answer: timelineAnswer(q), span: 12, height: 400 }) },
];

export const KNOWN = [
  "Break it down by firm",
  "Why does Halvorsen's spend keep rising?",
  "Show everything involving Kestrel Row",
  "Mark gifts within 30 days of a vote",
  "Put spend, gifts and votes on one time axis",
  "Who did Voss meet, and when?",
  "Who funds Whitcombe?",
];

// The kind of answer is known before it is ready, so the page can show where it will go while the agent works.
export function kindFor(q: string, c: AskContext): Op["op"] | null {
  const t = q.toLowerCase();
  return SCRIPTS.find((x) => x.re.test(t) && (!x.ok || x.ok(c)))?.kind ?? null;
}

export async function respond(q: string, c: AskContext, onStatus: (s: string) => void): Promise<Op | null> {
  const t = q.toLowerCase();
  const s = SCRIPTS.find((x) => x.re.test(t) && (!x.ok || x.ok(c)));
  if (!s) return null;
  await new Promise((r) => setTimeout(r, s.ms * 0.4));
  onStatus(s.status);
  const [op] = await Promise.all([s.make(q, c), new Promise((r) => setTimeout(r, s.ms * 0.6))]);
  return op;
}


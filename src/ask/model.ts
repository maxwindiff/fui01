import { query } from "./db";
import type { Result } from "./db";
import { load } from "./run";
import type { Answer } from "./spec";

// The page's side of the tool loop. The server forwards each round to the model; the page runs the model's queries
// in DuckDB, checks each answer it shows by running it, and sends the results back as the next round.

export interface Past { question: string; summary?: string; edits: string[] }
export interface Current { question: string; edits: string[]; answer: Answer; results: Record<string, { rows: number; columns: string[]; first: Record<string, unknown>[]; stats?: Record<string, unknown> }> }
export interface ModelContext { past: Past[]; current: Current | null; selection: Record<string, unknown>[] }
export type ModelReply =
  | { answer: Answer; previousSummary?: string }
  | { error: string }
  | { password: string }
  | { unavailable: true };

interface Call { id: string; type: "function"; function: { name: string; arguments: string } }
interface Turn { role: "assistant" | "tool"; content?: string; tool_calls?: Call[]; tool_call_id?: string }

const KEY = "ask-password";
export const savedPassword = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
export const savePassword = (p: string) => { try { localStorage.setItem(KEY, p); } catch { /* the password lasts for this page only */ } };

// In development, a script comparing models picks one through localStorage and reads each round from window.__askLog.
const devModel = () => { try { return localStorage.getItem("ask-model") ?? ""; } catch { return ""; } };
const devReasoning = () => { try { return localStorage.getItem("ask-reasoning") ?? ""; } catch { return ""; } };
const log = (entry: object) => { const w = window as unknown as { __askLog?: object[] }; (w.__askLog ??= []).push({ t: performance.now(), ...entry }); };

const short = (v: unknown) => (typeof v === "string" && v.length > 120 ? `${v.slice(0, 117)}...` : v);

const cell = (v: unknown) => (Array.isArray(v) ? `[${v.length} items]` : short(v));

// Statistics for each column of a table too long to send whole: the sum and range of numbers and the most common
// text values, so the model can state totals for the whole view.
function stats(r: Result) {
  const out: Record<string, unknown> = {};
  // Totals of each number column for each value of a text or boolean column with few values, e.g. donors per
  // in_range or spend per firm.
  const nums = r.columns.filter((c) => c.type === "quantitative");
  for (const by of r.columns.filter((c) => c.type === "nominal" || c.type === "boolean")) {
    if (!nums.length) break;
    const groups = new Map<string, Record<string, number>>();
    for (const row of r.rows) {
      const g = String(row[by.name]);
      const acc = groups.get(g) ?? Object.fromEntries(nums.map((c) => [c.name, 0]));
      for (const c of nums) acc[c.name] += Number(row[c.name] ?? 0);
      groups.set(g, acc);
    }
    if (groups.size > 1 && groups.size <= 12) out[`totals by ${by.name}`] = Object.fromEntries(groups);
  }
  for (const c of r.columns) {
    const vals = r.rows.map((row) => row[c.name]).filter((v) => v !== null && v !== undefined);
    if (c.type === "quantitative") {
      const ns = vals.map(Number);
      out[c.name] = { sum: +ns.reduce((s, n) => s + n, 0).toPrecision(10), min: Math.min(...ns), max: Math.max(...ns) };
    } else if (c.type === "nominal" || c.type === "boolean") {
      const counts = new Map<string, number>();
      for (const v of vals) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
      out[c.name] = { distinct: counts.size, top: [...counts].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([v, n]) => `${short(v)} (${n})`) };
    } else if (c.type === "temporal" && vals.length) {
      out[c.name] = { min: Math.min(...vals.map(Number)), max: Math.max(...vals.map(Number)) };
    }
  }
  return out;
}

// The current view, with its rows, so the model can follow up on it and summarize it. A short table goes whole; a
// longer one goes as its first rows and column statistics.
export function current(question: string, edits: string[], a: Answer, results: Record<string, Result>): Current {
  const { notes: _n, question: _q, ...answer } = a;
  const out: Current["results"] = {};
  for (const [name, r] of Object.entries(results)) {
    const whole = r.rows.length <= 25;
    out[name] = {
      rows: r.rows.length,
      columns: r.columns.map((c) => c.name),
      first: r.rows.slice(0, whole ? 25 : 10).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, cell(v)]))),
      ...(whole ? {} : { stats: stats(r) }),
    };
  }
  return { question, edits, answer: answer as Answer, results: out };
}

async function runQuery(sql: string) {
  const r = await query(`SELECT * FROM (${sql.replace(/;\s*$/, "")}) LIMIT 30`);
  const rows = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, cell(v)])));
  return JSON.stringify({ columns: r.columns.map((c) => `${c.name} ${c.type}`), rows }).slice(0, 6000);
}

async function runShow(args: string, question: string): Promise<{ answer: Answer; previousSummary?: string } | { problems: string }> {
  let parsed: { answer?: Answer; previous_summary?: string };
  try { parsed = JSON.parse(args); } catch { return { problems: "The arguments are not valid JSON." }; }
  if (typeof parsed.answer === "string") { try { parsed.answer = JSON.parse(parsed.answer); } catch { return { problems: "answer is a string that is not valid JSON. Pass it as an object." }; } }
  if ((!parsed.answer || typeof parsed.answer !== "object") && !(parsed as Record<string, unknown>).tables) return { problems: "answer is missing. Pass the Answer as an object under answer." };
  // A model sometimes wraps the answer once more, or leaves out the wrapper.
  const raw = parsed as Record<string, unknown>;
  let body = (parsed.answer ?? {}) as unknown as Record<string, unknown>;
  if (body.answer && typeof body.answer === "object") body = body.answer as Record<string, unknown>;
  if (!body.tables && raw.tables) body = raw;
  const answer = { ...body, question } as unknown as Answer;
  if (!answer.tables || !answer.layers) return { problems: `answer needs tables and layers. It has: ${Object.keys(body).join(", ") || "nothing"}.` };
  const loaded = await load(answer);
  if (loaded.errors.length) return { problems: `The view could not be drawn:\n${loaded.errors.map((e) => `- ${e}`).join("\n")}` };
  return { answer, previousSummary: typeof parsed.previous_summary === "string" ? parsed.previous_summary.slice(0, 600) : undefined };
}

export async function askModel(question: string, context: ModelContext, onStatus: (s: string) => void): Promise<ModelReply> {
  const turns: Turn[] = [];
  onStatus("Reading the question");
  for (;;) {
    let r: Response;
    try {
      r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ask-password": savedPassword(), ...(import.meta.env.DEV && devModel() ? { "x-ask-model": devModel() } : {}), ...(import.meta.env.DEV && devReasoning() ? { "x-ask-reasoning": devReasoning() } : {}) },
        body: JSON.stringify({ question, context, turns }),
      });
    } catch { return { unavailable: true }; }
    if (r.status === 404) return { unavailable: true };
    const data = await r.json().catch(() => null) as { message?: Turn; error?: string; code?: string; usage?: object; refused?: boolean } | null;
    if (import.meta.env.DEV) log({ question, model: devModel(), round: turns.length, status: r.status, usage: data?.usage, refused: data?.refused, message: data?.message ?? data?.error });
    if (data?.code === "unconfigured") return { unavailable: true };
    if (r.status === 401) return { password: data?.error ?? "The password is missing or wrong." };
    if (data?.refused) return { error: data.error ?? "The question was refused." };
    if (!r.ok || !data?.message) return { error: data?.error ?? `The model call failed (${r.status}).` };

    const msg = data.message;
    turns.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    if (!msg.tool_calls?.length) return { error: msg.content?.trim() || "The model did not draw a view." };
    for (const call of msg.tool_calls) {
      let content: string;
      if (call.function.name === "query") {
        onStatus("Looking at the data");
        try { content = await runQuery(String(JSON.parse(call.function.arguments).sql ?? "")); } catch (e) { content = `Error: ${(e as Error).message.split("\n")[0]}`; }
      } else if (call.function.name === "show") {
        onStatus("Checking the view");
        const s = await runShow(call.function.arguments, question);
        if ("answer" in s) return s;
        onStatus("Fixing the view");
        content = s.problems;
      } else content = `Unknown tool ${call.function.name}.`;
      turns.push({ role: "tool", tool_call_id: call.id, content });
      if (import.meta.env.DEV) log({ question, tool: call.function.name, result: content.slice(0, 400) });
    }
  }
}

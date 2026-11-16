// Vercel runs this file as compiled ES modules without bundling, so the imports on its path name the .js file.
import { SYSTEM } from "../src/ask/prompt.js";

// Forwards one round of the Ask page's tool loop to OpenRouter. The page runs the tools itself, since the case
// tables live in DuckDB in the browser, and sends the rounds so far with each request. The server writes the system
// prompt and the request settings, so a caller can only spend tokens on this task, within the limits below.

// The Vite dev server sets ASK_DEV. A request can then pick the model with x-ask-model, and the rate limits are off,
// so a script can compare models.
export interface Env { OPENROUTER_API_KEY?: string; OPENROUTER_KEY?: string; ASK_PASSWORD?: string; ASK_MODEL?: string; ASK_DEV?: string }

const LIMITS = {
  rounds: 6,                      // model calls for one question
  bodyChars: 120_000,
  contextChars: 40_000,
  turnChars: 16_000,
  outputTokens: 6_000,            // includes reasoning
  perIp: [{ n: 40, ms: 10 * 60_000 }, { n: 200, ms: 24 * 3600_000 }],
  // A question takes about two calls. When the model refuses an input that is not a data question, the address is
  // charged this many calls more, so probing the prompt uses up the quota ten times as fast as asking.
  refusalCalls: 20,
  badPassword: { n: 10, ms: 10 * 60_000 },
  global: { n: 3_000, ms: 24 * 3600_000 },
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query",
      description: "Run a read-only DuckDB query over the case tables and the tables of the current answer. Returns the column types and up to 30 rows.",
      parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "refuse",
      description: "Refuse an input that is not a question about the case data.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "show",
      description: "Show the answer as the view for this question. The page checks it and replies with any problems.",
      parameters: {
        type: "object",
        properties: {
          answer: { type: "object", description: "An Answer as described in the system prompt" },
          previous_summary: { type: "string", description: "One or two sentences on what the current view in the context shows and its main finding, from its results. Empty when the context has no current view." },
        },
        required: ["answer", "previous_summary"],
      },
    },
  },
];

// Counters live in the memory of one function instance, so they reset on a cold start and each instance counts
// separately. The credit limit on the OpenRouter key is the hard cap.
const hits = new Map<string, number[]>();
function allow(key: string, n: number, ms: number, now: number) {
  const list = (hits.get(key) ?? []).filter((t) => now - t < ms);
  hits.set(key, list);
  return list.length < n;
}
const record = (key: string, now: number) => hits.set(key, [...(hits.get(key) ?? []), now]);

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

interface Turn { role: "assistant" | "tool"; content?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string }

function cleanTurns(raw: unknown): Turn[] | string {
  if (!Array.isArray(raw)) return "turns must be a list";
  const out: Turn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") return "a turn is not an object";
    const r = t as Record<string, unknown>;
    if (r.role === "assistant") {
      const calls = Array.isArray(r.tool_calls) ? r.tool_calls : [];
      const tool_calls = calls.map((c) => {
        const f = (c as { function?: { name?: unknown; arguments?: unknown } }).function;
        return { id: String((c as { id?: unknown }).id), type: "function" as const, function: { name: String(f?.name), arguments: String(f?.arguments ?? "") } };
      });
      if (tool_calls.some((c) => !["query", "show"].includes(c.function.name))) return "unknown or finished tool";
      out.push({ role: "assistant", content: String(r.content ?? "").slice(0, LIMITS.turnChars), ...(tool_calls.length ? { tool_calls } : {}) });
    } else if (r.role === "tool") {
      out.push({ role: "tool", tool_call_id: String(r.tool_call_id), content: String(r.content ?? "").slice(0, LIMITS.turnChars) });
    } else return "turns may only come from the assistant or a tool";
  }
  return out;
}

// In development, x-ask-reasoning replaces the reasoning settings, e.g. {"effort":"low"}.
function reasoningOverride(req: Request) {
  try { const r = JSON.parse(req.headers.get("x-ask-reasoning") ?? ""); return r && typeof r === "object" ? { ...r, exclude: true } : null; } catch { return null; }
}

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  const key = env.OPENROUTER_API_KEY || env.OPENROUTER_KEY;
  if (!key) return json(503, { error: "The model is not configured.", code: "unconfigured" });
  const now = Date.now();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";

  if (env.ASK_PASSWORD) {
    if (!allow(`bad:${ip}`, LIMITS.badPassword.n, LIMITS.badPassword.ms, now)) return json(429, { error: "Too many wrong passwords. Try again in a few minutes.", code: "limit" });
    if (!sameText(req.headers.get("x-ask-password") ?? "", env.ASK_PASSWORD)) {
      record(`bad:${ip}`, now);
      return json(401, { error: "The password is missing or wrong.", code: "password" });
    }
  }
  const dev = env.ASK_DEV === "1";
  for (const { n, ms } of dev ? [] : LIMITS.perIp) {
    if (!allow(`ip:${ms}:${ip}`, n, ms, now)) return json(429, { error: `This address has used its ${n} model calls for the ${ms > 3600_000 ? "day" : "last 10 minutes"}. Try again later.`, code: "limit" });
  }
  if (!dev && !allow("global", LIMITS.global.n, LIMITS.global.ms, now)) return json(429, { error: "The page has used its model calls for the day. Try again later.", code: "limit" });

  const text = await req.text();
  if (text.length > LIMITS.bodyChars) return json(413, { error: "The request is too large." });
  let body: { question?: unknown; context?: unknown; turns?: unknown };
  try { body = JSON.parse(text); } catch { return json(400, { error: "The request is not JSON." }); }
  const question = String(body.question ?? "").trim().slice(0, 500);
  if (!question) return json(400, { error: "The question is empty." });
  const context = JSON.stringify(body.context ?? {});
  if (context.length > LIMITS.contextChars) return json(413, { error: "The context is too large." });
  const turns = cleanTurns(body.turns ?? []);
  if (typeof turns === "string") return json(400, { error: turns });
  const round = turns.filter((t) => t.role === "assistant").length;
  if (round >= LIMITS.rounds) return json(400, { error: "The question used up its rounds." });
  const last = round === LIMITS.rounds - 1;

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
    ...turns,
    ...(last ? [{ role: "user", content: "This is the last round. Call show now with your best answer." }] : []),
  ];
  for (const { ms } of LIMITS.perIp) record(`ip:${ms}:${ip}`, now);
  record("global", now);

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "fui01 Ask" },
    body: JSON.stringify({
      model: (env.ASK_DEV === "1" && req.headers.get("x-ask-model")) || env.ASK_MODEL || "openai/gpt-6-luna",
      messages,
      tools: TOOLS,
      max_tokens: LIMITS.outputTokens,
      ...(last ? { tool_choice: { type: "function", function: { name: "show" } } } : {}),
      // Low effort scored as well as medium on the test questions, at about half the latency.
      reasoning: (dev && reasoningOverride(req)) || { effort: "low", exclude: true },
      usage: { include: true },
    }),
  });
  const data = await r.json().catch(() => null) as { choices?: { message?: Turn; finish_reason?: string }[]; usage?: object; error?: { message?: string } } | null;
  if (!r.ok || !data?.choices?.[0]?.message) return json(502, { error: `The model call failed: ${data?.error?.message ?? r.status}` });
  const c = data.choices[0];
  if (c.message!.tool_calls?.some((t) => t.function.name === "refuse")) {
    if (!dev) for (const { ms } of LIMITS.perIp) for (let i = 0; i < LIMITS.refusalCalls; i++) record(`ip:${ms}:${ip}`, now);
    return json(200, { refused: true, error: "Error querying data" });
  }
  return json(200, { message: { role: "assistant", content: c.message!.content ?? "", tool_calls: c.message!.tool_calls }, finish: c.finish_reason, usage: data.usage, round, rounds: LIMITS.rounds });
}

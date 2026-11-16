// Asks the questions in questions.json through the Ask page, once per model, and writes each answer to
// runs/<name>/results.jsonl. Needs `npm run dev` running with OPENROUTER_API_KEY in .env.local.
//   node eval/run.mjs [model ...]        models run in parallel; the default is the page's default model
//   OUT=eval/runs/name SEQ=2 REASONING='{"effort":"medium"}' node eval/run.mjs openai/gpt-6-luna
import { chromium } from "playwright-core";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";

// The page asks for the password the dev server expects, so the script sets it from .env.local first.
const env = (() => { try { return readFileSync(".env.local", "utf8"); } catch { return ""; } })();
const PASSWORD = env.match(/^ASK_PASSWORD=(.*)$/m)?.[1]?.trim() ?? "";
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : [""];
const ALL = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url), "utf8"));
const ONLY = process.env.SEQ ? process.env.SEQ.split(",").map(Number) : ALL.map((_, i) => i);
const OUT = process.env.OUT ?? `eval/runs/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const results = [];
const ok_ = (info, qi) => info.asks === qi + 1 && !info.note;

async function runSeq(model, si) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([m, rz, pw]) => { if (m) localStorage.setItem("ask-model", m); if (rz) localStorage.setItem("ask-reasoning", rz); if (pw) localStorage.setItem("ask-password", pw); }, [model, process.env.REASONING ?? "", PASSWORD]);
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:5183/#vellum/ask", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  for (const [qi, q] of ALL[si].entries()) {
    const before = await page.evaluate(() => (window.__askLog ?? []).length);
    const t0 = Date.now();
    await page.fill(".ask-bar input", q);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    try { await page.waitForFunction(() => !document.querySelector(".ask-status"), null, { timeout: 150_000 }); } catch { /* timed out */ }
    const ms = Date.now() - t0;
    await page.waitForTimeout(1300);
    const info = await page.evaluate((b) => ({
      log: (window.__askLog ?? []).slice(b),
      title: document.querySelector(".ask-title h2")?.textContent ?? "",
      note: [...document.querySelectorAll(".ask-foot .note")].map((n) => n.textContent).join(" "),
      asks: document.querySelectorAll(".ask-tree circle.k-ask").length,
      marks: document.querySelectorAll(".ask-marks [data-id]").length,
    }), before);
    // The answer the model showed last, and what its tables hold. The page's views still hold the answer's tables.
    const lastShow = [...info.log].reverse().flatMap((e) => e.message?.tool_calls ?? []).find((c) => c.function.name === "show");
    let answer = null, summary = null, tables = {};
    try { const a = JSON.parse(lastShow.function.arguments); answer = a.answer; summary = a.previous_summary ?? a.summary; } catch { /* no answer */ }
    if (answer && ok_(info, qi)) tables = await page.evaluate(async (names) => {
      const db = await import("/src/ask/db.ts");
      const out = {};
      for (const n of names) {
        try {
          const c = await db.query(`SELECT count(*) AS n FROM ${n}`);
          const r = await db.query(`SELECT * FROM ${n} LIMIT 6`);
          out[n] = { rows: Number(c.rows[0].n), columns: r.columns.map((x) => `${x.name}:${x.type}`), sample: r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Array.isArray(v) ? `[${v.length}]` : typeof v === "string" && v.length > 60 ? v.slice(0, 57) + "..." : v]))) };
        } catch (e) { out[n] = { error: String(e.message).split("\n")[0] }; }
      }
      return out;
    }, Object.keys(answer.tables ?? {}));
    const queries = info.log.flatMap((e) => e.message?.tool_calls ?? []).filter((c) => c.function.name === "query").map((c) => { try { return JSON.parse(c.function.arguments).sql; } catch { return c.function.arguments; } });
    const text = info.log.map((e) => e.message?.content).filter(Boolean).join(" | ").slice(0, 600);
    const calls = info.log.filter((e) => "status" in e);
    const rounds = calls.length;
    const cost = info.log.reduce((s, e) => s + (e.usage?.cost ?? 0), 0);
    const tokens = info.log.reduce((s, e) => ({ in: s.in + (e.usage?.prompt_tokens ?? 0), out: s.out + (e.usage?.completion_tokens ?? 0) }), { in: 0, out: 0 });
    const problems = info.log.filter((e) => e.tool === "show").map((e) => e.result);
    const shows = info.log.filter((e) => e.message?.tool_calls?.some((c) => c.function.name === "show")).length;
    const ok = info.asks === qi + 1 && !info.note;
    const refused = info.log.some((e) => e.refused);
    const r = { model: model || "default", refused, reasoning: process.env.REASONING ?? "", problems, si, qi, q, ok, ms, rounds, shows, cost, tokens, title: info.title, note: info.note, marks: info.marks, errors: info.log.filter((e) => e.status !== 200).map((e) => e.message), text, queries, summary, answer, tables };
    results.push(r);
    appendFileSync(`${OUT}/results.jsonl`, JSON.stringify(r) + "\n");
    console.log(`${model} [${si}.${qi}] ${ok ? "ok " : "NO "} ${(ms / 1000).toFixed(1)}s r${rounds} s${shows} $${cost.toFixed(4)} ${info.title || info.note}`.slice(0, 220));
    if (!ok && info.asks !== qi + 1) break;
  }
  await ctx.close();
}

// Models run in parallel, and each model runs its sequences in order.
await Promise.all(MODELS.map(async (m) => { for (const si of ONLY) await runSeq(m, si); }));
await browser.close();

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as Pointer, ReactNode } from "react";
import { Fold, Segmented } from "../components/primitives";
import { tip } from "../tip";
import { parseCommit } from "./diff";
import type { Commit, FileDiff, Hunk } from "./diff";
import type { Finding, Flow, HunkNote, Place, Review as Notes, Span } from "./types";
import { highlight, langOf } from "./highlight";
import type { Lang } from "./highlight";
import { getReview, review, useReview } from "./store";
import type { Asked, ChangeId, Comment, Layout, Level } from "./store";
import smallRaw from "./changes/small.diff?raw";
import mediumRaw from "./changes/medium.diff?raw";
import largeRaw from "./changes/large.diff?raw";
import { small } from "./data/small";
import { medium } from "./data/medium";
import { large } from "./data/large";
import "../styles/review.css";

// The review page: the files and the agent's notes on the left, and the change itself across the rest. Questions about
// the whole change go in the toolbar, and questions about a line go in the box under it.

interface Change { id: ChangeId; label: string; commit: Commit; notes: Notes; hunks: Map<string, Hunk> }
const CHANGES: Change[] = ([["small", "Small", smallRaw, small], ["medium", "Medium", mediumRaw, medium], ["large", "Large", largeRaw, large]] as const).map(([id, label, raw, notes]) => {
  const commit = parseCommit(raw);
  return { id, label, commit, notes, hunks: new Map(commit.files.flatMap((f) => f.hunks).map((h) => [h.key, h])) };
});
const changeOf = (id: ChangeId) => CHANGES.find((c) => c.id === id)!;

const split = (p: Place) => { const [key, i] = p.split(":"); return { key, i: i === undefined ? null : +i }; };
const LEVELS = ["Raw", "Condensed", "Abstracted"];

function goto(p: Place) {
  const { key } = split(p);
  review.focus(p);
  review.reopen(key);
  if (getReview().view.kind !== "files") review.show({ kind: "files" });
  requestAnimationFrame(() => document.querySelector(`[data-hunk="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
}

// Text with `[words](place)` links and `code`.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g).map((s, i) => {
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s);
        if (m) return <a key={i} href={`#${m[2]}`} className="rv-link" onClick={(e) => { e.preventDefault(); goto(m[2]); }}>{m[1]}</a>;
        if (/^`[^`]+`$/.test(s)) return <code key={i}>{s.slice(1, -1)}</code>;
        return <Fragment key={i}>{s}</Fragment>;
      })}
    </>
  );
}

const X = () => <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="M1 1 7 7M7 1 1 7" /></svg>;

function CommentCard({ c }: { c: Comment }) {
  return (
    <div className={`rv-cmt${c.synced ? " synced" : ""}`}>
      <p className="rv-cmt-h">
        <span className="rv-cmt-s">{c.synced ? "On GitHub" : "Not synced"}</span>
        {c.synced ? null : <button type="button" className="ask-x" aria-label="Delete the comment" data-tip="Delete" onClick={() => review.removeComment(c.id)}><X /></button>}
      </p>
      <p className="rv-cmt-t">{c.text}</p>
    </div>
  );
}

// With `from`, the box edits the agent's draft for that finding, and sending it accepts the draft.
function CommentBox({ at, initial = "", from, onCancel = () => review.write(null) }: { at: Place; initial?: string; from?: string; onCancel?: () => void }) {
  const [text, setText] = useState(initial);
  const send = () => {
    if (!text.trim()) return;
    review.comment(at, text.trim(), from);
    if (from) review.decide(from, "accepted");
  };
  const notes = changeOf(getReview().change).notes;
  const ask = (q = text.trim()) => { if (q) review.ask(q, answer(notes, q), at); };
  // Questions with a scripted answer that links into this hunk.
  const asked = getReview().asked[getReview().change];
  const near = from ? [] : notes.qa.filter((x) => x.a.includes(`](${split(at).key}`) && !asked.some((a) => a.q === x.q && a.at));
  return (
    <div className="rv-cmt rv-write" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus rows={3} value={text} aria-label="Comment or question" placeholder={from ? "Comment" : "Comment, or ask the agent"} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); if (e.key === "Escape") onCancel(); }}
      />
      <p className="actions">
        <button type="button" className="btn primary" disabled={!text.trim()} onClick={send}>Comment</button>
        {from ? null : <button type="button" className="btn" disabled={!text.trim()} onClick={() => ask()}>Ask agent</button>}
        <button type="button" className="btn quiet" onClick={onCancel}>Cancel</button>
      </p>
      {near.length ? <div className="chips">{near.map((x) => <button key={x.q} type="button" className="chip" onClick={() => ask(x.q)}>{x.q}</button>)}</div> : null}
    </div>
  );
}

const plain = (f: Finding) => `${f.title}. ${f.body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}`;

function Draft({ f }: { f: Finding }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <CommentBox at={f.at} initial={plain(f)} from={f.id} onCancel={() => setEditing(false)} />;
  return (
    <div className={`rv-cmt rv-draft sev-${f.sev}`} onClick={(e) => e.stopPropagation()}>
      <p className="rv-cmt-h"><span className="rv-sev" />Agent<span className="rv-cmt-s">Draft</span></p>
      <p className="rv-cmt-t"><b>{f.title}.</b> <Rich text={f.body} /></p>
      <p className="actions">
        <button type="button" className="btn" onClick={() => { review.comment(f.at, plain(f), f.id); review.decide(f.id, "accepted"); }}>Accept</button>
        <button type="button" className="btn quiet" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="btn quiet" onClick={() => review.decide(f.id, "dismissed")}>Dismiss</button>
      </p>
    </div>
  );
}

function Answer({ x, onClose }: { x: Asked; onClose?: () => void }) {
  return (
    <div className="rv-cmt rv-qa" onClick={(e) => e.stopPropagation()}>
      <p className="rv-cmt-h">
        <span className="rv-qa-q">{x.q}</span>
        {onClose ? <button type="button" className="ask-x" aria-label="Remove the answer" data-tip="Remove" onClick={onClose}><X /></button> : null}
      </p>
      {x.a ? <p className="rv-qa-a"><Rich text={x.a} /></p> : <p className="note">Couldn't answer that.</p>}
    </div>
  );
}

// What hangs under a row: comments, the agent's open drafts, answers to questions about the row, and the box for a new
// comment.
function Attached({ change, hkey, from, to }: { change: Change; hkey: string; from: number; to: number }) {
  const per = useReview((s) => s.per[change.id]);
  const asked = useReview((s) => s.asked[change.id]);
  const writing = useReview((s) => s.writing);
  const shown = useReview((s) => s.draft);
  const inRow = (p: Place) => { const { key, i } = split(p); return key === hkey && i !== null && i >= from && i <= to; };
  const comments = per.comments.filter((c) => inRow(c.at));
  const drafts = change.notes.findings.filter((f) => f.id === shown && inRow(f.at) && !per.drafts[f.id]);
  const box = writing && inRow(writing) ? writing : null;
  const answers = asked.filter((x) => x.at && inRow(x.at)).reverse();
  if (!comments.length && !drafts.length && !answers.length && !box) return null;
  return (
    <div className="rv-notes">
      {drafts.map((f) => <Draft key={f.id} f={f} />)}
      {comments.map((c) => <CommentCard key={c.id} c={c} />)}
      {answers.map((x) => <Answer key={x.id} x={x} onClose={() => review.unask(x.id)} />)}
      {box ? <CommentBox at={box} /> : null}
    </div>
  );
}

const TOK = /\/\/[^\n]*|\/\*.*?(?:\*\/|$)|\w+|\s+|[^\w\s]/g;
const marks = new Map<string, boolean[]>();

// Marks the characters of a pseudocode line that are missing from the lines it replaces, or that stand next to code
// cut from them, by a longest common subsequence over tokens. A comment counts as one token. Punctuation matched
// between two marked tokens is marked too, so that a made-up call like `group_answers_by(root)` is not underlined in
// pieces.
function invented(text: string, source: string): boolean[] {
  const key = `${text}\u0000${source}`;
  const hit = marks.get(key);
  if (hit) return hit;
  const a = text.match(TOK) ?? [];
  const b = (source.match(TOK) ?? []).filter((t) => t.trim());
  const ws = a.map((t) => !t.trim());
  const n = a.length, m = b.length, W = m + 1, at = (i: number, j: number, k: number) => (i * W + j) * 3 + k;
  // The best score for a[i..] and b[j..]: 2 for each kept token, less 1 for each stretch of source skipped between two
  // kept tokens. The state k is 0 before the first kept token, 1 right after a kept token and 2 while skipping source.
  const f = new Int32Array((n + 1) * W * 3);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) for (let k = 0; k < 3; k++) {
    let v = f[at(i + 1, j, k)];
    v = Math.max(v, f[at(i, j + 1, k === 0 ? 0 : 2)] - (k === 1 ? 1 : 0));
    if (!ws[i] && a[i] === b[j]) v = Math.max(v, 2 + f[at(i + 1, j + 1, 1)]);
    f[at(i, j, k)] = v;
  }
  const made = a.map((_, i) => !ws[i]);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0, k = 0; i < n && j < m;) {
    const v = f[at(i, j, k)];
    if (!ws[i] && a[i] === b[j] && v === 2 + f[at(i + 1, j + 1, 1)]) { made[i] = false; pairs.push([i, j]); i++; j++; k = 1; }
    else if (v === f[at(i + 1, j, k)]) i++;
    else { j++; k = k === 0 ? 0 : 2; }
  }
  const words = a.map((t, i) => (ws[i] ? -1 : i)).filter((i) => i >= 0);
  for (let k = 0; k < words.length;) {
    let e = k;
    while (e < words.length && !made[words[e]]) e++;
    if (e > k && k > 0 && e < words.length && words.slice(k, e).every((i) => !/\w/.test(a[i]))) words.slice(k, e).forEach((i) => { made[i] = true; });
    k = Math.max(e, k + 1);
  }
  // Source skipped between two adjacent kept tokens was cut without a replacement, so the word next to the cut is
  // marked.
  for (let k = 1; k < pairs.length; k++) {
    const [[i1, j1], [i2, j2]] = [pairs[k - 1], pairs[k]];
    if (j2 === j1 + 1 || words.indexOf(i2) !== words.indexOf(i1) + 1) continue;
    if (/\w/.test(a[i1])) made[i1] = true;
    else if (/\w/.test(a[i2])) made[i2] = true;
    else made[i1] = made[i2] = true;
  }
  for (let k = 1; k < words.length; k++) if (made[words[k - 1]] && made[words[k]]) for (let i = words[k - 1] + 1; i < words[k]; i++) made[i] = true;
  const out = a.flatMap((t, i) => Array<boolean>(t.length).fill(made[i]));
  marks.set(key, out);
  return out;
}

// With `source`, the text is pseudocode for those lines, and the parts not taken from them are underlined.
function Code({ text, lang, source }: { text: string; lang: Lang; source?: string }) {
  if (!text) return <code> </code>;
  const indent = source != null ? /^\s*/.exec(text)![0] : "";
  const body = text.slice(indent.length);
  const tokens = highlight(body, lang);
  if (source == null) return <code>{tokens.map(([c, t], i) => (c ? <span key={i} className={`h-${c}`}>{t}</span> : t))}</code>;
  const made = invented(body, source);
  const runs: { u: boolean; parts: [string | null, string][] }[] = [];
  let at = 0;
  for (const [c, t] of tokens) {
    for (let s = 0; s < t.length;) {
      const u = made[at + s];
      let e = s;
      while (e < t.length && made[at + e] === u) e++;
      const last = runs[runs.length - 1];
      if (last?.u === u) last.parts.push([c, t.slice(s, e)]);
      else runs.push({ u, parts: [[c, t.slice(s, e)]] });
      s = e;
    }
    at += t.length;
  }
  const show = (parts: [string | null, string][]) => parts.map(([c, t], i) => (c ? <span key={i} className={`h-${c}`}>{t}</span> : t));
  return <code>{indent}{runs.map((r, i) => (r.u ? <span key={i} className="rv-u">{show(r.parts)}</span> : <Fragment key={i}>{show(r.parts)}</Fragment>))}</code>;
}

type Row =
  | { kind: "line"; i: number; span: number | null }
  | { kind: "pseudo"; from: number; to: number; text: string; first: boolean; last: boolean }
  | { kind: "fold"; from: number; to: number };

const spansFor = (note: HunkNote | undefined, level: Level): Span[] => (level === 0 ? [] : level === 1 ? note?.a ?? [] : note?.b ?? note?.a ?? []);

function rowsFor(h: Hunk, spans: Span[], open: string[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < h.lines.length;) {
    const s = spans.find(([a]) => a === i);
    if (!s) { rows.push({ kind: "line", i, span: null }); i++; continue; }
    const [a, b, text] = s;
    // Pseudocode lines take the indentation of the first replaced line.
    const indent = /^\s*/.exec(h.lines[a].text)![0];
    const parts = text.split("\n").map((t) => indent + t);
    if (open.includes(`${h.key}#${a}`)) for (let k = a; k <= b; k++) rows.push({ kind: "line", i: k, span: a });
    else if (!text) rows.push({ kind: "fold", from: a, to: b });
    else parts.forEach((t, k) => rows.push({ kind: "pseudo", from: a, to: b, text: t, first: k === 0, last: k === parts.length - 1 }));
    i = b + 1;
  }
  return rows;
}

const MAX_TIP = 14;

// The page's tooltip layer hides the tip when the pointer arrives from an element with data-tip, so the diff tip is
// shown again while the pointer moves, at most every 150 ms.
let lastTip = { id: "", t: 0 };
const showOriginal = (id: string, anchor: Element, content: ReactNode) => {
  const now = performance.now();
  if (lastTip.id === id && now - lastTip.t < 150) return;
  lastTip = { id, t: now };
  tip.show(anchor, content, { wait: true });
};
const hideOriginal = () => { lastTip = { id: "", t: 0 }; tip.hide(); };

// The diff lines behind a run of pseudocode, shown in a tooltip.
function Original({ h, from, to }: { h: Hunk; from: number; to: number }) {
  const lines = h.lines.slice(from, to + 1);
  return (
    <pre className="rv-tipdiff">
      {lines.slice(0, MAX_TIP).map((l, i) => <span key={i} className={l.k === "+" ? "add" : l.k === "-" ? "del" : ""}>{`${l.k === "-" ? "−" : l.k} ${l.text}\n`}</span>)}
      {lines.length > MAX_TIP ? <span className="more">{`${lines.length - MAX_TIP} more lines`}</span> : null}
    </pre>
  );
}

const signOf = (h: Hunk, a: number, b: number) => {
  const ks = new Set(h.lines.slice(a, b + 1).map((l) => l.k).filter((k) => k !== " "));
  return ks.size === 2 ? "~" : ks.has("+") ? "+" : ks.has("-") ? "−" : " ";
};
const tone = (sign: string) => (sign === "+" ? " add" : sign === "−" ? " del" : "");

// Whether the spans fold away every changed line of the hunk.
const folded = (h: Hunk, spans: Span[]) => h.lines.every((l, i) => l.k === " " || spans.some(([a, b, t]) => !t && i >= a && i <= b));

const keyOf = (r: Row) => (r.kind === "line" ? `${r.i}` : r.kind === "fold" ? `f${r.from}` : `p${r.from}.${r.text}`);
const sideOf = (h: Hunk, r: Row) => {
  if (r.kind === "fold") return "fold";
  const k = r.kind === "line" ? h.lines[r.i].k : signOf(h, r.from, r.to);
  return k === "-" || k === "−" ? "old" : k === "+" ? "new" : "both";
};
type Pair = { kind: "fold"; row: Row } | { kind: "both"; row: Row } | { kind: "pair"; l?: Row; r?: Row };

// For the split layout: a run of removed rows and the run of added rows after it share lines, side by side.
function pairsOf(h: Hunk, rows: Row[]): Pair[] {
  const out: Pair[] = [];
  let left: Row[] = [], right: Row[] = [];
  const flush = () => {
    for (let k = 0; k < Math.max(left.length, right.length); k++) out.push({ kind: "pair", l: left[k], r: right[k] });
    left = [];
    right = [];
  };
  for (const r of rows) {
    const side = sideOf(h, r);
    if (side === "old") { if (right.length) flush(); left.push(r); }
    else if (side === "new") right.push(r);
    else { flush(); out.push(side === "fold" ? { kind: "fold", row: r } : { kind: "both", row: r }); }
  }
  flush();
  return out;
}

// A read hunk folds to its header, and selecting the header opens it again. Excerpts in flows stay open.
function HunkView({ change, h, near, bare, force }: { change: Change; h: Hunk; near?: number | null; bare?: boolean; force?: boolean }) {
  const level = useReview((s) => s.level);
  const layout = useReview((s) => s.layout);
  const open = useReview((s) => s.open);
  const focus = useReview((s) => s.focus);
  const read = useReview((s) => s.per[change.id].read.includes(h.key));
  const lang = langOf(h.file);
  let spans = spansFor(change.notes.hunks[h.key], level);
  // An excerpt in a flow shows the lines around its step. Pseudocode reaching past them would make the excerpt longer
  // than the raw lines, so only pseudocode for the step's own line or for lines inside the excerpt stays.
  const R = 4;
  if (near != null) spans = spans.filter(([a, b]) => (a <= near && b >= near) || (a >= near - R && b <= near + R));
  let rows = rowsFor(h, spans, open);
  if (near != null) rows = rows.filter((r) => (r.kind === "line" ? Math.abs(r.i - near) <= R : r.from <= near + R && r.to >= near - R));
  const f = focus ? split(focus) : null;
  const here = near == null && f?.key === h.key ? f.i : null;
  const toggle = (from: number) => (e: MouseEvent) => { e.stopPropagation(); review.toggleOpen(`${h.key}#${from}`); };
  const shut = read && near == null && !bare && !force && !open.includes(h.key);
  const isHere = (from: number, to: number) => (here !== null && here >= from && here <= to ? " here" : "");
  const attach = (r: Row) => {
    if (r.kind === "line") return <Attached change={change} hkey={h.key} from={r.i} to={r.i} />;
    return r.kind === "fold" || r.last ? <Attached change={change} hkey={h.key} from={r.from} to={r.to} /> : null;
  };
  // Pointing at the gutter of an expanded line highlights every line that collapses with it.
  const hot = (span: number, on: boolean) => (e: Pointer) => {
    e.currentTarget.closest(".rv-hunk")?.querySelectorAll(`.rv-ln[data-span="${span}"]`).forEach((el) => el.classList.toggle("hot", on));
  };
  // In the split layout `side` picks the old or the new line number.
  const cell = (r: Row, side?: "old" | "new") => {
    if (r.kind === "fold") {
      const n = r.to - r.from + 1;
      return (
        <button type="button" className={`rv-ln rv-fold${isHere(r.from, r.to)}`} onClick={toggle(r.from)}>
          <span className="rv-no" /><span className="rv-sign">⋯</span><span>{n} {n === 1 ? "line" : "lines"}</span>
        </button>
      );
    }
    if (r.kind === "pseudo") {
      const sign = signOf(h, r.from, r.to);
      return (
        <button
          key={side} type="button" className={`rv-ln rv-pseudo${tone(sign)}${r.first ? " first" : ""}${isHere(r.from, r.to)}`}
          onClick={(e) => { hideOriginal(); toggle(r.from)(e); }}
          onPointerMove={(e) => showOriginal(`${h.key}#${r.from}`, e.currentTarget.querySelector("code")!, <Original h={h} from={r.from} to={r.to} />)}
          onPointerLeave={hideOriginal}
        >
          <span className="rv-no" /><span className="rv-sign">{sign}</span><Code text={r.text} lang={sign === " " ? "plain" : lang} source={h.lines.slice(r.from, r.to + 1).map((l) => l.text).join("\n")} />
        </button>
      );
    }
    const l = h.lines[r.i];
    const no = side === "old" ? l.old : side === "new" ? l.neu : l.neu ?? l.old;
    return (
      <div key={side} className={`rv-ln${l.k === "+" ? " add" : l.k === "-" ? " del" : ""}${r.span !== null ? " opened" : ""}${here === r.i ? " here" : ""}`} data-span={r.span ?? undefined}>
        <button type="button" className="rv-no num" aria-label={`Comment on line ${no}`} data-tip="Comment" onClick={(e) => { e.stopPropagation(); review.write(`${h.key}:${r.i}`); }}>{no}</button>
        {r.span !== null
          ? <button type="button" className="rv-sign rv-shut" aria-label="Collapse" data-tip="Collapse" onClick={toggle(r.span)} onPointerEnter={hot(r.span, true)} onPointerLeave={hot(r.span, false)}>{l.k === "-" ? "−" : l.k}</button>
          : <span className="rv-sign">{l.k === "-" ? "−" : l.k}</span>}
        <Code text={l.text} lang={l.k === " " ? "plain" : lang} />
      </div>
    );
  };
  return (
    <section className={`rv-hunk${read ? " read" : ""}${near == null && f?.key === h.key ? " focus" : ""}`} data-hunk={near == null ? h.key : undefined}>
      {bare ? null : (
        <header className="rv-hh" onClick={read && near == null ? () => review.toggleOpen(h.key) : undefined}>
          <span className="rv-hn num">{near == null ? h.newStart : null}</span>
          <span className="rv-hctx">{h.head ? <Code text={h.head} lang="plain" /> : null}</span>
          <ReadButton keys={[h.key]} on={read} small />
        </header>
      )}
      <Fold open={!shut}>
        <div className={`rv-code${layout === "split" ? " split" : ""}`}>
          {layout === "split"
            ? pairsOf(h, rows).map((p) => {
              if (p.kind === "fold") return <Fragment key={keyOf(p.row)}>{cell(p.row)}{attach(p.row)}</Fragment>;
              const rs = p.kind === "both" ? [p.row] : [p.l, p.r].filter((r): r is Row => !!r);
              return (
                <Fragment key={p.kind === "both" ? keyOf(p.row) : rs.map(keyOf).join("|")}>
                  <div className="rv-pair">
                    {p.kind === "both" ? <>{cell(p.row, "old")}{cell(p.row, "new")}</> : <>{p.l ? cell(p.l, "old") : <span className="rv-ln blank" />}{p.r ? cell(p.r, "new") : <span className="rv-ln blank" />}</>}
                  </div>
                  {rs.map((r) => <Fragment key={keyOf(r)}>{attach(r)}</Fragment>)}
                </Fragment>
              );
            })
            : rows.map((r) => <Fragment key={keyOf(r)}>{cell(r)}{attach(r)}</Fragment>)}
        </div>
      </Fold>
    </section>
  );
}

function ReadButton({ keys, on, label = "Mark as read", small }: { keys: string[]; on: boolean; label?: string; small?: boolean }) {
  return (
    <button type="button" className={`rv-read${on ? " on" : ""}${small ? " small" : ""}`} aria-pressed={on} aria-label={small ? label : undefined} data-tip={small ? (on ? "Read" : label) : undefined} onClick={(e) => { e.stopPropagation(); review.markRead(keys, !on); }}>
      <i aria-hidden="true" />{small ? null : on ? "Read" : label}
    </button>
  );
}

// Build output, lockfiles and caches stay closed, and their hunks are not drawn, until the reviewer opens them.
const GENERATED = /(\.tsbuildinfo|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)|\.map)$|(^|\/)(dist|build)\//;
const generated = (path: string) => GENERATED.test(path);

function FileView({ change, f }: { change: Change; f: FileDiff }) {
  const read = useReview((s) => s.per[change.id].read);
  const keys = f.hunks.map((h) => h.key);
  const open = useReview((s) => s.open);
  const all = keys.every((k) => read.includes(k));
  const bare = f.hunks.length === 1 && !f.hunks[0].head;
  const [peek, setPeek] = useState(false);
  useEffect(() => setPeek(false), [all]);
  // A generated file with comments on it opens like any other file.
  const noted = useReview((s) => s.per[change.id].comments.some((c) => keys.includes(split(c.at).key)));
  const gen = generated(f.path) && !noted;
  const shown = (!all && !gen) || peek || keys.some((k) => open.includes(k));
  const [loaded, setLoaded] = useState(!gen);
  if (shown && !loaded) setLoaded(true);
  return (
    <article className={`rv-file${shown ? "" : " shut"}`} data-file={f.path}>
      <header className="rv-fh" onClick={all || gen ? () => setPeek(!peek) : undefined}>
        <h3 className="rv-path"><span className="dim">{f.path.split("/").slice(0, -1).join("/")}{f.path.includes("/") ? "/" : ""}</span>{f.path.split("/").pop()}</h3>
        {f.status !== "modified" ? <span className="tag">{f.status}</span> : null}
        {generated(f.path) ? <span className="tag">generated</span> : null}
        <span className="rv-stat num"><b className="rv-plus">+{f.add}</b> <b className="rv-minus">−{f.del}</b></span>
        {gen && !loaded ? <button type="button" className="btn quiet rv-load" onClick={(e) => { e.stopPropagation(); setPeek(true); }}>Load diff</button> : null}
        <ReadButton keys={keys} on={all} label="Mark file as read" />
      </header>
      <Fold open={shown}>
        {loaded ? f.hunks.map((h) => <HunkView key={h.key} change={change} h={h} bare={bare} force={peek} />) : null}
        {loaded && f.hunks.length > 1 ? <footer className="rv-ff"><ReadButton keys={keys} on={all} label="Mark file as read" /></footer> : null}
      </Fold>
    </article>
  );
}

type Pele = typeof import("pele/core");
let pele: Promise<Pele> | null = null;
const loadPele = () => pele ??= Promise.all([
  import("pele/core"), import("pele/diagrams/sequence"), import("pele/diagrams/flowchart"), import("pele/diagrams/state"),
]).then(([core, ...kinds]) => { core.register(...kinds.map((k) => k.default)); return core; });

function Diagram({ text }: { text: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted: { destroy(): void } | null = null, gone = false;
    setFailed(false);
    loadPele().then((p) => {
      if (gone) return;
      mounted = p.mount(el.current!, text, { fontSize: 12.5, zoom: false, config: { sequence: { mirrorActors: false } }, onError: () => setFailed(true) });
    }, () => setFailed(true));
    return () => { gone = true; mounted?.destroy(); };
  }, [text]);
  return <figure className="rv-diagram" ref={el}>{failed ? <figcaption className="dim">The diagram could not be drawn.</figcaption> : null}</figure>;
}

function FlowView({ change, flow }: { change: Change; flow: Flow }) {
  useEffect(() => { scrollTo({ top: 0 }); }, [flow.id]);
  return (
    <article className="rv-flow">
      <header className="rv-flow-h">
        <button type="button" className="btn quiet" onClick={() => review.show({ kind: "files" })}>All files</button>
        <h2 className="rv-flow-t">{flow.title}</h2>
      </header>
      <ol className="rv-steps">
        {flow.steps.map((s, k) => {
          if ("diagram" in s) return <li key={k} className="rv-fig"><Diagram text={s.diagram} /></li>;
          const n = flow.steps.slice(0, k + 1).filter((x) => !("diagram" in x)).length;
          const at = s.at ? split(s.at) : null;
          const h = at ? change.hunks.get(at.key) : undefined;
          return (
            <li key={k}>
              <p className="rv-step"><span className="rv-step-n num">{n}</span><span><Rich text={s.text} /></span></p>
              {h ? <HunkView change={change} h={h} near={at!.i} /> : null}
              {s.code ? <pre className="rv-quote"><span className="rv-quote-f">{s.code.file}</span>{s.code.text}</pre> : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

interface TreeNode { name: string; path?: string; kids: TreeNode[] }

// Directories with a single subdirectory and nothing else merge into one row, as in `src/ask`.
function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", kids: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let at = root;
    for (const name of parts.slice(0, -1)) {
      let d = at.kids.find((x) => !x.path && x.name === name);
      if (!d) { d = { name, kids: [] }; at.kids.push(d); }
      at = d;
    }
    at.kids.push({ name: parts[parts.length - 1], path: p, kids: [] });
  }
  const squash = (n: TreeNode): TreeNode => {
    let x = n;
    while (!x.path && x.kids.length === 1 && !x.kids[0].path) x = { name: `${x.name}/${x.kids[0].name}`, kids: x.kids[0].kids };
    return { ...x, kids: sort(x.kids.map(squash)) };
  };
  const sort = (ns: TreeNode[]) => ns.sort((a, b) => Number(!!a.path) - Number(!!b.path) || a.name.localeCompare(b.name));
  return sort(root.kids.map(squash));
}

function Tree({ change, nodes, depth }: { change: Change; nodes: TreeNode[]; depth: number }) {
  const read = useReview((s) => s.per[change.id].read);
  const goFile = (path: string) => {
    review.show({ kind: "files" });
    requestAnimationFrame(() => document.querySelector(`[data-file="${CSS.escape(path)}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return (
    <>
      {nodes.map((n) => {
        const pad = { ["--d" as string]: depth };
        if (!n.path) return <Fragment key={n.name}><li className="dir" style={pad}>{n.name}</li><Tree change={change} nodes={n.kids} depth={depth + 1} /></Fragment>;
        const file = change.commit.files.find((f) => f.path === n.path)!;
        const done = file.hunks.filter((h) => read.includes(h.key)).length;
        const quiet = file.hunks.every((h) => folded(h, spansFor(change.notes.hunks[h.key], 1)));
        return (
          <li key={n.path} style={pad} className={quiet ? "quiet" : ""}>
            <button type="button" onClick={() => goFile(n.path!)} data-tip={n.path}><span className="rv-fname">{n.name}</span><Meter done={done} all={file.hunks.length} /></button>
          </li>
        );
      })}
    </>
  );
}

function Rail({ change }: { change: Change }) {
  const per = useReview((s) => s.per[change.id]);
  const view = useReview((s) => s.view);
  const shown = useReview((s) => s.draft);
  const el = useRef<HTMLElement>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => el.current!.style.setProperty("--rail-h", `${e.borderBoxSize[0].blockSize}px`));
    ro.observe(el.current!);
    return () => ro.disconnect();
  }, []);
  const n = change.notes;
  const tree = useMemo(() => buildTree(change.commit.files.map((f) => f.path)), [change]);
  const flowKeys = (f: Flow) => [...new Set(f.steps.flatMap((s) => ("at" in s && s.at ? [split(s.at).key] : [])))];
  return (
    <aside className="rv-rail" ref={el} aria-label="Files and notes">
      <section>
        <h4 className="sub-h">Files</h4>
        <ul className="rv-tree"><Tree change={change} nodes={tree} depth={0} /></ul>
      </section>
      <section>
        <h4 className="sub-h">Agent's review</h4>
        <ul className="rv-list">
          {n.findings.map((f) => (
            <li key={f.id} className={`sev-${f.sev}${per.drafts[f.id] ? ` ${per.drafts[f.id]}` : ""}${shown === f.id ? " on" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  // A dismissed draft comes back when its finding is picked again.
                  if (per.drafts[f.id] === "dismissed") { review.undecide(f.id); review.showDraft(f.id); }
                  else review.showDraft(shown === f.id ? null : f.id);
                  goto(f.at);
                }}
              ><span className="rv-sev" />{f.title}</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="sub-h">Flows</h4>
        <ul className="rv-list">
          {n.flows.map((f) => {
            const keys = flowKeys(f);
            const done = keys.filter((k) => per.read.includes(k)).length;
            return (
              <li key={f.id} className={view.kind === "flow" && view.id === f.id ? "on" : ""}>
                <button type="button" onClick={() => review.show({ kind: "flow", id: f.id })}>{f.title}<Meter done={done} all={keys.length} /></button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function Description({ c }: { c: Commit }) {
  return (
    <header className="rv-pr">
      <h2 className="rv-pr-t">{c.title}</h2>
      <p className="rv-pr-m">{c.author}<span className="num">{c.sha.slice(0, 7)}</span><span>{DATE.format(new Date(c.date.replace(" ", "T").replace(" ", "")))}</span></p>
      {c.body ? <div className="rv-pr-b">{c.body.split(/\n{2,}/).map((p, i) => <p key={i}>{p.replace(/\n/g, " ")}</p>)}</div> : null}
    </header>
  );
}

function Meter({ done, all }: { done: number; all: number }) {
  return <span className="rv-meter" aria-label={`${done} of ${all} read`}><i style={{ width: `${all ? (done / all) * 100 : 0}%` }} /></span>;
}

const STOP = new Set("a an and are be do does did for how i in is it of on or the this that to what when why with".split(" "));
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)));
function answer(n: Notes, q: string) {
  const w = words(q);
  let best: { a: string; score: number } | null = null;
  for (const x of n.qa) {
    const want = words(x.q);
    const score = [...want].filter((t) => w.has(t)).length / want.size;
    if (!best || score > best.score) best = { a: x.a, score };
  }
  return best && best.score >= 0.6 ? best.a : null;
}

// Questions about the whole change. The answers open under the field and close when the reviewer follows a link in one.
function Ask({ change }: { change: Change }) {
  const asked = useReview((s) => s.asked[change.id]).filter((x) => !x.at);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const ask = (text: string) => { const t = text.trim(); if (!t) return; review.ask(t, answer(change.notes, t)); setQ(""); setOpen(true); };
  const left = change.notes.qa.filter((x) => !asked.some((a) => a.q === x.q));
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea")) { e.preventDefault(); field.current?.focus(); }
    };
    addEventListener("pointerdown", away);
    addEventListener("keydown", key);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", key); };
  }, []);
  return (
    <div className={`rv-ask${open ? " open" : ""}`} ref={box} onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); field.current?.blur(); } }}>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input ref={field} type="text" value={q} placeholder="Ask about this change" aria-label="Question" onFocus={() => setOpen(true)} onChange={(e) => setQ(e.target.value)} />
      </form>
      {open && (left.length || asked.length) ? (
        <div className="rv-ask-pop" onClick={(e) => { if ((e.target as HTMLElement).closest(".rv-link")) setOpen(false); }}>
          {left.length ? <div className="chips">{left.map((x) => <button key={x.q} type="button" className="chip" onClick={() => ask(x.q)}>{x.q}</button>)}</div> : null}
          {asked.map((x) => <Answer key={x.id} x={x} />)}
        </div>
      ) : null}
    </div>
  );
}

function Sync({ change }: { change: Change }) {
  const comments = useReview((s) => s.per[change.id].comments);
  const unsynced = comments.filter((c) => !c.synced).length;
  return <button type="button" className="btn primary rv-sync" disabled={!unsynced} onClick={review.sync}>{unsynced ? `Sync ${unsynced} to GitHub` : comments.length ? "Synced with GitHub" : "Sync to GitHub"}</button>;
}

export function Review() {
  const id = useReview((s) => s.change);
  const level = useReview((s) => s.level);
  const layout = useReview((s) => s.layout);
  const view = useReview((s) => s.view);
  const read = useReview((s) => s.per[s.change].read);
  const change = changeOf(id);
  const order = useMemo(() => change.notes.order.map((p) => change.commit.files.find((f) => f.path === p)!), [change]);
  // Generated files count toward neither the progress nor `n`.
  const keys = useMemo(() => order.filter((f) => !generated(f.path)).flatMap((f) => f.hunks.map((h) => h.key)), [order]);
  const flow = view.kind === "flow" ? change.notes.flows.find((f) => f.id === view.id) : undefined;

  // n jumps to the next unread hunk after the one in focus.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest("input, textarea")) return;
      const s = getReview();
      const at = s.focus ? keys.indexOf(split(s.focus).key) : -1;
      const next = [...keys.slice(at + 1), ...keys.slice(0, at + 1)].find((k) => !s.per[s.change].read.includes(k));
      if (next) goto(next);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [keys]);

  const c = change.commit;
  const done = keys.filter((k) => read.includes(k)).length;
  return (
    <div className="rv">
      <div className="rv-bar" role="toolbar" aria-label="Change">
        <span className="rv-ex"><span className="label">Example</span><Segmented label="Example" value={id} onChange={(v) => review.setChange(v)} options={CHANGES.map((x) => ({ value: x.id, label: x.label, tip: `${x.commit.sha.slice(0, 7)} ${x.commit.title}` }))} /></span>
        <Ask key={id} change={change} />
        <span className="rv-gap" />
        <Segmented<Layout> label="Diff layout" value={layout} onChange={review.setLayout} options={[{ value: "unified", label: "Unified" }, { value: "split", label: "Split" }]} />
        <label className="rv-level">
          <span className="label">{LEVELS[level]}</span>
          <input type="range" min={0} max={2} step={1} value={level} aria-label="Summarization" style={{ ["--p" as string]: `${level * 50}%` }} onChange={(e) => review.setLevel(+e.target.value as Level)} />
        </label>
        <span className="rv-progress"><Meter done={done} all={keys.length} /><span className="num">{done}/{keys.length}</span></span>
        <Sync change={change} />
      </div>
      <Rail change={change} />
      <main className="rv-main">
        {flow ? <FlowView change={change} flow={flow} /> : <><Description c={c} />{order.map((f) => <FileView key={f.path} change={change} f={f} />)}</>}
      </main>
    </div>
  );
}


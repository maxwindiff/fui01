import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { PANEL_TITLES } from "../panels";
import { board, getBoard, registerInserter, useBoard } from "./board";
import type { Part, Scope } from "./board";
import { KNOWN } from "./mock";
import { BOARD_ORDER, isScope, partsText, SCOPE_MIME, scopeLabel } from "./scope";

// The question box. Text and scopes mix in one line: each scope is an atom in the text that stands for a panel, an
// answer or a set of records. Scopes come from the toolbar, from the panels and answers, from the + menu, and from
// typing @.

interface Item { group: string; label: string; part: Scope | { question: string }; lens?: number }

const lensIndex = (s: Scope) => (s.kind === "set" && s.lens ? getBoard().lenses.findIndex((l) => l.id === s.lens) : -1);

function tokenEl(id: string, s: Scope) {
  const el = document.createElement("span");
  el.contentEditable = "false";
  el.dataset.tok = id;
  el.className = `ans-tok k-${s.kind}`;
  const i = lensIndex(s);
  const sw = document.createElement("i");
  sw.className = `ans-tok-sw ${s.kind === "set" ? (i >= 0 ? `ln${i}` : "sel") : s.kind}`;
  el.append(sw, document.createTextNode(scopeLabel(s)));
  return el;
}

export function Composer({ ready, onRun }: { ready: boolean; onRun: (parts: Part[]) => void }) {
  const ed = useRef<HTMLDivElement>(null);
  const toks = useRef(new Map<string, Scope>());
  const range = useRef<Range | null>(null);
  const seq = useRef(0);
  const [empty, setEmpty] = useState(true);
  const [menu, setMenu] = useState<{ q: string; at: Range | null; i: number } | null>(null);
  const busy = useBoard((s) => s.busy);
  const note = useBoard((s) => s.note);
  const sel = useBoard((s) => s.sel);
  const lenses = useBoard((s) => s.lenses);
  const cards = useBoard((s) => s.cards);

  const parse = (): Part[] => {
    const out: Part[] = [];
    const walk = (n: Node) => {
      for (const c of n.childNodes) {
        if (c.nodeType === Node.TEXT_NODE) out.push((c.textContent ?? "").replace(/ /g, " "));
        else if (c instanceof HTMLElement && c.dataset.tok) { const s = toks.current.get(c.dataset.tok); if (s) out.push(s); }
        else if (c instanceof HTMLElement && c.tagName !== "BR") walk(c);
      }
    };
    if (ed.current) walk(ed.current);
    return out;
  };
  const changed = () => {
    const parts = parse();
    const isEmpty = !parts.some((p) => isScope(p) || p.trim());
    setEmpty(isEmpty);
    if (isEmpty && ed.current && ed.current.innerHTML !== "") ed.current.innerHTML = "";
    board.context(parts.filter(isScope).flatMap((s) => (s.kind === "panel" || s.kind === "card" ? [s.id] : [])));
  };

  // Puts parts at the caret, or at the end when the caret is elsewhere on the page.
  const insert = (parts: Part[], select?: string, at?: Range | null) => {
    const root = ed.current;
    if (!root) return;
    root.focus({ preventScroll: true });
    const r = at ?? (range.current && root.contains(range.current.startContainer) ? range.current : null) ?? (() => { const x = document.createRange(); x.selectNodeContents(root); x.collapse(false); return x; })();
    r.deleteContents();
    let picked: Text | null = null;
    const frag = document.createDocumentFragment();
    let last: Node | null = null;
    for (const p of parts) {
      if (typeof p === "string") {
        const t = document.createTextNode(p);
        if (select && p === select) picked = t;
        frag.append(t);
        last = t;
      } else {
        const id = `t${seq.current++}`;
        toks.current.set(id, p);
        frag.append(tokenEl(id, p), document.createTextNode(" "));
        last = frag.lastChild;
      }
    }
    // A scope typed after text needs a space before it.
    const before = r.startContainer.nodeType === Node.TEXT_NODE ? (r.startContainer.textContent ?? "").slice(0, r.startOffset) : "";
    if (isScope(parts[0] ?? "") && before && !/\s$/.test(before)) frag.prepend(document.createTextNode(" "));
    r.insertNode(frag);
    const s = getSelection()!;
    const after = document.createRange();
    if (picked) after.selectNodeContents(picked);
    else if (last) { after.setStartAfter(last); after.collapse(true); }
    s.removeAllRanges();
    s.addRange(after);
    range.current = after.cloneRange();
    changed();
  };
  const insertRef = useRef(insert);
  insertRef.current = insert;
  useLayoutEffect(() => {
    registerInserter((parts, select) => insertRef.current(parts, select));
    return () => registerInserter(null);
  }, []);

  useEffect(() => {
    const track = () => {
      const s = getSelection();
      if (s && s.rangeCount && ed.current?.contains(s.anchorNode)) range.current = s.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", track);
    const key = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) { e.preventDefault(); ed.current?.focus(); }
    };
    addEventListener("keydown", key);
    return () => { document.removeEventListener("selectionchange", track); removeEventListener("keydown", key); };
  }, []);

  const items = (q: string): Item[] => {
    const out: Item[] = [];
    if (sel.ids.length) out.push({ group: "Selection and lenses", label: sel.label, part: { kind: "set", label: sel.label, set: { ids: sel.ids } } });
    lenses.forEach((l, i) => out.push({ group: "Selection and lenses", label: l.name, part: { kind: "set", label: l.name, set: l.set, lens: l.id }, lens: i }));
    for (const c of [...cards].reverse()) out.push({ group: "Answers", label: c.title, part: { kind: "card", id: c.id } });
    for (const f of BOARD_ORDER) out.push({ group: "Panels", label: PANEL_TITLES[f], part: { kind: "panel", id: f } });
    if (!q) for (const k of KNOWN) out.push({ group: "Questions", label: k, part: { question: k } });
    const t = q.toLowerCase();
    return out.filter((x) => !t || x.label.toLowerCase().includes(t)).slice(0, q ? 9 : 40);
  };
  const shown = menu ? items(menu.q) : [];
  const pick = (it: Item) => {
    const at = menu?.at ?? null;
    setMenu(null);
    if ("question" in it.part) {
      if (at) at.deleteContents();
      insert([it.part.question], undefined, at);
    } else insert([it.part], undefined, at);
  };

  // Typing @ starts a search of the scopes, which runs to the caret.
  const onInput = () => {
    changed();
    const s = getSelection();
    const node = s?.anchorNode;
    if (!s || !node || node.nodeType !== Node.TEXT_NODE || !s.isCollapsed) { if (menu?.at) setMenu(null); return; }
    const text = (node.textContent ?? "").slice(0, s.anchorOffset);
    const m = text.match(/(?:^|\s)@([^@\n]{0,24})$/);
    if (!m) { if (menu?.at) setMenu(null); return; }
    const at = document.createRange();
    at.setStart(node, s.anchorOffset - m[1].length - 1);
    at.setEnd(node, s.anchorOffset);
    setMenu({ q: m[1], at, i: 0 });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const parts = parse();
    if (!partsText(parts) || busy || !ready) return;
    onRun(parts);
    if (ed.current) ed.current.innerHTML = "";
    toks.current.clear();
    setMenu(null);
    changed();
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (menu && shown.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMenu({ ...menu, i: (menu.i + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length }); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(shown[Math.min(menu.i, shown.length - 1)]); return; }
    }
    if (e.key === "Escape" && menu) { e.preventDefault(); e.stopPropagation(); setMenu(null); return; }
    // Chrome scrolls the page on Home and End when the caret is already at that end of the box, so the box moves the
    // caret itself.
    if ((e.key === "Home" || e.key === "End") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      getSelection()?.modify(e.shiftKey ? "extend" : "move", e.key === "Home" ? "backward" : "forward", "lineboundary");
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(SCOPE_MIME);
    if (!raw) return;
    e.preventDefault();
    const at = document.caretRangeFromPoint?.(e.clientX, e.clientY) ?? null;
    insert([JSON.parse(raw) as Scope], undefined, at && ed.current?.contains(at.startContainer) ? at : null);
  };

  useEffect(() => {
    if (!menu) return;
    const off = (e: PointerEvent) => { if (!(e.target as Element).closest(".ans-menu, .ans-add")) setMenu(null); };
    addEventListener("pointerdown", off);
    return () => removeEventListener("pointerdown", off);
  }, [menu]);

  let group = "";
  return (
    <form className="ans-composer" onSubmit={submit}>
      {note || (busy && busy.kind === "lens") ? <p className="ans-note">{busy?.kind === "lens" ? busy.status : note}</p> : null}
      <div className="ans-field">
        <button type="button" className="ans-add" aria-label="Add a panel, answer or set of records" aria-expanded={!!menu} data-tip="Add a panel, answer or set of records (@)" onClick={() => (menu ? setMenu(null) : setMenu({ q: "", at: null, i: 0 }))}>
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" /></svg>
        </button>
        <div
          ref={ed} className={`ans-input${empty ? " empty" : ""}`} contentEditable={busy ? "false" : "true"} role="textbox" aria-label="Ask" aria-multiline="false"
          data-ph={busy ? busy.status : "Ask about the case"} spellCheck={false}
          onInput={onInput} onKeyDown={onKey} onDrop={onDrop} onDragOver={(e) => { if (e.dataTransfer.types.includes(SCOPE_MIME)) e.preventDefault(); }}
          onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s+/g, " ")); }}
        />
        <button type="submit" className="ans-send" aria-label="Ask" data-tip="Ask (Enter)" disabled={empty || !!busy || !ready}>
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2.5 7h8.5M7.5 3.5 11 7l-3.5 3.5" /></svg>
        </button>
      </div>
      {menu && shown.length ? (
        <div className="ans-menu" role="listbox" aria-label="Add to the question">
          {shown.map((it, k) => {
            const head = it.group !== group ? (group = it.group) : null;
            const part = it.part;
            const kind = "question" in part ? "q" : part.kind;
            return (
              <div key={`${it.group}${k}`}>
                {head ? <p className="ans-menu-h">{head}</p> : null}
                <button type="button" role="option" aria-selected={k === menu.i} className={k === menu.i ? "on" : ""} onPointerEnter={() => setMenu({ ...menu, i: k })} onClick={() => pick(it)}>
                  {kind === "q" ? null : <i className={`ans-tok-sw ${kind === "set" ? (it.lens !== undefined ? `ln${it.lens}` : "sel") : kind}`} />}
                  <span>{it.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}

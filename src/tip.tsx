import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Note } from "./themes";

type Anchor = { x: number; y: number } | Element;
interface TipState { anchor: Anchor; content: ReactNode; card?: boolean; note?: boolean }

let state: TipState | null = null;
let timer = 0;
let lastHide = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (next: TipState | null) => {
  if (state && !next) lastHide = performance.now();
  state = next;
  emit();
};

const WAIT = 350;
const WARM = 600;

export const tip = {
  // A point anchor places the tip beside the pointer. An element anchor centres the tip above the element.
  show(anchor: Anchor, content: ReactNode, opts: { card?: boolean; wait?: boolean; note?: boolean } = {}) {
    clearTimeout(timer);
    const next = { anchor, content, card: opts.card, note: opts.note };
    if (!opts.wait || state || performance.now() - lastHide < WARM) set(next);
    else timer = window.setTimeout(() => set(next), WAIT);
  },
  hide() {
    clearTimeout(timer);
    if (state) set(null);
  },
};

export function TipLayer({ notes }: { notes: Record<string, Note> }) {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !s) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x: number, y: number;
    if (s.anchor instanceof Element) {
      const r = s.anchor.getBoundingClientRect();
      x = r.left + r.width / 2 - w / 2;
      y = r.top - h - 8;
      if (y < 8) y = r.bottom + 8;
    } else {
      x = s.anchor.x + 14;
      y = s.anchor.y + 14;
      if (x + w > innerWidth - 8) x = s.anchor.x - w - 14;
      if (y + h > innerHeight - 8) y = s.anchor.y - h - 14;
    }
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(8, y))}px)`;
  }, [s]);

  const book = useRef(notes);
  book.current = notes;

  // Any element with a data-tip attribute gets a text tooltip. data-tip-now skips the wait, for data marks.
  // data-note names notes on how the element moves or answers, which go under the text in their own style.
  useEffect(() => {
    let from: Element | null = null;
    const over = (e: Event) => {
      const el = (e.target as Element).closest?.("[data-tip], [data-note]");
      if (e.type === "focusin" && !(e.target as Element).matches(":focus-visible")) return;
      if (el === from) return;
      from = el;
      if (!el) return tip.hide();
      const text = el.getAttribute("data-tip");
      const found = (el.getAttribute("data-note") ?? "").split(" ").flatMap((k) => book.current[k] ?? []);
      if (!text && !found.length) return tip.hide();
      const content = found.length ? (
        <>
          {text ? <span className="tip-lead">{text}</span> : null}
          {found.map((n) => <span key={n.name} className="tip-note"><b>{n.name}</b>{n.what}<i>{n.timing}</i></span>)}
        </>
      ) : text;
      tip.show(el, content, { wait: !el.hasAttribute("data-tip-now") && e.type !== "focusin", note: found.length > 0 });
    };
    const out = () => { from = null; tip.hide(); };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", over);
    document.addEventListener("focusout", out);
    document.addEventListener("pointerdown", out);
    addEventListener("scroll", out, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", out);
      document.removeEventListener("pointerdown", out);
      removeEventListener("scroll", out, { capture: true });
    };
  }, []);

  return createPortal(
    s ? <div ref={ref} className={`tip${s.card ? " card" : ""}${s.note ? " note" : ""}`} role="tooltip">{s.content}</div> : null,
    document.body,
  );
}

export function TipRow({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return <span className={`tip-kv${strong ? " strong" : ""}`}><i>{k}</i><b>{v}</b></span>;
}

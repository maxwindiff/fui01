import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Anchor = { x: number; y: number } | Element;
interface TipState { anchor: Anchor; content: ReactNode; card?: boolean }

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
  show(anchor: Anchor, content: ReactNode, opts: { card?: boolean; wait?: boolean } = {}) {
    clearTimeout(timer);
    const next = { anchor, content, card: opts.card };
    if (!opts.wait || state || performance.now() - lastHide < WARM) set(next);
    else timer = window.setTimeout(() => set(next), WAIT);
  },
  hide() {
    clearTimeout(timer);
    if (state) set(null);
  },
};

export function TipLayer() {
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

  // Any element with a data-tip attribute gets a text tooltip. data-tip-now skips the wait, for data marks.
  useEffect(() => {
    let from: Element | null = null;
    const over = (e: Event) => {
      const el = (e.target as Element).closest?.("[data-tip]");
      if (e.type === "focusin" && !(e.target as Element).matches(":focus-visible")) return;
      if (el === from) return;
      from = el;
      if (el) tip.show(el, el.getAttribute("data-tip"), { wait: !el.hasAttribute("data-tip-now") && e.type !== "focusin" });
      else tip.hide();
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
    s ? <div ref={ref} className={`tip${s.card ? " card" : ""}`} role="tooltip">{s.content}</div> : null,
    document.body,
  );
}

export function TipRow({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return <span className={`tip-kv${strong ? " strong" : ""}`}><i>{k}</i><b>{v}</b></span>;
}

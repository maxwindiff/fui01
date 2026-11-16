import { motion } from "../motion";
import type { LinkT, MarkT } from "./render";

// Every mark is a rounded rectangle, so a dot can become a bar or a cell by changing its size and corner radius.
// A mark keeps its element while its id stays in view, which is what lets a record be followed by eye. Links are
// drawn between the current positions of their two marks on every frame, so they follow the marks as they move.

export interface Move { dur: number; stagger?: number; arrive?: number }
interface G { x: number; y: number; w: number; h: number; rx: number; rot: number; o: number }
interface Mark { el: SVGGElement; turn: SVGGElement; rect: SVGRectElement; text?: SVGTextElement; a: G; b: G; cur: G; t0: number; dur: number; gone: boolean; live: boolean; src?: string[] }
interface Link { el: SVGPathElement; t: LinkT; o0: number; o1: number; o: number; t0: number; dur: number; gone: boolean }

const NS = "http://www.w3.org/2000/svg";
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const KEYS = ["x", "y", "w", "h", "rx", "rot", "o"] as const;

export class Engine {
  private marks = new Map<string, Mark>();
  private links = new Map<string, Link>();
  private raf = 0;

  constructor(private layer: SVGGElement, private linkLayer: SVGGElement) {}

  apply(targets: MarkT[], links: LinkT[], mv: Move) {
    const still = motion.level === 0 || mv.dur === 0;
    const now = performance.now();
    const next = new Map(targets.map((t) => [t.id, t]));
    // A new row that an old mark lists in its source rows starts from that mark, so a total splits into its parts.
    // An old mark listed by a new row goes into it, so parts merge into their total. Two aggregates built from the
    // same rows are related the same way, so a total by sector can split into totals by group.
    const parentOf = new Map<string, Mark>();
    for (const m of this.marks.values()) if (!m.gone) for (const s of m.src ?? []) parentOf.set(s, m);
    const mergeInto = new Map<string, MarkT>();
    for (const t of targets) for (const s of t.src ?? []) mergeInto.set(s, t);
    const parentFor = (t: MarkT) => parentOf.get(t.id) ?? t.src?.map((s) => parentOf.get(s) ?? this.marks.get(s)).find((m) => m && !m.gone);
    const intoFor = (id: string, m: Mark) => mergeInto.get(id) ?? m.src?.map((s) => mergeInto.get(s)).find(Boolean);
    const entering = targets.filter((t) => !this.marks.has(t.id)).length;
    let ei = 0, moving = 0;
    for (const t of targets) {
      const b: G = { x: t.x, y: t.y, w: t.w, h: t.h, rx: t.rx, rot: t.rot, o: 1 };
      let m = this.marks.get(t.id);
      if (!m) {
        const el = document.createElementNS(NS, "g");
        el.dataset.id = t.id;
        const turn = document.createElementNS(NS, "g");
        const rect = document.createElementNS(NS, "rect");
        turn.appendChild(rect);
        el.appendChild(turn);
        this.layer.appendChild(el);
        const parent = parentFor(t);
        const a: G = parent ? { ...parent.cur, o: 1 } : { ...b, y: b.y - 18, o: 0 };
        m = { el, turn, rect, a, b, cur: { ...a }, t0: now, dur: mv.dur, gone: false, live: true };
        this.marks.set(t.id, m);
        if (!parent && entering > 1) m.t0 = now + (((ei++ * 7919) % entering) / entering) * (mv.arrive ?? 0);
      } else {
        m.a = { ...m.cur };
        m.gone = false;
        const far = Math.hypot(b.x - m.a.x, b.y - m.a.y);
        m.t0 = now + (far > 2 ? ((moving++ % 97) / 97) * (mv.stagger ?? 0) : 0);
        m.dur = mv.dur;
      }
      m.b = b;
      m.src = t.src;
      m.live = true;
      m.el.setAttribute("class", `ask-m ${t.cls}`);
      if (t.label) {
        if (!m.text) {
          m.text = document.createElementNS(NS, "text");
          m.text.setAttribute("class", "ask-label");
          m.el.appendChild(m.text);
        }
        m.text.textContent = t.label.text;
        m.text.setAttribute("x", t.label.dx.toFixed(1));
        m.text.setAttribute("y", t.label.dy.toFixed(1));
        m.text.setAttribute("text-anchor", t.label.anchor);
      } else if (m.text) {
        m.text.remove();
        m.text = undefined;
      }
    }
    for (const [id, m] of this.marks) {
      if (next.has(id) || m.gone) continue;
      m.gone = true;
      m.live = true;
      m.a = { ...m.cur };
      const into = intoFor(id, m);
      m.b = into ? { x: into.x, y: into.y, w: into.w, h: into.h, rx: into.rx, rot: into.rot, o: 0 } : { ...m.cur, o: 0 };
      m.t0 = now;
      m.dur = into ? mv.dur : Math.min(260, mv.dur || 260);
    }
    const nextLinks = new Set(links.map((l) => l.id));
    for (const t of links) {
      let l = this.links.get(t.id);
      if (!l) {
        const el = document.createElementNS(NS, "path");
        this.linkLayer.appendChild(el);
        l = { el, t, o0: 0, o1: 1, o: 0, t0: now + mv.dur * 0.4, dur: Math.max(200, mv.dur * 0.6), gone: false };
        this.links.set(t.id, l);
      } else {
        l.o0 = l.o; l.o1 = 1; l.t0 = now; l.dur = 200; l.gone = false;
      }
      l.t = t;
      l.el.setAttribute("class", `ask-link ${t.cls}`);
      l.el.style.strokeWidth = `${t.w.toFixed(2)}px`;
    }
    for (const l of this.links.values()) {
      if (nextLinks.has(l.t.id) || l.gone) continue;
      l.gone = true;
      l.o0 = l.o; l.o1 = 0; l.t0 = now; l.dur = 200;
    }
    if (still) {
      for (const m of this.marks.values()) m.t0 = -1e9;
      for (const l of this.links.values()) l.t0 = -1e9;
    }
    for (const m of this.marks.values()) m.live = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  light(ids: Set<string>, cls = "lit") {
    this.layer.classList.toggle(`has-${cls}`, ids.size > 0);
    for (const [id, m] of this.marks) m.el.classList.toggle(cls, ids.has(id));
    for (const l of this.links.values()) l.el.classList.toggle(cls, ids.has(l.t.a) || ids.has(l.t.b));
  }

  private tick = (now: number) => {
    this.raf = 0;
    let busy = false;
    for (const [id, m] of this.marks) {
      if (!m.live) continue;
      const t = Math.min(1, Math.max(0, (now - m.t0) / (m.dur || 1)));
      const e = ease(t);
      for (const k of KEYS) m.cur[k] = lerp(m.a[k], m.b[k], k === "o" ? Math.min(1, e * 1.6) : e);
      if (t >= 1) {
        m.live = false;
        if (m.gone) { m.el.remove(); this.marks.delete(id); continue; }
      } else busy = true;
      const c = m.cur;
      m.el.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
      if (c.rot > 0.5 || m.turn.hasAttribute("transform")) m.turn.setAttribute("transform", `rotate(${c.rot.toFixed(1)})`);
      m.el.style.opacity = c.o.toFixed(3);
      m.rect.setAttribute("x", (-c.w / 2).toFixed(2));
      m.rect.setAttribute("y", (-c.h / 2).toFixed(2));
      m.rect.setAttribute("width", Math.max(0, c.w).toFixed(2));
      m.rect.setAttribute("height", Math.max(0, c.h).toFixed(2));
      m.rect.setAttribute("rx", Math.max(0, Math.min(c.rx, c.w / 2, c.h / 2)).toFixed(2));
    }
    for (const [id, l] of this.links) {
      const t = Math.min(1, Math.max(0, (now - l.t0) / l.dur));
      l.o = lerp(l.o0, l.o1, t);
      if (t < 1) busy = true;
      else if (l.gone) { l.el.remove(); this.links.delete(id); continue; }
      const a = this.marks.get(l.t.a)?.cur, b = this.marks.get(l.t.b)?.cur;
      if (!a || !b) { l.el.style.opacity = "0"; continue; }
      l.el.style.opacity = (l.o * Math.min(a.o, b.o)).toFixed(3);
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const ra = Math.min(a.w, a.h) / 2, rb = Math.min(b.w, b.h) / 2 + (l.t.dir ? 3 : 0);
      if (d <= ra + rb) { l.el.setAttribute("d", ""); continue; }
      const x1 = a.x + (dx / d) * ra, y1 = a.y + (dy / d) * ra, x2 = b.x - (dx / d) * rb, y2 = b.y - (dy / d) * rb;
      // Directed links bow to one side, so ties in both directions between a pair stay apart.
      const bow = l.t.dir ? Math.min(28, d * 0.12) : 0;
      const mx = (x1 + x2) / 2 - (dy / d) * bow, my = (y1 + y2) / 2 + (dx / d) * bow;
      l.el.setAttribute("d", bow ? `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}` : `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    if (busy) this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.layer.replaceChildren();
    this.linkLayer.replaceChildren();
    this.marks.clear();
    this.links.clear();
  }
}

import { useMemo } from "react";
import { board, useBoard } from "./ask/board";
import { hits, onLenses, passes, prepare } from "./ask/records";
import type { RGBA } from "./themes";

// Ties the marks of a case panel to the selection, the lenses and the records hovered anywhere on the page, the way the
// marks of answers are tied to them. Each mark names the records it stands for. The panel puts the data-lk attribute
// from root on its outer element and the class from mark on each mark, and the stylesheet outlines, dims and hides
// from there.

export function useLinks(fig: string) {
  const sel = useBoard((s) => s.sel);
  const lenses = useBoard((s) => s.lenses);
  const hover = useBoard((s) => s.hover);
  return useMemo(() => {
    const S = sel.ids.length ? prepare(sel.ids) : null;
    const R = hover?.from === "ref" ? prepare(hover.ids) : null;
    const M = hover?.from === "mark" && hover.at !== fig ? prepare(hover.ids) : null;
    const L = onLenses(lenses);
    const outline = L.filter((l) => l.mode !== "hide");
    const root = [S && "sel", R && "ref", outline.length && "ln", L.some((l) => l.mode !== "mark") && "keep", L.some((l) => l.mode === "hide") && "hide"].filter(Boolean).join(" ") || undefined;
    const mark = (own: string[]) => {
      const out = ["lk"];
      if (S && hits(own, S.set, S.wide)) out.push("lk-sel");
      if (R && hits(own, R.set, R.wide)) out.push("lk-ref");
      if (M && hits(own, M.set, M.wide)) out.push("lk-lit");
      let lens = false;
      for (const l of outline) if (own.length && hits(own, l.set, l.wide)) { out.push(`lk-ln${l.i}`); lens = true; }
      if (lens) out.push("lk-ln");
      if (passes(own, L, ["hide"])) { out.push("lk-pass"); if (passes(own, L, ["dim"])) out.push("lk-keep"); }
      return out.join(" ");
    };
    return {
      root,
      mark,
      // Pointer handlers for a mark: hovering lights the same records elsewhere, and a click selects them.
      on(own: string[], label: string) {
        return {
          onPointerEnter: () => board.hover({ ids: own, from: "mark", at: fig }),
          onPointerLeave: () => board.hover(null),
          onClick: () => {
            if (sel.ids.length === own.length && own.every((x) => sel.ids.includes(x))) board.clearSelection();
            else board.select({ ids: own, label, from: fig });
          },
        };
      },
    };
  }, [sel, lenses, hover, fig]);
}

// How a mark drawn on the GPU shows, from the classes useLinks gives it and the flags on the panel's root: its alpha,
// 0 when a lens hides it, and the color of its outline ring as a custom property, if any.
export function emphasis(cls: string, root: string | undefined): { alpha: number; ring: string | null } {
  const c = new Set(cls.split(" "));
  const f = new Set((root ?? "").split(" "));
  const alpha = f.has("hide") && !c.has("lk-pass") ? 0
    : f.has("keep") && !c.has("lk-keep") ? 0.08
      : (f.has("sel") && !c.has("lk-sel")) || (f.has("ref") && !c.has("lk-ref")) || (f.has("ln") && !c.has("lk-ln")) ? 0.3 : 1;
  const ln = [...c].find((x) => /^lk-ln\d$/.test(x));
  const ring = c.has("lk-sel") ? "--accent" : ln ? `--ln${ln.slice(-1)}` : c.has("lk-ref") || c.has("lk-lit") ? "--ink" : null;
  return { alpha, ring };
}

// A CSS color from a custom property, as the GPU views take colors.
export function cssColor(el: HTMLElement, prop: string): RGBA {
  const probe = document.createElement("i");
  probe.style.color = `var(${prop})`;
  el.parentElement!.append(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ["0", "0", "0"];
  probe.remove();
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255, m[3] !== undefined ? +m[3] : 1];
}

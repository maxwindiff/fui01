import { PANEL_TITLES } from "../panels";
import { getBoard } from "./board";
import type { Part, Scope } from "./board";

// The order the case panels appear in on the board.
export const BOARD_ORDER = ["02", "01", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"];

export function scopeLabel(s: Scope) {
  if (s.kind === "panel") return PANEL_TITLES[s.id] ?? s.id;
  if (s.kind === "card") return getBoard().cards.find((c) => c.id === s.id)?.title ?? "An earlier answer";
  if (s.lens) return getBoard().lenses.find((l) => l.id === s.lens)?.name ?? s.label;
  return s.label;
}

// The records a scope stands for. A lens is read as it is now.
export function scopeIds(s: Scope): string[] {
  if (s.kind !== "set") return [];
  if (s.lens) return getBoard().lenses.find((l) => l.id === s.lens)?.set.ids ?? s.set.ids;
  return s.set.ids;
}

export const isScope = (p: Part): p is Scope => typeof p !== "string";
export const partsText = (parts: Part[]) => parts.map((p) => (typeof p === "string" ? p : scopeLabel(p))).join("").replace(/\s+/g, " ").trim();

// Scopes travel between the toolbar and the question box by drag and drop as JSON.
export const SCOPE_MIME = "application/x-fui01-scope";

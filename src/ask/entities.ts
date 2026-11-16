import { GRAPH } from "../data.js";
import { EVENTS } from "./data.js";

// Finds the case entity a row stands for, so a mark can open that entity's card. Only the row's key and columns
// that name a party are read, since a gift row also names the donor's employer and the recipient.
const CROWD = /^(donor|staff|sub|lob|pac|member|guest)\d+$/;
const named = GRAPH.entities.filter((e) => !CROWD.test(e.id));
const byName = new Map<string, string>();
for (const e of named) { byName.set(e.id, e.id); byName.set(e.name.toLowerCase(), e.id); }
const last = new Map<string, string[]>();
for (const e of named) if (e.kind === "official" || e.kind === "person") { const k = e.name.split(" ").pop()!.toLowerCase(); last.set(k, [...(last.get(k) ?? []), e.id]); }
for (const [k, ids] of last) if (ids.length === 1 && !byName.has(k)) byName.set(k, ids[0]);
for (const [k, v] of [["office of orbital logistics", "ool"], ["kestrel row", "kestrel"]] as const) byName.set(k, v);

const PARTY_COLUMNS = ["id", "name", "actor", "person", "client", "firm", "entity", "donor", "member", "center", "who"];

export function entityIn(row: Record<string, unknown>, key?: string): string | null {
  for (const c of [key, ...PARTY_COLUMNS]) {
    const v = c ? row[c] : undefined;
    if (typeof v === "string" && byName.has(v.toLowerCase())) return byName.get(v.toLowerCase())!;
  }
  return null;
}

export function entityInText(text: string): string | null {
  const t = text.toLowerCase();
  let best: [string, string] | null = null;
  for (const [k, id] of byName) if (k.length > 3 && t.includes(k) && (!best || k.length > best[0].length)) best = [k, id];
  return best?.[1] ?? null;
}

export const eventsOf = (id: string) => {
  const e = named.find((x) => x.id === id);
  if (!e) return [];
  const names = new Set([e.name, e.name.split(" ").pop()!]);
  return EVENTS.filter((ev) => names.has(ev.actor)).sort((a, b) => b.starts.localeCompare(a.starts));
};

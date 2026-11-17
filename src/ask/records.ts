import { MENTIONS, TABLES } from "../tables";
import { entityIn, entityNamed } from "./entities";
import type { MarkT } from "./render";
import { FIND } from "./board";
import type { Lens, LensMode } from "./board";

// Every base row with an id is a record, and every view on the board draws records. For each record the page keeps
// the case entities it involves, so a selection made in one view can be found in views that draw other records.

const PARTIES: Record<string, string[]> = {
  people: ["id"],
  gifts: ["donor_id", "employer", "recipient"],
  votes: ["senator"],
  filings: ["client", "firm"],
  events: ["actor"],
  entities: ["id"],
  contacts: ["person_id", "office"],
  transfers: ["source", "target"],
  senators: ["id"],
};
// Names in the tables that are not entity names.
const ALIAS: Record<string, string> = {
  "Sen. Whitcombe": "whitcombe", "Sen. Brandt": "brandt", "Rep. Arandia": "arandia", "Rep. Yates": "yates",
  "Subcommittee staff": "subcmte", "Halvorsen executives": "tolliver", "Ads backing Whitcombe": "whitcombe",
  "Arandia for Congress": "arandia", "Yates Victory": "yates",
};

const involves = new Map<string, string[]>();
for (const t of TABLES) {
  const cols = PARTIES[t.name];
  if (!cols) continue;
  for (const r of t.rows as Record<string, unknown>[]) {
    const out = new Set<string>();
    for (const c of cols) {
      const v = r[c];
      if (typeof v !== "string") continue;
      const id = c.endsWith("id") ? v : ALIAS[v] ?? entityNamed(v);
      if (id) out.add(id);
    }
    involves.set(String(r.id), [...out]);
  }
}

for (const m of MENTIONS) involves.set(m.document_id, [...(involves.get(m.document_id) ?? []), m.entity_id]);

export const entitiesOf = (ids: Iterable<string>) => {
  const out = new Set<string>();
  for (const id of ids) for (const e of involves.get(id) ?? []) out.add(e);
  return out;
};

// A mark stands for the records it was made from, or for its own row when it was not aggregated. It also contains
// the entities those records involve.
export interface MarkRecords { id: string; own: string[]; all: Set<string> }
export function markRecords(m: MarkT, key?: string): MarkRecords {
  const own = m.src ?? [m.id];
  const all = new Set(own);
  for (const e of entitiesOf(own)) all.add(e);
  const ent = entityIn(m.row, key);
  if (ent) all.add(ent);
  return { id: m.id, own, all };
}

// Whether something standing for the records in own matches a set, by the rule below.
export function hits(own: string[], set: Set<string>, wide: Set<string>) {
  if (own.some((r) => wide.has(r))) return true;
  for (const e of entitiesOf(own)) if (set.has(e)) return true;
  return false;
}

// A mark matches a set when it stands for one of the set's records or for an entity they involve, or when it contains
// one of them. Selecting a quarter of lobbying spend then finds the client and firm in the network, and selecting a
// person finds the events and gifts that involve them, without lighting every other quarter of the same client.
export function matching(marks: MarkRecords[], ids: Set<string>): Set<string> {
  const out = new Set<string>();
  if (!ids.size) return out;
  const wide = new Set(ids);
  for (const e of entitiesOf(ids)) wide.add(e);
  for (const m of marks) if (m.own.some((r) => wide.has(r)) || [...ids].some((r) => m.all.has(r))) out.add(m.id);
  return out;
}

// The selection, the lenses and hovered records, prepared once for matching many marks against them.
export interface Prepared { set: Set<string>; wide: Set<string> }
export const prepare = (ids: string[]): Prepared => ({ set: new Set(ids), wide: new Set([...ids, ...entitiesOf(ids)]) });
export interface OnLens extends Prepared { i: number; mode: LensMode }
// The search gets no lens color, since its records are already the selection.
export const onLenses = (lenses: Lens[]): OnLens[] => lenses.flatMap((l, i) => (l.on ? [{ i: l.id === FIND ? -1 : i, mode: l.mode, ...prepare(l.set.ids) }] : []));

// Dimming and hiding narrow the view: a record stays lit or shown only when it matches every lens that dims or
// hides. Records that stand for nothing in the tables, such as a row of totals without its source rows, stay.
export function passes(own: string[], lenses: OnLens[], modes: LensMode[], extra?: string | null) {
  if (!own.length && !extra) return true;
  return lenses.every((l) => !modes.includes(l.mode) || hits(own, l.set, l.wide) || (!!extra && l.set.has(extra)));
}

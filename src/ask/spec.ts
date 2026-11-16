import type { Column, ColType } from "./db";

// The description of an answer. The agent writes one per question, and edits on the page change it in place.
// Names follow Vega-Lite where the two overlap.

export type FieldType = "quantitative" | "temporal" | "ordinal" | "nominal" | "place";
export type MarkType = "point" | "span" | "cell" | "rule" | "text" | "link";
export type Token = string;

export interface Channel {
  field?: string;
  type?: FieldType;
  value?: Token | number;
  datum?: number | string;
  param?: string;
  map?: Record<string, Token>;
  bin?: boolean | { step: number };
  title?: string;
}
export interface Encoding {
  x?: Channel; x2?: Channel; y?: Channel; y2?: Channel;
  size?: Channel; fill?: Channel; weight?: Channel; tone?: Channel; shape?: Channel;
  text?: Channel; place?: Channel;
  source?: Channel; target?: Channel;
}
// A point layer with the network layout takes its positions from a force layout over the link layers whose ends
// are its keys, in place of x and y.
export interface Layer { from?: string; mark: MarkType; encoding: Encoding; adjust?: "stack" | "dodge" | "jitter"; layout?: "network" }
export interface Param { value: number; min: number; max: number; step?: number; label: string; unit?: string }
export interface TableDef { sql: string; key?: string }

export interface Answer {
  question: string;
  title: string;
  tables: Record<string, TableDef>;
  params?: Record<string, Param>;
  layers: Layer[];
  form?: "chart" | "table";
  unit?: [string, string];
  labels?: Record<string, string>;
  format?: Record<string, "usd" | "int" | "pct" | "date" | "time">;
  sort?: { field: string; desc: boolean };
  notes?: Record<string, unknown>;
}

export const CHANNELS = ["fill", "weight", "tone", "shape"] as const;
export type Look = (typeof CHANNELS)[number];
export const TOKENS: Record<Look, string[]> = {
  fill: ["solid", "hollow", "hatch", "tint"],
  weight: ["strong", "normal", "quiet", "ghost"],
  tone: ["ink", "accent", "t1", "t2", "t3", "t4", "t5", "t6"],
  shape: ["dot", "diamond", "square", "ring", "arrow"],
};

// Default maps by column name. When an answer maps one of these columns without giving its own map, it gets the
// default. Columns marked auto get their channel even when the answer does not mention them, since a simulated or
// uncovered row has to look different wherever it appears.
export const CONVENTIONS: { field: string; channel: Look; map: Record<string, Token>; auto?: boolean }[] = [
  { field: "certainty", channel: "fill", map: { recorded: "solid", estimated: "hollow", simulated: "hollow" }, auto: true },
  { field: "covered", channel: "fill", map: { false: "hatch", true: "solid" }, auto: true },
  { field: "origin", channel: "fill", map: { recorded: "solid", fetched: "tint", computed: "hollow", simulated: "hollow" }, auto: true },
  { field: "recipient", channel: "tone", map: { Whitcombe: "ink", Brandt: "t1" } },
  { field: "sector", channel: "tone", map: { "Aerospace and defense": "accent", Government: "t1", Finance: "t1", "Law and lobbying": "t3", Energy: "t6", Health: "t4", "Real estate": "t2" } },
];

export function inferType(c: Column | undefined, ch?: Channel): FieldType {
  if (ch?.type) return ch.type;
  const t: ColType | undefined = c?.type;
  if (t === "quantitative") return "quantitative";
  if (t === "temporal") return "temporal";
  return "nominal";
}

export const human = (s: string) => {
  const t = s.replace(/^[a-z]+\./, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const labelOf = (a: Answer, field: string) => a.labels?.[field] ?? human(field);

// Checks only that the description can be drawn. Each problem names the place where it occurs, so that the agent
// can repair the description.
export function check(a: Answer, cols: Record<string, Column[]>): string[] {
  const out: string[] = [];
  if (!a.layers?.length) out.push("layers: the answer has no layers");
  a.layers?.forEach((l, i) => {
    const at = `layers[${i}]`;
    if (!["point", "span", "cell", "rule", "text", "link"].includes(l.mark)) out.push(`${at}.mark: unknown mark ${l.mark}`);
    if (l.from && !cols[l.from]) out.push(`${at}.from: no table named ${l.from}`);
    const have = new Set((l.from ? cols[l.from] : [])?.map((c) => c.name));
    for (const [k, ch] of Object.entries(l.encoding ?? {})) {
      if (!ch) continue;
      if (ch.field && !have.has(ch.field)) out.push(`${at}.encoding.${k}: no column ${ch.field} in ${l.from ?? "the layer"}`);
      if (ch.param && !a.params?.[ch.param]) out.push(`${at}.encoding.${k}: no parameter ${ch.param}`);
      if ((CHANNELS as readonly string[]).includes(k) && ch.value !== undefined && !TOKENS[k as Look].includes(String(ch.value))) out.push(`${at}.encoding.${k}: ${ch.value} is not a ${k} token`);
    }
    const e = l.encoding ?? {};
    if (l.mark === "cell" && !(e.x?.field && e.y?.field)) out.push(`${at}: a cell needs fields on x and y`);
    if (l.mark === "text" && !e.text) out.push(`${at}: a text mark needs a text channel`);
    if (l.mark === "rule" && !e.x && !e.y) out.push(`${at}: a rule needs x or y`);
    if (l.mark === "link" && !(e.source?.field && e.target?.field)) out.push(`${at}: a link needs fields on source and target`);
  });
  for (const [name, t] of Object.entries(a.tables ?? {})) if (t.key && cols[name] && !cols[name].some((c) => c.name === t.key)) out.push(`tables.${name}.key: no column ${t.key}`);
  return out;
}

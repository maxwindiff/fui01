// What the agent wrote about a change. The prototype loads it from files, as the agent wrote it.
//
// A place in the code is a hunk key, `path@newStart` as in diff.ts, optionally followed by `:i` for the i-th line of
// the hunk. Text can link to places with `[words](place)`.

export type Place = string;

export interface Step {
  text: string;
  at?: Place;
  // Code outside the diff, which the step quotes.
  code?: { file: string; text: string };
}

// A diagram between the steps of a flow, in Mermaid.
export interface Figure { diagram: string }

export interface Flow { id: string; title: string; steps: (Step | Figure)[] }

export interface Finding { id: string; at: Place; sev: "high" | "medium" | "low"; title: string; body: string }

// Pseudocode for the hunk lines from..to, inclusive. An empty text folds the lines away.
export type Span = [number, number, string];

// `a` holds the spans for the middle summarization level and `b` the spans for the highest. Without `b`, the highest
// level uses `a`.
export interface HunkNote { a?: Span[]; b?: Span[] }

export interface QA { q: string; a: string }

export interface Review {
  findings: Finding[];
  flows: Flow[];
  order: string[];
  hunks: Record<string, HunkNote>;
  qa: QA[];
}

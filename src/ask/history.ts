import type { Answer } from "./spec";

// The answers so far, as a tree. A question asked from an earlier answer starts a branch beside the one already
// there, as a commit on an old revision does in git. An edit on the page is a small node of its own, and a run of
// edits to the same control folds into one node while nothing has grown from it yet.

export interface HNode { id: number; parent: number | null; kind: "ask" | "edit"; label: string; answer: Answer; editKey?: string }
export interface History { nodes: HNode[]; head: number }

export const EMPTY_HISTORY: History = { nodes: [], head: -1 };

export const node = (h: History, id: number) => h.nodes.find((n) => n.id === id) ?? null;
export const children = (h: History, id: number) => h.nodes.filter((n) => n.parent === id);

export function commit(h: History, kind: HNode["kind"], label: string, answer: Answer, editKey?: string): History {
  const head = node(h, h.head);
  if (kind === "edit" && head?.kind === "edit" && head.editKey === editKey && !children(h, head.id).length)
    return { ...h, nodes: h.nodes.map((n) => (n.id === head.id ? { ...n, label, answer } : n)) };
  const id = h.nodes.length ? Math.max(...h.nodes.map((n) => n.id)) + 1 : 0;
  return { nodes: [...h.nodes, { id, parent: head ? head.id : null, kind, label, answer, editKey }], head: id };
}

export function path(h: History, id = h.head): HNode[] {
  const out: HNode[] = [];
  for (let n = node(h, id); n; n = n.parent === null ? null : node(h, n.parent)) out.unshift(n);
  return out;
}

// The question an edit belongs to, so unkeyed rows keep their marks while the reader adjusts its answer.
export function askOf(h: History, id = h.head): HNode | null {
  for (let n = node(h, id); n; n = n.parent === null ? null : node(h, n.parent)) if (n.kind === "ask") return n;
  return null;
}

// Rows in the order the nodes were made, one lane per branch. A node takes its parent's lane when it is the
// parent's first child, and the next free lane otherwise.
export interface VNode { id: number; parent: number | null; kind: HNode["kind"] | "fold"; label: string; members?: number[]; ask?: number }
export interface Row { n: VNode; lane: number; parentRow: number; parentLane: number }
export function graph(nodes: VNode[]): { rows: Row[]; lanes: number } {
  const laneOf = new Map<number, number>();
  const rowOf = new Map<number, number>();
  let lanes = 0;
  const rows = nodes.map((n, i) => {
    let lane = 0;
    if (n.parent !== null) {
      const first = nodes.find((m) => m.parent === n.parent);
      lane = first?.id === n.id ? laneOf.get(n.parent)! : lanes;
    }
    if (lane >= lanes) lanes = lane + 1;
    laneOf.set(n.id, lane);
    rowOf.set(n.id, i);
    return { n, lane, parentRow: n.parent === null ? -1 : rowOf.get(n.parent)!, parentLane: n.parent === null ? lane : laneOf.get(n.parent)! };
  });
  return { rows, lanes: Math.max(1, lanes) };
}

// The tree as drawn. Edits under questions other than the current one are folded unless the reader opened that
// question. Each unbroken run of folded edits is drawn as a single fold node, which takes the run's place in the
// tree. An edit with two or more children stays, since the branches start there.
export function folded(h: History, open: Set<number>): VNode[] {
  const cur = askOf(h)?.id;
  const hide = new Set<number>();
  for (const n of h.nodes) {
    if (n.kind !== "edit" || n.id === h.head || children(h, n.id).length > 1) continue;
    const a = askOf(h, n.id)?.id;
    if (a !== undefined && a !== cur && !open.has(a)) hide.add(n.id);
  }
  const top = (id: number) => {
    let n = node(h, id)!;
    while (n.parent !== null && hide.has(n.parent)) n = node(h, n.parent)!;
    return n.id;
  };
  const fold = (id: number) => -(top(id) + 1);
  const out: VNode[] = [];
  const folds = new Map<number, VNode>();
  for (const n of h.nodes) {
    if (hide.has(n.id)) {
      const t = top(n.id);
      if (t === n.id) {
        const f: VNode = { id: -(n.id + 1), parent: n.parent, kind: "fold", label: "", members: [], ask: askOf(h, n.id)!.id };
        folds.set(f.id, f);
        out.push(f);
      }
      folds.get(-(t + 1))!.members!.push(n.id);
      continue;
    }
    out.push({ ...n, parent: n.parent !== null && hide.has(n.parent) ? fold(n.parent) : n.parent });
  }
  for (const f of folds.values()) f.label = `${f.members!.length} ${f.members!.length === 1 ? "edit" : "edits"}`;
  return out;
}

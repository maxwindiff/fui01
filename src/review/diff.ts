// Parses the output of `git show` with a header of sha, author, date and message: one line each, the message running
// to the first `diff --git`.

export interface Line { k: "+" | "-" | " "; text: string; old: number | null; neu: number | null }
export interface Hunk { key: string; file: string; head: string; oldStart: number; newStart: number; lines: Line[]; add: number; del: number }
export interface FileDiff { path: string; status: "added" | "deleted" | "modified"; hunks: Hunk[]; add: number; del: number }
export interface Commit { sha: string; author: string; date: string; title: string; body: string; files: FileDiff[] }

export function parseCommit(raw: string): Commit {
  const start = raw.indexOf("\ndiff --git ");
  const header = (start < 0 ? raw : raw.slice(0, start)).split("\n");
  const [sha, author, date, title, ...rest] = header;
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let hunk: Hunk | null = null;
  let o = 0, n = 0;
  for (const line of (start < 0 ? "" : raw.slice(start + 1)).split("\n")) {
    if (line.startsWith("diff --git ")) {
      file = { path: line.split(" b/").pop()!, status: "modified", hunks: [], add: 0, del: 0 };
      files.push(file);
      hunk = null;
    } else if (!file) continue;
    else if (line.startsWith("new file")) file.status = "added";
    else if (line.startsWith("deleted file")) file.status = "deleted";
    else if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/.exec(line)!;
      o = +m[1];
      n = +m[2];
      hunk = { key: `${file.path}@${n}`, file: file.path, head: m[3], oldStart: o, newStart: n, lines: [], add: 0, del: 0 };
      file.hunks.push(hunk);
    } else if (hunk && (line[0] === "+" || line[0] === "-" || line[0] === " ")) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      const k = line[0] as Line["k"];
      hunk.lines.push({ k, text: line.slice(1), old: k === "+" ? null : o++, neu: k === "-" ? null : n++ });
      if (k === "+") { hunk.add++; file.add++; }
      if (k === "-") { hunk.del++; file.del++; }
    }
  }
  return { sha, author, date, title, body: rest.join("\n").trim(), files };
}

// Splits a line of code into tokens for highlighting. The highlighter reads each line on its own, so a comment or string
// spanning several lines is highlighted only on its first line.

export type Lang = "ts" | "css" | "md" | "json" | "plain";
export type Token = [cls: string | null, text: string];

export const langOf = (path: string): Lang =>
  /\.(tsx?|jsx?|mjs)$/.test(path) ? "ts" : /\.css$/.test(path) ? "css" : /\.md$/.test(path) ? "md" : /\.(json|tsbuildinfo)$/.test(path) ? "json" : "plain";

const KW = new Set(
  "as async await break case catch class const continue default delete do else enum export extends false finally for from function if import in instanceof interface keyof let new null of readonly return satisfies static super switch this throw true try type typeof undefined var void while yield".split(" "),
);

const TS = /(\/\/.*$|\/\*.*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b)|(<\/?[A-Za-z][\w.]*|\/?>)|([A-Za-z_$][\w$]*)(\s*\()?/g;
const CSS_VALUE = /(\/\*.*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"|'[^']*')|(--[\w-]+)|(#[\da-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|ms|s|%|fr|em|rem|vh|vw|deg|turn)?\b)|([\w-]+)(\()|(@[\w-]+|!important)/g;
const CSS_DECL = /^(\s*)([\w-]+)(\s*:\s*)(.*)$/;

function scan(text: string, re: RegExp, pick: (m: RegExpExecArray) => Token[]): Token[] {
  const out: Token[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push([null, text.slice(last, m.index)]);
    out.push(...pick(m));
    last = m.index + m[0].length;
    if (!m[0].length) re.lastIndex++;
  }
  if (last < text.length) out.push([null, text.slice(last)]);
  return out;
}

function ts(text: string): Token[] {
  return scan(text, TS, (m) => {
    if (m[1]) return [["c", m[1]]];
    if (m[2]) return [["s", m[2]]];
    if (m[3]) return [["n", m[3]]];
    if (m[4]) return [["t", m[4]]];
    const id = m[5];
    const cls = KW.has(id) ? "k" : /^[A-Z]/.test(id) ? "y" : m[6] ? "f" : null;
    return m[6] ? [[cls, id], [null, m[6]]] : [[cls, id]];
  });
}

function cssValue(text: string): Token[] {
  return scan(text, CSS_VALUE, (m) => {
    if (m[1]) return [["c", m[1]]];
    if (m[2]) return [["s", m[2]]];
    if (m[3]) return [["v", m[3]]];
    if (m[4] || m[5]) return [["n", m[0]]];
    if (m[6]) return [["f", m[6]], [null, m[7]]];
    return [["k", m[0]]];
  });
}

function decls(text: string): Token[] {
  return text.split(/(;)/).flatMap((part): Token[] => {
    const d = CSS_DECL.exec(part);
    return d ? [[null, d[1]], ["p", d[2]], [null, d[3]], ...cssValue(d[4])] : cssValue(part);
  });
}

function css(text: string): Token[] {
  const t = text.trim();
  if (t.startsWith("/*") || t.startsWith("*")) return [["c", text]];
  const brace = text.indexOf("{");
  if (brace >= 0) {
    const sel = text.slice(0, brace);
    return [...(sel.trim().startsWith("@") ? cssValue(sel) : [["t", sel] as Token]), [null, "{"], ...decls(text.slice(brace + 1))];
  }
  return t.endsWith(",") ? [["t", text]] : decls(text);
}

function md(text: string): Token[] {
  if (/^#{1,6} /.test(text)) return [["k", text]];
  return scan(text, /(`[^`]+`)|(\*\*[^*]+\*\*)/g, (m) => [[m[1] ? "s" : "k", m[0]]]);
}

function json(text: string): Token[] {
  return scan(text, /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g, (m) => {
    if (m[1]) return m[2] ? [["p", m[1]], [null, m[2]]] : [["s", m[1]]];
    return [[m[3] ? "n" : "k", m[0]]];
  });
}

const cache = new Map<string, Token[]>();
export function highlight(text: string, lang: Lang): Token[] {
  if (lang === "plain" || !text) return [[null, text]];
  const key = `${lang}\u0000${text}`;
  let out = cache.get(key);
  if (!out) {
    out = lang === "ts" ? ts(text) : lang === "css" ? css(text) : lang === "md" ? md(text) : json(text);
    cache.set(key, out);
  }
  return out;
}

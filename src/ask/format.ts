import type { Answer } from "./spec";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtUsd = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e4 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v).toLocaleString("en-US")}`;
export function fmtDate(ms: number, withTime = false) {
  const d = new Date(ms);
  const s = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${s}, ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}` : s;
}
export const fmtTime = (ms: number) => { const d = new Date(ms); return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const MONEY = /amount|spend|usd|total|price|dollars|raised|given/;

export function fmtValue(a: Answer | null, field: string, v: unknown, type?: string): string {
  if (v === null || v === undefined) return "none";
  const f = a?.format?.[field];
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return `${v.length} rows`;
  if (v instanceof Date) v = v.getTime();
  if (typeof v === "number") {
    if (f === "date" || type === "temporal") return f === "date" || v % 864e5 === 0 ? fmtDate(v) : fmtDate(v, true);
    if (f === "time") return fmtTime(v);
    if (f === "usd" || (!f && MONEY.test(field))) return fmtUsd(v);
    if (f === "pct") return `${Math.round(v * 100)}%`;
    return Number.isInteger(v) ? v.toLocaleString("en-US") : Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);
  }
  return String(v);
}

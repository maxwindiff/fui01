# Writes report.md next to each results.jsonl, with every question, the answer's SQL and rows, the summary the model
# wrote for it, and the checks from grade.py: python3 eval/report.py eval/runs/*/results.jsonl
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from grade import CHECKS

def block(text, lang=""):
    return f"```{lang}\n{text}\n```\n"

for path in sys.argv[1:]:
    R = [json.loads(l) for l in open(path)]
    out = [f"# Eval run {os.path.basename(os.path.dirname(path))}\n"]
    for model in sorted({r["model"] for r in R}):
        rs = {(r["si"], r["qi"]): r for r in R if r["model"] == model}
        out.append(f"## {model} {rs[next(iter(rs))].get('reasoning', '')}\n")
        for k in sorted(rs):
            r, n = rs[k], rs.get((k[0], k[1] + 1))
            checks = [f"{name} {'pass' if f(r, n) else 'FAIL'}" for name, f in CHECKS.get(k, [])]
            out.append(f"### {k[0]}.{k[1]} {r['q']}\n")
            out.append(f"{'Drawn' if r['ok'] else 'Not drawn'} in {r['ms'] / 1000:.1f}s, {r['rounds']} calls, {r['shows']} answers shown, ${r['cost']:.4f}. Checks: {', '.join(checks) or 'none'}.\n")
            if r.get("title"): out.append(f"**{r['title']}**\n")
            if r.get("note") or (not r["ok"] and r.get("text")): out.append(f"> {r.get('note') or r.get('text')}\n")
            if n and n.get("summary"): out.append(f"Summary, written with the next question: {n['summary']}\n")
            for i, q in enumerate(r.get("queries") or []): out.append(f"Query {i + 1}:\n" + block(q, "sql"))
            for p in r.get("problems") or []: out.append("Problems sent back:\n" + block(p))
            a = r.get("answer") if isinstance(r.get("answer"), dict) else {}
            for name, t in (a.get("tables") or {}).items():
                sql = t.get("sql", "") if isinstance(t, dict) else str(t)
                tb = (r.get("tables") or {}).get(name, {})
                out.append(f"Table `{name}` ({tb.get('rows', '?')} rows):\n" + block(sql, "sql"))
                if tb.get("sample"):
                    cols = list(tb["sample"][0].keys())
                    out.append("| " + " | ".join(cols) + " |\n|" + "---|" * len(cols) + "\n" + "".join("| " + " | ".join(str(row.get(c, "")) for c in cols) + " |\n" for row in tb["sample"]))
            if a.get("layers"): out.append("Layers:\n" + block("\n".join(json.dumps(l) for l in a["layers"]), "json"))
    open(os.path.join(os.path.dirname(path), "report.md"), "w").write("\n".join(out))
    print("wrote", os.path.join(os.path.dirname(path), "report.md"))

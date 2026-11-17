# Model evals for the question box

`run.mjs` asks the question sequences in `questions.json` through the question box on the case page in headless Chrome, with the scripted answers turned off, one browser context per sequence, and records each answer in `runs/<name>/results.jsonl`: the SQL and layers the model showed, the first rows of each table, the queries it ran, problems the page sent back, latency, calls and cost. Later questions in a sequence are follow-ups, and the summary of each view comes back with the next question.

`grade.py` scores runs against the right answers from `src/tables.ts`: whether a view was drawn, whether its SQL kept the conditions the question asked for, and whether the summary's numbers are right. `report.py` writes a readable `report.md` for each run.

```sh
npm run dev                                   # with OPENROUTER_API_KEY in .env.local
node eval/run.mjs                             # the page's default model
node eval/run.mjs openai/gpt-6-luna anthropic/claude-haiku-5.5
REASONING='{"effort":"medium"}' SEQ=1,2 OUT=eval/runs/luna-medium node eval/run.mjs openai/gpt-6-luna
python3 eval/grade.py eval/runs/*/results.jsonl
python3 eval/report.py eval/runs/*/results.jsonl
```

The dev server lets these requests pick the model and reasoning settings and skips the rate limits. A full run of one model costs under a cent. Runs are gitignored.

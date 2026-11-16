# To do

## Revisit the heavier theme variants

The branch `theme-experiments` holds a second take on Floe, Massif and Phosphor. All three went too far and were rolled back on `main`. Parts of each may be worth bringing back in a quieter form.

- **Floe** as a tactile surface: ceramic plates on an aluminium deck, keys with travel and a lit dot, sunk trays for figures and charts, a motion knob. To decide: how much depth between background, panel and control reads as tactile without becoming heavy.
- **Massif** as a hologram: panels as sheets of cyan light, a backdrop of contour lines, fog and dust with parallax, contour lines and a projected volume in the relief views, live camera readouts, status lights in the title bars. To decide: which of the backdrop layers and readouts to keep, and whether any should go to other themes.
- **Phosphor** as a glowing tube: green phosphor with solid lit title bars and keys, bloom from an SVG filter, a pixel face for figures. Scanlines over the page hurt readability and should stay out. To decide: how to add glow and solid blocks without making it look like Console. Until then Phosphor stays out of the theme selector on `main` and loads only from `#phosphor`.

To look at a variant, run `git switch theme-experiments` and `npm install`, then start the dev server.

## Ask page

The Ask page (`#vellum/ask`, code in `src/ask/`) has a scripted agent in `agent.ts`. Answers follow the format in `spec.ts`, the queries run in DuckDB-Wasm (`db.ts`, `run.ts`), `filters.ts` turns comparisons in the SQL into controls, `render.tsx` lays out the marks and `history.ts` keeps the tree of answers.

- Deploy to Vercel. Set `OPENROUTER_API_KEY` and `ASK_PASSWORD`, and a credit limit on the OpenRouter key. Check that the function in `api/ask.ts` loads: the project uses ES modules with extensionless imports, which Vercel's Node runtime may reject. If it does, bundle `server/ask.ts` in a build step.
- The rate limits in `server/ask.ts` count in memory per function instance. Move them to a shared store if the page gets more than a few users.
- Add a text block for diffs and quotes, and time as a channel.
- The dossier's "Show in network" button reveals the case board's network panel, which is not on the Ask page. On the Ask page it could ask for a network centered on the entity instead.
- Keep axes in place between answers when the field stays, and stage changes that affect several things.
- Check the page at phone width and in Safari. The shared top bar overflows at 390 px. All five themes were checked in Chrome.

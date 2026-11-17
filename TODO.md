# To do

## New themes

No work is planned here yet. The branch `theme-experiments` holds a second take on Floe, Massif and Phosphor. All three went too far and were rolled back on `main`. Parts of each may be worth bringing back in a quieter form.

- **Floe** as a tactile surface: ceramic plates on an aluminium deck, keys with travel and a lit dot, sunk trays for figures and charts, a motion knob. To decide: how much depth between background, panel and control reads as tactile without becoming heavy.
- **Massif** as a hologram: panels as sheets of cyan light, a backdrop of contour lines, fog and dust with parallax, contour lines and a projected volume in the relief views, live camera readouts, status lights in the title bars. To decide: which of the backdrop layers and readouts to keep, and whether any should go to other themes.
- **Phosphor** as a glowing tube: green phosphor with solid lit title bars and keys, bloom from an SVG filter, a pixel face for figures. Scanlines over the page hurt readability and should stay out. To decide: how to add glow and solid blocks without making it look like Console. Until then Phosphor stays out of the theme selector on `main` and loads only from `#phosphor`.

To look at a variant, run `git switch theme-experiments` and `npm install`, then start the dev server.

## Answers beside the case board

The answers column (`src/ask/Answers.tsx`, state in `board.ts`) holds charts, stacks and written answers. The toolbar (`Scopes.tsx`) holds the search, the selection and the lenses, and the question box (`Composer.tsx`) takes text with scopes in it. A script in `mock.ts` answers the test questions, and other questions go to the model. Answers follow the format in `spec.ts`, the queries run in DuckDB-Wasm (`db.ts`, `run.ts`), `filters.ts` turns comparisons in the SQL into chips, and `render.tsx` lays out the marks. `sources.ts` describes the data behind every case panel as an answer.

- Run the model eval again, once the question box and the tables have settled. `eval/run.mjs` now types into the new question box and names the previous answer as the scope of each follow-up, but it has not been run since.
- The model gets one panel or answer as context. A question that names two panels, or a panel and an answer, passes the others only as their titles in the text.
- Hiding with a lens removes marks from the case panels, but the panels keep their axes and empty lanes. Only answers are laid out again.
- The entity card from the Ask page is not back yet. It is in git history before the move to one page.
- Search matches words in the text fields of each record and does not follow ties. "Voss" finds her contacts and events, but not the Kestrel Row filings, which do not name their lobbyists.
- The spike labels on the map's strata form stay when a lens hides their state.

# fui01

A specimen sheet of themes for a browser app that analyses ties between companies and government. Every theme draws the same panels over the same invented case file.

## Start

```
npm install
npm run dev      # http://127.0.0.1:5183
npm run build    # type-check, then a production build in dist/
```

Keys 1 to 5 switch themes. The URL hash holds the theme id and the page, for example `#console/review` or `#console/case`, and the page opens on Review when the hash names no page. Phosphor is left out of the selector and loads from `#phosphor`. The network and map panels need a browser with WebGPU. Without it they show a message and the rest of the page works.

The page has a toolbar, the case panels on the left, and answers to questions about them on the right. Both columns are drawn from the case tables in `src/tables.ts`. `src/data.ts` works out what each case panel shows, and `src/ask/sources.ts` writes the same data as SQL over the tables, one set of queries per panel. A question asked about a panel gets the panel's rows as context, and the table button on a panel opens its data as an answer.

Selecting a mark anywhere marks the same records, and the entities they involve, in every panel and answer. The toolbar shows the selection beside a search field, which selects the records whose text matches. Keep turns the selection into a lens, a named set of records that stays on the page. A lens either dims or hides every other record, and the records found by a search can do the same before they are kept. Hiding takes the other rows out of answers before they are laid out, so their axes fit what is left.

A question is text with scopes in it. A scope is a panel, an answer, the selection or a lens. The ask button on a panel or an answer puts it in the question box, and so do a click on a chip in the toolbar, dragging the chip, the + button, and typing @ (`/` focuses the box). The question is about the first panel or answer it names, or about the whole case when it names none.

The layout picked in the toolbar decides where answers go:

- **Content** leaves answers out and puts the panels in two columns. Ask question, the ask buttons and `/` switch to Floating and focus the question box.
- **Floating** lists answers in the order they were asked, in a column that scrolls by itself.
- **Beside** puts each answer level with the panel it was asked about, and a follow-up under the answer it follows. An answer about the whole case goes level with the panel that was on screen when it was asked.
- **Below** puts answers under their panels and gives the board the full width.

When the answers in one place take more room than they have, the oldest fold to their titles. The answer touched last, the newest answer, answers named in the question box and answers opened by hand stay open.

An answer can be a chart, a stack of charts on a shared time axis, a written answer, or a lens. A chart answer is a set of SQL queries over the case tables and a description of one view. The queries run in the browser in DuckDB-Wasm, and comparisons in the SQL become chips that change the answer. A chart answer also shows as a table, and in 3D in browsers with WebGPU. Its bars can be split by a column of the rows behind them, or opened up into those rows. A written answer links phrases to the records behind them. Hovering a phrase lights those records in every chart, and selecting it makes them the selection.

Answers that are not pinned are dropped when the page reloads. Pinned answers, lenses and the layout are saved in the browser. A script answers a fixed set of questions, which the + menu lists, and other questions go to a model through `api/ask.ts`. The questions used to test the design are in `docs/ask-questions.md`.

## Review

The Review tab is a static prototype of a code review tool. In it, an agent prepares a change for a reviewer. The tab shows three commits from this repository, small, medium and large. `src/review/changes/` holds their output from `git show`, and `src/review/data/` holds what the agent wrote about each one:
- its own review, as draft comments
- flows through the code, with diagrams in Mermaid between some of the steps
- a reading order for the files
- pseudocode for runs of lines in the hunks, at two levels

Text in these files links to code by hunk, as `path@line` with an optional `:i` for a line inside the hunk.

The page puts the file tree, the agent's review and the flows on the left, and the change across the rest. It starts with the commit message and then shows the files in the agent's reading order, as a unified or a split diff. [Pele](https://pele.run) draws the flow diagrams, and its sequence, flowchart and state renderers load only when a flow with a diagram opens. The slider in the toolbar sets the summarization level for the whole change:
1. Raw shows every line.
2. Condensed turns uninteresting code, such as long attribute lists and boilerplate, into pseudocode or folds it away.
3. Abstracted also turns self-contained pieces of logic into pseudocode, for example a single call to an invented function, `pop_morph_and_wake_scenes()`.

When the replaced lines define names used elsewhere, the agent writes pseudocode for them instead of folding them away. Each pseudocode line takes the indentation of the first replaced line, and changed lines and their pseudocode are highlighted. Selecting pseudocode opens the original lines in place. `src/review/highlight.ts` highlights TypeScript, CSS, Markdown and JSON one line at a time.

Marking a hunk as read folds it to its header, and marking a whole file folds the file to its name. Selecting a folded header opens it again, and `n` jumps to the next unread hunk. Generated files such as `tsconfig.tsbuildinfo` stay closed and their hunks are not drawn until the reviewer loads them or comments on them. They count toward neither the progress nor `n`. The agent's draft comment for a finding shows under its line after the reviewer picks the finding from the list on the left. The reviewer can accept the draft as a comment, edit it first or dismiss it, and Sync in the toolbar posts the comments to GitHub. The prototype has no GitHub, so Sync only marks the comments as posted.

The agent answers questions in two places:
- A question about the whole change goes in the field in the toolbar (`/` focuses it), and the answers open under the field.
- A line number opens a box under the line, for a comment or a question to the agent. The answer stays under the line, and the box suggests the questions whose answers link into that hunk.

The answers are scripted, and they last only as long as the page. Read marks and comments are saved in the browser.

## Rendering

Each kind of content is drawn with the lightest technology that can carry its mark count.

- **DOM** draws text, tables, documents and controls.
- **SVG** draws the charts, which have up to a few thousand marks.
- **WebGPU**, through [vgpu](https://vgpu.sh), draws the network and the map, which need lighting, depth and camera moves that SVG cannot do at speed.

A theme is an object in `src/themes.ts`. When the theme changes, `App.tsx` copies its `vars` onto the root element as CSS custom properties and sets `data-family` to the theme id. The DOM and the SVG charts read colours, type and stroke weights from those properties, and `src/styles/base.css` has a block of rules per family for everything the properties cannot express.

### GPU views

The code is in `src/gpu`. `scene.ts` draws four primitives as instanced geometry. The instance data is in storage buffers, and each layer is one draw call.

| Shader | Draws |
|---|---|
| `marks.wgsl` | node glyphs and terrain points as signed-distance fields, with stroke, knockout fill and halo |
| `segments.wgsl` | ties, rings, borders and outlines as capsules, with dashes, travelling pulses and an optional glow |
| `quads.wgsl` | translucent sheets with a dot grid, and the cast shadows of blocks |
| `boxes.wgsl` | solid blocks with flat shading per face and an outline |

A scene is a list of named layers. `network.ts` and `map.ts` lay out the data, write a typed array for each kind of geometry and pass it to the scene by layer name. The scene ignores a write to a layer it was not created with, so the `gpu` entry of a theme controls the result twice: the view component reads it to decide which layers to create, and the builders read it to decide what to write.

Scenes that contain boxes get a depth buffer and 4x multisampling and clear to an opaque ground. Their shadows blend with `min`, so overlapping shadows do not add up. The other scenes draw back to front with premultiplied or additive blending.

All four shaders import `view.wgsl`, which holds the orbit camera, defocus by distance from the focal plane, haze and the entry reveal. A builder writes each height once. The `lift` uniform scales every height, so the flat arrangement of a view is the same geometry with `lift` at zero and the camera looking straight down. Switching arrangement animates `lift` and the camera together.

Labels are DOM elements. The view projects node positions on the CPU through the same camera whenever it moves, then a greedy pass hides a label when another has taken its place. Picking also runs on the CPU, through a uniform grid over the nodes.

A single frame loop in `scene.ts` serves every scene on the page. A scene redraws when it is marked dirty or while it animates, and a scene scrolled out of view is skipped.

## Animation

### Levels

On the Case page, the top bar sets a motion level from 0 to 3. `motion.ts` stores it in `localStorage` and starts at 0 when the system asks for reduced motion.

| Level | Adds |
|---|---|
| 0, Still | nothing moves |
| 1, Quiet | responses to input: layout transitions, rows opening, sorted rows travelling, camera glides |
| 2, Standard | entry animations, money travelling along ties, a slow sway in the 3D views |
| 3, Lively | movement at rest, figures counting up, and entry again each time a panel returns to view |

CSS reads the level from `data-motion`, `data-entry` (level 2 and up) and `data-ambient` (level 3) on the root element. GPU code reads `motion.level` directly.

Durations and easing come from the `motion` entry of the theme. `App.tsx` copies them to `--dur-*` and `--ease`.

### Entry

- Every `Panel` registers with a shared `IntersectionObserver`. A panel stays hidden (`data-pending`) until it comes into view, then gets `data-enter="frame"` for one play of its frame animation. Panels that arrive in the same observer batch are staggered by their order in it.
- The frame animation is a CSS rule per theme family, keyed on `data-enter`.
- Chart parts animate under the same attribute: lines draw by `stroke-dashoffset`, bars scale from their baseline, and dense charts wipe in as one piece under a `clip-path`. Elements take a `--k` index for stagger.
- A GPU view starts its reveal when its panel stops being pending. The `reveal` uniform runs from 0 to 1, and every instance carries a delay, so the shaders stagger the geometry without any buffer writes.
- A panel that goes to full size replays only its content (`data-enter="content"`), after the layout transition ends.

### Movement at rest

The frame loop keeps a travel clock that runs from level 2 and runs faster at level 3. `segments.wgsl` offsets dashes and pulses by it, so money moves along ties with no buffer writes. The view components sway the camera on the same loop and stop while the pointer is over the view. Level 3 adds CSS animations under `html[data-ambient]`.

### Layout transitions

Opening a panel at full size and opening the dossier both change the board layout. `morph` in `workspace.tsx` runs the change inside `document.startViewTransition`. Every panel has its own `view-transition-name`, so the browser moves each frame from its old box to its new one. The rules at the end of `base.css` set `object-fit: none` on the transition images, so the contents of a frame keep their scale while the frame crops or uncovers them.

Keeping these transitions cheap:

- `workspace.tsx` is an external store read through `useWs(selector)`, so a layout change re-renders the panel frames and leaves the charts alone.
- While a transition runs, `gpuState.paused` stops the GPU views from redrawing every frame. Each view draws once at its new size.
- Content entry waits for the transition to end.

### Small responses

- `Fold` opens a region in place by animating a grid row from `0fr` to `1fr`, which leaves the height to CSS.
- `useFlip` records the position of each row before a reorder and plays a transform from the old position to the new one.
- `tip.tsx` holds the page's single tooltip. Chart marks show it at once, and elements with `data-tip` show it after 350 ms.

### Notes on the page

An element with a `data-note` attribute shows a note about how it moves or answers, in a dashed tooltip that differs from the data tooltips. The attribute holds keys into the table that `notesFor` in `themes.ts` builds for the active theme: the shared response notes with timings filled in from the theme, plus the theme's own `motion.notes`.

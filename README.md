# Theme specimens

This project holds the visual language for a browser app for analysing ties between companies and government: people, money, lobbying, events, documents. The page layout of the app is still open, so the work here is a specimen sheet. Each theme renders the same set of elements over the same invented case file, so the themes can be compared element by element.

```
npm install
npm run dev      # http://127.0.0.1:5183
```

Keys 1 and 2 switch themes. The theme id also goes in the URL hash, for example `#orrery`.

## Themes

| Key | Theme | Mode | Idea |
|---|---|---|---|
| 1 | Vellum | light | Graphite hairlines on drafting film, indigo for government, orange for money, serif reading text with margin notes. The network pulls apart into three stacked sheets of film. |
| 2 | Orrery | dark | Brass rings on lampblack, the subject at the centre, everything else placed by degree of separation. Ring plates step down from the centre and each entity stands on a stem. |

Panels are flat in both themes. Depth is used inside the two GPU views only, where it carries data: sector in Vellum's sheets, degree of separation and weight in Orrery's plates and stems, giving in the map's spikes and terrain. Each of those views has a control that returns it to a flat plan.

Shape carries the kind of entity and colour carries the sector, in every theme and in both the GPU views and the inline glyphs:

- circle: person (hollow for an official)
- square: company
- diamond: lobbying firm
- triangle: PAC
- hexagon: agency or committee
- asterisk: event

## Rendering

The page draws with three technologies, chosen by mark count.

1. **DOM** for text, tables, documents and controls. Text stays selectable and readable by assistive tech, and an agent can emit layout as plain markup.
2. **SVG** for charts with up to a few thousand marks: timeline, money flow, slopegraph, sparklines. These read their colours and stroke weights from CSS variables, so they follow the theme with no code.
3. **WebGPU through [vgpu](https://vgpu.sh)** for the network and the map, where mark counts reach the hundreds of thousands.

The GPU layer draws three primitives as instanced quads, with the data in storage buffers and one draw call per layer:

- `marks.wgsl`: node glyphs as signed-distance shapes, with stroke, knockout fill and halo
- `segments.wgsl`: ties, rings and borders as capsules, with dashes that march and pulses that travel
- `quads.wgsl`: translucent sheets with a dot grid

All three share `view.wgsl`: an orbit camera, defocus by distance from the focal plane, haze, and the entry reveal. A flat view is the same camera looking straight down with the heights scaled to zero. Flat and Strata, or Plan and Armillary, turn into one another this way: the builder writes each node's height once, and a `lift` uniform scales it while the camera tips.

Labels are DOM elements placed by projecting node positions on the CPU through the same camera, with a greedy pass that drops a label when its slot is taken. Picking also runs on the CPU.

### vgpu compared with React Three Fiber

React Three Fiber reconciles a three.js scene graph through React. It suits scenes built from meshes, materials and lights. The views here are a few instanced draws over typed arrays, so a scene graph would add per-object bookkeeping and about 170 kB of three.js for work the page does not do.

vgpu fits this shape of work:

- instanced draws read straight from storage buffers, addressed by their WGSL names
- one device serves several canvases, so each panel gets its own canvas with no context limit
- `.wgsl` files import one another as modules and are checked at build time (`npx vgpu check file.wgsl`)
- the same code renders headless in Node through Dawn, which gives pixel tests for agent-generated views

Costs to weigh:

- vgpu is at 0.6 and its API still changes between minor versions
- it draws through WebGPU only. In a browser without WebGPU the two GPU views show a message and the rest of the page works
- it has no text and no picking, so both stay on the CPU side as described above

### Measured

In headless Chrome on this machine the network view held the 60 Hz frame interval (16.7 ms between frames) with 100,000 entities and 300,000 tie segments, in the flat arrangement and in the deep one with defocus on. The frame interval is capped by the display, so this shows the absence of dropped frames and says nothing about headroom. The Graph size control in the network panel reruns the test.

The production build is 184 kB of JavaScript after gzip, plus 31 kB for the state outlines, loaded on demand.

## Motion

Each theme carries a motion table in `themes.ts` (`motion`), and the last panel on the sheet lists it with a Replay button. The rules behind it:

- Entry happens once, when a board mounts. Panels arrive in reading order, chart lines draw along their length, and the GPU views reveal ties from source to target. After about four seconds the board drops its `data-entering` attribute, so content shown again later appears without the entry animation.
- At rest the only movement is money: dashes or pulses travelling in the direction the money moved. The GPU views add a slow sway so depth reads through parallax, and the sway stops while the pointer is over the view.
- Changes of arrangement keep every node on screen and move the camera and the heights together.
- `prefers-reduced-motion` turns off entry, sway, travel and layout transitions.

## Interaction

The last panel also lists the interaction patterns, with a button beside most of them that carries the pattern out. Each pattern is built once and reused.

| Pattern | Where to try it | How it is built |
|---|---|---|
| Tooltip | Any chart, entity name, issue code or icon button | `tip.tsx` holds one tooltip for the page. A chart calls `tip.show` with a point and gets an immediate readout. Any element with a `data-tip` attribute gets a text tooltip after 350 ms, and the wait is skipped for 600 ms after a tooltip closes. |
| Open a row | Filings table, document list, Open evidence on the finding | `Fold` animates a grid row from `0fr` to `1fr`, which leaves the height to CSS. |
| Sort | Column headings of the filings table | `useFlip` records each row's position before the reorder and plays a transform from the old position to the new one. |
| Full size | Corner button on any panel | The board sets `data-stage`. The staged panel takes the first column and the rest fold to tiles in a rail. Charts read `usePanel().staged` and draw taller. |
| Dossier | Any underlined entity name, a network node, a node in the money flow | `Inspector.tsx` is a drawer fixed to the right edge. The shell pads its right side by the drawer's width, and a container query moves a column from the wide panel of each pair to the narrow one when the board gets tight. |
| Linked marks | Small multiples, money flow, footnotes in the document, ranked states beside the map | Hover state held in the component and applied as classes. The money flow follows ribbons upstream and downstream from the mark under the pointer. |
| Measure | Drag across the timeline | A brush in the SVG, with counts recomputed from the data on each move. |
| Commit | Add to brief, Dismiss | The brief is a list in the workspace state, counted in the top bar. |

The two layout changes, staging a panel and opening the dossier, run inside `document.startViewTransition` (`morph` in `workspace.tsx`). Each panel has its own `view-transition-name`, so the browser moves every frame from its old box to its new one. The CSS at the end of `base.css` sets `object-fit: none` on the transition images, so a frame's contents keep their scale while the frame crops or uncovers them, and the old and new pictures swap in the first 45% of the move. Durations come from the theme: 380 ms in Vellum, 560 ms in Orrery.

Every panel can be drawn at its place on the board, on the stage, or as a rail tile with a one-line summary (the `glance` prop). An agent composing a layout can rely on each element supporting all of them.

`workspace.tsx` holds the state shared across panels: the staged panel, the dossier trail, the open document, the brief, and a small command channel used by the buttons on the interaction sheet. Escape closes the stage first and the dossier second. The `/` key moves focus to search.

## Files

```
src/themes.ts            tokens, GPU style, motion table and interaction list
src/data.ts              the invented case file
src/workspace.tsx        shared state and the view-transition helper
src/tip.tsx              the tooltip layer
src/gpu/scene.ts         camera, layers, frame loop, buffer writers
src/gpu/network.ts       layouts and buffers for the network
src/gpu/map.ts           state outlines, dot grid, spikes, terrain
src/gpu/shaders/         WGSL
src/components/          one file per group of elements
src/styles/base.css      shared styles, a block per theme, then motion, interaction and layout transitions
references/              reference images
```

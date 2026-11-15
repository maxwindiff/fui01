# Theme specimens

This project holds the visual language for a browser app for analysing ties between companies and government: people, money, lobbying, events, documents. The page layout of the app is still open, so the work here is a specimen sheet. Each theme renders the same set of elements over the same invented case file, so the themes can be compared element by element.

```
npm install
npm run dev      # http://127.0.0.1:5183
```

Keys 1 to 6 switch themes. The theme id also goes in the URL hash, for example `#orrery`.

## Themes

| Key | Theme | Mode | Idea |
|---|---|---|---|
| 1 | Vellum | light | Graphite hairlines on drafting film, indigo for government, orange for money, serif reading text with margin notes. The network pulls apart into three stacked sheets of film. |
| 2 | Floe | light | A white massing model on a cool survey sheet with a dot grid. Panels have no frames, only a heavy rule under a numbered tab. Entities and states stand as white blocks under a low sun, with orange for money. |
| 3 | Console | light | A printed manual on cream grid paper: heavy grotesque titles and figures, thick rules, mustard tabs. The two GPU views are dark screens set into the page, drawn as stacks of flat-coloured cells at a fixed isometric angle. Small movements run in six steps. |
| 4 | Orrery | dark | Brass rings on lampblack, the subject at the centre, everything else placed by degree of separation. Ring plates step down from the centre and each entity stands on a stem. |
| 5 | Massif | dark | Glass panels with red corner brackets on basalt. The ground of the network rises where entities crowd together and is drawn as a field of lit points with depth of field. One red carries the money as glowing routes. |
| 6 | Phosphor | dark | A vector display with no fills: red frames, amber labels and money, green data. The network sits on a wire dome with the subject at the pole, and the states extrude as wire outlines. |

Floe, Console, Massif and Phosphor come from the reference folders `arctic`, `retro`, `terrain` and `crt`.

Panels are flat in every theme. Depth is used inside the two GPU views only, where it carries data, and each view has a control that returns it to a flat plan:

| Theme | Network | Map |
|---|---|---|
| Vellum | a sheet per sector | a spike per state |
| Floe | block height is weight in the case | block height is giving |
| Console | storeys are weight | storeys are giving, in four bands |
| Orrery | plate is degree of separation, stem is weight | plateau height is giving |
| Massif | ground height is the density of entities | ground height is giving, smoothed across state lines |
| Phosphor | latitude on the dome is degree of separation | outline height is giving |

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

The GPU layer draws four primitives as instanced geometry, with the data in storage buffers and one draw call per layer:

- `marks.wgsl`: node glyphs and terrain points as signed-distance shapes, with stroke, knockout fill and halo
- `segments.wgsl`: ties, rings, borders and wire outlines as capsules, with dashes that march, pulses that travel and an optional phosphor glow
- `quads.wgsl`: translucent sheets with a dot grid, and the cast shadows of blocks
- `boxes.wgsl`: solid blocks with flat shading per face and an outline

A scene is a list of named layers. A builder writes every kind of geometry it has, and a scene without a layer of that name skips the write, so a theme picks its look by the layers it declares and by `gpu` in `themes.ts`. The block themes are the only ones with solid geometry: their scenes add a depth buffer and 4x multisampling, clear to an opaque ground, and blend shadows with `min` so that overlapping shadows do not add up.

All four share `view.wgsl`: an orbit camera, defocus by distance from the focal plane, haze, and the entry reveal. A flat view is the same camera looking straight down with the heights scaled to zero. Each pair of arrangements (Flat and Strata, Plan and Massing, Scope and Dome and so on) turns into one another this way: the builder writes each node's height once, and a `lift` uniform scales it while the camera tips.

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

With 100,000 entities the block, relief and dome arrangements measured between 16.6 and 23 ms a frame in the same setup.

The production build is 195 kB of JavaScript and 24 kB of CSS after gzip, plus 31 kB for the state outlines, loaded on demand. Font files load only for the theme on screen.

## Motion

The top bar has four motion levels, kept in `localStorage` and defaulting to Still when the system asks for reduced motion.

| Level | What moves |
|---|---|
| Still | Nothing. Every change shows at once. |
| Quiet | Responses only: layout transitions, rows opening, sorted rows travelling, the camera gliding. |
| Standard | Adds entry. A panel draws itself when it first comes into view or onto the stage, money travels along its ties, and the 3D views sway slowly. |
| Lively | Adds movement at rest and on return. Money streams through the money flow, key marks pulse, figures count up, the sway widens, and a panel draws itself again each time it comes back into view. |

Changing level replays the entry of the panels on screen, so the levels can be compared on the spot. `motion.ts` holds the level. CSS reads it from `data-motion`, `data-entry` and `data-ambient` on the root, and the GPU code reads `motion.level`.

Each theme carries a motion table in `themes.ts` (`motion`), and the last panel on the sheet lists it. The frame animation differs by theme: Vellum wipes in from the left, Floe runs its header rule out from the tab, Console prints downward in steps, Orrery fades up under a sweeping tick scale, Massif closes its corner brackets, and Phosphor flickers on. Console sets `ease` to `steps(6, end)`, and layout transitions take `layoutEase` so that they stay smooth.

Entry is built like this:

- `Panel` watches itself with one shared `IntersectionObserver`. A panel stays hidden (`data-pending`) until it comes into view, then plays its frame animation once (`data-enter="frame"`). Panels that arrive together are staggered by their order in the batch.
- A panel that goes onto the stage plays only its content (`data-enter="content"`), after the layout transition has finished.
- The observer reports a panel as hidden while its own entry clips it to nothing, so the panel's box decides whether it is on screen.
- Dense charts (timeline, small multiples, the vote strip) wipe in as one piece with a `clip-path`. The money flow wipes from sources to recipients with a clip path on its ribbons, and each column lights as the wipe reaches it.
- Elements take a `--k` index for left-to-right stagger. `Count` counts a figure up at the Lively level.
- The GPU views start their reveal once the panel around them is no longer pending.
- At rest the only movement at Standard is money: dashes or pulses in the direction it moved. The 3D views sway, and the sway stops while the pointer is over the view.

## Interaction

The last panel also lists the interaction patterns, with a button beside most of them that carries the pattern out.

| Pattern | Where to try it | How it is built |
|---|---|---|
| Breadcrumb | Top bar | `Crumbs.tsx` reads the workspace: the case, the staged panel (or the panel under the middle of the viewport while the board scrolls), then the dossier trail. Each segment goes back to that level. |
| Tooltip | Any chart, entity name, issue code or icon button | `tip.tsx` holds one tooltip for the page. A chart calls `tip.show` with a point and gets an immediate readout. Any element with a `data-tip` attribute gets a text tooltip after 350 ms, and the wait is skipped for 600 ms after a tooltip closes. |
| Open a row | Filings table, document list, Open evidence on the finding | `Fold` animates a grid row from `0fr` to `1fr`, which leaves the height to CSS. |
| Sort | Column headings of the filings table | `useFlip` records each row's position before the reorder and plays a transform from the old position to the new one. |
| Full size | Corner button on any panel | The board sets `data-stage`. The staged panel takes the first column and the rest fold to tiles in a rail. Charts read `usePanel().staged` and draw taller. |
| Dossier | Any underlined entity name, a network node, a node in the money flow | `Inspector.tsx` is a drawer fixed to the right edge. The shell pads its right side by the drawer's width, and a container query moves a column from the wide panel of each pair to the narrow one when the board gets tight. |
| Linked marks | Small multiples, money flow, footnotes in the document, ranked states beside the map | Hover state held in the component and applied as classes. The money flow follows ribbons upstream and downstream from the mark under the pointer. |
| Measure | Drag across the timeline | A brush in the SVG, with counts recomputed from the data on each move. |
| Commit | Add to brief, Dismiss | The brief is a list in the workspace store, counted in the top bar. |

The two layout changes, staging a panel and opening the dossier, run inside `document.startViewTransition` (`morph` in `workspace.tsx`). Each panel has its own `view-transition-name`, so the browser moves every frame from its old box to its new one. The CSS at the end of `base.css` sets `object-fit: none` on the transition images, so a frame's contents keep their scale while the frame crops or uncovers them. Durations come from the theme: 380 ms in Vellum, 560 ms in Orrery.

Every panel can be drawn at its place on the board, on the stage, or as a rail tile with a one-line summary (the `glance` prop). An agent composing a layout can rely on each element supporting all of them.

### Keeping layout transitions cheap

- `workspace.tsx` is a small external store. Components read it through `useWs(selector)` and re-render only when their selection changes, so a change of stage re-renders the panel frames and the breadcrumb and leaves the charts alone. The update callback of a stage transition takes about 9 ms.
- While a transition runs, `gpuState.paused` stops the GPU views from drawing every frame. They draw once at their new size, and the network camera settles in place instead of gliding.
- Content entry waits for the transition to finish, so the two do not compete.
- The page avoids backdrop filters, blend modes over the whole viewport and filter animations, which are costly for a compositor that is already moving large layers.

`workspace.tsx` holds the state shared across panels: the staged panel, the dossier trail, the open document, the brief, the motion level, and a small command channel used by the buttons on the interaction sheet. Escape closes the dossier first and the stage second. The `/` key moves focus to search.

## Files

```
src/themes.ts            tokens, GPU style, motion table and interaction list
src/motion.ts            motion levels
src/panels.ts            panel titles
src/data.ts              the invented case file
src/workspace.tsx        shared store and the view-transition helper
src/tip.tsx              the tooltip layer
src/gpu/scene.ts         camera, layers, frame loop, buffer writers
src/gpu/network.ts       layouts and buffers for the network
src/gpu/map.ts           state outlines, dot grid, cell lattice, and the map arrangements
src/gpu/field.ts         height field for the relief arrangements
src/gpu/shaders/         WGSL
src/components/          one file per group of elements
src/styles/base.css      shared styles, a block per theme, then motion, interaction and layout transitions
references/              reference images, a folder per style
```

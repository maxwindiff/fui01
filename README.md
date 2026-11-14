# Theme specimens

This project holds the visual language for a browser app for analysing ties between companies and government: people, money, lobbying, events, documents. The page layout of the app is still open, so the work here is a specimen sheet. Each theme renders the same set of elements over the same invented case file, so the themes can be compared element by element.

```
npm install
npm run dev      # http://127.0.0.1:5183
```

Keys 1 to 4 switch themes. The theme id also goes in the URL hash, for example `#strata`.

## Themes

| Key | Theme | Mode | Space | Idea |
|---|---|---|---|---|
| 1 | Vellum | light | flat | Graphite hairlines on drafting film, indigo for government, orange for money, serif reading text with margin notes |
| 2 | Strata | light | depth | Vellum with the network pulled apart into three stacked sheets and the panels hung at a slight angle |
| 3 | Orrery | dark | flat | Brass rings on lampblack, the subject at the centre, everything else placed by degree of separation |
| 4 | Armillary | dark | depth | Orrery raised off the table: stepped ring plates, entities on stems, money arcing overhead |

Strata and Armillary inherit every token from Vellum and Orrery. They add a `deep` block for the camera and a different motion table, so a change to a family's palette or type carries to both of its themes.

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

All three share `view.wgsl`: an orbit camera, defocus by distance from the focal plane, haze, and the entry reveal. A flat view is the same camera looking straight down with the heights scaled to zero. That is how Flat and Strata, or Plan and Armillary, turn into one another: the builder writes each node's height once, and a `lift` uniform scales it while the camera tips.

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

In headless Chrome on this machine the network view held the 60 Hz frame interval (16.7 ms between frames) with 100,000 entities and 300,000 tie segments, in the flat themes and in the deep themes with defocus on. The frame interval is capped by the display, so this shows the absence of dropped frames and says nothing about headroom. The Graph size control in the network panel reruns the test.

The production build is 173 kB of JavaScript after gzip, plus 31 kB for the state outlines, loaded on demand.

## Motion

Each theme carries a motion table in `themes.ts` (`motion`), and the last panel on the sheet lists it with a Replay button. The rules behind it:

- Entry happens once, when a board mounts. Panels arrive in reading order, chart lines draw along their length, and the GPU views reveal ties from source to target.
- At rest the only movement is money: dashes or pulses travelling in the direction the money moved. The deep themes add a slow sway so depth reads through parallax, and the sway stops while the pointer is over the view.
- Changes of arrangement keep every node on screen and move the camera and the heights together.
- In the deep themes a panel under the pointer or holding focus turns flat, so reading and clicking happen on a flat surface.
- `prefers-reduced-motion` turns off entry, sway, tilt and travel.

## Files

```
src/themes.ts            tokens, GPU style and motion for the four themes
src/data.ts              the invented case file
src/gpu/scene.ts         camera, layers, frame loop, buffer writers
src/gpu/network.ts       layouts and buffers for the network
src/gpu/map.ts           state outlines, dot grid, spikes, terrain
src/gpu/shaders/         WGSL
src/components/          one file per group of elements
src/styles/base.css      shared styles, then one block per family and per deep theme
assets/                  reference images
```

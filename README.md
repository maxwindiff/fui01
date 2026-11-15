# fui01

A specimen sheet of themes for a browser app that analyses ties between companies and government. Every theme draws the same panels over the same invented case file.

## Start

```
npm install
npm run dev      # http://127.0.0.1:5183
npm run build    # type-check, then a production build in dist/
```

Keys 1 to 6 switch themes, and the theme id also goes in the URL hash, for example `#console`. The network and map panels need a browser with WebGPU. Without it they show a message and the rest of the page works.

## Rendering

Each kind of content is drawn with the lightest technology that can carry its mark count.

- **DOM** draws text, tables, documents and controls.
- **SVG** draws the charts, which have up to a few thousand marks.
- **WebGPU**, through [vgpu](https://vgpu.sh), draws the network and the map, where mark counts go into the hundreds of thousands.

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

The top bar sets a motion level from 0 to 3. `motion.ts` stores it in `localStorage` and starts at 0 when the system asks for reduced motion.

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

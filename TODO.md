# To do

## Revisit the heavier theme variants

The branch `theme-experiments` holds a second take on Floe, Massif and Phosphor. All three went too far and were rolled back on `main`. Parts of each may be worth bringing back in a quieter form.

- **Floe** as a tactile surface: ceramic plates on an aluminium deck, keys with travel and a lit dot, sunk trays for figures and charts, a motion knob. To decide: how much depth between background, panel and control reads as tactile without becoming heavy.
- **Massif** as a hologram: panels as sheets of cyan light, a backdrop of contour lines, fog and dust with parallax, contour lines and a projected volume in the relief views, live camera readouts, status lights in the title bars. To decide: which of the backdrop layers and readouts to keep, and whether any should go to other themes.
- **Phosphor** as a glowing tube: green phosphor with solid lit title bars and keys, bloom from an SVG filter, a pixel face for figures. Scanlines over the page hurt readability and should stay out. To decide: how to add glow and solid blocks without making it look like Console.

To look at a variant, run `git switch theme-experiments` and `npm install`, then start the dev server.

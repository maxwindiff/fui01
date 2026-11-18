import type { Review } from "../types";

export const medium: Review = {
  findings: [
    {
      id: "m1", at: "src/ask/board.ts@80:6", sev: "medium", title: "Saved Mark lenses come back as Dim",
      body: "restore() turns every saved mode except hide into dim. A reader with a saved Mark lens finds everything outside it faded on the next load, which changes the board more than Mark did. Loading Mark lenses as Dim but switched off (`on: false`) would keep the board as it looked.",
    },
    {
      id: "m2", at: "src/ask/board.ts@129:3", sev: "low", title: "The search keeps its Dim or Hide after it is cleared",
      body: "Nothing resets findMode. After pressing Hide on one search, clearing it and typing another hides the rest straight away. If that's not intended, reset findMode in clearSelection or when the search text empties.",
    },
    {
      id: "m3", at: "src/styles/base.css@1133:3", sev: "low", title: "The drawer covers most of the answers column",
      body: "At 1250px the 408px drawer covers nearly all of the answers column, so comparing a dossier with an answer means closing the drawer. The commit message says this is intended. Worth a look at narrower widths, where the drawer also covers part of the board.",
    },
    {
      id: "m4", at: "src/ask/records.ts@1:3", sev: "low", title: "records.ts now imports a value from board.ts",
      body: "Until now records.ts took only types from board.ts. board.ts imports nothing back, so there's no cycle, but FIND could live in scope.ts with the other shared names.",
    },
  ],
  flows: [
    {
      id: "find", title: "A search that dims or hides",
      steps: [
        { diagram: `sequenceDiagram
  actor R as Reader
  participant S as Scopes
  participant B as board
  participant L as useLenses
  participant P as panels and answers
  R->>S: type a search
  S->>B: select(from: find)
  R->>S: press Hide
  S->>B: setFindMode(hide)
  B-->>L: lenses, sel, findMode
  L-->>P: lenses + FIND
  P->>P: hide what FIND misses` },
        { text: "Typing in the search selects the matching records, marked as coming from the search.", code: { file: "src/ask/Scopes.tsx", text: "const ids = find(t);\nboard.select({ ids, label: `“${t}”`, from: \"find\" });" } },
        { text: "The selection chip offers Dim and Hide, but only for a search.", at: "src/ask/Scopes.tsx@53:16" },
        { text: "Pressing one sets findMode, and pressing it again clears it.", at: "src/ask/Scopes.tsx@53:19" },
        { text: "setFindMode stores the mode.", at: "src/ask/board.ts@129:3" },
        { text: "useLenses appends the search as a lens with the id FIND while a mode is set.", at: "src/ask/board.ts@103:9" },
        { text: "onLenses gives it the index -1, so it never gets a lens color.", at: "src/ask/records.ts@84:5" },
        { text: "Case panels leave it out of the outlines, but it still dims or hides.", at: "src/links.ts@10:13" },
        { text: "Answers skip lighting it, but it still narrows which marks stay lit.", at: "src/ask/Answers.tsx@173:5" },
      ],
    },
    {
      id: "keep", title: "Keeping a search as a lens",
      steps: [
        { text: "Enter in the search, or Keep on the chip, calls keepSelection.", code: { file: "src/ask/Scopes.tsx", text: "if (e.key === \"Enter\" && sel.from === \"find\" && sel.ids.length) { board.keepSelection(); setQ(\"\"); }" } },
        { text: "The new lens takes the search's mode, or Dim when none is set.", at: "src/ask/board.ts@187:4" },
        { text: "The lens chip offers Dim and Hide.", at: "src/ask/Scopes.tsx@53:3" },
      ],
    },
    {
      id: "dossier", title: "Opening a dossier",
      steps: [
        { text: "Selecting an entity name adds it to the dossier trail.", code: { file: "src/workspace.tsx", text: "inspect(id: string) {\n  const t = state.trail;\n  if (t[t.length - 1] === id) return;\n  if (t.length) set({ trail: [...t, id].slice(-6) });\n  else morph(() => set({ trail: [id] }));\n}," } },
        { text: "The shell no longer reads the trail, so the page keeps its width.", at: "src/App.tsx@69:7" },
        { text: "The drawer is fixed to the right, above the toolbar, with a shadow at every width.", at: "src/styles/base.css@1159:4" },
      ],
    },
    {
      id: "restore", title: "Loading saved lenses",
      steps: [
        { text: "Every saved lens becomes Dim unless it was Hide.", at: "src/ask/board.ts@80:6" },
        { text: "Lenses added later default to Dim.", at: "src/ask/board.ts@179:4" },
      ],
    },
  ],
  order: ["src/ask/board.ts", "src/ask/records.ts", "src/links.ts", "src/ask/Scopes.tsx", "src/ask/Answers.tsx", "src/App.tsx", "src/styles/base.css", "src/components/NetworkView.tsx", "src/gpu/network.ts", "README.md"],
  hunks: {
    "src/ask/Answers.tsx@173": {
      b: [
        [3, 4, "light_and_collect(hit, `ln${i}`);"],
        [5, 8, "if (l.id !== FIND) light_and_collect(hit, `ln${i}`);"],
        [11, 11, "e.light(any_lens_outlines() ? all : new Set(), \"ln\");"],
        [12, 12, "e.light(any_lens_outlines(except: FIND) ? all : new Set(), \"ln\");"],
      ],
    },
    "src/ask/Answers.tsx@429": {
      a: [
        [3, 9, "{revs.length > 1 && open ? (\n  <span className=\"ans-revs\"><button onClick={step(-1)}>‹</button>{rev + 1}/{revs.length}<button onClick={step(1)}>›</button></span>\n) : null}"],
        [10, 10, "<button className=\"panel-ask\" onClick={ask_about(card)}><AskIcon /></button>"],
        [11, 11, "{card.pinned ? null : <button onClick={pin}>Pin</button>}"],
        [12, 12, "<button className=\"ans-x\" onClick={remove}><X /></button>"],
        [15, 15, "<p className=\"ans-q\"><Question card={card} />{link_to_parent}{busy ? <Status /> : null}</p>"],
        [16, 22, "<p className=\"ans-q\"><Question card={card} />{revs.length > 1 && open ? (\n  <span className=\"ans-revs\"><button onClick={step(-1)}>‹</button>{rev + 1}/{revs.length}<button onClick={step(1)}>›</button></span>\n) : null}{link_to_parent}{busy ? <Status /> : null}</p>"],
        [25, 25, "{card.kind === \"chart\" ? <ChartBody /> : card.kind === \"stack\" ? <StackBody /> : <TextBody />}"],
      ],
      b: [
        [3, 9, "<VersionStepper />"],
        [10, 12, "<AskButton />{!card.pinned && <PinButton />}<RemoveButton />"],
        [15, 15, "<p className=\"ans-q\"><Question />{link_to_parent}{status}</p>"],
        [16, 22, "<p className=\"ans-q\"><Question /><VersionStepper />{link_to_parent}{status}</p>"],
        [25, 25, "<CardBody />"],
      ],
    },
    "src/ask/Scopes.tsx@53": {
      a: [
        [0, 0, "const drag = (s: Scope) => (e: DragEvent) => { put s on the drag data as JSON and text };"],
        [14, 14, "<button className=\"scope-name\" onClick={() => board.insert([scope])}>{sel.label}</button>"],
        [16, 22, "{sel.from === \"find\" ? (\n  <div className=\"seg\">\n    {MODES.map((o) => <button aria-pressed={findMode === o.value} onClick={() => board.setFindMode(findMode === o.value ? null : o.value)}>{o.label}</button>)}\n  </div>\n) : null}"],
        [24, 24, "<button className=\"ask-x\" onClick={() => board.clearSelection()}><X /></button>"],
      ],
      b: [
        [0, 0, "const drag = (s: Scope) => set_drag_data(s);"],
        [3, 6, "const MODES = [Dim, Hide];"],
        [14, 14, "<ScopeName />"],
        [16, 22, "{sel.from === \"find\" && <ModeButtons toggle={board.setFindMode} />}"],
        [23, 24, "<KeepButton /><ClearButton />"],
        [29, 33, "const MODES = [Mark, Dim, Hide];"],
      ],
    },
    "src/ask/board.ts@80": {
      a: [
        [4, 4, "if (saved) return { cards, lenses: lenses.map((l) => ({ ...l, mode: l.mode === \"only\" ? \"dim\" : l.mode })), layout };"],
        [6, 6, "if (saved) return { cards, lenses: lenses.map((l) => ({ ...l, mode: l.mode === \"hide\" ? \"hide\" : \"dim\" })), layout };"],
      ],
      b: [
        [0, 0, "layout = saved_layout() ?? layout;"],
        [3, 4, "if (saved) return { cards, lenses: rename_mode(lenses, \"only\" → \"dim\"), layout };"],
        [5, 6, "if (saved) return { cards, lenses: rename_mode(lenses, anything but \"hide\" → \"dim\"), layout };"],
      ],
    },
    "src/ask/board.ts@103": {
      a: [[9, 9, "return useMemo(() => (search_is_active && mode ? [...lenses, { id: FIND, name: sel.label, set: { ids: sel.ids }, mode, on: true }] : lenses), [lenses, sel, mode]);"]],
      b: [[5, 10, "export function useLenses(): Lens[] {\n  return search_is_active && findMode ? [...lenses, search_as_lens(findMode)] : lenses;\n}"]],
    },
    "src/ask/board.ts@187": {
      a: [[4, 4, "const lens: Lens = { id: newId(), name: sel.label, set: { ids: sel.ids }, mode: (from_search && state.findMode) || \"dim\", on: true };"]],
      b: [
        [3, 3, "const lens = selection_as_lens(\"mark\");"],
        [4, 4, "const lens = selection_as_lens((from_search && state.findMode) || \"dim\");"],
      ],
    },
    "src/ask/records.ts@84": {
      a: [[5, 5, "export const onLenses = (lenses: Lens[]) => lenses.flatMap((l, i) => (l.on ? [{ i: l.id === FIND ? -1 : i, mode: l.mode, ...prepare(l.set.ids) }] : []));"]],
      b: [
        [3, 3, "export const onLenses = (lenses) => the lenses that are on, each with its index i;"],
        [5, 5, "export const onLenses = (lenses) => the lenses that are on, each with its index i, or -1 for FIND;"],
      ],
    },
    "src/links.ts@10": {
      a: [
        [12, 12, "const root = [S && \"sel\", R && \"ref\", outline.length && \"ln\", L.some((l) => l.mode !== \"mark\") && \"keep\", L.some(hiding) && \"hide\"].join(\" \");"],
        [14, 14, "const root = [S && \"sel\", R && \"ref\", outline.length && \"ln\", L.length > 0 && \"keep\", L.some(hiding) && \"hide\"].join(\" \");"],
      ],
    },
    "src/components/NetworkView.tsx@502": {
      a: [[3, 6, "const change = (d: Density) => { setDensity(d); setModel(d === \"case\" ? case graph : stress graph of 5,000 or 100,000 nodes); };"]],
    },
    "src/components/NetworkView.tsx@526": {
      a: [
        [2, 2, "{deep ? <Segmented label=\"Arrangement\" options={[flat, deep]} /> : null}"],
        [3, 3, "<Segmented label=\"Graph size\" options={[\"Case file\", \"5,000\", \"100,000\"]} />"],
      ],
    },
    "src/gpu/network.ts@265": {
      a: [
        [7, 57, "export function buildStressModel(n: number, g: GpuStyle): NetModel {\n  // n nodes in about √n / 3 gaussian clusters on a golden-angle spiral, 1.2% of them hubs\n  // three ties per node, 96.5% inside its cluster: 7% money, 9% contact, the rest plain\n  return finish({\n    n, m: n * 3, x, y, radius, shape, sector, hollow, es, et, etype, ew,\n    ids: [], names: [], roles: [], labels: [], focus: -1, rings: [], half: half * 1.12, dense: true,"],
      ],
      b: [
        [7, 57, "export function buildStressModel(n: number, g: GpuStyle): NetModel {\n  return finish({\n    ...random_clustered_graph(n, ties_per_node: 3), dense: true,"],
      ],
    },
    "src/gpu/network.ts@353": {
      a: [
        [7, 7, "model.sheets.reverse().forEach((s, k) => quads.sheet(bounds + pad, s.z, film, ink, model.dense ? 0 : 26, …));"],
        [8, 8, "model.sheets.reverse().forEach((s, k) => quads.sheet(bounds + pad, s.z, film, ink, 26, …));"],
      ],
    },
    "src/gpu/network.ts@364": {
      a: [
        [4, 4, "quads.sheet(bounds + pad, 0, transparent, guide, model.dense ? 0 : 24, …);"],
        [6, 6, "quads.sheet(bounds + pad, 0, transparent, guide, 24, …);"],
        [8, 8, "for (const corner of the four corners)"],
      ],
    },
    "src/gpu/network.ts@446": {
      a: [
        [12, 16, "const [edgeC, contactC, moneyC] = tie colors, faded in dense graphs;\nconst bend = model.dense ? 0 : g.edge.curve, rise = stemmed && !model.dense ? 0.07 : 0;"],
        [17, 21, "const [edgeC, contactC, moneyC] = tie colors;\nconst bend = g.edge.curve, rise = stemmed ? 0.07 : 0;"],
      ],
      b: [
        [3, 3, "const stem = rgba(guide, model.dense ? 0.16 : …);"],
        [6, 6, "if ((model.dense && small(i)) || !fa(i)) continue;"],
        [12, 16, "const [edgeC, contactC, moneyC, bend, rise] = tie_style(g, form, model.dense);"],
        [17, 21, "const [edgeC, contactC, moneyC, bend, rise] = tie_style(g, form);"],
      ],
    },
    "src/gpu/network.ts@478": {
      a: [
        [3, 4, "? contact_stroke(k, width: g.contact.width * widthScale)\n: edge_stroke(k, width: g.edge.width * widthScale);"],
        [5, 6, "? contact_stroke(k, width: g.contact.width)\n: edge_stroke(k, width: g.edge.width);"],
        [12, 14, "const strong = (e) => model.dense || ew[e] >= 2;\nconst mw = (e) => model.dense ? 1 : money_width(e);\nconst lift = model.dense || grounded ? 0 : lift_for(form);"],
        [15, 17, "const strong = (e) => ew[e] >= 2;\nconst mw = (e) => money_width(e);\nconst lift = grounded ? 0 : lift_for(form);"],
      ],
      b: [
        [3, 4, "? contact_stroke(k, widthScale) : edge_stroke(k, widthScale);"],
        [5, 6, "? contact_stroke(k) : edge_stroke(k);"],
        [12, 14, "const [strong, mw, lift] = money_tie_style(g, form, model.dense);"],
        [15, 17, "const [strong, mw, lift] = money_tie_style(g, form);"],
        [21, 21, "const s: Stroke = { color, width: mw(e) * (strong(e) ? widthScale : 1), … };"],
        [22, 22, "const s: Stroke = { color, width: mw(e), … };"],
      ],
    },
    "src/gpu/network.ts@513": {
      a: [[0, 0, "if (!used.has(cell)) boxes.box(blank key at cx, cy);"]],
    },
    "src/gpu/network.ts@529": {
      a: [
        [5, 5, "writeMark(marks, c++, foot of i);"],
        [13, 13, "const own = focus block ? white : boxed && glyph ? glyph : colors[model.sector[i]];"],
        [18, 18, "writeMark(marks, c++, x[i], y[i], z[i], r, shape, col, stroke, knock, model.dense ? 0 : g.node.halo, …);"],
        [19, 19, "writeMark(marks, c++, x[i], y[i], z[i], r, shape, col, stroke, knock, g.node.halo, …);"],
      ],
    },
  },
  qa: [
    { q: "What happens if I hide with a search and then clear it?", a: "The marks come back, since useLenses adds the search only while the search has records. findMode stays set, though, so [the next search](src/ask/board.ts@129:3) hides the rest as soon as it matches anything." },
    { q: "Does anything else still call buildStressModel?", a: "No. NetworkView was the only caller, and [its import](src/components/NetworkView.tsx@2:3) goes in the same change. Nothing else reads `dense`, which [NetModel no longer has](src/gpu/network.ts@59:3)." },
    { q: "Why does the search lens get index -1?", a: "Lens colors are assigned by index (ln0 to ln3). The search is already shown as the selection, so [onLenses](src/ask/records.ts@84:5) gives it -1, and [links.ts](src/links.ts@10:13) leaves it out of the outlines. It still counts for dimming and hiding." },
  ],
};

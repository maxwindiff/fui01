import type { Review } from "../types";

export const small: Review = {
  findings: [
    {
      id: "s1", at: "tsconfig.tsbuildinfo@1:0", sev: "high", title: "Build cache committed",
      body: "tsconfig.tsbuildinfo is written by `tsc -b` and changes on every build, so it will show up in every later diff. Remove it from the commit and add `*.tsbuildinfo` to .gitignore.",
    },
    {
      id: "s2", at: "src/ask/Answers.tsx@618:4", sev: "medium", title: "Whole-case answers now depend on panel 02",
      body: "Answers about the whole case used to group under \"top\". They now group under \"02\", so in Below they render in the Person panel's slot. If that panel moves or is removed, those answers lose their slot. A named constant, or the first slot on the board, would make the dependency visible.",
    },
    {
      id: "s3", at: "src/ask/Answers.tsx@618:8", sev: "low", title: "Arrangement reads computed style",
      body: "cols() calls getComputedStyle for every group on every arrangement, which forces a style recalculation inside what is otherwise a pure placement pass. It works, and it keeps the 900px breakpoint in one place. Worth a note if arrangement ever runs per frame.",
    },
    {
      id: "s4", at: "src/themes.ts@895:4", sev: "low", title: "Phosphor gets 0.7, the others 0.65",
      body: "If the larger scale keeps Phosphor's halo readable, a short comment would say so. Otherwise it reads like a typo.",
    },
  ],
  flows: [
    {
      id: "remove", title: "Removing or pinning an answer",
      steps: [
        { text: "The header draws Pin only while the answer is unpinned.", at: "src/ask/Answers.tsx@435:11" },
        { text: "× is drawn for every answer and calls board.remove.", at: "src/ask/Answers.tsx@435:12" },
        {
          text: "board.remove drops the card. Its follow-ups stay and move up to the removed card's parent.",
          code: { file: "src/ask/board.ts", text: "const cards = state.cards.filter((c) => c.id !== id).map((c) => (c.from === id ? { ...c, from: gone?.from ?? null, near: gone?.near, y: gone?.y } : c));\nset({ cards, focus: state.focus === id ? null : state.focus, sel: state.sel.from === id ? NONE : state.sel });" },
        },
        { diagram: `flowchart LR
  subgraph Before
    a1[answer] --> b1[removed answer] --> c1[follow-up]
  end
  subgraph After
    a2[answer] --> c2[follow-up]
  end` },
      ],
    },
    {
      id: "below", title: "Placing answers in Below",
      steps: [
        { diagram: `sequenceDiagram
  participant A as useArrange
  participant S as slot in the DOM
  participant F as foldFor
  A->>A: group answers by root panel
  A->>S: getComputedStyle: columns
  S-->>A: 1 or 2
  A->>F: limit = 0.85 × window × columns
  F-->>A: which answers fold` },
        { text: "Each answer belongs to the panel its first question was about. Answers about the whole case now go to panel 02.", at: "src/ask/Answers.tsx@618:4" },
        { text: "For each slot, cols reads how many grid columns it has, at most two.", at: "src/ask/Answers.tsx@618:8" },
        { text: "A group may fill 85% of the window height per column before older answers fold.", at: "src/ask/Answers.tsx@618:9" },
        { text: "The slot grid has two columns, and one below 900px.", at: "src/styles/base.css@678:4" },
      ],
    },
    {
      id: "nodes", title: "Sizing network nodes",
      steps: [
        { text: "Each theme sets node.scale in its GPU style.", at: "src/themes.ts@199:4" },
        {
          text: "buildNetBuffers multiplies each node's radius by the scale, except in block themes, where blocks set the size.",
          code: { file: "src/gpu/network.ts", text: "const r = model.radius[i] * (boxed ? g.node.scale : blk ? 1 : g.node.scale);" },
        },
      ],
    },
  ],
  order: ["src/ask/Answers.tsx", "src/styles/base.css", "src/themes.ts", "tsconfig.tsbuildinfo"],
  hunks: {
    "src/ask/Answers.tsx@435": {
      a: [
        [2, 2, "<button className=\"panel-ask\" onClick={ask_about(card)}><AskIcon /></button>"],
        [3, 10, "{card.pinned ? (\n  <button className=\"ans-x\" onClick={remove}><X /></button>\n) : (\n  <><button onClick={remove}>Discard</button><button onClick={pin}>Pin</button></>\n)}"],
        [11, 11, "{card.pinned ? null : <button onClick={pin}>Pin</button>}"],
        [12, 12, "<button className=\"ans-x\" onClick={remove}><X /></button>"],
        [15, 15, "<p className=\"ans-q\"><Question card={card} />{link_to_parent}{status}</p>"],
      ],
      b: [
        [2, 2, "<AskButton />"],
        [3, 10, "{card.pinned ? <RemoveButton /> : <><DiscardButton /><PinButton /></>}"],
        [11, 12, "{!card.pinned && <PinButton />}\n<RemoveButton />"],
        [15, 15, "<p className=\"ans-q\">…</p>"],
      ],
    },
    "src/ask/Answers.tsx@618": {
      a: [
        [0, 0, "if (layout === \"column\") groups = [{ ids: all, top: 0, limit: column height - 8 }];"],
        [3, 3, "const root = (o: Placed) => parentOf(o) ? root(parentOf(o)) : anchorOf(o) ?? \"top\";"],
        [4, 4, "const root = (o: Placed) => parentOf(o) ? root(parentOf(o)) : anchorOf(o) ?? \"02\";"],
        [5, 5, "for (const o of order) by[root(o)].push(o.id);"],
        [8, 8, "const cols = (fig: string) => Math.min(2, gridColumns(`[data-slot=\"${fig}\"]`) ?? 1);"],
      ],
      b: [
        [0, 0, "if (layout === \"column\") groups = [all_answers_in_one_group()];"],
        [3, 3, "const root = (o) => anchor_of_first_question(o) ?? \"top\";"],
        [4, 4, "const root = (o) => anchor_of_first_question(o) ?? \"02\";"],
        [5, 5, "const by = group_answers_by(root);"],
        [6, 6, "groups = by.map((g) => ({ ids: g, limit: 0.85 * innerHeight }));"],
        [7, 9, "const cols = (fig) => slot_column_count(fig); // 1 or 2\ngroups = by.map(([fig, g]) => ({ ids: g, limit: 0.85 * innerHeight * cols(fig) }));"],
      ],
    },
    "src/styles/base.css@678": {
      a: [[1, 2, "/* Layouts: Column and Below */"]],
      b: [
        [1, 2, "/* Layouts: Column and Below */"],
        [3, 3, ".ans-slot { display: grid; }"],
        [4, 5, ".ans-slot { display: grid; grid-template-columns: 1fr 1fr; } /* 1fr under 900px */"],
        [6, 8, ""],
      ],
    },
    "src/themes.ts@199": {
      a: [[0, 2, "edge: {…}, money: {…}, contact: {…},"], [5, 7, "focus: {…}, guide: {…}, map: {"]],
      b: [[0, 2, ""], [3, 3, "node: { …, scale: 1 },"], [4, 4, "node: { …, scale: 0.65 },"], [5, 7, ""]],
    },
    "src/themes.ts@340": {
      a: [[0, 2, "edge: {…}, money: {…}, contact: {…},"], [5, 7, "focus: {…}, guide: {…}, map: {"]],
      b: [[0, 2, ""], [3, 3, "node: { …, scale: 1 },"], [4, 4, "node: { …, scale: 0.65 },"], [5, 7, ""]],
    },
    "src/themes.ts@762": {
      a: [[0, 2, "edge: {…}, money: {…}, contact: {…},"], [5, 7, "focus: {…}, guide: {…}, map: {"]],
      b: [[0, 2, ""], [3, 3, "node: { …, scale: 1 },"], [4, 4, "node: { …, scale: 0.65 },"], [5, 7, ""]],
    },
    "src/themes.ts@895": {
      a: [[0, 2, "edge: {…}, money: {…}, contact: {…},"], [5, 7, "focus: {…}, guide: {…}, map: {"]],
      b: [[0, 2, ""], [3, 3, "node: { …, scale: 1.05 },"], [4, 4, "node: { …, scale: 0.7 },"], [5, 7, ""]],
    },
    "tsconfig.tsbuildinfo@1": { a: [[0, 0, ""]] },
  },
  qa: [
    { q: "Why does the fold limit depend on the number of columns?", a: "Answers in a two-column slot share rows, so the slot holds about twice as many before it runs past the window. [cols](src/ask/Answers.tsx@618:8) reads the slot's column count and [the limit](src/ask/Answers.tsx@618:9) multiplies by it. Without that, Below would fold answers that still fit." },
    { q: "What happens to follow-ups when I remove an answer?", a: "They stay. board.remove moves each follow-up up to the removed answer's parent, and they keep their place. The × change only makes removal reachable on pinned answers." },
    { q: "Does this change Floe and Console?", a: "No. Both draw blocks, and buildNetBuffers sizes blocks by the block width, so their node scale is untouched." },
  ],
};

import type { Review } from "../types";

export const large: Review = {
  findings: [
    {
      id: "l1", at: "src/main.tsx@1:12", sev: "medium", title: "The reduced-motion default becomes permanent after one visit",
      body: "main.tsx calls applyMotionLevel on startup, and [applyMotionLevel saves the level](src/motion.ts@1:31). Since [initial()](src/motion.ts@1:14) prefers a saved value, a reader who opens the page once with reduced motion on keeps Still after turning it off, and the other way round. Saving only in ws.setLevel would keep the system setting as the default until the reader picks a level.",
    },
    {
      id: "l2", at: "src/components/primitives.tsx@236:12", sev: "medium", title: "Count shows the final figure, then drops to zero",
      body: "Count starts at `to`. When plays changes, the first frames fall inside the 300 ms delay, where t is 0, so the figure jumps from its final value to 0 before counting up. Setting v to 0 when the count starts, or holding the value until t > 0, would remove the flash.",
    },
    {
      id: "l3", at: "src/styles/base.css@718:15", sev: "low", title: "The reduced-motion media query overrides the chosen level",
      body: "The `prefers-reduced-motion` block still turns off every CSS animation and transition. On a machine with reduced motion, a reader who picks Lively gets GPU motion and count-ups but no CSS entry, so the levels mean something different there. The level already defaults from the system setting, so the media query could go.",
    },
    {
      id: "l4", at: "src/components/Crumbs.tsx@1:34", sev: "low", title: "Crumbs re-renders on every store change",
      body: "Crumbs calls useWorkspace, which selects the whole state. It re-renders on brief, command and replay changes, which the store was built to avoid. Selecting stage and trail with useWs would do.",
    },
  ],
  flows: [
    {
      id: "level", title: "Changing the motion level",
      steps: [
        { text: "The control calls ws.setLevel with the new level.", at: "src/App.tsx@38:37" },
        { text: "setLevel applies the level, then bumps replays.", at: "src/workspace.tsx@1:115" },
        { text: "applyMotionLevel keeps the level in motion.level for code outside React, sets three attributes on the root, saves the level and calls the listeners.", at: "src/motion.ts@1:25" },
        { text: "The GPU scenes listen, and wake to redraw.", at: "src/gpu/scene.ts@61:7" },
        { text: "Each panel on screen sees replays change and plays its entry again.", at: "src/components/primitives.tsx@117:85" },
        { text: "CSS keys entry and ambient motion off the attributes on the root.", at: "src/styles/base.css@544:17" },
      ],
      seq: {
        parts: ["Reader", "MotionControl", "ws", "motion.ts", "GPU scenes", "Panel"],
        msgs: [[0, 1, "pick Lively"], [1, 2, "setLevel(3)"], [2, 3, "applyMotionLevel(3)"], [3, 3, "root attributes, localStorage"], [3, 4, "wakeScenes()"], [2, 5, "replays + 1"], [5, 5, "arm(\"frame\")"]],
      },
    },
    {
      id: "entry", title: "A panel coming into view",
      steps: [
        { text: "At Standard and Lively a panel starts pending, which CSS draws at opacity 0.", at: "src/components/primitives.tsx@117:37" },
        { text: "One IntersectionObserver serves every panel. Panels reported in the same batch get consecutive order numbers.", at: "src/components/primitives.tsx@117:13" },
        { text: "On first sight, arm sets data-enter on the next frame, with the order as the stagger index.", at: "src/components/primitives.tsx@117:52" },
        { text: "CSS animates the frame and then its marks, delayed by the panel's index and each mark's --k.", at: "src/styles/base.css@544:30" },
        { text: "At Lively, figures count up when the panel plays.", at: "src/components/primitives.tsx@236:4" },
        { text: "The GPU reveal waits until the panel is no longer pending.", at: "src/gpu/scene.ts@144:20" },
      ],
    },
    {
      id: "stage", title: "Staging a panel",
      steps: [
        { text: "setStage remembers the scroll position and calls morph.", at: "src/workspace.tsx@1:81" },
        { text: "morph pauses the GPU views and starts a view transition.", at: "src/workspace.tsx@1:47" },
        { text: "While paused, the network camera jumps to its new pose instead of gliding.", at: "src/components/NetworkView.tsx@70:6" },
        { text: "The frame loop stops advancing the travel clock.", at: "src/gpu/scene.ts@61:17" },
        { text: "When the transition finishes, the last running morph resumes and wakes the scenes.", at: "src/workspace.tsx@1:49" },
        { text: "The staged panel plays its content entry.", at: "src/components/primitives.tsx@117:89" },
      ],
      seq: {
        parts: ["Panel", "ws", "morph", "GPU", "browser"],
        msgs: [[0, 1, "setStage(fig)"], [1, 2, "change, after"], [2, 3, "paused = true"], [2, 4, "startViewTransition"], [4, 2, "finished"], [2, 3, "paused = false, wake"], [0, 0, "arm(\"content\")"]],
      },
    },
    {
      id: "store", title: "Reading the workspace",
      steps: [
        { text: "State lives in a module variable, and set notifies every subscriber.", at: "src/workspace.tsx@1:21" },
        { text: "useWs subscribes with a selector, so a component re-renders only when its slice changes.", at: "src/workspace.tsx@1:31" },
        { text: "Panel reads stage and replays through selectors.", at: "src/components/primitives.tsx@117:32" },
        { text: "Crumbs still reads the whole state through useWorkspace.", at: "src/components/Crumbs.tsx@1:34" },
      ],
    },
  ],
  order: [
    "src/motion.ts", "src/workspace.tsx", "src/main.tsx", "src/components/primitives.tsx", "src/gpu/scene.ts", "src/components/NetworkView.tsx",
    "src/components/MapView.tsx", "src/App.tsx", "src/components/Crumbs.tsx", "src/panels.ts", "src/styles/base.css", "src/components/Charts.tsx",
    "src/components/Person.tsx", "src/components/Records.tsx", "src/components/Timeline.tsx", "src/components/Controls.tsx", "src/components/Inspector.tsx",
    "src/components/Motion.tsx", "src/themes.ts", "README.md",
  ],
  hunks: {
    "README.md@70": {
      b: [
        [6, 9, "- (four rules: entry once per board, money at rest, arrangement changes, reduced motion)"],
        [10, 15, "| Level | What moves |  (Still, Quiet, Standard, Lively)"],
        [21, 27, "- (seven notes: the shared observer, stage entry, wipes, --k and Count, the GPU reveal, rest)"],
      ],
    },
    "README.md@105": {
      b: [[14, 17, "- (four notes: the store with selectors, paused GPU views, entry after the transition, no costly filters)"]],
    },
    "src/App.tsx@1": { b: [[5, 8, "import { Panel, Segmented }, { Crumbs }, { MOTION_LEVELS }, { PANEL_TITLES };"]] },
    "src/App.tsx@16": {
      a: [[13, 13, "<p className=\"note\">{Light or Dark} theme. Drawn from: {theme.lineage}. All names and figures … invented.</p>"]],
      b: [[10, 14, "<div><h1>{theme.name}</h1><p>{theme.concept}</p><p className=\"note\">{mode and lineage}</p></div>"]],
    },
    "src/App.tsx@30": {
      a: [
        [3, 3, "<li><span className=\"note\">{t.family}, {t.role.toLowerCase()}</span><p style={font of t}>{t.sample}</p></li>"],
        [4, 4, "<li><span className=\"note\">{t.family}</span><p style={font of t}>{t.sample}</p></li>"],
      ],
    },
    "src/App.tsx@38": {
      a: [
        [12, 12, "<li><span>{item}</span><button onClick={() => ws.toggleBrief(item)}>Remove</button></li>"],
        [22, 29, "function BriefButton() {\n  const count = useWs((s) => s.brief.length);\n  return <button className=\"brief\" popoverTarget=\"brief-list\">Brief <b>{count}</b></button>;\n}"],
        [31, 42, "function MotionControl() {\n  const level = useWs((s) => s.level);\n  return <Segmented label=\"Motion\" value={level} onChange={(v) => ws.setLevel(+v)} options={MOTION_LEVELS} />;\n}"],
        [49, 58, "function Frame({ children }: { children: ReactNode }) {\n  const stage = useWs((s) => s.stage), inspecting = useWs((s) => s.trail.length > 0);\n  return <div className=\"shell\" data-inspect={inspecting}><main className=\"board\" data-stage={stage}>{children}</main><footer /></div>;\n}"],
      ],
      b: [
        [22, 58, "function BriefButton() { return <button>Brief {brief.length}</button>; }\nfunction MotionControl() { return <Segmented options={MOTION_LEVELS} value={level} onChange={ws.setLevel} />; }\nfunction DocGlance() { return title_of(doc); }\nfunction Frame({ children }) { return <div className=\"shell\"><main className=\"board\">{children}</main></div>; }"],
        [60, 66, "const act = (command: string) => run_demo(command); // stage, dossier, brush or a table command\nconst replay = () => { ws.setStage(null); scrollTo top; ws.replay(); };"],
        [73, 76, "const ws = useWorkspace();\nconst [run, setRun, boardKey, entered, setEntered] = entry_replay_state();"],
      ],
    },
    "src/App.tsx@116": {
      b: [
        [3, 8, "// entry animations stop 4 s after a board appears\nuseEffect(() => mark_entered(boardKey, after: 4000), [boardKey]);"],
        [13, 14, "ws.stage ? ws.setStage(null) : ws.closeInspector();"],
        [15, 17, "trail.length ? ws.closeInspector() : stage && ws.setStage(null);"],
      ],
    },
    "src/App.tsx@131": {
      b: [[5, 11, "const act = (command: string) => run_demo(command);\nconst giving = sum(STATE_GIVING);"]],
    },
    "src/App.tsx@143": {
      a: [
        [3, 15, "<nav className=\"switcher\">\n  {THEMES.map((t, i) => <button onClick={() => setId(t.id)}><kbd>{i + 1}</kbd><Swatch t={t} />{t.name}<span>{t.mode}</span></button>)}\n  <p>Keys 1 and 2 switch themes. Esc steps back.</p>\n  <button className=\"brief\" popoverTarget=\"brief-list\">Brief <b>{ws.brief.length}</b></button>\n</nav>"],
        [16, 28, "<header className=\"switcher\">\n  <div className=\"themes\">{THEMES.map((t, i) => <button className=\"theme-btn\" data-tip={`key ${i + 1}`} onClick={() => setId(t.id)}><Swatch t={t} />{t.name}</button>)}</div>\n  <Crumbs />\n  <MotionControl />\n  <BriefButton />\n</header>"],
        [30, 51, "<div className=\"shell\" data-inspect={ws.trail.length > 0}>\n  <main className=\"board\" key={boardKey} data-stage={ws.stage} data-entering={entered !== boardKey}>\n    <Masthead theme={theme} />\n    {/* panels 01 to 13, titles written out */}\n    <Panel fig=\"14\" title=\"Controls\"><Controls /></Panel>\n    <Panel fig=\"15\" title=\"Motion and interaction\"><MotionSheet onRun={act} onReplay={() => { ws.setStage(null); scrollTo top; setRun((n) => n + 1); }} /></Panel>\n  </main>\n</div>"],
        [52, 69, "<Frame key={theme.id}>\n  <Masthead theme={theme} />\n  {/* panels 01 to 13, titles from PANEL_TITLES, panel 12's glance is <DocGlance /> */}\n  <Panel fig=\"14\" title={T[\"14\"]}><Controls /></Panel>\n  <Panel fig=\"15\" title={T[\"15\"]}><MotionSheet onRun={act} onReplay={replay} /></Panel>\n</Frame>"],
        [74, 81, "export function App() { return <WorkspaceProvider><Sheet /></WorkspaceProvider>; }"],
      ],
      b: [
        [3, 15, "<nav className=\"switcher\"><ThemeButtons /><KeyHint /><BriefButton /></nav>"],
        [16, 28, "<header className=\"switcher\"><ThemeButtons /><Crumbs /><MotionControl /><BriefButton /></header>"],
        [30, 51, "<div className=\"shell\"><main className=\"board\" key={boardKey}>{masthead and panels 01 to 15}</main></div>"],
        [52, 69, "<Frame key={theme.id}>{masthead and panels 01 to 15}</Frame>"],
        [74, 81, "export function App() { return <WorkspaceProvider><Sheet /></WorkspaceProvider>; }"],
      ],
    },
    "src/components/Charts.tsx@63": {
      a: [
        [3, 3, "<circle className=\"c-dot\" cx={x(i)} cy={y(v)} r={i === peak ? 3.4 : 1.7} />"],
        [4, 4, "<circle style={{ \"--k\": i }} className=\"c-dot\" cx={x(i)} cy={y(v)} r={i === peak ? 3.4 : 1.7} />"],
      ],
    },
    "src/components/Charts.tsx@151": {
      a: [
        [1, 1, "{at >= 0 ? <span className=\"mult-at\">{month(at)} {m.data[at]}</span> : <b>{total}</b>}"],
        [3, 3, "<svg viewBox={…} preserveAspectRatio=\"none\" onPointerMove={move} onPointerLeave={() => setAt(-1)}>"],
        [4, 4, "<svg className=\"wipe\" viewBox={…} preserveAspectRatio=\"none\" onPointerMove={move} onPointerLeave={() => setAt(-1)}>"],
        [7, 7, "<rect className=\"mult…\" x={i * 4 + 0.5} y={max - v} width={3} height={v} />"],
        [8, 8, "<rect style={{ \"--k\": i }} className=\"mult…\" x={i * 4 + 0.5} y={max - v} width={3} height={v} />"],
      ],
    },
    "src/components/Charts.tsx@224": {
      a: [
        [2, 2, "<svg width={w} height={H} data-probing={lit !== null} role=\"img\">"],
        [7, 7, "<text className=\"c-label\" x={column x} textAnchor={c === 0 ? \"end\" : \"start\"}>{label}</text>"],
        [8, 8, "<text className=\"c-label flow-head\" style={{ \"--col\": c }} x={column x} textAnchor={c === 0 ? \"end\" : \"start\"}>{label}</text>"],
      ],
      b: [[3, 5, "<clipPath id=\"flow-wipe\"><rect className=\"flow-wipe\" /></clipPath>"]],
    },
    "src/components/Charts.tsx@245": {
      a: [[12, 12, "<g className=\"flow-node …\" …>"]],
      b: [[3, 5, "{ribbons.map((rb) => <path className=\"flow-stream\" d={rb.mid} />)}"]],
    },
    "src/components/Controls.tsx@66": {
      a: [[3, 5, "<p className=\"note\">{needle ? `${n} entities, ${n} documents and ${n} filings match.` : \"Press / from anywhere …\"}</p>"]],
    },
    "src/components/Controls.tsx@159": {
      a: [
        [3, 5, "<div><dt>Lobbying, 2025</dt><dd><b>$9.39M</b><Spark /></dd></div>\n<div><dt>To subcommittee</dt><dd><b>$2.71M</b><Spark /></dd></div>\n<div><dt>Contacts logged</dt><dd><b>214</b><Spark /></dd></div>"],
        [6, 8, "<div><dt>Lobbying, 2025</dt><dd><b><Count to={9390} fmt={fmtMoney} /></b><Spark /></dd></div>\n<div><dt>To subcommittee</dt><dd><b><Count to={2710} fmt={fmtMoney} /></b><Spark /></dd></div>\n<div><dt>Contacts logged</dt><dd><b><Count to={214} /></b><Spark /></dd></div>"],
      ],
      b: [
        [3, 5, "{readouts: $9.39M, $2.71M, 214}"],
        [6, 8, "{readouts: <Count to={9390} />, <Count to={2710} />, <Count to={214} />}"],
      ],
    },
    "src/components/Crumbs.tsx@1": {
      a: [
        [11, 19, "const update = () => {\n  raf = 0;\n  setSection(the [data-panel] crossing 40% of the window height ?? \"\");\n};"],
        [21, 28, "update();\non scroll and resize: queue();\nreturn () => { cancelAnimationFrame(raf); remove the listeners; };"],
      ],
      b: [
        [5, 31, "// The panel under the middle of the viewport, which the breadcrumb names while the board scrolls.\nfunction useSection(active: boolean) {\n  return panel_crossing_40_percent_line(); // tracked on scroll and resize while active\n}"],
        [39, 59, "return (\n  <nav className=\"crumbs\">\n    <button onClick={ws.home}>Whitcombe case</button>\n    {fig && <button onClick={ws.stage ? ws.closeInspector : () => ws.reveal(fig)}>{PANEL_TITLES[fig]}</button>}\n    {ws.trail.map((id, i) => <button onClick={() => ws.jump(i)}>{entity(id).name}</button>)}\n  </nav>\n);"],
      ],
    },
    "src/components/Inspector.tsx@21": {
      a: [
        [3, 11, "<ol className=\"trail\">\n  {ws.trail.map((t, i) => <li>{i < last ? <button onClick={() => ws.jump(i)}>{name of t}</button> : <span>{name of t}</span>}</li>)}\n</ol>"],
        [12, 12, "<p className=\"insp-kind\"><Glyph />{Government, Company side, Intermediary or Event}</p>"],
        [19, 19, "<p className=\"insp-kind\"><Glyph />{Government, Company side, Intermediary or Event}</p>"],
      ],
      b: [
        [3, 11, "<Trail />"],
        [12, 12, "<Kind />"],
        [19, 19, "<Kind />"],
      ],
    },
    "src/components/Inspector.tsx@52": {
      a: [[3, 3, "{g.minor ? <p className=\"sub\">{\"and \"}{g.minor} minor ties to background entities</p> : null}"]],
    },
    "src/components/MapView.tsx@42": {
      a: [
        [3, 3, "const sway = deep && on && !reducedMotion ? deep.sway * 0.5 * wave(idle) : 0;"],
        [4, 4, "const sway = deep && on && motion.level >= 2 ? deep.sway * (motion.level === 3 ? 0.9 : 0.5) * wave(idle) : 0;"],
      ],
    },
    "src/components/MapView.tsx@209": {
      a: [
        [3, 3, "<li className={lit === code ? \"on\" : \"\"} onPointerEnter={() => light(code)} onPointerLeave={() => light(null)}>"],
        [4, 4, "<li style={{ \"--k\": rank * 2 }} className={lit === code ? \"on\" : \"\"} onPointerEnter={() => light(code)} onPointerLeave={() => light(null)}>"],
      ],
    },
    "src/components/MapView.tsx@218": {
      a: [[3, 3, "<li className=\"key-dots\"><Dots />{key text for armillary, strata or flat}</li>"]],
    },
    "src/components/NetworkView.tsx@222": {
      a: [
        [6, 6, "s.cam.yaw = this.restYaw + this.deep.sway * wave(this.idle);"],
        [7, 7, "s.cam.yaw = this.restYaw + this.deep.sway * (motion.level === 3 ? 1.8 : 1) * wave(this.idle);"],
      ],
    },
    "src/components/NetworkView.tsx@462": {
      a: [
        [7, 7, "{deep ? <Segmented label=\"Arrangement\" options={[flat, deep]} /> : null}"],
        [8, 8, "{deep ? <Segmented label=\"Arrangement\" options={[flat with tip, deep with tip]} /> : null}"],
        [9, 9, "<Segmented label=\"Graph size\" options={[\"Case file\", \"5,000\", \"100,000\"]} />"],
        [24, 24, "{readout.id && inspected !== readout.id ? <button onClick={() => ws.inspect(readout.id)}>Open dossier</button> : null}"],
      ],
    },
    "src/components/Person.tsx@118": {
      a: [
        [3, 3, "<g className={`seat party-${s.party}`} data-tip={…}>"],
        [4, 4, "<g style={{ \"--k\": i }} className={`seat party-${s.party}`} data-tip={…}>"],
      ],
    },
    "src/components/Person.tsx@131": {
      a: [
        [3, 3, "<svg className=\"votes\" viewBox={…} role=\"img\">"],
        [4, 4, "<svg className=\"votes wipe\" viewBox={…} role=\"img\">"],
        [7, 7, "<g data-tip={`Vote ${i + 1}: …`}>"],
        [8, 8, "<g style={{ \"--k\": i }} data-tip={`Vote ${i + 1}: …`}>"],
      ],
    },
    "src/components/Person.tsx@157": {
      a: [[2, 2, "<p className=\"seat-count\">D 9, I 1, R 11</p>"]],
    },
    "src/components/Records.tsx@102": {
      a: [
        [3, 3, "<div className=\"gt-item\" data-flip={f.id} data-open={isOpen}>"],
        [4, 4, "<div className=\"gt-item\" style={{ \"--k\": index * 2 }} data-flip={f.id} data-open={isOpen}>"],
      ],
    },
    "src/components/Records.tsx@241": {
      a: [
        [0, 0, "{first four entities of d.about as <Ent />}"],
        [3, 3, "<button disabled={d.id === ws.doc} onClick={() => ws.openDoc(d.id)}>{shown ? \"Shown in the document panel\" : \"Open document\"}</button>"],
        [4, 4, "<button disabled={d.id === current} onClick={() => ws.openDoc(d.id)}>{shown ? \"Shown in the document panel\" : \"Open document\"}</button>"],
      ],
    },
    "src/components/Timeline.tsx@91": {
      a: [
        [11, 11, "<svg width={w} height={H} role=\"img\" aria-label=\"Timeline of …\">"],
        [12, 12, "<svg className=\"wipe\" width={w} height={H} role=\"img\" aria-label=\"Timeline of …\">"],
      ],
    },
    "src/components/Timeline.tsx@125": {
      a: [
        [3, 3, "<rect className=\"tl-contact…\" x={…} y={…} width={2.5} height={…} />"],
        [4, 4, "<rect style={{ \"--k\": i }} className=\"tl-contact…\" x={…} y={…} width={2.5} height={…} />"],
      ],
    },
    "src/components/primitives.tsx@1": {
      b: [[1, 1, "import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState };"]],
    },
    "src/components/primitives.tsx@103": {
      a: [
        [3, 3, "<rect className={i === peak ? \"spark-peak\" : \"spark-bar\"} x={…} y={py(v)} width={bw} height={…} />"],
        [4, 4, "<rect className={i === peak ? \"spark-bar spark-peak\" : \"spark-bar\"} style={{ \"--k\": i }} x={…} y={py(v)} width={bw} height={…} />"],
      ],
    },
    "src/components/primitives.tsx@117": {
      a: [
        [35, 42, "const el = useRef<HTMLElement>(null);\nconst [enter, pending, order, plays] = useState(…); // null, motion.level >= 2, 0, 0\nconst st = useRef({ seen: false, visible: false, tile, staged, timer: 0, raf: 0 }); // tile and staged kept current"],
        [96, 96, "const style = { \"--span\": span, \"--span-tight\": tight, viewTransitionName, \"--i\": parseInt(fig, 10) };"],
        [97, 97, "const style = { \"--span\": span, \"--span-tight\": tight, viewTransitionName, \"--i\": order };"],
        [99, 99, "<section className=\"panel…\" data-panel={fig} style={style} onClick={tile ? () => ws.setStage(fig) : undefined}>"],
        [100, 104, "<section ref={el} className=\"panel…\" data-panel={fig} style={style} data-enter={enter} data-pending={pending && !enter} onClick={tile ? () => ws.setStage(fig) : undefined}>"],
      ],
      b: [
        [7, 20, "// One observer serves every panel, so panels that come into view together arrive in the same batch and can be staggered.\nfunction watch(el, fn) { observe el with the shared IntersectionObserver; fn(visible, order in batch); }"],
        [35, 42, "const el = useRef<HTMLElement>(null);\nconst [enter, pending, order, plays] = useState(…); // null, motion.level >= 2, 0, 0\nconst st = useRef({ seen: false, visible: false, tile, staged, timer: 0, raf: 0 }); // tile and staged kept current"],
        [44, 59, "const arm = (kind: \"frame\" | \"content\", k: number) => {\n  if (motion.level < 2) return;\n  st.seen = true;\n  restart_entry_next_frame(kind, order: k); // sets data-enter, clears it after 5.2 s\n};"],
        [61, 65, "const onscreen = () => box_intersects_window(el);"],
        [67, 78, "useEffect(() => watch(el, (hit, k) => {\n  const on = hit || onscreen(); // the observer misses panels clipped by their own entry\n  if (!st.tile && on && !st.seen) arm(\"frame\", k);\n  if (!on && motion.level === 3 && st.seen) wait_for_next_view();\n}), [fig]);"],
        [80, 91, "useEffect(() => {\n  if (motion.level < 2) return show_without_entry();\n  if (replayed) onscreen() && !tile ? arm(staged ? \"content\" : \"frame\", panels_in_view_before(fig)) : wait_for_next_view();\n  else if (just_staged) arm(\"content\", 0);\n  else if (left_the_rail && onscreen() && !st.seen) arm(\"content\", 0);\n}, [tile, staged, replays]);"],
        [96, 96, "const style = { …, \"--i\": parseInt(fig, 10) };"],
        [97, 97, "const style = { …, \"--i\": order };"],
        [99, 99, "<section className=\"panel…\" data-panel={fig} style={style}>"],
        [100, 104, "<section ref={el} className=\"panel…\" data-panel={fig} style={style} data-enter={enter} data-pending={pending && !enter}>"],
      ],
    },
    "src/components/primitives.tsx@236": {
      a: [[10, 16, "const t0 = performance.now() + 300;\neach frame: setV(to * easeOutCubic(clamp01((now - t0) / 900))), until t reaches 1;"]],
      b: [[3, 20, "// A figure that counts up from zero each time its panel plays an entry, at the Lively level.\nexport function Count({ to, fmt }) {\n  const v = motion.level === 3 && plays ? count_up(0 → to, 900 ms, after 300 ms) : to;\n  return <>{fmt(v)}</>;\n}"]],
    },
    "src/components/primitives.tsx@286": {
      a: [
        [3, 3, "export function Segmented({ value, options: { value, label }[], onChange, label })"],
        [4, 4, "export function Segmented({ value, options: { value, label, tip? }[], onChange, label })"],
        [8, 8, "<button role=\"radio\" aria-checked={o.value === value} className={…} onClick={() => onChange(o.value)}>"],
        [9, 9, "<button role=\"radio\" aria-checked={o.value === value} className={…} data-tip={o.tip} onClick={() => onChange(o.value)}>"],
      ],
    },
    "src/gpu/scene.ts@61": {
      b: [
        [11, 13, "let travel = 0, prev = performance.now(); // seconds of travel for dashes and pulses"],
        [16, 19, "const ambient = motion.level >= 2, moving = ambient && !gpuState.paused;\nif (moving) travel += elapsed seconds * (motion.level === 3 ? 1.6 : 1);"],
      ],
    },
    "src/gpu/scene.ts@144": {
      b: [
        [16, 18, "this.reveal = progress since revealFrom; stop at 1;"],
        [19, 25, "// The reveal waits while the panel around the canvas is still hidden, then starts once its frame has begun to draw.\nif (!this.revealFrom && panel_not_pending()) this.revealFrom = now + 300;\nif (this.revealFrom) this.reveal = progress since revealFrom; stop at 1;"],
      ],
    },
    "src/motion.ts@1": {
      a: [[3, 6, "{ id: 0, name: \"Still\", what: \"…\" },\n{ id: 1, name: \"Quiet\", what: \"…\" },\n{ id: 2, name: \"Standard\", what: \"…\" },\n{ id: 3, name: \"Lively\", what: \"…\" },"]],
      b: [
        [0, 7, "export const MOTION_LEVELS = [Still, Quiet, Standard, Lively]; // { id, name, what }"],
        [12, 18, "function initial() {\n  return saved_level() ?? (prefersLess ? 0 : 2);\n}"],
      ],
    },
    "src/panels.ts@1": {
      a: [[1, 15, "\"01\": \"Relationship network\", \"02\": \"Person\", …, \"15\": \"Motion and interaction\","]],
    },
    "src/styles/base.css@51": {
      b: [
        [3, 9, ".switcher button, .switcher span, kbd, p, .brief b { … }"],
        [10, 11, ".theme-btn:hover, .theme-btn.on { … }"],
        [14, 28, ".crumbs { … } /* names separated by \"/\" */\n.motion-ctl { … }\n.brief { … }"],
      ],
    },
    "src/styles/base.css@463": {
      a: [[5, 5, "background-image: url(\"data:image/svg+xml,… noise …\");"]],
    },
    "src/styles/base.css@544": {
      a: [
        [3, 8, "/* panels and the masthead play entry animations under [data-entering], staggered by --i */"],
        [25, 29, "/* chart parts draw, rise, fade or grow under [data-entering], delayed by --i and --k */"],
      ],
      b: [
        [3, 8, "/* panels and the masthead play entry animations under [data-entering], staggered by --i */"],
        [9, 19, "/* Entry. A panel stays hidden until it comes into view, then draws itself once. The Panel component sets data-pending and data-enter. */\n.panel[data-pending] { opacity: 0 }\n.panel[data-enter=\"frame\"] { animation: plot-in or wind-up, by family; delay: var(--d) }\nhtml[data-entry] .mast > * { animation: wind-up, 90ms apart }"],
        [25, 29, "/* chart parts draw, rise, fade or grow under [data-entering], delayed by --i and --k */"],
        [30, 42, ".panel[data-enter] chart parts { animation: draw, rise, fade, grow or row-in; delay: --d + --lead + --k }\n.panel[data-enter] svg.wipe { animation: wipe-clip } /* one animation for a dense chart */\n.panel[data-enter] .flow-wipe { animation: wipe-x } /* the money flow, from its sources */"],
        [51, 60, "/* At Lively, money streams along the ribbons, key marks beat and the peak dot swells. */\nhtml[data-ambient] .panel:not([data-enter]) .flow-stream { animation: stream }\nhtml[data-ambient] .panel:not([data-enter]) key marks { animation: beat or swell }"],
      ],
    },
    "src/styles/base.css@674": {
      a: [
        [3, 3, ".insp-h { display: flex; align-items: center; gap: 10px; … }"],
        [9, 9, ".insp-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; … }"],
      ],
      b: [
        [3, 3, ".insp-h { display: flex; … }"],
        [4, 8, ".trail { … } /* the dossier trail, now in the breadcrumb */"],
        [9, 9, ".insp-h { display: flex; justify-content: space-between; … }"],
      ],
    },
    "src/themes.ts@195": {
      a: [
        [3, 4, "character: \"A frame changes size like a mask over a drawing. …\","],
        [6, 10, "// Plot in, Ink ties, Pull apart, Drift, Money, a paragraph each"],
        [11, 15, "// Plot in, Ink ties, Pull apart, Drift, Money, a sentence each"],
      ],
    },
    "src/themes.ts@334": {
      a: [
        [3, 4, "character: \"A plate glides to its new place and settles. …\","],
        [6, 10, "// Wind up, Sweep, Lift off, Turn, Money, a paragraph each"],
        [11, 15, "// Wind up, Sweep, Lift off, Turn, Money, a sentence each"],
      ],
    },
    "src/themes.ts@356": {
      a: [
        [3, 47, "// Tooltip, Open a row, Sort, Full size, Dossier, Linked marks, Measure, Commit: several lines each, a paragraph of description"],
        [48, 55, "// the same eight, a line each, a sentence of description"],
      ],
    },
    "src/workspace.tsx@1": {
      a: [[65, 79, "interface Workspace {\n  stage, trail, doc, brief, command;\n  setStage, reveal, inspect, jump, closeInspector, openDoc, toggleBrief, run;\n}"]],
      b: [
        [21, 33, "let state: State = { stage: null, trail: [], doc: \"E-0212\", brief: [], command: none, level: motion.level, replays: 0 };\nconst set = (patch) => { merge patch into state; notify subscribers };\nexport const getState = () => state;\n// A component re-renders only when what its selector returns changes.\nexport function useWs(select) { return select(state); }"],
        [47, 53, "pause_scenes();\nconst resume = pop_morph_and_wake_scenes();"],
        [65, 79, "interface Workspace { state fields and actions }"],
        [80, 119, "export const ws = {\n  setStage(fig) { morph to the stage, keeping the board's scroll position },\n  reveal(fig) { stage it, or scroll it into view },\n  inspect(id) { push id onto the trail, opening the drawer with a morph },\n  jump(i), closeInspector(), home(), openDoc(id), toggleBrief(item), run(name, arg), replay(),\n  // A change of level replays the entry of the panels in view, so the reader can compare levels on the spot.\n  setLevel(next) { applyMotionLevel(next); set({ level: next, replays: replays + 1 }); },\n};"],
      ],
    },
    "src/workspace.tsx@115": {
      a: [
        [6, 14, "export function WorkspaceProvider({ children }: { children: ReactNode }) {\n  const [stage, trail, doc, brief, command] = useState(…);\n  const live = useRef({ stage, trail }); // kept current\n  const boardY = useRef(0);"],
        [47, 50, "const value = useMemo(() => ({ state and actions }), [all of them]);"],
      ],
      b: [
        [4, 4, "const panelEl = (fig) => the [data-panel] element;"],
        [6, 52, "export function WorkspaceProvider({ children }) {\n  // the same state and actions as ws, in React state and useCallback, passed down through context\n  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;\n}"],
      ],
    },
  },
  qa: [
    { q: "What happens with prefers-reduced-motion?", a: "On the first visit [initial()](src/motion.ts@1:17) starts at Still. [main.tsx](src/main.tsx@1:12) then saves that level, so later visits use the saved value even if the system setting changes. Separately, [the media query](src/styles/base.css@718:15) still turns off all CSS animation, whatever level is picked." },
    { q: "Why does staging a panel get cheaper?", a: "Panels used to read the whole workspace context, so every stage change re-rendered all of them. They now [select only stage and replays](src/components/primitives.tsx@117:32). During the transition [the GPU views stop drawing](src/workspace.tsx@1:47) every frame, and the network camera [jumps instead of gliding](src/components/NetworkView.tsx@70:6)." },
    { q: "What does each motion level change?", a: "Still turns off all motion. Quiet keeps responses: layout transitions, opening rows, sorting, camera glides. Standard adds entry when [a panel comes into view](src/components/primitives.tsx@117:74), money travel and sway. Lively adds [streams and pulses at rest](src/styles/base.css@544:51), [count-ups](src/components/primitives.tsx@236:4), wider sway, and entry each time a panel returns." },
  ],
};

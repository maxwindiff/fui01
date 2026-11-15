export type ThemeId = "vellum" | "orrery" | "floe" | "console" | "massif" | "phosphor";
export type RGBA = [number, number, number, number];

export interface DeepSpace {
  form: "strata" | "armillary" | "blocks" | "relief" | "dome";
  pitch: number;
  yaw: number;
  sway: number;
  swayPeriod: number;
  aperture: number;
  fogFloor: number;
  fov?: number;
  mapPitch: number;
  mapYaw: number;
  labels: [string, string];
  mapLabel: string;
  mapKey: string;
  mapScale?: number;
}

export interface Motion {
  enter: number;
  stagger: number;
  reveal: number;
  morph: number;
  hover: number;
  layout: number;
  expand: number;
  sort: number;
  ease: string;
  // Layout transitions take this curve where ease is stepped.
  layoutEase?: string;
  notes: { name: string; what: string; timing: string }[];
}

export interface GpuStyle {
  vizBg: string;
  additive: boolean;
  additiveBase?: boolean;
  glow?: number;
  // Sector colours inside the GPU views, for a theme whose views sit on a ground unlike the page.
  sectors?: [string, string, string, string];
  block?: BlockStyle;
  // Contour lines drawn on a relief at even heights, and motes that drift above it.
  contour?: { color: string; alpha: number; levels: number };
  dust?: { color: string; count: number };
  layout: "force" | "orbit";
  edge: { color: string; alpha: number; width: number; curve: number };
  money: { color: string; alpha: number; width: number; weak: number; weakAlpha: number; mode: "dash" | "pulse" };
  contact: { color: string; alpha: number; width: number; dash: number };
  node: { stroke: number; hollowOfficials: boolean; hollowAll?: boolean; halo: number; scale: number };
  focus: { color: string; ring: number };
  guide: { color: string; alpha: number };
  map: {
    border: { color: string; alpha: number; width: number };
    dot: { color: string; alpha: number; min: number; max: number; shape: number; halo: number; jitter: number };
    arc: { color: string; alpha: number; width: number; mode: "dash" | "pulse" };
    // Fills the floor of the map with one square a cell, as bright as the state's giving.
    pixel?: boolean;
    city: { color: string; shape: number; fill: number };
    event: { color: string };
  };
  deep: DeepSpace;
}

// paint decides whether a block takes the neutral top and side or its sector colour. ramp colours the map cells from
// no giving to the most, and stepped rounds heights to whole storeys.
export interface BlockStyle {
  paint: "plain" | "sector";
  top: string;
  side: string;
  ink: string;
  inkAlpha: number;
  outline: number;
  shadow: number;
  shadowColor: string;
  focus: string | null;
  glyph: string | null;
  ramp: string[];
  hover: string;
  stepped: boolean;
  coarse: boolean;
  // Half width of a network block, in node radii.
  width: number;
  // Height of a band in the sector's colour around a network block, as a share of the block's width.
  band?: number;
  // Network blocks become keys of one size on a lattice of this pitch, with unlit keys in the empty places and
  // ties routed along the gaps. lamp brightens the middle of each top.
  keys?: { pitch: number; blank: string; lamp: number };
}

export interface Theme {
  id: ThemeId;
  family: ThemeId;
  name: string;
  mode: "light" | "dark";
  // Layers drawn behind the board, and live readouts inside the GPU views.
  backdrop?: boolean;
  hud?: boolean;
  concept: string;
  lineage: string;
  vars: Record<string, string>;
  palette: { name: string; role: string; var: string }[];
  type: { role: string; family: string; sample: string; var: string }[];
  gpu: GpuStyle;
  motion: Motion;
}

export function rgba(hex: string, a = 1): RGBA {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

const vellum: Theme = {
  id: "vellum",
  family: "vellum",
  name: "Vellum",
  mode: "light",
  concept:
    "Drafting film under a light table. Graphite hairlines carry the structure, indigo traces mark government, orange marks money, and reading text is set in a book serif with notes in the margin. The network pulls apart into sheets of film stacked by sector, with ties passing between them.",
  lineage: "Paper schematics, ink orbit plots, tilted schematic sheets with shallow depth of field",
  vars: {
    "--bg": "#E6EBE4",
    "--bg-image":
      "radial-gradient(120% 90% at 50% 18%, #F0F4ED 0%, #E6EBE4 48%, #D3DAD3 100%)",
    "--surface": "rgba(244,247,241,0.55)",
    "--surface-2": "#DAE0D9",
    "--viz-bg": "#EBEFE8",
    "--viz-image": "radial-gradient(80% 80% at 50% 45%, #E9EEE7 0%, #D3DBD3 100%)",
    "--viz-image-size": "auto",
    "--viz-ink": "#171B1A",
    "--ink": "#171B1A",
    "--ink-2": "#48524F",
    "--ink-3": "#828C88",
    "--rule": "rgba(23,27,26,0.20)",
    "--rule-strong": "rgba(23,27,26,0.62)",
    "--accent": "#E2581B",
    "--accent-text": "#BC4410",
    "--accent-ink": "#FFFFFF",
    "--gov": "#4E59B8",
    "--corp": "#171B1A",
    "--inter": "#E2581B",
    "--event": "#6F7A75",
    "--money": "#E2581B",
    "--contact": "#4E59B8",
    "--dem": "#3857C2",
    "--rep": "#C4382F",
    "--ind": "#737C78",
    "--alert": "#C4382F",
    "--ok": "#2C7A58",
    "--font-display": "'Newsreader Variable', 'Iowan Old Style', Georgia, serif",
    "--font-ui": "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    "--font-text": "'Newsreader Variable', 'Iowan Old Style', Georgia, serif",
    "--font-label": "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    "--font-num": "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    "--display-weight": "400",
    "--display-track": "-0.02em",
    "--display-case": "none",
    "--title-size": "19px",
    "--title-weight": "500",
    "--label-case": "none",
    "--label-track": "0.01em",
    "--label-size": "12px",
    "--label-weight": "400",
    "--ui-size": "14px",
    "--text-size": "16px",
    "--text-leading": "1.5",
    "--num-weight": "400",
    "--radius": "0px",
    "--radius-ctl": "0px",
    "--rule-w": "1px",
    "--stroke": "1",
    "--stroke-bold": "1.75",
    "--mast-size": "104px",
    "--font-name": "'Newsreader Variable', Georgia, serif",
    "--name-weight": "400",
    "--name-track": "-0.015em",
    "--chart-font": "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    "--chart-size": "12px",
    "--chart-weight": "400",
    "--chart-case": "none",
    "--chart-track": "0.01em",
    "--net-font": "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    "--net-size": "12.5px",
    "--net-weight": "400",
    "--net-case": "none",
    "--net-track": "0.01em",
    "--redact": "#171B1A",
  },
  palette: [
    { name: "Film", role: "ground", var: "--bg" },
    { name: "Graphite", role: "ink, corporate", var: "--ink" },
    { name: "Indigo trace", role: "government, contact", var: "--gov" },
    { name: "Signal orange", role: "money, intermediaries", var: "--accent" },
    { name: "Party blue", role: "Democrat", var: "--dem" },
    { name: "Party red", role: "Republican, alert", var: "--rep" },
  ],
  type: [
    { role: "Reading and titles", family: "Newsreader", sample: "Twenty-six contacts in ninety days", var: "--font-text" },
    { role: "Labels and figures", family: "IBM Plex Sans Condensed", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#EBEFE8",
    additive: false,
    layout: "force",
    edge: { color: "#171B1A", alpha: 0.34, width: 0.8, curve: 0.22 },
    money: { color: "#E2581B", alpha: 0.95, width: 1.7, weak: 0.8, weakAlpha: 0.6, mode: "dash" },
    contact: { color: "#4E59B8", alpha: 0.7, width: 0.9, dash: 0 },
    node: { stroke: 1.1, hollowOfficials: true, halo: 0, scale: 1 },
    focus: { color: "#171B1A", ring: 1.2 },
    guide: { color: "#171B1A", alpha: 0.16 },
    map: {
      border: { color: "#171B1A", alpha: 0.42, width: 0.7 },
      dot: { color: "#171B1A", alpha: 0.62, min: 0.45, max: 2.5, shape: 0, halo: 0, jitter: 0 },
      arc: { color: "#E2581B", alpha: 0.95, width: 1.3, mode: "dash" },
      city: { color: "#171B1A", shape: 0, fill: -1 },
      event: { color: "#4E59B8" },
    },
    deep: {
      form: "strata",
      pitch: 0.6,
      yaw: -0.5,
      sway: 0.07,
      swayPeriod: 26,
      aperture: 2.6,
      fogFloor: 0.45,
      mapPitch: 0.74,
      mapYaw: -0.3,
      labels: ["Flat", "Strata"],
      mapLabel: "Spikes",
      mapKey: "Spike height is giving",
    },
  },
  motion: {
    enter: 520,
    stagger: 45,
    reveal: 1500,
    morph: 1100,
    hover: 180,
    layout: 380,
    expand: 220,
    sort: 320,
    ease: "cubic-bezier(0.2, 0.7, 0.1, 1)",
    notes: [
      { name: "Plot in", what: "Frames wipe in from the left when they come into view. Lines draw, bars rise left to right, and the money flow wipes from sources to recipients.", timing: "520 ms a panel, 45 ms apart" },
      { name: "Ink ties", what: "Network ties and state borders draw from source to target.", timing: "1.5 s, on the GPU" },
      { name: "Pull apart", what: "Flat to Strata separates the sheets and tips the camera in one move.", timing: "1.1 s" },
      { name: "Drift", what: "The stack sways slowly and stops under the pointer.", timing: "26 s a cycle" },
      { name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

const orrery: Theme = {
  id: "orrery",
  family: "orrery",
  name: "Orrery",
  mode: "dark",
  concept:
    "A brass instrument in a dark room. The subject stands at the centre and everything else orbits on engraved rings by degree of separation, each entity on a stem as tall as its weight in the case. Amber carries money, teal carries government, ivory is for reading.",
  lineage: "Engraved astrolabes, amber terrain tables with markers on stems, thin gold line art on black",
  vars: {
    "--bg": "#0B0906",
    "--bg-image":
      "radial-gradient(80% 55% at 50% 0%, #1A140B 0%, #0B0906 62%)",
    "--surface": "#120F0A",
    "--surface-2": "#1C1710",
    "--viz-bg": "#0E0B07",
    "--viz-image": "radial-gradient(60% 60% at 50% 55%, #1E170C 0%, #0D0A06 75%)",
    "--viz-image-size": "auto",
    "--viz-ink": "#F0E4CC",
    "--ink": "#F0E4CC",
    "--ink-2": "#BCA884",
    "--ink-3": "#7D6E54",
    "--rule": "rgba(216,164,74,0.26)",
    "--rule-strong": "rgba(216,164,74,0.78)",
    "--accent": "#FF8B1F",
    "--accent-text": "#FF9A3B",
    "--accent-ink": "#1A0E02",
    "--gov": "#3FCDB8",
    "--corp": "#F0E4CC",
    "--inter": "#FF8B1F",
    "--event": "#EE5A42",
    "--money": "#FF8B1F",
    "--contact": "#3FCDB8",
    "--dem": "#63B4E8",
    "--rep": "#EE5A42",
    "--ind": "#D8A44A",
    "--alert": "#EE4B32",
    "--ok": "#3FCDB8",
    "--brass": "#D8A44A",
    "--font-display": "'Jura Variable', 'Avenir Next', sans-serif",
    "--font-ui": "'Jura Variable', 'Avenir Next', sans-serif",
    "--font-text": "'Spectral', Georgia, serif",
    "--font-label": "'Jura Variable', 'Avenir Next', sans-serif",
    "--font-num": "'Jura Variable', 'Avenir Next', sans-serif",
    "--display-weight": "300",
    "--display-track": "0.14em",
    "--display-case": "uppercase",
    "--title-size": "13px",
    "--title-weight": "600",
    "--label-case": "uppercase",
    "--label-track": "0.12em",
    "--label-size": "10.5px",
    "--label-weight": "600",
    "--ui-size": "14px",
    "--text-size": "16px",
    "--text-leading": "1.55",
    "--num-weight": "400",
    "--radius": "0px",
    "--radius-ctl": "999px",
    "--rule-w": "1px",
    "--stroke": "1.1",
    "--stroke-bold": "1.8",
    "--mast-size": "92px",
    "--font-name": "'Jura Variable', 'Avenir Next', sans-serif",
    "--name-weight": "300",
    "--name-track": "0.02em",
    "--chart-font": "'Jura Variable', 'Avenir Next', sans-serif",
    "--chart-size": "11.5px",
    "--chart-weight": "500",
    "--chart-case": "none",
    "--chart-track": "0.03em",
    "--net-font": "'Jura Variable', 'Avenir Next', sans-serif",
    "--net-size": "11px",
    "--net-weight": "600",
    "--net-case": "uppercase",
    "--net-track": "0.1em",
    "--redact": "#4A3F2C",
  },
  palette: [
    { name: "Lampblack", role: "ground", var: "--bg" },
    { name: "Brass", role: "rules, scales, labels", var: "--brass" },
    { name: "Ivory", role: "reading ink, corporate", var: "--ink" },
    { name: "Furnace amber", role: "money, intermediaries, focus", var: "--accent" },
    { name: "Verdigris", role: "government, contact", var: "--gov" },
    { name: "Cinnabar", role: "alerts, Republican", var: "--alert" },
  ],
  type: [
    { role: "Titles, labels, figures", family: "Jura", sample: "TWENTY-SIX CONTACTS IN NINETY DAYS", var: "--font-display" },
    { role: "Reading", family: "Spectral", sample: "Voss left this office nineteen months earlier.", var: "--font-text" },
  ],
  gpu: {
    vizBg: "#0E0B07",
    additive: true,
    layout: "orbit",
    edge: { color: "#D8A44A", alpha: 0.3, width: 0.8, curve: 0.3 },
    money: { color: "#FF8B1F", alpha: 1, width: 1.6, weak: 0.8, weakAlpha: 0.5, mode: "pulse" },
    contact: { color: "#3FCDB8", alpha: 0.6, width: 0.8, dash: 0 },
    node: { stroke: 1.2, hollowOfficials: true, halo: 0, scale: 1 },
    focus: { color: "#FF8B1F", ring: 1.4 },
    guide: { color: "#D8A44A", alpha: 0.34 },
    map: {
      border: { color: "#D8A44A", alpha: 0.4, width: 0.7 },
      dot: { color: "#FF8B1F", alpha: 0.95, min: 0.4, max: 2.2, shape: 3, halo: 1.6, jitter: 0.35 },
      arc: { color: "#3FCDB8", alpha: 0.95, width: 1.2, mode: "pulse" },
      city: { color: "#F0E4CC", shape: 3, fill: -1 },
      event: { color: "#3FCDB8" },
    },
    deep: {
      form: "armillary",
      pitch: 0.6,
      yaw: 0.6,
      sway: 0.3,
      swayPeriod: 48,
      aperture: 2.2,
      fogFloor: 0.3,
      mapPitch: 0.66,
      mapYaw: 0.28,
      labels: ["Plan", "Armillary"],
      mapLabel: "Terrain",
      mapKey: "Height is giving",
    },
  },
  motion: {
    enter: 700,
    stagger: 60,
    reveal: 2200,
    morph: 1400,
    hover: 220,
    layout: 560,
    expand: 320,
    sort: 460,
    ease: "cubic-bezier(0.3, 0, 0.1, 1)",
    notes: [
      { name: "Wind up", what: "Plates fade up as they come into view while the tick scale under each title sweeps across. Lines draw and the money flow wipes from sources to recipients.", timing: "700 ms a panel, 60 ms apart" },
      { name: "Sweep", what: "Rings sweep round from twelve o'clock and nodes light as their ring arrives.", timing: "2.2 s, on the GPU" },
      { name: "Lift off", what: "Plan to Armillary raises every stem off its ring and tips the camera in one move.", timing: "1.4 s" },
      { name: "Turn", what: "The instrument swings slowly while tick scales turn against it. Both stop under the pointer.", timing: "48 s a cycle" },
      { name: "Money", what: "Pulses travel along arcs and ribbons in the direction the money moved.", timing: "a pulse every 4 to 6 s" },
    ],
  },
};

const floe: Theme = {
  id: "floe",
  family: "floe",
  name: "Floe",
  mode: "light",
  concept:
    "A polar station built from ceramic modules. Each panel is a white plate seated on an aluminium deck with a blue livery stripe, controls are keys and sliders with travel, figures sit behind dark glass, and the network is a field of white blocks with a band in their sector's colour.",
  lineage: "Modular habitat panels with livery stripes, pocket synthesizers, white architectural models",
  vars: {
    "--bg": "#AFB8BF",
    "--bg-image": "linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px) 0 1px / 100% 240px, linear-gradient(rgba(24,34,44,0.16) 1px, transparent 1px) 0 0 / 100% 240px, linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px) 1px 0 / 240px 100%, linear-gradient(90deg, rgba(24,34,44,0.16) 1px, transparent 1px) 0 0 / 240px 100%, linear-gradient(180deg, #B9C1C7 0%, #A5AFB7 100%)",
    "--surface": "#F3F3EF",
    "--surface-2": "#E4E6E3",
    "--viz-bg": "#DDE1E3",
    "--viz-image": "none",
    "--viz-image-size": "auto",
    "--viz-ink": "#1D2226",
    "--ink": "#1D2226",
    "--ink-2": "#555E66",
    "--ink-3": "#8B949B",
    "--rule": "rgba(29,34,38,0.13)",
    "--rule-strong": "rgba(29,34,38,0.5)",
    "--accent": "#2B50E6",
    "--accent-text": "#2242C4",
    "--accent-ink": "#FFFFFF",
    "--gov": "#D08A00",
    "--corp": "#1D2226",
    "--inter": "#2B50E6",
    "--event": "#7A858D",
    "--money": "#2B50E6",
    "--contact": "#D08A00",
    "--dem": "#3B9BE0",
    "--rep": "#D6453D",
    "--ind": "#8B949B",
    "--alert": "#D6453D",
    "--ok": "#2E9C7A",
    "--glass": "#1B2024",
    "--edge": "#939DA5",
    "--key": "#FBFBF8",
    "--font-display": "'Jost Variable', 'Century Gothic', sans-serif",
    "--font-ui": "'Jost Variable', 'Century Gothic', sans-serif",
    "--font-text": "'Jost Variable', 'Century Gothic', sans-serif",
    "--font-label": "'Martian Mono Variable', ui-monospace, monospace",
    "--font-num": "'Jost Variable', 'Century Gothic', sans-serif",
    "--font-lcd": "'Doto Variable', ui-monospace, monospace",
    "--display-weight": "300",
    "--display-track": "-0.02em",
    "--display-case": "lowercase",
    "--title-size": "15px",
    "--title-weight": "500",
    "--label-case": "lowercase",
    "--label-track": "0",
    "--label-size": "9.5px",
    "--label-weight": "400",
    "--ui-size": "14.5px",
    "--text-size": "16.5px",
    "--text-leading": "1.5",
    "--num-weight": "500",
    "--radius": "14px",
    "--radius-ctl": "7px",
    "--rule-w": "1px",
    "--stroke": "1.25",
    "--stroke-bold": "2",
    "--mast-size": "120px",
    "--font-name": "'Jost Variable', 'Century Gothic', sans-serif",
    "--name-weight": "400",
    "--name-track": "-0.01em",
    "--chart-font": "'Martian Mono Variable', ui-monospace, monospace",
    "--chart-size": "9.5px",
    "--chart-weight": "400",
    "--chart-case": "lowercase",
    "--chart-track": "0",
    "--net-font": "'Jost Variable', 'Century Gothic', sans-serif",
    "--net-size": "13px",
    "--net-weight": "500",
    "--net-case": "none",
    "--net-track": "0",
    "--redact": "#1D2226",
  },
  palette: [
    { name: "Deck", role: "ground", var: "--bg" },
    { name: "Ceramic", role: "panels, keys, blocks", var: "--surface" },
    { name: "Glass", role: "ink, windows, corporate", var: "--ink" },
    { name: "Livery blue", role: "money, intermediaries", var: "--accent" },
    { name: "Ochre", role: "government, contact", var: "--gov" },
    { name: "Anodised", role: "edges, events", var: "--edge" },
  ],
  type: [
    { role: "Titles, reading", family: "Jost", sample: "twenty-six contacts in ninety days", var: "--font-text" },
    { role: "Captions", family: "Martian Mono", sample: "ld-2 2025 q3", var: "--font-label" },
    { role: "Readouts", family: "Doto", sample: "$2.94M  214", var: "--font-lcd" },
  ],
  gpu: {
    vizBg: "#DDE1E3",
    additive: false,
    layout: "force",
    block: {
      paint: "plain", top: "#FFFFFF", side: "#EEF0EE", ink: "#1D2226", inkAlpha: 0.14, outline: 0.7,
      shadow: 0.5, shadowColor: "#5B6670", focus: "#2B50E6", glyph: null, band: 0.26,
      ramp: ["#F7F8F6", "#DDE4F8", "#B7C5F4", "#8198EE", "#4C6BE8"], hover: "#D08A00", stepped: false, coarse: false, width: 1.9,
    },
    edge: { color: "#1D2226", alpha: 0.3, width: 0.8, curve: 0 },
    money: { color: "#2B50E6", alpha: 1, width: 1.8, weak: 0.8, weakAlpha: 0.6, mode: "dash" },
    contact: { color: "#D08A00", alpha: 0.85, width: 1, dash: 3 },
    node: { stroke: 1.1, hollowOfficials: true, halo: 0, scale: 0.7 },
    focus: { color: "#2B50E6", ring: 1.3 },
    guide: { color: "#1D2226", alpha: 0.22 },
    map: {
      border: { color: "#1D2226", alpha: 0, width: 0.6 },
      dot: { color: "#1D2226", alpha: 0.6, min: 0.45, max: 2.4, shape: 0, halo: 0, jitter: 0 },
      arc: { color: "#1D2226", alpha: 1, width: 1.4, mode: "dash" },
      city: { color: "#1D2226", shape: 0, fill: -1 },
      event: { color: "#D08A00" },
    },
    deep: {
      form: "blocks", pitch: 0.74, yaw: -0.62, sway: 0.06, swayPeriod: 30, aperture: 0, fogFloor: 0.72,
      mapPitch: 0.8, mapYaw: -0.34, labels: ["Plan", "Massing"], mapLabel: "Massing", mapKey: "Block height and colour are giving",
    },
  },
  motion: {
    enter: 460,
    stagger: 45,
    reveal: 1500,
    morph: 1000,
    hover: 110,
    layout: 360,
    expand: 220,
    sort: 300,
    ease: "cubic-bezier(0.3, 1.3, 0.5, 1)",
    layoutEase: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    notes: [
      { name: "Seat", what: "Each module drops onto the deck and settles with a small overshoot when it comes into view.", timing: "460 ms a panel, 45 ms apart" },
      { name: "Travel", what: "Keys sink by their own depth while pressed, and a lit dot marks the one that is on. The motion knob turns a detent a click.", timing: "110 ms" },
      { name: "Extrude", what: "Blocks rise out of the sheet from the centre outward.", timing: "1.5 s, on the GPU" },
      { name: "Raise", what: "Plan to Massing lifts every block to its height and lengthens the shadows with it.", timing: "1 s" },
      { name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

const consoleTheme: Theme = {
  id: "console",
  family: "console",
  name: "Console",
  mode: "light",
  concept:
    "A control room desk. Panels are enamelled steel bays with engraved label plates and a pictogram each, controls are backlit keys set in black wells, charts run on recorder paper, and the network is a board of lit keys with ties routed between them like a mimic diagram.",
  lineage: "Power station control desks, annunciator panels, backlit key matrices, shipboard pictogram standards",
  vars: {
    "--bg": "#CBC3AE",
    "--bg-image": "none",
    "--surface": "#DAD3C0",
    "--surface-2": "#C9C1AB",
    "--viz-bg": "#12110C",
    "--viz-image": "none",
    "--viz-image-size": "auto",
    "--viz-ink": "#F7E6BD",
    "--ink": "#17160F",
    "--ink-2": "#4B473B",
    "--ink-3": "#7C7665",
    "--rule": "rgba(23,22,15,0.2)",
    "--rule-strong": "rgba(23,22,15,0.78)",
    "--accent": "#E0502F",
    "--accent-text": "#B6371A",
    "--accent-ink": "#17160F",
    "--gov": "#1B7BA3",
    "--corp": "#17160F",
    "--inter": "#D24726",
    "--event": "#A26F08",
    "--money": "#D24726",
    "--contact": "#1B7BA3",
    "--dem": "#2C6FB5",
    "--rep": "#C93A2B",
    "--ind": "#7C7665",
    "--alert": "#C93A2B",
    "--ok": "#2B7F4C",
    "--well": "#17160F",
    "--unlit": "#3A372C",
    "--lamp": "#F7E6BD",
    "--lamp-blue": "#74CBEA",
    "--lamp-red": "#EE5C3C",
    "--lamp-white": "#F2F1EA",
    "--lamp-amber": "#F5B93B",
    "--lamp-green": "#93D38C",
    "--paper": "#E7EDD6",
    "--font-display": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-ui": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-text": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-label": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-num": "'B612 Mono', ui-monospace, monospace",
    "--display-weight": "600",
    "--display-track": "0.09em",
    "--display-case": "uppercase",
    "--title-size": "12.5px",
    "--title-weight": "600",
    "--label-case": "uppercase",
    "--label-track": "0.09em",
    "--label-size": "10.5px",
    "--label-weight": "600",
    "--ui-size": "15px",
    "--text-size": "16.5px",
    "--text-leading": "1.5",
    "--num-weight": "400",
    "--radius": "4px",
    "--radius-ctl": "4px",
    "--rule-w": "1.5px",
    "--stroke": "1.4",
    "--stroke-bold": "2.2",
    "--mast-size": "92px",
    "--font-name": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--name-weight": "600",
    "--name-track": "0.01em",
    "--chart-font": "'B612 Mono', ui-monospace, monospace",
    "--chart-size": "10px",
    "--chart-weight": "400",
    "--chart-case": "uppercase",
    "--chart-track": "0",
    "--net-font": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--net-size": "11.5px",
    "--net-weight": "600",
    "--net-case": "uppercase",
    "--net-track": "0.06em",
    "--redact": "#17160F",
  },
  palette: [
    { name: "Desk enamel", role: "ground, bays", var: "--surface" },
    { name: "Bakelite", role: "ink, wells, label plates", var: "--ink" },
    { name: "Lamp cream", role: "lit keys, companies", var: "--lamp" },
    { name: "Lamp red", role: "money, intermediaries, alarms", var: "--lamp-red" },
    { name: "Lamp blue", role: "government, contact", var: "--lamp-blue" },
    { name: "Lamp amber", role: "events, cautions", var: "--lamp-amber" },
  ],
  type: [
    { role: "Plates, titles, reading", family: "Barlow Semi Condensed", sample: "TWENTY-SIX CONTACTS IN NINETY DAYS", var: "--font-display" },
    { role: "Meters and figures", family: "B612 Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-num" },
  ],
  gpu: {
    vizBg: "#12110C",
    additive: false,
    layout: "force",
    sectors: ["#74CBEA", "#F7E6BD", "#EE5C3C", "#F5B93B"],
    block: {
      paint: "sector", top: "#F7E6BD", side: "#F7E6BD", ink: "#12110C", inkAlpha: 1, outline: 1.2,
      shadow: 0, shadowColor: "#000000", focus: null, glyph: "#17160F",
      ramp: ["#33302A", "#F2F1EA", "#74CBEA", "#F5B93B", "#EE5C3C"], hover: "#FFFFFF", stepped: true, coarse: true, width: 2,
      keys: { pitch: 30, blank: "#2A2821", lamp: 0.5 },
    },
    edge: { color: "#F7E6BD", alpha: 0.5, width: 1.1, curve: 0 },
    money: { color: "#EE5C3C", alpha: 1, width: 2.6, weak: 1.3, weakAlpha: 0.75, mode: "dash" },
    contact: { color: "#74CBEA", alpha: 0.9, width: 1.1, dash: 2.5 },
    node: { stroke: 1.2, hollowOfficials: false, halo: 0, scale: 0.5 },
    focus: { color: "#FFFFFF", ring: 1.6 },
    guide: { color: "#F7E6BD", alpha: 0.2 },
    map: {
      border: { color: "#F7E6BD", alpha: 0, width: 0.6 },
      dot: { color: "#F7E6BD", alpha: 0.6, min: 0.45, max: 2.4, shape: 1, halo: 0, jitter: 0 },
      arc: { color: "#FFFFFF", alpha: 1, width: 1.6, mode: "dash" },
      city: { color: "#FFFFFF", shape: 1, fill: 1 },
      event: { color: "#FFFFFF" },
    },
    deep: {
      form: "blocks", pitch: 0.84, yaw: 0.5, sway: 0, swayPeriod: 30, aperture: 0, fogFloor: 0.6, fov: 0.32,
      mapPitch: 0.72, mapYaw: 0.42, labels: ["Plan", "Board"], mapLabel: "Board", mapKey: "Key colour and height are giving, in four bands",
    },
  },
  motion: {
    enter: 420,
    stagger: 60,
    reveal: 1400,
    morph: 900,
    hover: 60,
    layout: 400,
    expand: 240,
    sort: 400,
    ease: "steps(5, end)",
    layoutEase: "cubic-bezier(0.2, 0.7, 0.1, 1)",
    notes: [
      { name: "Lamp test", what: "Every lamp in a bay flashes once when the bay comes into view, then settles to its state.", timing: "420 ms a bay, 60 ms apart" },
      { name: "Relay", what: "Keys, rows and folds change in five steps with no easing, like a relay bank closing. Layout changes stay smooth.", timing: "five steps" },
      { name: "Board", what: "Keys light from the centre outward and rise to their storey.", timing: "1.4 s, on the GPU" },
      { name: "Selector", what: "The motion switch turns one detent a click.", timing: "five steps" },
      { name: "Money", what: "Dashes march along the routed ties and the ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

const massif: Theme = {
  id: "massif",
  family: "massif",
  name: "Massif",
  mode: "dark",
  concept:
    "A projection table over a landscape of influence. Panels are sheets of cyan light standing above contour lines, fog and dust, the ground rises where entities and money crowd together inside a projected volume, and orange carries the money.",
  lineage: "Holographic terrain tables, contour surveys with glowing routes, dense instrument readouts",
  backdrop: true,
  hud: true,
  vars: {
    "--bg": "#050B0F",
    "--bg-image": "none",
    "--surface": "rgba(8,26,34,0.42)",
    "--surface-2": "#11262E",
    "--viz-bg": "#040A0D",
    "--viz-image": "none",
    "--viz-image-size": "auto",
    "--viz-ink": "#DCEAEE",
    "--ink": "#DDF6F8",
    "--ink-2": "#86C2CB",
    "--ink-3": "#4F8791",
    "--rule": "rgba(69,227,236,0.2)",
    "--rule-strong": "rgba(69,227,236,0.55)",
    "--accent": "#FF5A1F",
    "--accent-text": "#FF7A45",
    "--accent-ink": "#050B0F",
    "--accent-2": "#45E3EC",
    "--gov": "#45E3EC",
    "--corp": "#DCEAEE",
    "--inter": "#FF5A1F",
    "--event": "#E8C35A",
    "--money": "#FF5A1F",
    "--contact": "#45E3EC",
    "--dem": "#5B9BFF",
    "--rep": "#F2617A",
    "--ind": "#8CA6AE",
    "--alert": "#F2617A",
    "--ok": "#58D6A4",
    "--gold": "#E8C35A",
    "--font-display": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-ui": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-text": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-label": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--font-num": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--display-weight": "500",
    "--display-track": "0.16em",
    "--display-case": "uppercase",
    "--title-size": "12px",
    "--title-weight": "600",
    "--label-case": "uppercase",
    "--label-track": "0.1em",
    "--label-size": "9.5px",
    "--label-weight": "500",
    "--ui-size": "14px",
    "--text-size": "15.5px",
    "--text-leading": "1.55",
    "--num-weight": "500",
    "--radius": "0px",
    "--radius-ctl": "0px",
    "--rule-w": "1px",
    "--stroke": "1.1",
    "--stroke-bold": "1.9",
    "--mast-size": "76px",
    "--font-name": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--name-weight": "500",
    "--name-track": "0.03em",
    "--chart-font": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--chart-size": "9.5px",
    "--chart-weight": "400",
    "--chart-case": "uppercase",
    "--chart-track": "0.06em",
    "--net-font": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--net-size": "10px",
    "--net-weight": "500",
    "--net-case": "uppercase",
    "--net-track": "0.08em",
    "--redact": "#58727A",
  },
  palette: [
    { name: "Abyss", role: "ground", var: "--bg" },
    { name: "Frost", role: "ink, terrain, corporate", var: "--ink" },
    { name: "Route orange", role: "money, intermediaries, focus", var: "--accent" },
    { name: "Survey cyan", role: "government, contact, telemetry", var: "--accent-2" },
    { name: "Benchmark gold", role: "events, codes", var: "--gold" },
    { name: "Scree", role: "labels, notes", var: "--ink-2" },
  ],
  type: [
    { role: "Titles and reading", family: "Saira Semi Condensed", sample: "TWENTY-SIX CONTACTS IN NINETY DAYS", var: "--font-display" },
    { role: "Labels and figures", family: "JetBrains Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#040A0D",
    additive: true,
    glow: 2.8,
    layout: "force",
    contour: { color: "#45E3EC", alpha: 0.55, levels: 10 },
    dust: { color: "#BDEFF4", count: 260 },
    edge: { color: "#8FB3BC", alpha: 0.26, width: 0.7, curve: 0.1 },
    money: { color: "#FF5A1F", alpha: 1, width: 1.8, weak: 0.8, weakAlpha: 0.55, mode: "pulse" },
    contact: { color: "#45E3EC", alpha: 0.6, width: 0.8, dash: 0 },
    node: { stroke: 1.2, hollowOfficials: true, halo: 3, scale: 1 },
    focus: { color: "#FF5A1F", ring: 1.4 },
    guide: { color: "#8FB3BC", alpha: 0.4 },
    map: {
      border: { color: "#8FB3BC", alpha: 0.3, width: 0.6 },
      dot: { color: "#A9F2F7", alpha: 1, min: 0.5, max: 2.1, shape: 0, halo: 0, jitter: 0 },
      arc: { color: "#FF5A1F", alpha: 1, width: 1.6, mode: "pulse" },
      city: { color: "#DCEAEE", shape: 1, fill: -1 },
      event: { color: "#E8C35A" },
    },
    deep: {
      form: "relief", pitch: 0.46, yaw: -0.5, sway: 0.12, swayPeriod: 40, aperture: 3, fogFloor: 0.14,
      mapPitch: 0.6, mapYaw: -0.14, labels: ["Flat", "Relief"], mapLabel: "Relief", mapKey: "Height is giving, smoothed across state lines", mapScale: 0.97,
    },
  },
  motion: {
    enter: 600,
    stagger: 55,
    reveal: 2000,
    morph: 1500,
    hover: 200,
    layout: 480,
    expand: 280,
    sort: 420,
    ease: "cubic-bezier(0.25, 0.6, 0.15, 1)",
    notes: [
      { name: "Lock on", what: "Corner brackets close in on each panel as it comes into view while the glass fades up and its rule runs out.", timing: "600 ms a panel, 55 ms apart" },
      { name: "Survey", what: "Contours and the point field light from the centre outward, then stems and routes follow.", timing: "2 s, on the GPU" },
      { name: "Uplift", what: "Flat to Relief raises the ground under the points and drops the camera to a low angle.", timing: "1.5 s" },
      { name: "Parallax", what: "Grid, contours and dust behind the panels scroll at their own rates. Fog and dust drift from the Standard level up.", timing: "8%, 20% and up to 30% of the scroll" },
      { name: "Telemetry", what: "Status lights blink in each title bar and the views report bearing, elevation, zoom and frame time as they move.", timing: "every 2.4 s, four times a second" },
      { name: "Money", what: "Pulses travel along routes and ribbons in the direction the money moved.", timing: "a pulse every 4 to 6 s" },
    ],
  },
};

const phosphor: Theme = {
  id: "phosphor",
  family: "phosphor",
  name: "Phosphor",
  mode: "dark",
  concept:
    "A green tube in a dark room. Title bars, keys and tags are solid blocks of lit phosphor with black type, everything that is lit blooms into the dark around it, figures are set in a pixel face, and the network sits on a wire dome with the subject at its pole.",
  lineage: "Green-screen terminals, block-colour key matrices, raster radar scopes",
  vars: {
    "--bg": "#050D08",
    "--bg-image": "radial-gradient(120% 90% at 50% 12%, #0D2417 0%, #050D08 62%)",
    "--surface": "rgba(8,21,13,0.82)",
    "--surface-2": "#10291A",
    "--viz-bg": "#030A06",
    "--viz-image": "none",
    "--viz-image-size": "auto",
    "--viz-ink": "#CFF8DC",
    "--ink": "#CFF8DC",
    "--ink-2": "#86C9A0",
    "--ink-3": "#4F8A68",
    "--rule": "rgba(61,245,142,0.2)",
    "--rule-strong": "rgba(61,245,142,0.62)",
    "--frame": "#1E8A52",
    "--accent": "#FF4D7A",
    "--accent-text": "#FF7598",
    "--accent-ink": "#04140A",
    "--lit": "#3DF58E",
    "--cyan": "#42D9FF",
    "--mustard": "#FFE14D",
    "--gov": "#42D9FF",
    "--corp": "#CFF8DC",
    "--inter": "#FF4D7A",
    "--event": "#FFE14D",
    "--money": "#FF4D7A",
    "--contact": "#42D9FF",
    "--dem": "#6AA8FF",
    "--rep": "#FF7A5C",
    "--ind": "#86C9A0",
    "--alert": "#FF4D7A",
    "--ok": "#3DF58E",
    "--font-display": "'Jersey 20', 'Courier New', monospace",
    "--font-ui": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--font-text": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--font-label": "'Share Tech Mono', ui-monospace, monospace",
    "--font-num": "'Share Tech Mono', ui-monospace, monospace",
    "--display-weight": "400",
    "--display-track": "0.03em",
    "--display-case": "uppercase",
    "--title-size": "19px",
    "--title-weight": "400",
    "--label-case": "uppercase",
    "--label-track": "0.08em",
    "--label-size": "11px",
    "--label-weight": "400",
    "--ui-size": "14.5px",
    "--text-size": "16px",
    "--text-leading": "1.5",
    "--num-weight": "400",
    "--radius": "6px",
    "--radius-ctl": "3px",
    "--rule-w": "1.5px",
    "--stroke": "1.5",
    "--stroke-bold": "2.4",
    "--mast-size": "112px",
    "--font-name": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--name-weight": "600",
    "--name-track": "0",
    "--chart-font": "'Share Tech Mono', ui-monospace, monospace",
    "--chart-size": "11px",
    "--chart-weight": "400",
    "--chart-case": "uppercase",
    "--chart-track": "0.04em",
    "--net-font": "'Share Tech Mono', ui-monospace, monospace",
    "--net-size": "11.5px",
    "--net-weight": "400",
    "--net-case": "uppercase",
    "--net-track": "0.05em",
    "--redact": "#1E8A52",
  },
  palette: [
    { name: "Tube black", role: "ground", var: "--bg" },
    { name: "P1 green", role: "frames, lit blocks, quantities", var: "--lit" },
    { name: "Mint", role: "ink, corporate", var: "--ink" },
    { name: "Hot pink", role: "money, intermediaries, findings", var: "--accent" },
    { name: "Cyan", role: "government, contact", var: "--cyan" },
    { name: "Yellow", role: "events, records", var: "--mustard" },
  ],
  type: [
    { role: "Titles and figures", family: "Jersey 20", sample: "CONTACTS 26", var: "--font-display" },
    { role: "Reading", family: "Chakra Petch", sample: "Voss left this office nineteen months earlier.", var: "--font-text" },
    { role: "Labels", family: "Share Tech Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#030A06",
    additive: true,
    additiveBase: true,
    glow: 3.8,
    layout: "orbit",
    edge: { color: "#3DF58E", alpha: 0.3, width: 0.9, curve: 0 },
    money: { color: "#FF4D7A", alpha: 1, width: 1.9, weak: 1, weakAlpha: 0.55, mode: "dash" },
    contact: { color: "#42D9FF", alpha: 0.8, width: 1, dash: 0 },
    node: { stroke: 1.5, hollowOfficials: true, halo: 6, scale: 1.1 },
    focus: { color: "#FFFFFF", ring: 1.5 },
    guide: { color: "#3DF58E", alpha: 0.5 },
    map: {
      border: { color: "#3DF58E", alpha: 0.5, width: 0.9 },
      dot: { color: "#3DF58E", alpha: 0.8, min: 0.4, max: 1.4, shape: 1, halo: 0, jitter: 0 },
      pixel: true,
      arc: { color: "#FF4D7A", alpha: 1, width: 1.7, mode: "dash" },
      city: { color: "#FFFFFF", shape: 1, fill: 1 },
      event: { color: "#FFE14D" },
    },
    deep: {
      form: "dome", pitch: 0.5, yaw: 0.5, sway: 0.34, swayPeriod: 60, aperture: 0, fogFloor: 0.3,
      mapPitch: 0.6, mapYaw: 0.34, labels: ["Scope", "Dome"], mapLabel: "Extrude", mapKey: "Pixel brightness and outline height are giving", mapScale: 0.9,
    },
  },
  motion: {
    enter: 520,
    stagger: 60,
    reveal: 1900,
    morph: 1300,
    hover: 90,
    layout: 440,
    expand: 240,
    sort: 380,
    ease: "cubic-bezier(0.3, 0, 0.2, 1)",
    notes: [
      { name: "Switch on", what: "Each panel opens from a bright line across its middle, the way a tube comes up, when it enters the view.", timing: "520 ms a panel, 60 ms apart" },
      { name: "Trace", what: "The beam draws the rings from the pole outward, then each tie from source to target.", timing: "1.9 s, on the GPU" },
      { name: "Inflate", what: "Scope to Dome lifts the rings into latitudes and tips the camera in one move.", timing: "1.3 s" },
      { name: "Sweep", what: "The meridians turn around the pole while the camera swings slowly. Both stop under the pointer.", timing: "60 s a cycle" },
      { name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

export const THEMES: Theme[] = [vellum, floe, consoleTheme, orrery, massif, phosphor];
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? vellum;

export interface Interaction {
  name: string;
  what: string;
  timing: (m: Motion) => string;
  action?: { label: string; run: string };
}

// `run` is a command the app shell carries out when the reader presses the button beside the entry.
export const INTERACTIONS: Interaction[] = [
  { name: "Tooltip", what: "Data marks answer at once. Labels and icon buttons wait a third of a second, then the next ones open without waiting.", timing: (m) => `0 to 350 ms, fade ${m.hover} ms` },
  { name: "Open a row", what: "Rows open in place and move the later rows down.", timing: (m) => `${m.expand} ms`, action: { label: "Open a filing", run: "filing" } },
  { name: "Sort", what: "Rows travel to their new places so one can be followed.", timing: (m) => `${m.sort} ms, rows 14 ms apart`, action: { label: "Sort by amount", run: "sort" } },
  { name: "Full size", what: "A panel takes the stage and the rest fold to tiles in a rail.", timing: (m) => `${m.layout} ms`, action: { label: "Stage the network", run: "stage" } },
  { name: "Dossier", what: "An entity name opens its dossier in a drawer and the board narrows to make room.", timing: (m) => `${m.layout} ms`, action: { label: "Open Petra Voss", run: "dossier" } },
  { name: "Linked marks", what: "Pointing at a mark lights its counterparts elsewhere.", timing: () => "0 ms" },
  { name: "Measure", what: "Dragging across the timeline counts what falls inside.", timing: () => "follows the pointer", action: { label: "Measure the 90 days", run: "brush" } },
  { name: "Commit", what: "Add to brief steps the count in the top bar.", timing: (m) => `${m.expand} ms` },
];

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

export interface Note { name: string; what: string; timing: string }
export type NoteKey = "entry" | "reveal" | "morph" | "rest" | "money" | "selector";

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
  // Each note describes one movement and is shown as a tooltip on the element named by `on`.
  notes: (Note & { on: NoteKey })[];
}

export interface GpuStyle {
  vizBg: string;
  additive: boolean;
  additiveBase?: boolean;
  glow?: number;
  // Sector colours inside the GPU views, for a theme whose views sit on a ground unlike the page.
  sectors?: [string, string, string, string];
  block?: BlockStyle;
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
  // Network blocks become keys of one size on a lattice of this pitch, with unlit keys in the empty places and
  // ties routed along the gaps. lamp brightens the middle of each top.
  keys?: { pitch: number; blank: string; lamp: number };
}

export interface Theme {
  id: ThemeId;
  family: ThemeId;
  name: string;
  mode: "light" | "dark";
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
    node: { stroke: 1.1, hollowOfficials: true, halo: 0, scale: 0.65 },
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
      { on: "entry", name: "Plot in", what: "Frames wipe in from the left when they come into view. Lines draw, bars rise left to right, and the money flow wipes from sources to recipients.", timing: "520 ms a panel, 45 ms apart" },
      { on: "reveal", name: "Ink ties", what: "Network ties and state borders draw from source to target.", timing: "1.5 s, on the GPU" },
      { on: "morph", name: "Pull apart", what: "Flat to Strata separates the sheets and tips the camera in one move.", timing: "1.1 s" },
      { on: "rest", name: "Drift", what: "The stack sways slowly and stops under the pointer.", timing: "26 s a cycle" },
      { on: "money", name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
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
    node: { stroke: 1.2, hollowOfficials: true, halo: 0, scale: 0.65 },
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
      { on: "entry", name: "Wind up", what: "Plates fade up as they come into view while the tick scale under each title sweeps across. Lines draw and the money flow wipes from sources to recipients.", timing: "700 ms a panel, 60 ms apart" },
      { on: "reveal", name: "Sweep", what: "Rings sweep round from twelve o'clock and nodes light as their ring arrives.", timing: "2.2 s, on the GPU" },
      { on: "morph", name: "Lift off", what: "Plan to Armillary raises every stem off its ring and tips the camera in one move.", timing: "1.4 s" },
      { on: "rest", name: "Turn", what: "The instrument swings slowly while tick scales turn against it. Both stop under the pointer.", timing: "48 s a cycle" },
      { on: "money", name: "Money", what: "Pulses travel along arcs and ribbons in the direction the money moved.", timing: "a pulse every 4 to 6 s" },
    ],
  },
};

const floe: Theme = {
  id: "floe",
  family: "floe",
  name: "Floe",
  mode: "light",
  concept:
    "A white massing model on a survey sheet. Entities stand as blocks as tall as their weight in the case, the sun is low, and one blue carries the money.",
  lineage: "White embossed instrument panels, architectural models, polar survey charts",
  vars: {
    "--bg": "#ECEEEF",
    "--bg-image":
      "radial-gradient(circle, rgba(31,37,43,0.15) 0.7px, transparent 1.2px) 12px 12px / 24px 24px, radial-gradient(120% 90% at 50% 10%, #F6F7F8 0%, #ECEEEF 50%, #DBDFE2 100%)",
    "--surface": "transparent",
    "--surface-2": "#DDE2E5",
    "--viz-bg": "#E9ECEE",
    "--viz-image": "none",
    "--viz-image-size": "auto",
    "--viz-ink": "#1F252B",
    "--ink": "#1F252B",
    "--ink-2": "#55606A",
    "--ink-3": "#8A949C",
    "--rule": "rgba(31,37,43,0.16)",
    "--rule-strong": "rgba(31,37,43,0.85)",
    "--accent": "#3D65B5",
    "--accent-text": "#30539C",
    "--accent-ink": "#FFFFFF",
    "--gov": "#2F8F85",
    "--corp": "#1F252B",
    "--inter": "#3D65B5",
    "--event": "#68747E",
    "--money": "#3D65B5",
    "--contact": "#2F8F85",
    "--dem": "#4F86B5",
    "--rep": "#D6453D",
    "--ind": "#8A949C",
    "--alert": "#D6453D",
    "--ok": "#3F9C8C",
    "--tint": "#A9CFC8",
    "--font-display": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-ui": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-text": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-label": "'IBM Plex Mono', ui-monospace, monospace",
    "--font-num": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--display-weight": "300",
    "--display-track": "0.14em",
    "--display-case": "uppercase",
    "--title-size": "12.5px",
    "--title-weight": "600",
    "--label-case": "uppercase",
    "--label-track": "0.07em",
    "--label-size": "10px",
    "--label-weight": "400",
    "--ui-size": "14.5px",
    "--text-size": "16.5px",
    "--text-leading": "1.5",
    "--num-weight": "600",
    "--radius": "0px",
    "--radius-ctl": "0px",
    "--rule-w": "1px",
    "--stroke": "1",
    "--stroke-bold": "1.75",
    "--mast-size": "96px",
    "--font-name": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--name-weight": "500",
    "--name-track": "0",
    "--chart-font": "'IBM Plex Mono', ui-monospace, monospace",
    "--chart-size": "10.5px",
    "--chart-weight": "400",
    "--chart-case": "uppercase",
    "--chart-track": "0.04em",
    "--net-font": "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
    "--net-size": "12.5px",
    "--net-weight": "500",
    "--net-case": "none",
    "--net-track": "0.01em",
    "--redact": "#1F252B",
  },
  palette: [
    { name: "Pack ice", role: "ground", var: "--bg" },
    { name: "Polar night", role: "ink, corporate", var: "--ink" },
    { name: "Glacier blue", role: "money, intermediaries", var: "--accent" },
    { name: "Sea green", role: "government, contact", var: "--gov" },
    { name: "Meltwater", role: "quiet fills", var: "--tint" },
    { name: "Slate", role: "events, notes", var: "--ink-3" },
  ],
  type: [
    { role: "Titles, reading, figures", family: "Barlow Semi Condensed", sample: "Twenty-six contacts in ninety days", var: "--font-text" },
    { role: "Captions", family: "IBM Plex Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#E9ECEE",
    additive: false,
    layout: "force",
    block: {
      paint: "plain", top: "#FFFFFF", side: "#F0F3F5", ink: "#1F252B", inkAlpha: 0.1, outline: 0.6,
      shadow: 0.55, shadowColor: "#55616C", focus: "#3D65B5", glyph: null,
      ramp: ["#F6F8F8", "#E3ECEB", "#C6DAD7", "#A3C4C0", "#7FAAA8"], hover: "#3D65B5", stepped: false, coarse: false, width: 1.5,
    },
    edge: { color: "#1F252B", alpha: 0.3, width: 0.8, curve: 0 },
    money: { color: "#3D65B5", alpha: 1, width: 1.7, weak: 0.8, weakAlpha: 0.6, mode: "dash" },
    contact: { color: "#2F8F85", alpha: 0.8, width: 0.9, dash: 3 },
    node: { stroke: 1.1, hollowOfficials: true, halo: 0, scale: 0.7 },
    focus: { color: "#3D65B5", ring: 1.3 },
    guide: { color: "#1F252B", alpha: 0.24 },
    map: {
      border: { color: "#1F252B", alpha: 0, width: 0.6 },
      dot: { color: "#1F252B", alpha: 0.6, min: 0.45, max: 2.4, shape: 0, halo: 0, jitter: 0 },
      arc: { color: "#3D65B5", alpha: 1, width: 1.4, mode: "dash" },
      city: { color: "#1F252B", shape: 0, fill: -1 },
      event: { color: "#2F8F85" },
    },
    deep: {
      form: "blocks", pitch: 0.74, yaw: -0.62, sway: 0.06, swayPeriod: 30, aperture: 0, fogFloor: 0.72,
      mapPitch: 0.8, mapYaw: -0.34, labels: ["Plan", "Massing"], mapLabel: "Massing", mapKey: "Block height is giving",
    },
  },
  motion: {
    enter: 420,
    stagger: 35,
    reveal: 1500,
    morph: 1000,
    hover: 140,
    layout: 340,
    expand: 200,
    sort: 300,
    ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    notes: [
      { on: "entry", name: "Rule in", what: "The heavy rule under each title runs out from its tab when the panel comes into view, then the content fades up beneath it.", timing: "420 ms a panel, 35 ms apart" },
      { on: "reveal", name: "Extrude", what: "Blocks rise out of the sheet from the centre outward.", timing: "1.5 s, on the GPU" },
      { on: "morph", name: "Raise", what: "Plan to Massing lifts every block to its height and lengthens the shadows with it.", timing: "1 s" },
      { on: "rest", name: "Drift", what: "The model turns a few degrees each way and stops under the pointer.", timing: "30 s a cycle" },
      { on: "money", name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
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
    hover: 100,
    layout: 400,
    expand: 240,
    sort: 360,
    ease: "cubic-bezier(0.2, 0.7, 0.1, 1)",
    notes: [
      { on: "entry", name: "Fade in", what: "A bay fades in when it comes into view. Charts draw left to right and the money flow runs from sources to recipients.", timing: "420 ms a bay, 60 ms apart" },
      { on: "reveal", name: "Light up", what: "Keys light from the centre outward and rise to their height.", timing: "1.4 s, on the GPU" },
      { on: "morph", name: "Raise", what: "Plan to Board raises every key and tips the view.", timing: "0.9 s" },
      { on: "selector", name: "Selector", what: "The switch turns one detent a click and moves to the next motion level.", timing: "240 ms, in three steps" },
      { on: "money", name: "Money", what: "Dashes march along the routed ties and the ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

const massif: Theme = {
  id: "massif",
  family: "massif",
  name: "Massif",
  mode: "dark",
  concept:
    "A landscape of influence under a night sky. The ground rises wherever entities and money crowd together, drawn as a field of lit points, and one red route colour carries the money across it.",
  lineage: "Dot-matrix terrain, greyscale relief with a glowing route, glass panels with small mono labels",
  vars: {
    "--bg": "#0A0D10",
    "--bg-image": "radial-gradient(90% 60% at 50% 0%, #151B21 0%, #0A0D10 62%)",
    "--surface": "rgba(19,24,30,0.74)",
    "--surface-2": "#1C232B",
    "--viz-bg": "#07090B",
    "--viz-image": "radial-gradient(70% 70% at 50% 62%, #10151A 0%, #07090B 80%)",
    "--viz-image-size": "auto",
    "--viz-ink": "#E8ECEF",
    "--ink": "#E8ECEF",
    "--ink-2": "#A2ABB3",
    "--ink-3": "#69727B",
    "--rule": "rgba(154,163,171,0.2)",
    "--rule-strong": "rgba(232,236,239,0.6)",
    "--accent": "#FF4A1C",
    "--accent-text": "#FF6E48",
    "--accent-ink": "#0A0D10",
    "--gov": "#4FAEF0",
    "--corp": "#E8ECEF",
    "--inter": "#FF4A1C",
    "--event": "#E8C35A",
    "--money": "#FF4A1C",
    "--contact": "#4FAEF0",
    "--dem": "#4FAEF0",
    "--rep": "#F2617A",
    "--ind": "#A2ABB3",
    "--alert": "#FF4A1C",
    "--ok": "#5FD0A0",
    "--gold": "#E8C35A",
    "--font-display": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-ui": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-text": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--font-label": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--font-num": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--display-weight": "600",
    "--display-track": "0.05em",
    "--display-case": "uppercase",
    "--title-size": "12.5px",
    "--title-weight": "600",
    "--label-case": "uppercase",
    "--label-track": "0.1em",
    "--label-size": "9.5px",
    "--label-weight": "500",
    "--ui-size": "14px",
    "--text-size": "15.5px",
    "--text-leading": "1.55",
    "--num-weight": "500",
    "--radius": "3px",
    "--radius-ctl": "2px",
    "--rule-w": "1px",
    "--stroke": "1.1",
    "--stroke-bold": "1.9",
    "--mast-size": "100px",
    "--font-name": "'Saira Semi Condensed', 'Arial Narrow', sans-serif",
    "--name-weight": "500",
    "--name-track": "0.01em",
    "--chart-font": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--chart-size": "10px",
    "--chart-weight": "500",
    "--chart-case": "uppercase",
    "--chart-track": "0.06em",
    "--net-font": "'JetBrains Mono Variable', ui-monospace, monospace",
    "--net-size": "10px",
    "--net-weight": "500",
    "--net-case": "uppercase",
    "--net-track": "0.08em",
    "--redact": "#39424B",
  },
  palette: [
    { name: "Basalt", role: "ground", var: "--bg" },
    { name: "Snow", role: "ink, terrain, corporate", var: "--ink" },
    { name: "Route red", role: "money, intermediaries, focus", var: "--accent" },
    { name: "Azure", role: "government, contact", var: "--gov" },
    { name: "Survey gold", role: "events, coordinates", var: "--gold" },
    { name: "Scree", role: "labels, notes", var: "--ink-2" },
  ],
  type: [
    { role: "Titles and reading", family: "Saira Semi Condensed", sample: "TWENTY-SIX CONTACTS IN NINETY DAYS", var: "--font-display" },
    { role: "Labels and figures", family: "JetBrains Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#07090B",
    additive: true,
    glow: 2.6,
    layout: "force",
    edge: { color: "#A2ABB3", alpha: 0.26, width: 0.7, curve: 0.1 },
    money: { color: "#FF4A1C", alpha: 1, width: 1.7, weak: 0.8, weakAlpha: 0.55, mode: "pulse" },
    contact: { color: "#4FAEF0", alpha: 0.65, width: 0.8, dash: 0 },
    node: { stroke: 1.2, hollowOfficials: true, halo: 0, scale: 0.65 },
    focus: { color: "#FF4A1C", ring: 1.4 },
    guide: { color: "#A2ABB3", alpha: 0.4 },
    map: {
      border: { color: "#A2ABB3", alpha: 0.34, width: 0.6 },
      dot: { color: "#E8ECEF", alpha: 1, min: 0.5, max: 2.1, shape: 0, halo: 0, jitter: 0 },
      arc: { color: "#FF4A1C", alpha: 1, width: 1.5, mode: "pulse" },
      city: { color: "#E8ECEF", shape: 1, fill: -1 },
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
      { on: "entry", name: "Lock on", what: "Corner brackets close in on each panel as it comes into view while the glass fades up.", timing: "600 ms a panel, 55 ms apart" },
      { on: "reveal", name: "Survey", what: "The point field lights from the centre outward, then stems and routes follow.", timing: "2 s, on the GPU" },
      { on: "morph", name: "Uplift", what: "Flat to Relief raises the ground under the points and drops the camera to a low angle.", timing: "1.5 s" },
      { on: "rest", name: "Orbit", what: "The camera drifts around the landform. Near and far points go soft with distance.", timing: "40 s a cycle" },
      { on: "money", name: "Money", what: "Pulses travel along routes and ribbons in the direction the money moved.", timing: "a pulse every 4 to 6 s" },
    ],
  },
};

const phosphor: Theme = {
  id: "phosphor",
  family: "phosphor",
  name: "Phosphor",
  mode: "dark",
  concept:
    "A vector display with nothing filled in. Red draws the frames, amber the labels and the money, green the data, and the network sits on a wire dome with the subject at its pole.",
  lineage: "Vector arcade tubes, neon isometric wireframes, radar scopes",
  vars: {
    "--bg": "#170D1B",
    "--bg-image": "radial-gradient(90% 70% at 50% 18%, #25132B 0%, #170D1B 55%, #0E0711 100%)",
    "--surface": "transparent",
    "--surface-2": "rgba(255,74,43,0.13)",
    "--viz-bg": "#110915",
    "--viz-image": "radial-gradient(65% 65% at 50% 52%, #1F1025 0%, #0D0610 82%)",
    "--viz-image-size": "auto",
    "--viz-ink": "#F4E8CF",
    "--ink": "#F4E8CF",
    "--ink-2": "#F0B03A",
    "--ink-3": "#A07E48",
    "--rule": "rgba(255,74,43,0.4)",
    "--rule-strong": "#FF4A2B",
    "--accent": "#FFC53D",
    "--accent-text": "#FFC53D",
    "--accent-ink": "#170D1B",
    "--gov": "#9A8CFF",
    "--corp": "#2FD9A0",
    "--inter": "#FFC53D",
    "--event": "#E85AD0",
    "--money": "#FFC53D",
    "--contact": "#3DE6E0",
    "--dem": "#8F9BFF",
    "--rep": "#FF4A2B",
    "--ind": "#9AE34A",
    "--alert": "#FF4A2B",
    "--ok": "#2FD9A0",
    "--frame": "#FF4A2B",
    "--font-display": "'Michroma', 'Eurostile', sans-serif",
    "--font-ui": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--font-text": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--font-label": "'Share Tech Mono', ui-monospace, monospace",
    "--font-num": "'Share Tech Mono', ui-monospace, monospace",
    "--display-weight": "400",
    "--display-track": "0.08em",
    "--display-case": "uppercase",
    "--title-size": "10.5px",
    "--title-weight": "400",
    "--label-case": "uppercase",
    "--label-track": "0.08em",
    "--label-size": "11.5px",
    "--label-weight": "400",
    "--ui-size": "14.5px",
    "--text-size": "15.5px",
    "--text-leading": "1.55",
    "--num-weight": "400",
    "--radius": "0px",
    "--radius-ctl": "0px",
    "--rule-w": "1px",
    "--stroke": "1.4",
    "--stroke-bold": "2",
    "--mast-size": "58px",
    "--font-name": "'Chakra Petch', 'Arial Narrow', sans-serif",
    "--name-weight": "500",
    "--name-track": "0.01em",
    "--chart-font": "'Share Tech Mono', ui-monospace, monospace",
    "--chart-size": "11.5px",
    "--chart-weight": "400",
    "--chart-case": "uppercase",
    "--chart-track": "0.05em",
    "--net-font": "'Share Tech Mono', ui-monospace, monospace",
    "--net-size": "11.5px",
    "--net-weight": "400",
    "--net-case": "uppercase",
    "--net-track": "0.06em",
    "--redact": "#5A2A32",
  },
  palette: [
    { name: "Tube black", role: "ground", var: "--bg" },
    { name: "Frame red", role: "rules, frames, alerts", var: "--frame" },
    { name: "Amber", role: "labels, money, focus", var: "--accent" },
    { name: "Trace green", role: "data, corporate", var: "--corp" },
    { name: "Violet", role: "government", var: "--gov" },
    { name: "Cyan", role: "contact", var: "--contact" },
  ],
  type: [
    { role: "Titles", family: "Michroma", sample: "CONTACTS :: 26", var: "--font-display" },
    { role: "Reading", family: "Chakra Petch", sample: "Voss left this office nineteen months earlier.", var: "--font-text" },
    { role: "Labels and figures", family: "Share Tech Mono", sample: "LD-2 2025 Q3  $2,940,000", var: "--font-label" },
  ],
  gpu: {
    vizBg: "#110915",
    additive: true,
    additiveBase: true,
    glow: 3.4,
    layout: "orbit",
    edge: { color: "#FF4A2B", alpha: 0.34, width: 0.9, curve: 0 },
    money: { color: "#FFC53D", alpha: 1, width: 1.6, weak: 0.9, weakAlpha: 0.5, mode: "dash" },
    contact: { color: "#3DE6E0", alpha: 0.75, width: 0.9, dash: 0 },
    node: { stroke: 1.5, hollowOfficials: true, hollowAll: true, halo: 5, scale: 0.7 },
    focus: { color: "#FFC53D", ring: 1.4 },
    guide: { color: "#2FD9A0", alpha: 0.42 },
    map: {
      border: { color: "#2FD9A0", alpha: 0.36, width: 0.8 },
      dot: { color: "#2FD9A0", alpha: 0, min: 0.4, max: 1.4, shape: 6, halo: 0, jitter: 0 },
      arc: { color: "#FFC53D", alpha: 1, width: 1.5, mode: "dash" },
      city: { color: "#FFC53D", shape: 2, fill: -1 },
      event: { color: "#E85AD0" },
    },
    deep: {
      form: "dome", pitch: 0.5, yaw: 0.5, sway: 0.34, swayPeriod: 60, aperture: 0, fogFloor: 0.3,
      mapPitch: 0.6, mapYaw: 0.34, labels: ["Scope", "Dome"], mapLabel: "Extrude", mapKey: "Outline height is giving", mapScale: 0.9,
    },
  },
  motion: {
    enter: 500,
    stagger: 50,
    reveal: 1900,
    morph: 1300,
    hover: 120,
    layout: 440,
    expand: 240,
    sort: 380,
    ease: "cubic-bezier(0.3, 0, 0.2, 1)",
    notes: [
      { on: "entry", name: "Strike", what: "Each frame flickers on like a tube warming up when it comes into view. Lines draw and the money flow wipes from sources to recipients.", timing: "500 ms a panel, 50 ms apart" },
      { on: "reveal", name: "Trace", what: "The beam draws the rings from the pole outward, then each tie from source to target.", timing: "1.9 s, on the GPU" },
      { on: "morph", name: "Inflate", what: "Scope to Dome lifts the rings into latitudes and tips the camera in one move.", timing: "1.3 s" },
      { on: "rest", name: "Sweep", what: "The meridians turn around the pole while the camera swings slowly. Both stop under the pointer.", timing: "60 s a cycle" },
      { on: "money", name: "Money", what: "Dashes march along ties and ribbons in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

export const THEMES: Theme[] = [vellum, floe, consoleTheme, orrery, massif];
// Phosphor stays out of the selector and the number keys but still loads from #phosphor.
const ALL_THEMES = [...THEMES, phosphor];
export const themeById = (id: string) => ALL_THEMES.find((t) => t.id === id) ?? vellum;

// Notes on how the page answers the reader. Timings come from the theme.
const RESPONSES: Record<string, { name: string; what: string; timing: (m: Motion) => string }> = {
  row: { name: "Open a row", what: "The row opens in place and moves the later rows down.", timing: (m) => `${m.expand} ms` },
  sort: { name: "Sort", what: "Rows travel to their new places so one can be followed.", timing: (m) => `${m.sort} ms, rows 14 ms apart` },
  full: { name: "Full size", what: "The panel takes the stage and the rest fold to tiles in a rail.", timing: (m) => `${m.layout} ms` },
  dossier: { name: "Dossier", what: "The entity's dossier opens in a drawer and the board narrows to make room.", timing: (m) => `${m.layout} ms` },
  linked: { name: "Linked marks", what: "Pointing at a row lights its counterpart in the view beside it.", timing: () => "at once" },
  measure: { name: "Measure", what: "Dragging across the timeline counts what falls inside.", timing: () => "follows the pointer" },
  commit: { name: "Commit", what: "Adding to the brief steps the count in the top bar.", timing: (m) => `${m.expand} ms` },
};

export function notesFor(theme: Theme): Record<string, Note> {
  const m = theme.motion;
  const out: Record<string, Note> = {};
  for (const [k, r] of Object.entries(RESPONSES)) out[k] = { name: r.name, what: r.what, timing: r.timing(m) };
  for (const n of m.notes) out[n.on] = n;
  return out;
}

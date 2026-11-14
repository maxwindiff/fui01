export type ThemeId = "vellum" | "strata" | "orrery" | "armillary";
export type RGBA = [number, number, number, number];

export interface DeepSpace {
  form: "strata" | "armillary";
  pitch: number;
  yaw: number;
  sway: number;
  swayPeriod: number;
  aperture: number;
  fogFloor: number;
  mapPitch: number;
  mapYaw: number;
  labels: [string, string];
}

export interface Motion {
  enter: number;
  stagger: number;
  reveal: number;
  morph: number;
  hover: number;
  ease: string;
  notes: { name: string; what: string; timing: string }[];
}

export interface GpuStyle {
  vizBg: string;
  additive: boolean;
  layout: "force" | "orbit";
  edge: { color: string; alpha: number; width: number; curve: number };
  money: { color: string; alpha: number; width: number; weak: number; weakAlpha: number; mode: "dash" | "pulse" };
  contact: { color: string; alpha: number; width: number; dash: number };
  node: { stroke: number; hollowOfficials: boolean; halo: number; scale: number };
  focus: { color: string; ring: number };
  guide: { color: string; alpha: number };
  map: {
    border: { color: string; alpha: number; width: number };
    dot: { color: string; alpha: number; min: number; max: number; shape: number; halo: number; jitter: number };
    arc: { color: string; alpha: number; width: number; mode: "dash" | "pulse" };
    city: { color: string; shape: number; fill: number };
    event: { color: string };
  };
  deep?: DeepSpace;
}

export interface Theme {
  id: ThemeId;
  family: "vellum" | "orrery";
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
    "Drafting film under a light table. Graphite hairlines carry the structure, indigo traces mark government, orange marks money, and reading text is set in a book serif with notes in the margin.",
  lineage: "Paper schematics, ink orbit plots, faded indigo route diagrams",
  vars: {
    "--bg": "#E6EBE4",
    "--bg-image":
      "radial-gradient(120% 90% at 50% 18%, #F0F4ED 0%, #E6EBE4 48%, #D3DAD3 100%)",
    "--surface": "rgba(244,247,241,0.55)",
    "--surface-2": "#DAE0D9",
    "--viz-bg": "#EBEFE8",
    "--viz-image":
      "radial-gradient(circle at 1px 1px, rgba(23,27,26,0.16) 0.7px, transparent 1.1px)",
    "--viz-image-size": "22px 22px",
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
  },
  motion: {
    enter: 520,
    stagger: 45,
    reveal: 1500,
    morph: 1100,
    hover: 180,
    ease: "cubic-bezier(0.2, 0.7, 0.1, 1)",
    notes: [
      { name: "Plot in", what: "Each frame wipes in from the left as if a pen plotter drew it. Chart lines draw along their own length and bars rise from the baseline.", timing: "520 ms a panel, 45 ms apart" },
      { name: "Ink ties", what: "Network ties and state borders draw from source to target, then nodes land with a slight overshoot.", timing: "1.5 s, drawn on the GPU" },
      { name: "Money", what: "Dashes march along money ties in the direction the money moved. Nothing else moves at rest.", timing: "0.9 dash lengths a second" },
      { name: "Respond", what: "Hover rings, tooltips and row highlights answer the pointer without easing in.", timing: "under 180 ms" },
    ],
  },
};

const orrery: Theme = {
  id: "orrery",
  family: "orrery",
  name: "Orrery",
  mode: "dark",
  concept:
    "A brass instrument in a dark room. The subject sits at the centre and everything else orbits on engraved rings by degree of separation. Amber carries money, teal carries government, ivory is for reading.",
  lineage: "Engraved astrolabes, amber terrain tables, thin gold line art on black",
  vars: {
    "--bg": "#0B0906",
    "--bg-image":
      "radial-gradient(80% 55% at 50% 0%, #1A140B 0%, #0B0906 62%)",
    "--surface": "#120F0A",
    "--surface-2": "#1C1710",
    "--viz-bg": "#0E0B07",
    "--viz-image":
      "radial-gradient(70% 70% at 50% 50%, #17120A 0%, #0E0B07 70%)",
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
  },
  motion: {
    enter: 700,
    stagger: 60,
    reveal: 2200,
    morph: 1400,
    hover: 220,
    ease: "cubic-bezier(0.3, 0, 0.1, 1)",
    notes: [
      { name: "Wind up", what: "Each plate fades up while the tick scale under its title sweeps from left to right. Chart lines draw along their own length.", timing: "700 ms a panel, 60 ms apart" },
      { name: "Sweep", what: "Rings sweep round from twelve o'clock, innermost first, and nodes light as their ring arrives.", timing: "2.2 s, drawn on the GPU" },
      { name: "Clockwork", what: "Tick scales turn slowly, each ring at its own rate, and pulses travel along money ties in the direction the money moved.", timing: "one turn in 4 to 12 minutes" },
      { name: "Respond", what: "Hover rings, tooltips and row highlights answer the pointer with a short glow.", timing: "under 220 ms" },
    ],
  },
};

const strata: Theme = {
  ...vellum,
  id: "strata",
  name: "Strata",
  concept:
    "Vellum pulled apart into sheets. Government, intermediaries and companies each sit on a sheet of film, stacked over the light table, and ties pass between them. Panels hang at a slight angle and turn to face the reader when touched.",
  lineage: "Tilted schematic sheets, layered film, shallow depth of field",
  gpu: {
    ...vellum.gpu,
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
    },
  },
  motion: {
    ...vellum.motion,
    enter: 760,
    stagger: 60,
    notes: [
      { name: "Lay down", what: "Sheets drop onto the table from behind the page plane, one after another, and settle at their resting angle.", timing: "760 ms a sheet, 60 ms apart" },
      { name: "Pull apart", what: "Switching between Flat and Strata separates the three layers and tips the camera in a single move, so each node keeps its place and the reader keeps their bearings.", timing: "1.1 s, ease in and out" },
      { name: "Face the reader", what: "A panel under the pointer or holding focus turns flat and steps forward. Neighbours stay tilted. Text is read on a flat sheet.", timing: "180 ms" },
      { name: "Drift", what: "At rest the stack sways a few degrees so depth reads through parallax. Sheets away from the focal plane soften. The sway stops while the pointer is over the view.", timing: "26 s a cycle" },
      { name: "Money", what: "Dashes march along money ties, down or up through the sheets in the direction the money moved.", timing: "0.9 dash lengths a second" },
    ],
  },
};

const armillary: Theme = {
  ...orrery,
  id: "armillary",
  name: "Armillary",
  concept:
    "Orrery raised off the table. Rings step down from the centre like the plates of an astrolabe, each entity stands on a stem as tall as its weight in the case, and money arcs overhead. The instrument turns slowly until touched.",
  lineage: "Tilted ring instruments, terrain tables with markers on stems, astrolabe plates",
  gpu: {
    ...orrery.gpu,
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
    },
  },
  motion: {
    ...orrery.motion,
    enter: 900,
    stagger: 70,
    notes: [
      { name: "Raise", what: "Plates swing up from lying flat and lock at their resting angle while the tick scale under each title sweeps across.", timing: "900 ms a plate, 70 ms apart" },
      { name: "Lift off", what: "Switching between Plan and Armillary raises every stem from the ring it stands on and tips the camera in a single move.", timing: "1.4 s, ease in and out" },
      { name: "Face the reader", what: "A panel under the pointer or holding focus turns flat and steps forward, and its rim brightens.", timing: "220 ms" },
      { name: "Turn", what: "At rest the instrument swings slowly through a third of a turn and back. Tick scales turn against it at their own rates. Both stop while the pointer is over the view.", timing: "48 s a cycle" },
      { name: "Money", what: "Pulses travel along the arcs overhead in the direction the money moved.", timing: "one pulse every 4 to 6 s" },
    ],
  },
};

export const THEMES: Theme[] = [vellum, strata, orrery, armillary];
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? vellum;

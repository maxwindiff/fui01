export interface MotionLevel { id: number; name: string; what: string }

export const MOTION_LEVELS: MotionLevel[] = [
  { id: 0, name: "Still", what: "Nothing animates. Every change shows at once." },
  { id: 1, name: "Quiet", what: "Motion answers the reader and does nothing else: panels travel to new places, rows open, sorted rows move, the camera glides." },
  { id: 2, name: "Standard", what: "Adds entry. A panel draws itself when it comes into view or onto the stage, money travels along its ties, and the 3D views sway slowly." },
  { id: 3, name: "Lively", what: "Adds movement at rest. Money streams through the flow chart, key marks pulse, readouts count up, the sway widens, and a panel draws itself again each time it returns to view." },
];

const KEY = "fui01-motion";
const prefersLess = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null && MOTION_LEVELS[+saved]) return +saved;
  } catch { /* storage can be blocked */ }
  return prefersLess ? 0 : 2;
}

// Read by code that runs outside React, such as the GPU frame loop.
export const motion = { level: initial() };
const listeners = new Set<() => void>();
export const onMotionChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function applyMotionLevel(level: number) {
  motion.level = level;
  const root = document.documentElement;
  root.dataset.motion = String(level);
  root.toggleAttribute("data-entry", level >= 2);
  root.toggleAttribute("data-ambient", level === 3);
  try { localStorage.setItem(KEY, String(level)); } catch { /* storage can be blocked */ }
  listeners.forEach((f) => f());
}

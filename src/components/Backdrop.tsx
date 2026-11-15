import { useEffect, useRef } from "react";
import { mulberry32 } from "../data";
import { motion, onMotionChange } from "../motion";

const TILE = 1280;
const GRID = 160;

// Contour lines of a height field that repeats every TILE pixels down the page, so the layer can scroll without an end.
function drawTopo(width: number): string {
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = TILE;
  const g = cv.getContext("2d")!;
  const rand = mulberry32(11);
  const waves = Array.from({ length: 7 }, (_, k) => ({
    a: 1 / (1 + k * 0.55), kx: (0.6 + rand() * 2.4) / 520, n: 1 + Math.floor(rand() * 3), p: rand() * 6.28, q: rand() * 6.28,
  }));
  const w2 = (Math.PI * 2) / TILE;
  const f = (x: number, y: number) => {
    const wx = x + 70 * Math.sin(y * w2 * 2 + 1.3), wy = y + 50 * Math.sin(x / 310);
    let v = 0;
    for (const w of waves) v += w.a * Math.sin(wx * w.kx + w.p) * Math.cos(wy * w2 * w.n + w.q);
    return v;
  };
  const step = 10, cols = Math.ceil(width / step), rows = TILE / step;
  const h = new Float32Array((cols + 1) * (rows + 1));
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) h[r * (cols + 1) + c] = f(c * step, r * step);
  const levels = 13;
  for (let l = 0; l < levels; l++) {
    const v = -1.5 + (l / (levels - 1)) * 3;
    const index = l % 4 === 0;
    g.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * (cols + 1) + c;
        const a = h[i], b = h[i + 1], d = h[i + cols + 1], e = h[i + cols + 2];
        const pts: number[] = [];
        const cut = (v0: number, v1: number, x0: number, y0: number, x1: number, y1: number) => {
          if ((v0 < v) === (v1 < v)) return;
          const t = (v - v0) / (v1 - v0);
          pts.push((x0 + (x1 - x0) * t) * step, (y0 + (y1 - y0) * t) * step);
        };
        cut(a, b, c, r, c + 1, r);
        cut(b, e, c + 1, r, c + 1, r + 1);
        cut(d, e, c, r + 1, c + 1, r + 1);
        cut(a, d, c, r, c, r + 1);
        for (let k = 0; k + 3 < pts.length; k += 4) { g.moveTo(pts[k], pts[k + 1]); g.lineTo(pts[k + 2], pts[k + 3]); }
      }
    }
    g.strokeStyle = index ? "rgba(96, 214, 228, 0.2)" : "rgba(96, 214, 228, 0.085)";
    g.lineWidth = index ? 1.2 : 1;
    g.stroke();
  }
  return cv.toDataURL();
}

// Layers behind the board: a survey grid, contour lines, drifting fog and dust. Each scrolls at its own rate.
export function Backdrop() {
  const root = useRef<HTMLDivElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = root.current!;
    const grid = el.querySelector<HTMLElement>(".bd-grid")!;
    const topo = el.querySelector<HTMLElement>(".bd-topo")!;
    topo.style.backgroundImage = `url(${drawTopo(Math.max(1920, screen.width))})`;

    const cv = dust.current!;
    const g = cv.getContext("2d")!;
    const rand = mulberry32(5);
    const motes = Array.from({ length: 84 }, () => ({
      x: rand(), y: rand(), z: 0.12 + rand() * 0.88, vx: (rand() - 0.5) * 0.004, vy: -0.0015 - rand() * 0.004, tw: rand() * 6.28, hot: rand() < 0.1,
    }));
    let w = 0, h = 0, raf = 0, last = 0, t = 0;
    const size = () => {
      const k = Math.min(1.5, devicePixelRatio);
      w = innerWidth; h = innerHeight;
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      g.setTransform(k, 0, 0, k, 0, 0);
      paint();
    };
    const paint = () => {
      g.clearRect(0, 0, w, h);
      const sy = scrollY;
      for (const m of motes) {
        const x = (((m.x + t * m.vx) % 1) + 1) % 1 * w;
        const y = ((((m.y + t * m.vy) * h - sy * m.z * 0.3) % h) + h) % h;
        const r = 0.5 + m.z * m.z * 3.4;
        const a = (0.1 + 0.42 * (1 - m.z)) * (0.7 + 0.3 * Math.sin(m.tw + t * 0.9));
        g.fillStyle = m.hot ? `rgba(255, 122, 69, ${a})` : `rgba(170, 232, 240, ${a})`;
        g.beginPath();
        g.arc(x, y, r, 0, 6.2832);
        g.fill();
      }
    };
    const place = () => {
      const sy = scrollY;
      grid.style.transform = `translate3d(0, ${-((sy * 0.08) % GRID)}px, 0)`;
      topo.style.transform = `translate3d(0, ${-((sy * 0.2) % TILE)}px, 0)`;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33 || document.hidden) return;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      paint();
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (motion.level >= 2) raf = requestAnimationFrame(frame);
    };
    const scroll = () => { place(); if (motion.level < 2) paint(); };
    size();
    place();
    run();
    const off = onMotionChange(run);
    addEventListener("resize", size);
    addEventListener("scroll", scroll, { passive: true });
    return () => { cancelAnimationFrame(raf); off(); removeEventListener("resize", size); removeEventListener("scroll", scroll); };
  }, []);

  return (
    <div className="backdrop" ref={root} aria-hidden="true">
      <div className="bd-grid" />
      <div className="bd-topo" />
      <div className="bd-fog"><i /><i /><i /></div>
      <canvas className="bd-dust" ref={dust} />
      <div className="bd-shade" />
    </div>
  );
}

// A height field on a square grid, used for the relief arrangements.
export interface Field {
  x0: number;
  y0: number;
  step: number;
  cols: number;
  rows: number;
  h: Float32Array;
}

export function makeField(x0: number, y0: number, x1: number, y1: number, step: number): Field {
  const cols = Math.ceil((x1 - x0) / step) + 1, rows = Math.ceil((y1 - y0) / step) + 1;
  return { x0, y0, step, cols, rows, h: new Float32Array(cols * rows) };
}

export function splat(f: Field, x: number, y: number, w: number) {
  const cx = Math.round((x - f.x0) / f.step), cy = Math.round((y - f.y0) / f.step);
  if (cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows) return;
  f.h[cy * f.cols + cx] += w;
}

// Three box passes come close to a Gaussian with a deviation of about radius + 0.5 cells.
export function blur(f: Field, radius: number) {
  const { cols, rows } = f;
  const tmp = new Float32Array(f.h.length);
  const pass = (src: Float32Array, dst: Float32Array, n: number, stride: number, lines: number, lineStride: number) => {
    const k = 1 / (radius * 2 + 1);
    for (let l = 0; l < lines; l++) {
      const o = l * lineStride;
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += src[o + Math.max(0, Math.min(n - 1, i)) * stride];
      for (let i = 0; i < n; i++) {
        dst[o + i * stride] = sum * k;
        sum += src[o + Math.min(n - 1, i + radius + 1) * stride] - src[o + Math.max(0, i - radius) * stride];
      }
    }
  };
  for (let p = 0; p < 3; p++) {
    pass(f.h, tmp, cols, 1, rows, cols);
    pass(tmp, f.h, rows, cols, cols, 1);
  }
}

export function scaleTo(f: Field, peak: number) {
  let max = 0;
  for (const v of f.h) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < f.h.length; i++) f.h[i] *= peak / max;
}

export function sample(f: Field, x: number, y: number): number {
  const gx = Math.max(0, Math.min(f.cols - 1.001, (x - f.x0) / f.step));
  const gy = Math.max(0, Math.min(f.rows - 1.001, (y - f.y0) / f.step));
  const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
  const o = iy * f.cols + ix;
  return (f.h[o] * (1 - fx) + f.h[o + 1] * fx) * (1 - fy) + (f.h[o + f.cols] * (1 - fx) + f.h[o + f.cols + 1] * fx) * fy;
}

// Light arriving from the upper left of the plan, as a factor from 0 on the far slopes to 1 on the near ones.
export function rim(f: Field, x: number, y: number): number {
  const e = f.step;
  const gx = (sample(f, x + e, y) - sample(f, x - e, y)) / (2 * e);
  const gy = (sample(f, x, y + e) - sample(f, x, y - e)) / (2 * e);
  const n = 1 / Math.hypot(gx, gy, 1);
  return Math.max(0, Math.min(1, (0.55 * gx + 0.62 * gy) * n * 1.5 + 0.12));
}

// Walks the contour at height v and reports each straight piece of it, a cell at a time.
export function contour(f: Field, v: number, piece: (x0: number, y0: number, x1: number, y1: number) => void) {
  const { cols, rows, step, h } = f;
  const p: number[] = [];
  const cut = (a: number, b: number, ax: number, ay: number, bx: number, by: number) => {
    if ((a < v) === (b < v)) return;
    const t = (v - a) / (b - a);
    p.push(f.x0 + (ax + (bx - ax) * t) * step, f.y0 + (ay + (by - ay) * t) * step);
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      p.length = 0;
      cut(h[i], h[i + 1], c, r, c + 1, r);
      cut(h[i + 1], h[i + cols + 1], c + 1, r, c + 1, r + 1);
      cut(h[i + cols], h[i + cols + 1], c, r + 1, c + 1, r + 1);
      cut(h[i], h[i + cols], c, r, c, r + 1);
      for (let k = 0; k + 3 < p.length; k += 4) piece(p[k], p[k + 1], p[k + 2], p[k + 3]);
    }
  }
}

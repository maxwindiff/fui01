import { View, haze, entry } from "./view.wgsl";

@group(0) @binding(0) var<uniform> view: View;

// Corners in order: origin, +u, +v, far corner. p0.w and p1.w hold the world size along u and v, p2.w the entry delay.
// color fills the sheet, ink draws its dot grid and border.
// style: dot grid spacing in world units, dot alpha, border alpha, border width px
struct Quad {
  p0: vec4f,
  p1: vec4f,
  p2: vec4f,
  p3: vec4f,
  color: vec4f,
  ink: vec4f,
  style: vec4f,
}
@group(0) @binding(1) var<storage, read> quads: array<Quad>;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) inst: u32,
  @location(2) depth: f32,
}

@vertex fn vs_main(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let q = quads[i];
  let c = corners[v];
  let p = mix(mix(q.p0.xyz, q.p1.xyz, c.x), mix(q.p2.xyz, q.p3.xyz, c.x), c.y);
  let clip = view.proj * vec4f(p.xy, p.z * view.lift, 1.0);
  var out: VOut;
  out.position = vec4f(clip.xy / clip.w, 0.5, 1.0);
  out.uv = c;
  out.inst = i;
  out.depth = clip.w;
  return out;
}

@fragment fn fs_main(in: VOut) -> @location(0) vec4f {
  let q = quads[in.inst];
  let size = vec2f(q.p0.w, q.p1.w);
  let world = in.uv * size;
  let ppw = view.focal / in.depth;
  var rgb = q.color.rgb;
  var a = q.color.a;

  if (q.style.x > 0.0) {
    let cell = (fract(world / q.style.x) - 0.5) * q.style.x;
    let r = max(0.75 * view.dpr / ppw, q.style.x * 0.035);
    let dot = (1.0 - smoothstep(r - 0.7 / ppw, r + 0.7 / ppw, length(cell))) * q.style.y;
    rgb = mix(rgb, q.ink.rgb, dot);
    a = max(a, dot);
  }
  let edge = min(min(world.x, size.x - world.x), min(world.y, size.y - world.y)) * ppw;
  let line = (1.0 - smoothstep(q.style.w * view.dpr - 0.7, q.style.w * view.dpr + 0.7, edge)) * q.style.z;
  rgb = mix(rgb, q.ink.rgb, line);
  a = max(a, line);

  a = a * view.fade * haze(view, in.depth) * entry(view, q.p2.w);
  return vec4f(rgb * a, a);
}

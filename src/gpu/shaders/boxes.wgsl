import { View, haze, entry } from "./view.wgsl";

@group(0) @binding(0) var<uniform> view: View;

// a: centre xy, base z, half width.  b: height, entry delay, outline px, shade on the top face once lifted.
struct Box {
  a: vec4f,
  b: vec4f,
  top: vec4f,
  side: vec4f,
  ink: vec4f,
  band: vec4f,
  // x: height of the band on the sides, in world units.  y: brightening at the middle of the top.
  fx: vec4f,
}
@group(0) @binding(1) var<storage, read> boxes: array<Box>;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) size: vec2f,
  @location(2) @interpolate(flat) inst: u32,
  @location(3) @interpolate(flat) light: f32,
  @location(4) depth: f32,
}

@vertex fn vs_main(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let b = boxes[i];
  let face = v / 6u;
  let c = corners[v % 6u];
  let e = entry(view, b.b.y);
  let half = b.a.w * step(0.001, e);
  let z0 = b.a.z * view.lift;
  let h = b.b.x * view.lift * e;
  let s = (c.x * 2.0 - 1.0) * half;
  var p = vec3f(0.0);
  var size = vec2f(half * 2.0, h);
  var light = 1.0;
  switch face {
    case 0u { p = vec3f(b.a.x + s, b.a.y + (c.y * 2.0 - 1.0) * half, z0 + h); size = vec2f(half * 2.0); }
    case 1u { p = vec3f(b.a.x + half, b.a.y + s, z0 + c.y * h); light = 0.8; }
    case 2u { p = vec3f(b.a.x - half, b.a.y + s, z0 + c.y * h); light = 0.95; }
    case 3u { p = vec3f(b.a.x + s, b.a.y + half, z0 + c.y * h); light = 0.78; }
    default { p = vec3f(b.a.x + s, b.a.y - half, z0 + c.y * h); light = 0.9; }
  }
  let clip = view.proj * vec4f(p, 1.0);
  var out: VOut;
  out.position = clip;
  out.uv = c * size;
  out.size = size;
  out.inst = i;
  out.light = light;
  out.depth = clip.w;
  return out;
}

@fragment fn fs_main(in: VOut) -> @location(0) vec4f {
  let b = boxes[in.inst];
  let top = step(0.999, in.light);
  let drop = in.size.y - in.uv.y;
  let banded = step(b.fx.x * 0.7, drop) * step(drop, b.fx.x * 1.7) * step(b.fx.x * 2.1, in.size.y) * step(0.001, b.fx.x);
  let side = mix(b.side.rgb, b.band.rgb, banded) * in.light;
  let middle = 1.0 - smoothstep(0.0, 1.25, length(in.uv / in.size - 0.5) * 2.0);
  let cap = mix(b.top.rgb * (1.0 - b.b.w * view.lift), vec3f(1.0), b.fx.y * middle);
  var rgb = mix(side, cap, top);
  let ppw = view.focal / in.depth;
  let edge = min(min(in.uv.x, in.size.x - in.uv.x), min(in.uv.y, in.size.y - in.uv.y)) * ppw;
  let w = b.b.z * view.dpr;
  // The outline fades out on faces a few pixels across, where it would turn the surface into a moire.
  let room = smoothstep(3.0, 7.0, min(in.size.x, in.size.y) * ppw);
  let line = (1.0 - smoothstep(w - 0.7, w + 0.7, edge)) * b.ink.a * step(0.001, w) * room;
  rgb = mix(rgb, b.ink.rgb, line);
  rgb = mix(view.bg.rgb, rgb, haze(view, in.depth));
  return vec4f(rgb * view.fade, view.fade);
}

import { View, defocus, haze, entry } from "./view.wgsl";

@group(0) @binding(0) var<uniform> view: View;

// a: xyz, radius.  style: stroke px, fill, halo px, shape.  extra: world-sized, entry delay
struct Mark {
  a: vec4f,
  color: vec4f,
  style: vec4f,
  extra: vec4f,
}
@group(0) @binding(1) var<storage, read> marks: array<Mark>;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) inst: u32,
  @location(2) @interpolate(flat) rpx: f32,
  @location(3) @interpolate(flat) blur: f32,
  @location(4) @interpolate(flat) haze: f32,
}

@vertex fn vs_main(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let m = marks[i];
  let clip = view.proj * vec4f(m.a.xy, m.a.z * view.lift, 1.0);
  let ppw = view.focal / clip.w;
  let e = entry(view, m.extra.y);
  let grow = e * (1.0 + 0.35 * sin(e * 3.14159265));
  let rpx = select(m.a.w * view.dpr, max(m.a.w * ppw, 0.7 * view.dpr), m.extra.x > 0.5) * grow;
  let blur = defocus(view, clip.w);
  let extent = rpx + (m.style.x * 0.5 + m.style.z) * view.dpr + 1.5 + blur;
  let c = corners[v];
  var out: VOut;
  out.position = vec4f(clip.xy / clip.w + vec2f(c.x, -c.y) * extent * 2.0 / view.size, 0.5, 1.0);
  out.local = c * extent;
  out.inst = i;
  out.rpx = rpx;
  out.blur = blur;
  out.haze = haze(view, clip.w) * step(0.001, e);
  return out;
}

fn sd_spokes(p: vec2f, r: f32, n: i32) -> f32 {
  var d = 1e6;
  for (var j = 0; j < n; j++) {
    let a = 1.5707963 + f32(j) * 3.14159265 / f32(n);
    let dir = vec2f(cos(a), sin(a));
    let t = clamp(dot(p, dir), -r, r);
    d = min(d, length(p - dir * t));
  }
  return d;
}

fn sd_shape(p: vec2f, r: f32, shape: f32, hair: f32) -> f32 {
  let s = i32(shape + 0.5);
  let q = abs(p);
  switch s {
    case 1 { return max(q.x, q.y) - r * 0.84; }
    case 2 { return (q.x + q.y) * 0.70710678 - r * 0.7; }
    case 3 { return max(q.y * 0.8660254 + q.x * 0.5, q.x) - r * 0.86; }
    case 4 { let t = p + vec2f(0.0, r * 0.12); return max(q.x * 0.8660254 - t.y * 0.5, t.y) - r * 0.5; }
    case 5 { return sd_spokes(p, r, 3) - hair; }
    case 6 { return sd_spokes(p, r, 2) - hair; }
    default { return length(p) - r; }
  }
}

@fragment fn fs_main(in: VOut) -> @location(0) vec4f {
  let m = marks[in.inst];
  let sw = m.style.x * view.dpr;
  let hair = max(0.6 * view.dpr, in.rpx * 0.13);
  let d = sd_shape(in.local, in.rpx, m.style.w, hair);
  let f = 0.7 + in.blur;
  let inside = 1.0 - smoothstep(-f, f, d);
  let edge = (1.0 - smoothstep(-f, f, abs(d) - sw * 0.5)) * step(0.001, sw);

  var rgb = m.color.rgb;
  var a = 0.0;
  if (m.style.y < 0.0) {
    let knock = inside * -m.style.y * view.bg.a;
    rgb = mix(view.bg.rgb, m.color.rgb, edge);
    a = max(knock, edge * m.color.a);
  } else {
    a = max(inside * m.style.y, edge) * m.color.a;
  }
  if (m.style.z > 0.0) {
    let g = exp(-max(d, 0.0) / (m.style.z * view.dpr * 0.32));
    a = max(a, g * 0.55 * m.color.a * (1.0 - inside));
  }
  a = a * view.fade * in.haze / (1.0 + in.blur * 0.22);
  return vec4f(rgb * a, a);
}

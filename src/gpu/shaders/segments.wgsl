import { View, defocus, haze, entry } from "./view.wgsl";

@group(0) @binding(0) var<uniform> view: View;

// a: xyz, width px.  b: xyz, dash period px.  anim: flow speed, pulse amount, t0, t1.
// extra: total length in world units, phase, spin rate about the pivot, entry delay
struct Seg {
  a: vec4f,
  b: vec4f,
  color: vec4f,
  anim: vec4f,
  extra: vec4f,
}
@group(0) @binding(1) var<storage, read> segs: array<Seg>;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) px: vec2f,
  @location(1) @interpolate(flat) a: vec2f,
  @location(2) @interpolate(flat) b: vec2f,
  @location(3) @interpolate(flat) inst: u32,
  @location(4) @interpolate(flat) depth: vec2f,
}

fn spin(p: vec3f, rate: f32) -> vec3f {
  let angle = view.time * rate;
  let c = cos(angle);
  let s = sin(angle);
  let q = p.xy - view.pivot;
  return vec3f(view.pivot + vec2f(q.x * c - q.y * s, q.x * s + q.y * c), p.z);
}

@vertex fn vs_main(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let s = segs[i];
  let wa = spin(s.a.xyz, s.extra.z);
  let wb = spin(s.b.xyz, s.extra.z);
  let ca = view.proj * vec4f(wa.xy, wa.z * view.lift, 1.0);
  let cb = view.proj * vec4f(wb.xy, wb.z * view.lift, 1.0);
  let a = ca.xy / ca.w * view.size * 0.5;
  let b = cb.xy / cb.w * view.size * 0.5;
  let blur = max(defocus(view, ca.w), defocus(view, cb.w));
  let hw = max(s.a.w * view.dpr, 1.0) * 0.5 + 1.5 + blur + view.glow * view.dpr * 2.6;
  let ab = b - a;
  let len = max(length(ab), 1e-5);
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let c = corners[v];
  let p = mix(a, b, c.x) + dir * (c.x * 2.0 - 1.0) * hw + n * c.y * hw;
  var out: VOut;
  out.position = vec4f(p / (view.size * 0.5), 0.5, 1.0);
  out.px = p;
  out.a = a;
  out.b = b;
  out.inst = i;
  out.depth = vec2f(ca.w, cb.w);
  return out;
}

@fragment fn fs_main(in: VOut) -> @location(0) vec4f {
  let s = segs[in.inst];
  let wpx = s.a.w * view.dpr;
  let w = max(wpx, 1.0);
  let thin = min(wpx, 1.0);
  let pa = in.px - in.a;
  let ba = in.b - in.a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  let d = length(pa - ba * h) - w * 0.5;
  let depth = mix(in.depth.x, in.depth.y, h);
  let blur = defocus(view, depth);
  let f = 0.7 + blur;
  let core = (1.0 - smoothstep(-f, f, d)) * thin * (w / (w + blur * 1.6));
  var a = core * s.color.a;
  var rgb = s.color.rgb;
  if (view.glow > 0.0) {
    // A phosphor trace: a halo that falls off outside the stroke and a core that burns toward white.
    let halo = exp(-max(d, 0.0) / (view.glow * view.dpr * 0.5)) * 0.4;
    a = max(core, halo) * s.color.a;
    rgb = mix(rgb, vec3f(1.0), core * 0.5 * s.color.a);
  }

  let t = mix(s.anim.z, s.anim.w, h);
  if (s.b.w > 0.0) {
    let along = t * s.extra.x * view.focal / depth / view.dpr;
    let u = fract(along / s.b.w - view.time * s.anim.x + s.extra.y);
    let edge = 0.5 / max(s.b.w * view.dpr, 1.0);
    a = a * smoothstep(0.0, edge, u) * (1.0 - smoothstep(0.5, 0.5 + edge, u));
  }
  if (s.anim.y > 0.0) {
    let head = fract(view.time * s.anim.x + s.extra.y);
    var dt = t - head;
    dt = dt - round(dt);
    let comet = exp(-pow(max(dt, 0.0) / 0.012, 2.0)) * step(0.0, dt) + exp(dt / 0.16) * step(dt, 0.0);
    a = a * (0.34 + s.anim.y * comet);
    rgb = mix(rgb, vec3f(1.0), clamp(comet - 0.55, 0.0, 1.0) * 0.6);
  }
  if (view.reveal < 0.999) {
    let e = entry(view, s.extra.w);
    a = a * (1.0 - smoothstep(e - 0.04, e, t)) * step(0.001, e);
  }
  a = clamp(a, 0.0, 1.0) * view.fade * haze(view, depth);
  return vec4f(rgb * a, a);
}

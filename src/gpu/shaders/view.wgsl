export struct View {
  proj: mat4x4f,
  bg: vec4f,
  size: vec2f,
  pivot: vec2f,
  fog: vec2f,
  focal: f32,
  dpr: f32,
  time: f32,
  fade: f32,
  lift: f32,
  focus: f32,
  aperture: f32,
  reveal: f32,
  fogFloor: f32,
}

// Blur radius in physical pixels for a point at view depth w.
export fn defocus(view: View, w: f32) -> f32 {
  return view.aperture * abs(w - view.focus) / view.focus * view.dpr;
}

export fn haze(view: View, w: f32) -> f32 {
  return mix(1.0, view.fogFloor, smoothstep(view.fog.x, view.fog.y, w));
}

// Progress of an element's entry, given its delay in 0..1.
export fn entry(view: View, delay: f32) -> f32 {
  return clamp((view.reveal - delay * 0.55) / 0.45, 0.0, 1.0);
}

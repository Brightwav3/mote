/* ADR 0001: generators ported from bloub/src/bot/shape.ts and skins.ts, pinned
   by test/shapes.test.mjs. 64 samples, Minkowski corner rounding and peak-radius
   normalisation are load-bearing. docs/decisions/0001-port-bloub-verbatim.md */
const PROFILE_SAMPLES = 64;
const TAU = Math.PI * 2;
const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU);
const COS = ANGLES.map(Math.cos);
const SIN = ANGLES.map(Math.sin);

/* Any polygon → radial profile, by casting a ray from the centre. */
function profileFromPolygon(poly, cx, cy) {
  const radii = new Array(PROFILE_SAMPLES).fill(0);
  const n = poly.length;
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const dx = COS[k], dy = SIN[k];
    let best = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const ex = b.x - a.x, ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const px = a.x - cx, py = a.y - cy;
      const t = (px * ey - py * ex) / den;
      const u = (px * dy - py * dx) / den;
      if (t > best && u >= 0 && u <= 1) best = t;
    }
    radii[k] = best;
  }
  return radii;
}

/* Convex hull of two circles — the common external tangents plus the two
   arcs. This is what makes the capsule a stadium and the droplet a teardrop
   with straight flanks, rather than a lumpy pile of discs. */
function hullOfCircles(x1, y1, r1, x2, y2, r2v, steps = 96) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const base = Math.atan2(dy, dx);
  const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)));
  const pts = [];
  for (let i = 0; i <= steps / 2; i++) {
    const a = base + spread + ((TAU - 2 * spread) * i) / (steps / 2);
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 });
  }
  for (let i = 0; i <= steps / 2; i++) {
    const a = base - spread + (2 * spread * i) / (steps / 2);
    pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v });
  }
  return pts;
}

function superellipseProfile(n, sx = 1, sy = 1) {
  return ANGLES.map((_, i) =>
    Math.pow(Math.pow(Math.abs(COS[i] / sx), n) + Math.pow(Math.abs(SIN[i] / sy), n), -1 / n));
}

function unionOfCirclesProfile(circles) {
  const out = new Array(PROFILE_SAMPLES).fill(0);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const dx = COS[i], dy = SIN[i];
    let best = 0;
    for (const c of circles) {
      const b = dx * c.x + dy * c.y;
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
      if (disc < 0) continue;
      const t = b + Math.sqrt(disc);
      if (t > best) best = t;
    }
    out[i] = best;
  }
  return out;
}

/* Corners rounded by Minkowski sum with a disc: every edge is pushed outward
   by `rc` and every vertex becomes an arc of that radius. Vertices are
   therefore placed at the wanted radius MINUS rc. Clockwise, screen axes. */
function roundedPolygon(verts, rc, arcSteps = 10) {
  const n = verts.length;
  const out = [];
  const normal = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return Math.atan2(-dx / len, dy / len);
  };
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n], cur = verts[i], next = verts[(i + 1) % n];
    const a0 = normal(prev, cur), a1 = normal(cur, next);
    let d = a1 - a0;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    for (let k = 0; k <= arcSteps; k++) {
      const a = a0 + (d * k) / arcSteps;
      out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc });
    }
  }
  return out;
}

function regularPolygonProfile(sides, radius, rc, rotationDeg = 0) {
  const rot = (rotationDeg * Math.PI) / 180;
  const verts = Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * TAU;
    return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) };
  });
  return profileFromPolygon(roundedPolygon(verts, rc), 0, 0);
}

/* Bring the largest radius to `max`, so the shapes weigh the same by eye. */
function normalizeProfile(radii, max = 1) {
  const peak = Math.max(...radii);
  if (peak <= 0) return radii;
  const k = max / peak;
  return radii.map((r) => r * k);
}

/* Pebble: a circle deformed by two low harmonics — irregular but smooth. */
const pebble = normalizeProfile(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)), 1.02);

/* Cloud: a union of bumps, wide at the bottom, two lobes on top. */
const cloud = normalizeProfile(unionOfCirclesProfile([
  { x: -0.44, y: 0.2, r: 0.54 },
  { x: 0.46, y: 0.2, r: 0.5 },
  { x: 0.02, y: 0.3, r: 0.6 },
  { x: -0.24, y: -0.3, r: 0.48 },
  { x: 0.3, y: -0.24, r: 0.44 },
]), 1.02);

/* Droplet: a big disc below, drawn to a point above. */
const droplet = normalizeProfile(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0), 1.04);

/* Capsule lying down: the hull of two discs side by side. Not normalised —
   the original leaves it alone. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0);

const BODIES = [
  { id: "cercle", label: "Circle", profile: new Array(PROFILE_SAMPLES).fill(1) },
  { id: "galet", label: "Pebble", profile: pebble },
  // 1.15 rather than 1.02: on a superellipse the largest radius is the
  // diagonal, so normalising on it would leave the shape looking smaller
  // than the circle.
  { id: "squircle", label: "Squircle", profile: normalizeProfile(superellipseProfile(4.2), 1.15) },
  { id: "capsule", label: "Capsule", profile: capsule },
  // -90deg: one vertex toward the top of the screen (y points down)
  { id: "triangle", label: "Triangle", profile: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg: vertices left and right, so the top and bottom edges are flat
  { id: "hexagone", label: "Hexagon", profile: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: "nuage", label: "Cloud", profile: cloud },
  { id: "goutte", label: "Droplet", profile: droplet },
];
const BODY_BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b]));

/* Closed Catmull-Rom through the sampled points, emitted as cubic Béziers.
   Sampling a smooth profile densely and joining with straight lines would be
   fine at this size, but the silhouette is the whole character here — it gets
   curves. */
/* The path is ~9,000 characters and depends only on the silhouette — the
   breath and squash are a scale transform on the group above it, not a
   reshape. So it is built once per body and never again; rebuilding it every
   frame was pure waste. */
const TENSION = 1 / 6;   // Bloub's closedPath tension
const PATH_CACHE = new Map();
function profilePath(body, R) {
  const hit = PATH_CACHE.get(body.id);
  if (hit) return hit;
  const d = buildPath(body.profile, R);
  PATH_CACHE.set(body.id, d);
  return d;
}

function buildPath(profile, R) {
  const pts = profile.map((r, i) => [r * R * COS[i], r * R * SIN[i]]);
  const n = pts.length;
  const at = (i) => pts[(i % n + n) % n];
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * TENSION, p1[1] + (p2[1] - p0[1]) * TENSION];
    const c2 = [p2[0] - (p3[0] - p1[0]) * TENSION, p2[1] - (p3[1] - p1[1]) * TENSION];
    d += `C${r2(c1[0])} ${r2(c1[1])},${r2(c2[0])} ${r2(c2[1])},${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d + "Z";
}

/* Bloub's customiser palette, kept as it is: the point of a palette is that
   somebody already balanced it. Eye colour is chosen per body — pale eyes on
   a dark body, dark eyes on a pale one — so cream is a usable body too. */
/* ── SILHOUETTES IN MOTION ────────────────────────────────────────────────
   A profile is a shape; a silhouette is that shape POSED — rotated, squashed
   and offset. The resting body needs none of that, which is why it was not
   here before: it is the animation catalogue that spins a triangle, drops the
   ball to a dot and drags it off-centre.

   `toPoints` and the pose fields are bloub/src/bot/shape.ts verbatim: rotate,
   then squash in screen axes, then translate, then scale. Applying those in
   any other order gives a different shape, not a differently-placed one. */
/* ADR 0005: silhouette posing ported from bloub/src/bot/shape.ts.
   docs/decisions/0005-animation-catalogue.md */
const EGG_PROFILE = [0.8369,0.8424,0.8497,0.8585,0.8674,0.8775,0.8878,0.8983,0.9089,0.9185,0.9288,0.9374,0.9445,0.9504,0.9543,0.9559,0.9555,0.9519,0.9466,0.9389,0.9302,0.9193,0.9085,0.8969,0.8852,0.8734,0.8625,0.8513,0.8411,0.8325,0.8243,0.8179,0.8137,0.8112,0.8102,0.8128,0.8178,0.8262,0.8374,0.8518,0.8702,0.8922,0.9169,0.9446,0.9741,1.0023,1.0267,1.0433,1.0481,1.0393,1.0216,0.9970,0.9697,0.9418,0.9169,0.8949,0.8760,0.8604,0.8490,0.8394,0.8337,0.8314,0.8305,0.8326];

function poseSil(radii, pose) {
  return { radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1, ...pose };
}
/* A circle of any radius. Every state that collapses, pops or bounces is this
   one call with a different radius, which is why the morphs never tear: the
   ball and the dot are the same 64 samples. */
function circleSil(radius, pose = {}) {
  return poseSil(new Array(PROFILE_SAMPLES).fill(radius), pose);
}
function bodySil(body, pose = {}) { return poseSil(body.profile, pose); }

function blendSil(a, b, t) {
  const radii = new Array(PROFILE_SAMPLES);
  for (let i = 0; i < PROFILE_SAMPLES; i++) radii[i] = lerp(a.radii[i], b.radii[i], t);
  /* Shortest way round, so a turn from +170deg to -170deg does not unwind the
     whole circle on the way. */
  let dRot = b.rot - a.rot;
  while (dRot > Math.PI) dRot -= TAU;
  while (dRot < -Math.PI) dRot += TAU;
  return {
    radii, rot: a.rot + dRot * t,
    cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t),
    sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t),
  };
}

function toPoints(s, scale) {
  const cr = Math.cos(s.rot), sr = Math.sin(s.rot);
  const out = new Array(PROFILE_SAMPLES);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = s.radii[i], x = r * COS[i], y = r * SIN[i];
    out[i] = [(( x * cr - y * sr) * s.sx + s.cx) * scale,
              (( x * sr + y * cr) * s.sy + s.cy) * scale];
  }
  return out;
}

/* Same Catmull-Rom as the static bodies, but rebuilt every frame — a posed
   silhouette changes on every one of them, so there is nothing to cache. */
function silPath(s, R) {
  const pts = toPoints(s, R);
  const n = pts.length;
  const at = (i) => pts[(i % n + n) % n];
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${r2(p1[0] + (p2[0] - p0[0]) * TENSION)} ${r2(p1[1] + (p2[1] - p0[1]) * TENSION)},` +
         `${r2(p2[0] - (p3[0] - p1[0]) * TENSION)} ${r2(p2[1] - (p3[1] - p1[1]) * TENSION)},` +
         `${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d + "Z";
}

/* Exact closed polyline — keeps straight segments, unlike the Catmull-Rom
   above. The teardrop dot of the leaning "!" is not a disc. */
function polyPath(pts, scale = 1) {
  if (pts.length < 3) return "";
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    d += `${i === 0 ? "M" : "L"}${r2(pts[i].x * scale)} ${r2(pts[i].y * scale)}`;
  }
  return d + "Z";
}

/* The eight silhouettes must match Bloub's generators exactly. They are a port,
   not a reimplementation (ADR 0001), so "close enough" is a failure: an earlier
   hand-rolled version used 240 samples, p-norm corner rounding and area
   normalisation, and produced eight shapes that were all subtly wrong. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, PURE } from './harness.mjs'

/* Governed by ADR 0001 — docs/decisions/0001-port-bloub-verbatim.md */

const TAU = Math.PI * 2
const N = 64
const ANG = Array.from({ length: N }, (_, i) => (i / N) * TAU)
const COS = ANG.map(Math.cos), SIN = ANG.map(Math.sin)

const pfp = (poly, cx, cy) => Array.from({ length: N }, (_, k) => {
  const dx = COS[k], dy = SIN[k]
  let best = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const px = a.x - cx, py = a.y - cy
    const t = (px * ey - py * ex) / den, u = (px * dy - py * dx) / den
    if (t > best && u >= 0 && u <= 1) best = t
  }
  return best
})
const hull = (x1, y1, r1, x2, y2, r2, steps = 96) => {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1e-6
  const base = Math.atan2(y2 - y1, x2 - x1)
  const sp = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)))
  const pts = []
  for (let i = 0; i <= steps / 2; i++) {
    const a = base + sp + ((TAU - 2 * sp) * i) / (steps / 2)
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 })
  }
  for (let i = 0; i <= steps / 2; i++) {
    const a = base - sp + (2 * sp * i) / (steps / 2)
    pts.push({ x: x2 + Math.cos(a) * r2, y: y2 + Math.sin(a) * r2 })
  }
  return pts
}
const norm = (r, mx = 1) => { const p = Math.max(...r); return p > 0 ? r.map((x) => x * mx / p) : r }
const uoc = (cs) => Array.from({ length: N }, (_, i) => {
  const dx = COS[i], dy = SIN[i]
  let best = 0
  for (const c of cs) {
    const b = dx * c.x + dy * c.y
    const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r)
    if (disc < 0) continue
    const t = b + Math.sqrt(disc)
    if (t > best) best = t
  }
  return best
})
const roundPoly = (v, rc, steps = 10) => {
  const out = []
  const nrm = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1
    return Math.atan2(-dx / L, dy / L)
  }
  for (let i = 0; i < v.length; i++) {
    const p = v[(i - 1 + v.length) % v.length], c = v[i], q = v[(i + 1) % v.length]
    const a0 = nrm(p, c), a1 = nrm(c, q)
    let d = a1 - a0
    while (d > Math.PI) d -= TAU
    while (d < -Math.PI) d += TAU
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (d * k) / steps
      out.push({ x: c.x + Math.cos(a) * rc, y: c.y + Math.sin(a) * rc })
    }
  }
  return out
}
const reg = (sides, radius, rc, rot = 0) => pfp(roundPoly(
  Array.from({ length: sides }, (_, i) => {
    const a = (rot * Math.PI) / 180 + (i / sides) * TAU
    return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) }
  }), rc), 0, 0)

const REFERENCE = {
  cercle: new Array(N).fill(1),
  galet: norm(ANG.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)), 1.02),
  squircle: norm(ANG.map((_, i) =>
    Math.pow(Math.pow(Math.abs(COS[i]), 4.2) + Math.pow(Math.abs(SIN[i]), 4.2), -1 / 4.2)), 1.15),
  capsule: pfp(hull(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0),
  triangle: reg(3, 1.12, 0.34, -90),
  hexagone: reg(6, 1.04, 0.26, 0),
  nuage: norm(uoc([{ x: -0.44, y: 0.2, r: 0.54 }, { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 }, { x: -0.24, y: -0.3, r: 0.48 }, { x: 0.3, y: -0.24, r: 0.44 }]), 1.02),
  goutte: norm(pfp(hull(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0), 1.04),
}

test('all eight silhouettes are present and sampled at 64 angles', async () => {
  const { BODIES, PROFILE_SAMPLES } = await load(PURE)
  assert.equal(PROFILE_SAMPLES, 64)
  // joined, not deepEqual: sandbox arrays are cross-realm and fail a prototype check
  assert.equal(BODIES.map((b) => b.id).join(','), Object.keys(REFERENCE).join(','))
  for (const b of BODIES) assert.equal(b.profile.length, 64, `${b.id} sample count`)
})

test('every radius matches the Bloub generator to floating point', async () => {
  const { BODIES } = await load(PURE)
  for (const b of BODIES) {
    const ref = REFERENCE[b.id]
    for (let i = 0; i < ref.length; i++) {
      assert.ok(Math.abs(ref[i] - b.profile[i]) < 1e-12,
        `${b.id}[${i}] got ${b.profile[i]} want ${ref[i]}`)
    }
  }
})

test('shapes are distinct from one another', async () => {
  const { BODIES } = await load(PURE)
  const seen = new Set(BODIES.map((b) => b.profile.join(',')))
  assert.equal(seen.size, BODIES.length)
})

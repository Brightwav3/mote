/* The animation catalogue is a port (ADR 0005,
   docs/decisions/0005-animation-catalogue.md), so what is worth testing is
   that it has not drifted — and that a state is what it claims to be: a pure
   function of local time that returns a complete, finite pose. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, PURE } from './harness.mjs'

const PARTS = [...PURE, 'anim/decor.js', 'anim/states.js']

/* The measured fourteen followed by the eleven original Mote states. Written
   out rather than read from the source: a test that imports the list it checks
   passes on any list. */
const CATALOGUE = ['idle', 'thinking', 'wink', 'wide', 'alert', 'notify',
  'exclaim', 'sleep', 'egg', 'hexagon', 'play', 'orbit', 'burst', 'comet',
  'nod', 'nope', 'listening', 'peek', 'focus', 'celebrate', 'charge', 'glitch',
  'melt', 'portal', 'magnet']

test('the catalogue is the measured core followed by original Mote states', async () => {
  const { STATES } = await load(PARTS)
  // joined, not deepEqual: the sandbox's arrays are from another realm
  assert.equal(STATES.map((s) => s.id).join(','), CATALOGUE.join(','))
})

test('only idle wears the resting face, and body-preserving states keep the chosen shape', async () => {
  const { STATE_BY_ID } = await load(PARTS)
  const faces = CATALOGUE.filter((id) => STATE_BY_ID[id].baseFace)
  assert.equal(faces.join(','), 'idle')
  /* Everything else draws its own shape, and that shape IS the animation. */
  const bodies = CATALOGUE.filter((id) => STATE_BY_ID[id].baseBody)
  assert.equal(bodies.join(','), 'idle,wink,wide,alert,notify,nod,nope,listening,peek,focus,celebrate,charge,glitch,melt,portal,magnet')
})

test('every state returns a finite, complete pose across its whole run', async () => {
  const { STATES, PROFILE_SAMPLES } = await load(PARTS)
  for (const s of STATES) {
    for (let t = 0; t <= s.duration + 0.5; t += 1 / 60) {
      const p = s.pose(t)
      assert.equal(p.sil.radii.length, PROFILE_SAMPLES, `${s.id} silhouette`)
      for (const r of p.sil.radii) assert.ok(Number.isFinite(r), `${s.id} radius at t=${t}`)
      for (const k of ['rot', 'cx', 'cy', 'sx', 'sy']) {
        assert.ok(Number.isFinite(p.sil[k]), `${s.id} ${k} at t=${t}`)
      }
      assert.equal(p.eyes.length, 2, `${s.id} eyes`)
      for (const e of p.eyes) {
        assert.ok(Number.isFinite(e.w + e.h + e.open), `${s.id} eye at t=${t}`)
      }
      assert.ok(Number.isFinite(p.gaze.yaw + p.gaze.pitch + p.gaze.roll), `${s.id} gaze at t=${t}`)
      assert.ok(p.eyeAlpha >= 0 && p.eyeAlpha <= 1, `${s.id} eyeAlpha at t=${t}`)
      for (const dot of p.dots) {
        assert.ok(dot.opacity >= 0 && dot.opacity <= 1.0001, `${s.id} dot opacity at t=${t}`)
      }
    }
  }
})

test('states are pure — same local time, same pose', async () => {
  const { STATE_BY_ID } = await load(PARTS)
  for (const id of CATALOGUE) {
    const a = STATE_BY_ID[id].pose(0.7)
    const b = STATE_BY_ID[id].pose(0.7)
    assert.equal(a.sil.radii.join(','), b.sil.radii.join(','), `${id} silhouette is not pure`)
    assert.equal(JSON.stringify(a.gaze), JSON.stringify(b.gaze), `${id} gaze is not pure`)
  }
})

/* The measured constants, spot-checked against bloub/src/bot/states.ts. If one
   of these moves, the animation is no longer the one that was measured. */
test('measured constants have not drifted', async () => {
  const { STATE_BY_ID, DOT_X, DOT_R, COMET_DOT, NOTIF_R, NOTIF_DIST } = await load(PARTS)
  assert.equal([...DOT_X].join(','), '-0.557,-0.013,0.532')
  assert.equal(DOT_R, 0.165)
  assert.equal(COMET_DOT, 0.129)
  assert.equal(NOTIF_R, 0.15)
  assert.equal(NOTIF_DIST, 1.003)

  // wink: the shut eye is WIDER than the open one, not a squashed copy
  const wink = STATE_BY_ID.wink.pose(0.8)
  assert.equal(`${wink.eyes[0].w},${wink.eyes[0].h}`, '0.236,0.464')
  assert.equal(`${wink.eyes[1].w},${wink.eyes[1].h}`, '0.447,0.089')
  assert.ok(wink.eyes[1].w > wink.eyes[0].w)

  // burst: collapses to 0.166 of full radius by 0.7s, and regrows by 2.4s
  const low = STATE_BY_ID.burst.pose(0.7).sil.radii[0]
  assert.ok(Math.abs(low - 0.166) < 1e-3, `burst collapsed to ${low}`)
  assert.ok(Math.abs(STATE_BY_ID.burst.pose(2.4).sil.radii[0] - 1) < 0.02)

  // the triangle tumbles: its centre is off the origin, on a circle of 0.213
  const orbit = STATE_BY_ID.orbit.pose(0.5)
  assert.ok(Math.abs(Math.hypot(orbit.sil.cx, orbit.sil.cy) - 0.213) < 1e-9)
})

test('rings and ribbons come out of the seeded tables identically every load', async () => {
  const a = await load(PARTS)
  const b = await load(PARTS)
  assert.equal(JSON.stringify(a.RINGS), JSON.stringify(b.RINGS))
  assert.equal(JSON.stringify(a.COMET_RIBBONS), JSON.stringify(b.COMET_RIBBONS))
  assert.equal(a.RINGS.length, 6)
  assert.equal(a.COMET_RIBBONS.length, 4)
  /* Flattening always <= 0.45: the orbit planes are seen close to edge-on, and
     that is what makes them read as orbits rather than as circles. */
  for (const r of a.RINGS) assert.ok(r.k <= 0.45, `ring flattening ${r.k}`)
})

test('an arc is split by depth, and the far half is a separate path', async () => {
  const { arcRender, RINGS } = await load(PARTS)
  const a = arcRender(RINGS[0], 0.4, 92, 'rg0', 1)
  assert.ok(a.front.length > 0, 'no near half')
  assert.ok(a.back.length > 0, 'no far half')
  assert.equal(a.grad.stops.length, 3)
  for (const s of a.grad.stops) assert.match(s, /^#[0-9a-f]{6}$/)
})

/* The eye-containment scalar. Two things are being protected here, and they
   pull against each other: the droplet must stop wearing its eyes outside its
   head, and every other body must go on rendering exactly as it did.

   See src/faces/fitting.js. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, PURE } from './harness.mjs'

/* Governed by:
     ADR 0010 — docs/decisions/0010-eye-containment-solved-not-authored.md
     ADR 0001 — docs/decisions/0001-port-bloub-verbatim.md
     ADR 0003 — docs/decisions/0003-discrete-expressions-with-crossfade.md */

const R = 92

const M = await load(PURE)

/* The resting, forward-facing pose of one face — what the maker preview, the
   picker tiles and the photoroom all draw. */
const still = (face) => {
  const pose = M.poseOf(face)
  return { pose, gaze: M.gazeOf(pose, { yaw: 0, pitch: 0 }) }
}

const fitOf = (body, face) => {
  const { pose, gaze } = still(face)
  const frames = M.eyeFrames(gaze.yaw, gaze.pitch, gaze.roll, pose.split, R)
  return { fit: M.eyeFitFor(body.profile, frames, pose.eyes, R), frames, pose }
}

/* The worst corner's reach as a fraction of the silhouette's own radius in
   that direction — the quantity the scalar exists to bound. */
const worstReach = (body, face, fit) => {
  const { frames, pose } = fitOf(body, face)
  let worst = 0
  for (let i = 0; i < 2; i++) {
    const e = pose.eyes[i], f = frames[i]
    const w = (e.w * R * fit) / 2, h = (e.h * R * fit) / 2
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = f.x * fit + f.a * sx * w + f.c * sy * h
        const y = f.y * fit + f.b * sx * w + f.d * sy * h
        const limit = M.radiusAt(body.profile, Math.atan2(y, x)) * R
        worst = Math.max(worst, Math.hypot(x, y) / limit)
      }
    }
  }
  return worst
}

test('a circle leaves every face untouched, exactly', () => {
  const circle = M.BODY_BY_ID.cercle
  for (const face of M.FACES) {
    assert.equal(fitOf(circle, face).fit, 1, `${face.id} was scaled on a circle`)
  }
})

/* The whole point of solving rather than authoring: seven of the eight bodies
   were already fine, and a fix that moved them would be a restyling of Bloub's
   poses under the cover of a bug fix. */
test('only the droplet is touched at all', () => {
  /* Spread out of the sandbox's realm before comparing: a strict deepEqual
     sees the two Array prototypes as different types. */
  const scaled = [...M.BODIES]
    .filter((b) => M.FACES.some((f) => fitOf(b, f).fit < 1))
    .map((b) => b.id)
  assert.deepEqual(scaled, ['goutte'])
})

test('the droplet no longer wears its eyes outside its head', () => {
  const droplet = M.BODY_BY_ID.goutte
  const scared = M.FACES.find((f) => f.id === 'scared')

  /* The defect, as measured before the fix. */
  assert.ok(worstReach(droplet, scared, 1) > 1,
    'the regression this guards is gone from the geometry — check the fix is still needed')

  const { fit } = fitOf(droplet, scared)
  assert.ok(fit < 1 && fit > M.EYE_FIT_FLOOR, `implausible scalar ${fit}`)
  assert.ok(worstReach(droplet, scared, fit) <= M.EYE_LIMIT + 1e-9,
    'still outside the limit after fitting')
})

test('no body and no face reaches past the limit once fitted', () => {
  for (const body of M.BODIES) {
    for (const face of M.FACES) {
      const { fit } = fitOf(body, face)
      assert.ok(worstReach(body, face, fit) <= M.EYE_LIMIT + 1e-9,
        `${body.id}/${face.id} reaches past the limit`)
    }
  }
})

/* Uniform, so an expression keeps its proportions — ADR 0003's "a drawn face
   is one pose exactly" survives the containment. */
test('fitting is uniform, so an expression keeps its aspect ratio', () => {
  const droplet = M.BODY_BY_ID.goutte
  for (const face of M.FACES) {
    const { fit } = fitOf(droplet, face)
    const [a, b] = face.eyes
    /* Not exactly equal: (w*k)/(h*k) and w/h differ in the last bit or two.
       The claim is that the ratio is preserved, not that the division is. */
    assert.ok(Math.abs((a.w * fit) / (a.h * fit) - a.w / a.h) < 1e-12, `${face.id} left eye stretched`)
    assert.ok(Math.abs((b.w * fit) / (b.h * fit) - b.w / b.h) < 1e-12, `${face.id} right eye stretched`)
  }
})

/* A collapsed body must not take the eyes to nothing. */
test('the floor holds when the body is driven to a dot', () => {
  const dot = new Array(M.PROFILE_SAMPLES).fill(0.1585)
  const scared = M.FACES.find((f) => f.id === 'scared')
  const { pose, gaze } = still(scared)
  const frames = M.eyeFrames(gaze.yaw, gaze.pitch, gaze.roll, pose.split, R)
  assert.equal(M.eyeFitFor(dot, frames, pose.eyes, R), M.EYE_FIT_FLOOR)
})

/* The seventeen faces are Bloub's measured poses, hardcoded (ADR 0001). These
   values were once paraphrased — yaw dropped entirely, roll and pitch scaled to
   two thirds and a half — and every expression rendered as something Bloub never
   drew. The table is therefore checked field by field against the source. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, PURE } from './harness.mjs'

/* Governed by:
     ADR 0001 — docs/decisions/0001-port-bloub-verbatim.md
     ADR 0003 — docs/decisions/0003-discrete-expressions-with-crossfade.md */

// transcribed from bloub/src/bot/expressions.ts + face.ts
const BLOUB = {
  neutral:     [28.49, 28.62, -13, 15.46, [[0.186, 0.412, 0, 1], [0.186, 0.412, 0, 1]]],
  attentive:   [4, 5, -4, 16, [[0.21, 0.44, 0, 1], [0.21, 0.44, 0, 1]]],
  curious:     [16, -9, -15, 16.5, [[0.24, 0.46, -8, 1], [0.2, 0.38, -8, 1]]],
  surprised:   [3, -3, 0, 19, [[0.45, 0.47, 0, 1], [0.45, 0.47, 0, 1]]],
  excited:     [6, -14, 0, 19.5, [[0.4, 0.56, -10, 1], [0.4, 0.56, 10, 1]]],
  happy:       [5, 9, 0, 17, [[0.27, 0.17, 14, 1], [0.27, 0.17, -14, 1]]],
  laughing:    [4, 14, 0, 18, [[0.34, 0.13, 20, 1], [0.34, 0.13, -20, 1]]],
  proud:       [5, 17, 0, 17, [[0.3, 0.15, 18, 1], [0.3, 0.15, -18, 1]]],
  shy:         [-19, -14, -7, 14, [[0.17, 0.3, 0, 1], [0.17, 0.3, 0, 1]]],
  confused:    [-14, 3, 8, 16.5, [[0.2, 0.44, -18, 1], [0.28, 0.17, 14, 1]]],
  suspicious:  [12, 6, -6, 16, [[0.21, 0.4, 0, 1], [0.22, 0.15, 0, 1]]],
  sad:         [3, -13, 0, 16, [[0.22, 0.4, -28, 1], [0.22, 0.4, 28, 1]]],
  angry:       [3, 7, 0, 17, [[0.34, 0.15, 30, 1], [0.34, 0.15, -30, 1]]],
  scared:      [2, -20, 0, 20.5, [[0.4, 0.6, 0, 1], [0.4, 0.6, 0, 1]]],
  unimpressed: [-22, 2, 0, 16, [[0.3, 0.12, 0, 1], [0.3, 0.12, 0, 1]]],
  sleepy:      [6, -9, -3, 16, [[0.2, 0.42, 0, 0.42], [0.2, 0.42, 0, 0.42]]],
}

test('every Bloub expression is present, plus the one original face', async () => {
  const { FACES } = await load(PURE)
  const ids = FACES.map((f) => f.id)
  for (const id of Object.keys(BLOUB)) assert.ok(ids.includes(id), `missing ${id}`)
  assert.equal(FACES.length, Object.keys(BLOUB).length + 1, 'expected 16 ported + round')
  assert.ok(ids.includes('round'))
})

test('each pose matches Bloub field for field', async () => {
  const { FACES } = await load(PURE)
  for (const f of FACES) {
    const ref = BLOUB[f.id]
    if (!ref) continue                       // `round` is ours
    const [yaw, pitch, roll, split, eyes] = ref
    assert.equal(f.yaw, yaw, `${f.id}.yaw`)
    assert.equal(f.pitch, pitch, `${f.id}.pitch`)
    assert.equal(f.roll, roll, `${f.id}.roll`)
    assert.equal(f.split, split, `${f.id}.split`)
    for (let i = 0; i < 2; i++) {
      assert.equal(f.eyes[i].w, eyes[i][0], `${f.id}.eyes[${i}].w`)
      assert.equal(f.eyes[i].h, eyes[i][1], `${f.id}.eyes[${i}].h`)
      assert.equal(Math.abs(f.eyes[i].tilt), Math.abs(eyes[i][2]), `${f.id}.eyes[${i}].tilt`)
      assert.equal(f.eyes[i].open, eyes[i][3], `${f.id}.eyes[${i}].open`)
    }
  }
})

test('asymmetric faces stay asymmetric', async () => {
  const { FACES } = await load(PURE)
  const byId = Object.fromEntries(FACES.map((f) => [f.id, f]))
  for (const id of ['suspicious', 'confused', 'curious']) {
    const f = byId[id]
    assert.notEqual(f.eyes[0].h, f.eyes[1].h, `${id} lost its asymmetry`)
  }
})

test('a settled expression renders the pose exactly, not a blend', async () => {
  const { FACES, expressionFor, CROSSFADE } = await load(PURE)
  /* The chooser is stateful and time-ordered — it enforces a minimum dwell
     before it will change face — so the clock has to march forward across the
     whole loop, not restart per face. */
  let t = 0
  for (const f of FACES) {
    t += 1
    let r = expressionFor(t, f.v, f.a, f.d)                    // enters, crossfading
    t += CROSSFADE * 2 + 1
    r = expressionFor(t, f.v, f.a, f.d)                        // settles
    assert.equal(r.id, f.id, `did not settle on ${f.id}`)
    assert.equal(r.mix.split, f.split, `${f.id} split drifted`)
    assert.equal(r.mix.yaw, f.yaw, `${f.id} yaw drifted`)
    for (let i = 0; i < 2; i++) {
      assert.equal(r.mix.eyes[i].h, f.eyes[i].h, `${f.id} eye ${i} height drifted`)
      // +0 vs -0: a mirrored tilt of zero negates to -0, which strictEqual rejects
      assert.equal(r.mix.eyes[i].tilt + 0, f.eyes[i].tilt + 0, `${f.id} eye ${i} tilt drifted`)
    }
  }
})

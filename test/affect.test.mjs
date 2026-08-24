/* The springs carry mood. They have exploded before: `v *= exp(-c * dt)` is the
   damping term, so a negative dt turns it into an amplifier and one backwards
   step sends the value to infinity. A hidden tab or a system clock change is
   enough to produce that, so it is guarded and tested. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load, PURE } from './harness.mjs'

test('a spring settles on its home', async () => {
  const { Spring } = await load(PURE)
  const s = new Spring(0, 11, 5.2)
  s.home = 0.7
  for (let i = 0; i < 600; i++) s.step(1 / 60)
  assert.ok(Math.abs(s.x - 0.7) < 0.01, `settled at ${s.x}`)
})

test('a negative dt cannot amplify the spring', async () => {
  const { Spring } = await load(PURE)
  const s = new Spring(0, 11, 5.2)
  s.home = 1
  s.push(3)
  for (let i = 0; i < 200; i++) s.step(-1 / 60)
  assert.ok(Math.abs(s.x) <= 1.6, `runaway to ${s.x}`)
})

test('spring state stays bounded under absurd input', async () => {
  const { Spring } = await load(PURE)
  const s = new Spring(0, 11, 5.2)
  for (let i = 0; i < 500; i++) { s.push(50); s.step(1 / 60) }
  assert.ok(Math.abs(s.x) <= 1.6 && Number.isFinite(s.x), `unbounded: ${s.x}`)
})

test('a name always produces the same creature', async () => {
  const { createRng } = await load(PURE)
  const seed = (t) => {
    let h = 0x811c9dc5
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
    return h || 0x9e3779b9
  }
  const draw = (n) => { const r = createRng(seed(n)); return [r(), r(), r()] }
  assert.deepEqual(draw('Bo').join(), draw('Bo').join())
  assert.notEqual(draw('Bo').join(), draw('Zelda').join())
})

/* ADR 0012: one eye ink per host theme, with its matching endpoint inverted. */
test('eye ink follows light and dark host themes', async () => {
  const { PAINTS, eyeInkFor } = await load(PURE)
  for (const [name, hex] of PAINTS) {
    const lightWant = hex.toLowerCase() === '#ffffff' ? '#14181A' : '#FFFFFF'
    const darkWant = hex.toLowerCase() === '#0a0a0c' ? '#FFFFFF' : '#14181A'
    assert.equal(eyeInkFor(hex, 'light'), lightWant, `light ${name} (${hex})`)
    assert.equal(eyeInkFor(hex, 'dark'), darkWant, `dark ${name} (${hex})`)
  }
})

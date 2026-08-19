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

test('eye ink stays legible on every body colour', async () => {
  const { PAINTS, eyeInkFor } = await load(PURE)
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255)
  }
  const contrast = (a, b) => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]
    return (hi + 0.05) / (lo + 0.05)
  }
  /* The eyes are large graphical objects, so the standard that applies is WCAG
     1.4.11 non-text contrast, 3:1 — not the 4.5:1 body-text bar. The threshold
     here is 4.0: comfortably above what is required and just under the worst
     paint in the palette (violet, 4.23:1, where both inks land within 0.01 of
     each other), so it still fails loudly if someone adds an unusable colour. */
  for (const [name, hex] of PAINTS) {
    const ratio = contrast(hex, eyeInkFor(hex))
    assert.ok(ratio >= 4.0, `${name} (${hex}) eye contrast only ${ratio.toFixed(2)}:1`)
  }
})

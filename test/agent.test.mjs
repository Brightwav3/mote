/* The agent surface is the thing an integrator actually touches (ADR 0006,
   docs/decisions/0006-embeddable-agent-avatar.md), so what matters is that
   every state exists, and that the scripts behind them name faces and
   animations that are really there.

   That last one is not pedantry. A misspelt face id does not throw — `react`
   looks it up, gets undefined, and the creature simply does nothing when the
   agent reports an error. Nothing in the running page says so. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { load, PURE } from './harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/* The states an integrator is promised. Written out, not read from the source:
   a test that imports the list it checks passes on any list. */
const SURFACE = ['idle', 'listening', 'thinking', 'tool', 'toolResult', 'speaking',
  'done', 'shipped', 'needsInput', 'notify', 'error', 'interrupted', 'asleep']

/* Load `embed/agent.js` ALONE, against stubs, and record what each act plays.
   The acts only touch the rest of the creature from inside their bodies, so
   this works — and it means the scripts can be inspected as data without a
   DOM, a clock or a frame loop. */
async function actScripts() {
  const code = await readFile(join(root, 'src', 'embed', 'agent.js'), 'utf8')
  const played = []
  const sandbox = {
    Math, Object, JSON, console,
    play: (steps) => played.push(...steps),
    stopAnim() {}, playAnim() {}, look() {}, say() {}, later() {}, blink() {},
    react() {}, runPending() {}, direct() {}, makeStage() {}, drawStage() {},
    expressionFor: () => ({ mix: {}, id: 'neutral', settled: true }),
    animPose: () => null, bodySil: () => ({}), gazeOf: () => ({}),
    maybeIdleAnim() {}, temperamentFor: () => ({}), clamp: (v) => v, lerp: (a) => a,
    rad: () => 0, rnd: () => 0, epoch: 0, clock: 0, MOODLINE: {},
    FACES: [], STATES: [], BODIES: [], PAINTS: [], BODY_BY_ID: {},
    mote: { cursor: {}, hold: null, episodeUntil: 0, lastInput: 0, body: {}, gaze: {} },
  }
  vm.createContext(sandbox)
  vm.runInContext(code + '\n;globalThis.__acts = AGENT_ACTS;', sandbox)

  const out = {}
  for (const [name, fn] of Object.entries(sandbox.__acts)) {
    played.length = 0
    fn('x', 1000)
    out[name] = played.map((s) => ({ face: s.face, anim: s.anim, hold: s.hold }))
  }
  return out
}

test('the agent surface is the thirteen documented states', async () => {
  const acts = await actScripts()
  assert.equal(Object.keys(acts).sort().join(','), [...SURFACE].sort().join(','))
})

test('every face an act names really exists', async () => {
  const acts = await actScripts()
  const { FACES } = await load(PURE)
  const known = new Set(FACES.map((f) => f.id))
  for (const [name, steps] of Object.entries(acts)) {
    for (const s of steps) {
      assert.ok(known.has(s.face), `${name} names unknown face "${s.face}"`)
    }
  }
})

test('every animation an act names really exists', async () => {
  const acts = await actScripts()
  const { STATES } = await load([...PURE, 'anim/decor.js', 'anim/states.js'])
  const known = new Set(STATES.map((s) => s.id))
  for (const [name, steps] of Object.entries(acts)) {
    for (const s of steps) {
      if (s.anim) assert.ok(known.has(s.anim), `${name} names unknown animation "${s.anim}"`)
    }
  }
})

test('no act leaves a gap a face could fall through', async () => {
  const acts = await actScripts()
  for (const [name, steps] of Object.entries(acts)) {
    for (const s of steps) {
      /* Every beat holds. A zero hold hands the face back to "nearest
         expression to the travelling mood", which is an arbitrary point
         mid-flight — the bug ADR 0004 exists because of. */
      assert.ok(s.hold > 0, `${name} has a beat with hold ${s.hold}`)
    }
  }
})

test('the library build exposes the API and keeps its internals in', async () => {
  const lib = await readFile(join(root, 'dist', 'mote-avatar.js'), 'utf8')
  assert.match(lib, /export default MoteLib/)
  assert.match(lib, /export \{ MoteLib as Mote \}/)
  /* Everything the sources declare must stay inside the wrapper: a library
     that leaks `clamp` or `mote` into the page's scope is not embeddable.

     Checked structurally, not by scanning for declarations. The sources are
     not indented, so every `const` in them looks top-level to a regex; what
     actually guarantees the scope is that nothing at all sits outside the
     IIFE except the two export lines. */
  const code = lib.slice(lib.indexOf('const MoteLib'))
  const outside = code.split('})();')
  assert.equal(outside.length, 2, 'the wrapper does not close exactly once')
  assert.equal(outside[1].split(/\s+/).filter(Boolean).join(' '),
    'export default MoteLib; export { MoteLib as Mote };')
  /* And the demo must not be in it. */
  assert.ok(!lib.includes('getElementById("hatch")'), 'the maker page leaked into the library build')
  assert.ok(!lib.includes('id="acts"'), 'the demo deck leaked into the library build')
})

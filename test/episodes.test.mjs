/* Episodes carried as data — validation, repeat modes, and the persona round
   trip. See src/creature/episodes.js.

   The pure half runs against `checkEpisode`/`pingpongOrder` directly. The rest
   runs a mounted creature, because the property that matters about a loop is
   that it survives its own restart and dies to the next deliberate act, and
   both of those are facts about the epoch and the animation clock rather than
   about the list. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

/* Governed by:
     ADR 0004 — docs/decisions/0004-scripted-episodes.md
     ADR 0006 — docs/decisions/0006-embeddable-agent-avatar.md */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function makeNode(tag) {
  return {
    tagName: tag, attrs: {}, children: [], parentNode: null,
    get firstChild() { return this.children[0] || null },
    setAttribute(k, v) { this.attrs[k] = String(v) },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    getAttributeNames() { return Object.keys(this.attrs) },
    appendChild(n) {
      if (n.parentNode) n.parentNode.removeChild(n)
      n.parentNode = this; this.children.push(n); return n
    },
    removeChild(n) {
      const i = this.children.indexOf(n)
      if (i >= 0) this.children.splice(i, 1)
      n.parentNode = null; return n
    },
    cloneNode(deep = false) {
      const copy = makeNode(tag)
      copy.attrs = { ...this.attrs }
      if (deep) for (const c of this.children) copy.appendChild(c.cloneNode(true))
      return copy
    },
    querySelectorAll() { return [] },
  }
}

async function runtime() {
  const manifest = JSON.parse(await readFile(join(root, 'src', 'manifest.json'), 'utf8'))
  const core = manifest.filter((p) => !p.startsWith('app/'))
  const code = (await Promise.all(
    core.map((p) => readFile(join(root, 'src', p), 'utf8'))
  )).join('\n')

  const sandbox = {
    Math, JSON, Array, Object, Number, String, Boolean, Map, Set, Error, console,
    document: { createElementNS: (_ns, tag) => makeNode(tag) },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext('globalThis.__mk = () => {\n' + code
    + '\n;return { Mote, checkEpisode, pingpongOrder, playEpisode };\n};', sandbox)
  return sandbox.__mk()
}

const R = await runtime()
const mount = (opts) => R.Mote.mount(makeNode('div'), { manual: true, ...opts })

/* `t` must increase monotonically across a whole test — a reset makes the
   dwell guard swallow face changes. See CLAUDE.md. */
function run(avatar, seconds, from) {
  const n = Math.round(seconds * 60)
  for (let i = 1; i <= n; i++) avatar.tick(from + (i * 1000) / 60)
  return from + (n * 1000) / 60
}

const ok = [{ face: 'happy', hold: 0.5 }, { face: 'attentive', hold: 0.5 }]

/* Rounds are counted through `onSay`, not through `state().playing`.

   `playing` is `clock < episodeUntil`, and the creature sets `episodeUntil`
   for its OWN idle scripts too — so a moment after a loop ends, an idle
   thought starts and `playing` goes back to true. It is the right field for a
   status line and the wrong one for "did my episode stop", which is a
   distinction worth having found here rather than in somebody's integration.

   A marker on the first beat makes each round observable directly. */
const marked = (text) => [
  { face: 'happy', hold: 0.5, say: [text, 100] },
  { face: 'attentive', hold: 0.5 },
]

function counter(avatar, text) {
  let n = 0
  avatar.onSay((said) => { if (said === text) n++ })
  return () => n
}

test('ping-pong walks back out the way it came, without repeating the ends', () => {
  const ids = (steps) => R.pingpongOrder(steps).map((s) => s.face)
  const abc = [{ face: 'a' }, { face: 'b' }, { face: 'c' }]
  assert.deepEqual([...ids(abc)], ['a', 'b', 'c', 'b'])

  const abcd = [{ face: 'a' }, { face: 'b' }, { face: 'c' }, { face: 'd' }]
  assert.deepEqual([...ids(abcd)], ['a', 'b', 'c', 'd', 'c', 'b'])

  /* Under three beats there is no "back out" to walk: a b would become a b,
     and a alone would stutter on itself. */
  assert.deepEqual([...ids(abc.slice(0, 2))], ['a', 'b'])
})

test('a bad script is refused at the call, naming what is wrong and where', () => {
  const refused = (steps, needle) => {
    assert.throws(() => R.checkEpisode(steps), (e) => {
      assert.match(e.message, needle, 'wrong message: ' + e.message)
      return true
    })
  }
  refused([], /non-empty/)
  refused([{ hold: 1 }], /beat 0: a beat needs a face/)
  refused([{ face: 'happy' }], /beat 0: a beat needs a hold/)
  refused([ok[0], { face: 'nope', hold: 1 }], /beat 1\.face: unknown face "nope"/)
  refused([{ face: 'happy', hold: 0 }], /beat 0\.hold/)
  refused([{ face: 'happy', hold: 1e6 }], /beat 0\.hold/)
  refused([{ face: 'happy', hold: 1, anim: 'moonwalk' }], /unknown animation/)
  refused([{ face: 'happy', hold: 1, look: ['sideways', 1] }], /look must be/)
  refused([{ face: 'happy', hold: 1, say: 'hello' }], /say must be/)

  /* The typo this whole check exists for: a key nobody defined, silently
     ignored, would play a beat with no face at all. */
  refused([{ expression: 'happy', hold: 1 }], /unknown key "expression"/)
})

test('a half-valid script runs none of itself', () => {
  const avatar = mount({})
  const before = avatar.state().name
  assert.throws(() => avatar.episode([ok[0], { face: 'nope', hold: 1 }]))
  assert.equal(avatar.state().name, before, 'a beat played before validation failed')
})

test('a persona is refused at mount, not at the first play', () => {
  assert.throws(
    () => mount({ episodes: { greet: [{ face: 'nope', hold: 1 }] } }),
    /episode "greet".*unknown face/s)
})

test('a named episode plays, and an unknown name throws', () => {
  const avatar = mount({ episodes: { greet: ok } })
  assert.deepEqual([...avatar.episodes()], ['greet'])
  avatar.episode('greet')
  assert.throws(() => avatar.episode('nope'), /no episode named "nope"/)
})

/* The reason a loop needs no cancellation handle: it re-arms after its own
   `play()`, so it carries the fresh epoch, and any deliberate act bumps past
   it. ADR 0004. */
test('a loop keeps going, and the next deliberate act ends it', () => {
  const avatar = mount({ episodes: { hum: { steps: marked('hum'), mode: 'loop' } } })
  const rounds = counter(avatar, 'hum')
  let t = 0

  avatar.episode('hum')
  t = run(avatar, 5, t)               // five rounds of a one-second cycle
  assert.ok(rounds() >= 4, `a loop ran ${rounds()} rounds in five seconds`)

  const atInterrupt = rounds()
  avatar.done()
  t = run(avatar, 6, t)
  assert.equal(rounds(), atInterrupt, 'the loop outlived a deliberate act')
})

test('repeat counts rounds, and a counted loop ends by itself', () => {
  const avatar = mount({})
  const rounds = counter(avatar, 'twice')
  let t = 0

  avatar.episode(marked('twice'), { mode: 'loop', repeat: 2 })
  t = run(avatar, 0.2, t)
  assert.equal(rounds(), 1)
  t = run(avatar, 1.2, t)
  assert.equal(rounds(), 2, 'the second round never started')
  t = run(avatar, 4, t)
  assert.equal(rounds(), 2, 'a counted loop did not stop')
})

/* `once` is the default, and it means once. */
test('an episode with no mode plays a single time', () => {
  const avatar = mount({})
  const rounds = counter(avatar, 'solo')
  let t = 0
  avatar.episode(marked('solo'))
  t = run(avatar, 4, t)
  assert.equal(rounds(), 1)
})

test('an unknown mode is refused', () => {
  const avatar = mount({})
  assert.throws(() => avatar.episode(ok, { mode: 'reverse' }), /unknown mode "reverse"/)
})

/* The contract of `persona()`: what comes out goes back in and produces the
   same animal. */
test('a persona survives a JSON round trip', () => {
  const first = mount({
    name: 'Ada', body: 'goutte', paint: '#3b93f0',
    episodes: { hum: { steps: ok, mode: 'pingpong' }, greet: ok },
  })
  const persona = JSON.parse(JSON.stringify(first.persona()))

  assert.equal(persona.name, 'Ada')
  assert.equal(persona.body, 'goutte')
  assert.equal(persona.paint, '#3b93f0')
  assert.equal(persona.episodes.hum.mode, 'pingpong')
  /* A once-only episode stays a bare array — the mode is not noise to carry. */
  assert.ok(Array.isArray(persona.episodes.greet))

  const second = R.Mote.mount(makeNode('div'), { manual: true, ...persona })
  assert.deepEqual(second.persona(), first.persona())
})

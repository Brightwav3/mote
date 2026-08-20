/* The one test that runs the code an integrator actually executes: mount,
   drive frames, call the agent surface, destroy.

   Everything else in this suite is pure — maths, tables, file structure — and
   both real bugs found in this feature (an animation being cut rather than
   faded, and no crossfade at all when starting from rest) lived in the layer
   below, where nothing was watching. This is the smoke alarm for that layer.

   The DOM here is a stub, not jsdom: the renderer only ever calls
   `createElementNS`, `setAttribute`, `appendChild` and `removeChild`, so forty
   lines cover it and the project keeps its zero dependencies. That is only
   possible because `makeStage` builds its tree node by node (ADR 0006,
   docs/decisions/0006-embeddable-agent-avatar.md); back when it assembled a
   markup string this test would have needed an HTML parser. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
/* ADR 0009: multi-instance lifecycle is verified through public handles. */
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function makeNode(tag) {
  return {
    tagName: tag,
    attrs: {},
    children: [],
    parentNode: null,
    get firstChild() { return this.children[0] || null },
    setAttribute(k, v) {
      assert.ok(v !== undefined && v !== null && String(v) !== 'NaN',
        `${tag}.${k} set to ${v}`)
      this.attrs[k] = String(v)
    },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    getAttributeNames() { return Object.keys(this.attrs) },
    appendChild(n) {
      if (n.parentNode) n.parentNode.removeChild(n)
      n.parentNode = this
      this.children.push(n)
      return n
    },
    removeChild(n) {
      const i = this.children.indexOf(n)
      if (i >= 0) this.children.splice(i, 1)
      n.parentNode = null
      return n
    },
    cloneNode(deep = false) {
      const copy = makeNode(tag)
      copy.attrs = { ...this.attrs }
      if (deep) for (const child of this.children) copy.appendChild(child.cloneNode(true))
      return copy
    },
    querySelectorAll(selector) {
      const out = []
      const matches = (node) => selector === '*' || (selector === '[id]' && node.getAttribute('id') !== null)
      const visit = (node) => {
        for (const child of node.children) {
          if (matches(child)) out.push(child)
          visit(child)
        }
      }
      visit(this)
      return out
    },
    /* Depth-first, for assertions only. */
    all(out = []) {
      for (const c of this.children) { out.push(c); c.all(out) }
      return out
    },
  }
}

async function mountInStub() {
  const manifest = JSON.parse(await readFile(join(root, 'src', 'manifest.json'), 'utf8'))
  const core = manifest.filter((p) => !p.startsWith('app/'))
  const code = (await Promise.all(
    core.map((p) => readFile(join(root, 'src', p), 'utf8'))
  )).join('\n')

  let raf = 0
  const sandbox = {
    Math, JSON, Array, Object, Number, String, Boolean, Map, Set, Error, console,
    document: { createElementNS: (_ns, tag) => makeNode(tag) },
    performance: { now: () => 0 },
    requestAnimationFrame: () => ++raf,
    cancelAnimationFrame: () => {},
  }
  vm.createContext(sandbox)
  /* Mirror `build.mjs`: the sources are wrapped in a FACTORY, and the public
     `mount` calls it once per handle so every creature gets a private copy of
     the module scope. Evaluating the sources once and handing back that single
     inner `Mote` would test a library nobody ships — and would quietly pass
     even if multi-instance were broken.
     ADR 0009: docs/decisions/0009-multi-instance-agent-avatars.md */
  vm.runInContext(
    'globalThis.__createMote = () => {\n' + code + '\n;return Mote;\n};',
    sandbox)
  const shared = sandbox.__createMote()
  const Mote = {
    ...shared,
    mount: (host, opts) => sandbox.__createMote().mount(host, opts),
  }
  return { Mote, host: makeNode('div') }
}

/* 3.5 s of frames at 60fps, driven by hand — `manual: true` means the handle
   never asks for a rAF, so the clock is entirely ours. */
function run(avatar, seconds, from = 0) {
  const n = Math.round(seconds * 60)
  for (let i = 1; i <= n; i++) avatar.tick(from + (i * 1000) / 60)
  return from + (n * 1000) / 60
}

test('it mounts, draws, and keeps drawing', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true, name: 'Ada' })
  const svg = host.firstChild
  assert.equal(svg.tagName, 'svg')

  const body = svg.all().find((n) => n.tagName === 'path')
  assert.ok(body.getAttribute('d'), 'nothing was drawn on mount')
  const first = body.getAttribute('d')

  run(avatar, 3)
  assert.ok(body.getAttribute('fill'), 'body has no colour')
  /* Two eyes, both positioned. */
  const rects = svg.all().filter((n) => n.tagName === 'rect' && n.getAttribute('rx') !== null)
  assert.equal(rects.length, 2)
  for (const r of rects) assert.ok(Number(r.getAttribute('width')) > 0)
  assert.ok(first, 'body path went missing')
  /* ADR 0008-snapshot-boundary */
  const snapshotHost = makeNode('div')
  avatar.snapshot(snapshotHost)
  assert.equal(snapshotHost.firstChild.tagName, 'svg')
  assert.ok(snapshotHost.firstChild.all().some((n) => n.tagName === 'path' && n.getAttribute('d')),
    'snapshot did not copy the rendered Mote')
  const variantHost = makeNode('div')
  avatar.snapshot(variantHost, { body: 'triangle', paint: '#8b5cf6', name: 'Vela' })
  const variantBody = variantHost.firstChild.all().find((n) => n.getAttribute('data-mote-body') === 'true')
  assert.equal(variantBody.getAttribute('fill'), '#8b5cf6')
  assert.equal(variantHost.firstChild.getAttribute('data-mote-name'), 'Vela')
  assert.notEqual(variantBody.getAttribute('d'), body.getAttribute('d'), 'snapshot skin did not change its body')
  avatar.destroy()
})

test('multiple mounted Motes keep independent lives and teardown', async () => {
  const { Mote, host } = await mountInStub()
  const secondHost = makeNode('div')
  const first = Mote.mount(host, { manual: true, name: 'Ada', body: 'galet', paint: '#2c6ef5' })
  const second = Mote.mount(secondHost, { manual: true, name: 'Bea', body: 'triangle', paint: '#8b5cf6' })

  first.thinking()
  second.tool('search')
  run(first, 1.2)
  run(second, 1.2)

  assert.equal(host.children.length, 1)
  assert.equal(secondHost.children.length, 1)
  assert.equal(first.skin().name, 'Ada')
  assert.equal(second.skin().name, 'Bea')
  assert.equal(first.state().name, 'thinking')
  assert.equal(second.state().name, 'tool')
  assert.equal(second.state().awaitingTool, true)

  first.destroy()
  assert.equal(host.children.length, 0)
  assert.equal(secondHost.children.length, 1, 'destroying one Mote removed another instance')
  run(second, 1.2, 1200)
  assert.equal(second.state().awaitingTool, true)
  second.destroy()
})

test('compact mounted Motes keep a calm, fixed eye pair while status stays alive', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true, ambient: false, name: 'Row' })
  avatar.thinking()
  run(avatar, 4)

  const eyeRects = () => host.firstChild.all()
    .filter((n) => n.tagName === 'rect' && n.getAttribute('rx') !== null)
    .map((n) => ({
      x: n.getAttribute('x'), y: n.getAttribute('y'),
      width: n.getAttribute('width'), height: n.getAttribute('height'),
      parent: n.parentNode?.getAttribute('transform'),
    }))
  const first = eyeRects()
  run(avatar, 6, 4000)
  assert.deepEqual(eyeRects(), first, 'compact eyes changed while the status episode was running')
  assert.equal(avatar.state().name, 'thinking')
  avatar.destroy()
})

test('every agent state runs without a bad attribute', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true })
  let t = run(avatar, 0.5)
  /* setAttribute in the stub asserts on undefined/null/NaN, so a state that
     produces a broken pose fails here rather than silently drawing nothing. */
  for (const [name, args] of [
    ['listening', []], ['thinking', []], ['tool', ['search']], ['toolResult', [true]],
    ['speaking', ['hello there', 1800]], ['done', []], ['shipped', []],
    ['needsInput', ['may I?']], ['notify', []], ['error', ['oh dear']],
    ['interrupted', []], ['idle', []], ['asleep', []],
  ]) {
    avatar[name](...args)
    t = run(avatar, 2, t)
  }
  for (const s of Mote.states()) { avatar.animate(s.id); t = run(avatar, 1.2, t) }
  avatar.destroy()
})

test('repeating a state while it plays is a no-op', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true })
  let t = run(avatar, 0.5)
  const faces = []
  avatar.onFace((id, settled) => { if (settled) faces.push(id) })

  /* What a token stream does: the same state, hundreds of times. */
  avatar.thinking()
  for (let i = 0; i < 200; i++) { avatar.thinking(); t = run(avatar, 1 / 60, t) }
  t = run(avatar, 3, t)

  /* If each call restarted the episode the creature would never leave the
     first beat. It should have moved through the script. */
  assert.ok(new Set(faces).size > 1, `stuck on ${[...new Set(faces)]}`)
  avatar.destroy()
})

test('a tool call waits for its result', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true })
  let t = run(avatar, 0.5)

  avatar.tool('search')
  t = run(avatar, 12, t)   // far longer than any single script
  assert.equal(avatar.state().awaitingTool, true, 'stopped waiting on its own')

  avatar.toolResult(true)
  t = run(avatar, 2, t)
  assert.equal(avatar.state().awaitingTool, false)
  avatar.destroy()
})

test('destroy puts the creature back, so a remount is a fresh one', async () => {
  const { Mote, host } = await mountInStub()
  const first = Mote.mount(host, { manual: true, name: 'Ada' })
  let t = run(first, 0.5)
  first.error('everything is on fire')
  t = run(first, 3, t)
  first.destroy()
  assert.equal(host.children.length, 0, 'destroy left nodes behind')

  const host2 = makeNode('div')
  const second = Mote.mount(host2, { manual: true, name: 'Bo' })
  run(second, 0.5)
  /* A fresh creature is not in the middle of anything. Without the reset it
     inherits the previous one's episode and mood. */
  assert.equal(second.state().name, null)
  assert.equal(second.state().playing, false)
  second.destroy()
})

test('changing body morphs rather than swaps', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true, body: 'cercle' })
  let t = run(avatar, 1)
  const body = host.firstChild.all().find((n) => n.tagName === 'path')

  /* A circle is 64 equal radii; a triangle is emphatically not. Sample the
     drawn path every other frame across the morph and check it travels
     instead of arriving. */
  avatar.setSkin({ body: 'triangle' })
  const seen = new Set()
  for (let i = 0; i < 40; i++) { t = run(avatar, 1 / 60, t); seen.add(body.getAttribute('d')) }
  assert.ok(seen.size > 20, `body path took ${seen.size} distinct values across the morph`)

  /* And it settles: once arrived, the path stops changing. */
  t = run(avatar, 1.5, t)
  const settled = body.getAttribute('d')
  t = run(avatar, 0.5, t)
  assert.equal(body.getAttribute('d'), settled, 'the body never stopped moving')
  avatar.destroy()
})

/* ADR 0007: the stream adapter, and the three properties the stream forced on
   the API. docs/decisions/0007-stream-adapter.md */
test('a model stream drives it end to end', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true })
  let t = run(avatar, 0.5)
  const said = []
  avatar.onSay((text) => said.push(text))

  /* The Anthropic Messages streaming shape, tool call and all. */
  const events = [
    { type: 'message_start', message: { id: 'msg_1' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hm' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'search' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"q"' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 20 } },
  ]
  for (const e of events) { avatar.event(e); t = run(avatar, 0.2, t) }
  assert.equal(avatar.state().awaitingTool, true, 'did not wait for the tool')

  avatar.toolResult(true)
  t = run(avatar, 1, t)

  /* Second request: the text answer, streamed a few characters at a time. */
  avatar.event({ type: 'message_start', message: { id: 'msg_2' } })
  avatar.event({ type: 'content_block_start', index: 0, content_block: { type: 'text' } })
  for (const chunk of ['I found ', 'three of them. ', 'Want the ', 'details?']) {
    avatar.event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk } })
    t = run(avatar, 0.3, t)
  }
  avatar.event({ type: 'content_block_stop', index: 0 })
  avatar.event({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })
  avatar.event({ type: 'message_stop' })
  t = run(avatar, 2, t)

  /* Batched to sentences, not one call per token — 4 chunks, 2 sentences. */
  assert.deepEqual(said.map((s) => s.trim()),
    ['search…', 'I found three of them.', 'Want the details?'])
  avatar.destroy()
})

test('an unknown event type is ignored, not thrown on', async () => {
  const { Mote, host } = await mountInStub()
  const avatar = Mote.mount(host, { manual: true })
  run(avatar, 0.5)
  avatar.event({ type: 'something_new_2027', payload: {} })
  avatar.event({})
  avatar.event(null)
  run(avatar, 1)
  avatar.destroy()
})

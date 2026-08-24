# Mote

A small creature you make. Pick a body, a colour and a name, and it goes about
its own business — attending to its own eight places in the room, drifting on
slow mood weather, occasionally glancing over at you.

Ships as one self-contained HTML file with no dependencies.

```bash
npm run check     # build + test
npm run serve     # http://localhost:5199
```

## Using it in your agent

```bash
npm install github:Brightwav3/mote
```

`dist/` is committed, so a git install needs no build step. Types are included.

```js
import Mote from 'mote-avatar'

const avatar = Mote.mount(document.getElementById('avatar'), {
  name: 'Ada', body: 'galet', paint: '#3b93f0',
})

avatar.onSay((text) => bubble.textContent = text)
```

Pass the host theme to keep eye ink consistent across the whole cast:

```js
const avatar = Mote.mount(host, { theme: 'dark' })
avatar.setTheme('light') // when the host UI switches
```

In `dark`, every body has dark eyes except Ink, which has white eyes. In
`light`, every body has white eyes except White, which has dark eyes. Theme is
host context, so it is deliberately absent from `skin()` and `persona()`.

The `sun` body keeps Mote's existing face and has editable petals:

```js
avatar.setSkin({
  body: 'sun',
  sun: { size: 0.23, count: 8, distance: 1.04, rotation: 0 },
})
```

`size` accepts 0.14–0.34, `count` 5–12, `distance` 0.9–1.18, and
`rotation` is clockwise in degrees. Values are clamped to safe ranges and the
four settings survive `skin()` and `persona()` round trips.

For compact presence surfaces, `avatar.snapshot(host, skin)` copies the last
rendered SVG frame into a decorative host without mounting another live
creature. The optional `skin` can choose a body, paint and name for a distinct
compact persona; see [ADR 0008](docs/decisions/0008-snapshot-boundary.md).

Multiple live Motes can coexist. Each `Mote.mount(host, opts)` call owns its own
mood, attention, episode queue, animation player and animation clock, so agent
rows can each keep a living identity while a selected Mote occupies the main
presence surface. Destroying one handle only clears its own host.

The mechanism is that the library is built as a factory and `mount` calls it per
handle, so a creature's state is a whole private copy of the module scope rather
than something threaded through every function. You do not have to do anything
to get this — `Mote.mount` is the only entry point you need; see
[ADR 0009](docs/decisions/0009-multi-instance-agent-avatars.md).

Compact agent rows may pass `ambient: false`. The instance still animates
runtime states and keeps its own life, but it does not autonomously wander its
gaze or mood between runtime events. This keeps a dense sidebar legible while
the selected main Mote can retain the fuller ambient behavior.

Then call it as the turn goes. The whole surface is the states of an agent's
turn, and each one is a written sequence of faces and animations — see
[ADR 0006](docs/decisions/0006-embeddable-agent-avatar.md).

| Call | What it shows |
| --- | --- |
| `avatar.idle()` | hands it back to itself |
| `avatar.listening()` | attends to you and holds it |
| `avatar.thinking()` | the three dots, then curious |
| `avatar.tool('search')` | looks away and **waits** — until `toolResult()` |
| `avatar.toolResult(ok)` | the tool came back; `false` is a failed one |
| `avatar.speaking(text, ms)` | says it, watching you |
| `avatar.done()` | pleased, then back to attending |
| `avatar.shipped()` | excited, then proud — for the long job |
| `avatar.needsInput('may I?')` | the exclamation mark, then asks |
| `avatar.notify()` | the pip, notched out of its body |
| `avatar.error('...that was me.')` | alarmed, then owns it |
| `avatar.interrupted()` | bursts apart and reassembles |
| `avatar.asleep()` | the session has gone quiet |

### From a model stream

```js
for await (const e of client.messages.stream({ ... })) avatar.event(e)
// or: await avatar.runStream(stream)
```

It maps the Anthropic Messages streaming events onto the states above. Three
things about it are worth knowing, and all three exist because wiring a real
stream is what exposed them — see
[ADR 0007](docs/decisions/0007-stream-adapter.md):

- **Repeating a state while its episode is playing is a no-op.** A stream calls
  `thinking()` on every delta; without this the creature restarts its script on
  every token and never reaches its second beat. So the whole API is safe to
  call from a render loop.
- **Speech is batched to sentences.** A `speaking()` per token is a face change
  per token.
- **`tool()` waits.** A stream never says a tool *finished* — the result comes
  back in the next request — so `toolResult(ok)` is what ends it. A creature
  that looks up after a fixed two seconds whether or not the tool returned is
  the tell that it is animation rather than status.

Between calls it gets on with its own life — looks around, drifts on slow mood
weather, occasionally plays something to itself. An agent that never calls
anything still has a face worth looking at, which is the whole argument for an
avatar over a spinner.

Also on the handle: `state()` for what it was last put into, `event(e)` and
`runStream(s)` for a model stream, `setSkin({body, paint, name})`, `skin()`, `say(text, ms)`,
`look(mode, seconds)`, `animate(id, hold)` for any catalogue animation
by name, `pointer(x, y)` for the rare moments it glances over, `poke()`,
`after(seconds, fn)` to schedule on the animation clock rather than the wall
clock, `start()` / `stop()` / `tick(now)` / `destroy()`, and the catalogues
`animations()`, `bodies()`, `palette()`.

Large-field motion — the burst, the orbit, the comet, the travelling
exclamation mark — is skipped entirely under `prefers-reduced-motion`. The face
still changes, so every state stays legible.

**Each mount is its own creature.** The implementation keeps the historical
plain-script source layout; isolation comes from the build, which wraps those
sources in a factory that `mount` calls once per handle. A page may therefore
show several agents without sharing mood, attention, animation or tool-wait
state.

## What it does

**The name decides the creature.** A hash of the name seeds temperament —
baseline mood, volatility, how quickly it lets go of a feeling, how curious it
is, how sociable. The same name always produces the same animal, and the maker
page tells you who you are about to get: *"Zelda will be placid, sunny and
bold."*

**Mood has two timescales.** Emotion is fast and spikes on events. Mood is slow,
accumulates from what you do, and biases where emotion returns to. Praise it
repeatedly and it stays cheerful for a minute or two afterwards; scold it and
the next thing you do lands differently. Nothing on screen reports this.

**Seventeen expressions, all reachable unprompted.** Sixteen are Bloub's,
hardcoded and verified; the seventeenth is original. Over thirty simulated
minutes alone, every one appears.

**Eyes jump, they do not glide.** Gaze moves in ballistic saccades on the main
sequence — 24 ms plus 2.2 ms per degree — with tremor and drift between them and
a reflex blink locked to the large ones.

**It does not follow your cursor.** Continuous tracking reads as a targeting
reticle. It knows where you are and chooses when to look, and a glance is a
fixation on where you *were*, not a follow.

**Episodes can be written from outside.** The ten agent states are ten scripts
of the same shape, and `avatar.episode(beats)` takes an eleventh — a list of
`{ face, hold }` beats, optionally with an animation, a glance or a line to say
on any of them. Scripts are checked whole before a single beat runs, including
rejecting keys nobody defined, because a silently ignored `expression:` for
`face:` is the failure mode worth spending code on. `mode: "loop"` and
`mode: "pingpong"` repeat; a loop needs no cancelling, since the next
deliberate act ends it.

**A creature is portable.** `avatar.persona()` returns name, body, colour and
named episodes as plain JSON, and `Mote.mount(host, persona)` puts the same
animal back. Episodes in a persona are checked at mount, so a typo in a config
file surfaces when the config loads rather than the first time a rare event
fires.

**The photoroom takes a still.** The *Photo* button holds the creature in one
of the seventeen expressions and saves it as a square SVG. Nothing ticks while
it is open — no blink, no gaze, no mood — because you cannot catch the frame
you wanted by pressing a button at the right instant. The file is the exact
frame on screen, transparent, on the same square viewBox the live creature
uses, so it drops in as an icon or an avatar.

## Layout

```
src/
  lib/          maths, sphere geometry, springs
  faces/        the seventeen poses and the expression chooser
  bodies/       the nine silhouettes and the palette
  creature/     affect, temperament, gaze, behaviour, scripts
  render/       SVG stage
  embed/        the public API: mount, the agent-state table, the stream adapter
  app/          the demo page — an integrator like any other
  shell.html    markup and stylesheet
  manifest.json evaluation order — the build concatenates in this order
docs/decisions/ ADRs: why it is shaped this way
test/           node:test, no framework
```

`build.mjs` emits two targets from the one manifest: `dist/index.html`, the demo,
and `dist/mote-avatar.js`, the creature alone as an ES module. The split is
`app/`. There is no bundler and no lockfile; see
[ADR 0002](docs/decisions/0002-single-file-build.md).

## Provenance

The face and silhouette vocabulary is **ported from
[Bloub](https://github.com/jeremy-prt/bloub)** (MIT, © 2026 Jérémy Perret) — the
sixteen measured expression poses, the sphere projection that places the eyes,
the eight shape generators and the palette. These are ports, not
reimplementations: the constants are Bloub's and the test suite fails if they
drift. `NOTICE` lists exactly what came from where, and
[ADR 0001](docs/decisions/0001-port-bloub-verbatim.md) explains why they are
copied rather than rewritten.

Original to this project: the behaviour layer — the valence/arousal/dominance
affect model, the two timescales, temperament from the name, the attention and
oculomotor model, the discrete-expression chooser, the episode player, and the
application.

Bloub is itself a study of the x.ai bot avatar. Neither project is affiliated
with x.AI.

## Licence

MIT — see [LICENSE](LICENSE), [NOTICE](NOTICE) and
[LICENSE-BLOUB](LICENSE-BLOUB).

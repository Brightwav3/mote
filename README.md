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
npm run build            # writes dist/mote-avatar.js
```

```js
import Mote from './mote-avatar.js'

const avatar = Mote.mount(document.getElementById('avatar'), {
  name: 'Ada', body: 'galet', paint: '#3b93f0',
})

avatar.onSay((text) => bubble.textContent = text)
```

Then call it as the turn goes. The whole surface is the states of an agent's
turn, and each one is a written sequence of faces and animations — see
[ADR 0006](docs/decisions/0006-embeddable-agent-avatar.md).

| Call | What it shows |
| --- | --- |
| `avatar.idle()` | hands it back to itself |
| `avatar.listening()` | attends to you and holds it |
| `avatar.thinking()` | the three dots, then curious |
| `avatar.tool('search')` | looks away while it waits, says the tool's name |
| `avatar.speaking(text, ms)` | says it, watching you |
| `avatar.done()` | pleased, then back to attending |
| `avatar.shipped()` | excited, then proud — for the long job |
| `avatar.needsInput('may I?')` | the exclamation mark, then asks |
| `avatar.notify()` | the pip, notched out of its body |
| `avatar.error('...that was me.')` | alarmed, then owns it |
| `avatar.interrupted()` | bursts apart and reassembles |
| `avatar.asleep()` | the session has gone quiet |

Between calls it gets on with its own life — looks around, drifts on slow mood
weather, occasionally plays something to itself. An agent that never calls
anything still has a face worth looking at, which is the whole argument for an
avatar over a spinner.

Also on the handle: `setSkin({body, paint, name})`, `skin()`, `say(text, ms)`,
`look(mode, seconds)`, `animate(id, hold)` for any of the fourteen animations
by name, `pointer(x, y)` for the rare moments it glances over, `poke()`,
`after(seconds, fn)` to schedule on the animation clock rather than the wall
clock, `start()` / `stop()` / `tick(now)` / `destroy()`, and the catalogues
`animations()`, `bodies()`, `palette()`.

**One avatar per page.** The creature's state is module-level on purpose — an
assistant has one face — and mounting again replaces the first. Making it
multi-instance is a real refactor, not a flag.

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

## Layout

```
src/
  lib/          maths, sphere geometry, springs
  faces/        the seventeen poses and the expression chooser
  bodies/       the eight silhouettes and the palette
  creature/     affect, temperament, gaze, behaviour, scripts
  render/       SVG stage
  embed/        the public API: mount, and the agent-state table
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

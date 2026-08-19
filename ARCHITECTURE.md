# Architecture

How Mote is put together. *Why* it is shaped this way lives in
[`docs/decisions/`](docs/decisions/).

## The pipeline

One `requestAnimationFrame` loop, four stages, each reading the one below it.
Nothing lower knows anything about the stage above.

```
  app/loop.js      frame(t) — drives everything, owns the clock
        │
        ├─ creature/mote.js    what it wants: attention, ideas, episodes
        │       │
        │       ├─ lib/springs.js         emotion (fast) as damped springs
        │       ├─ creature/temperament.js who this one is, from its name
        │       └─ creature/gaze.js       where the eyes actually go
        │
        ├─ faces/expressions.js  which of the 17 poses that adds up to
        │
        └─ render/stage.js       draw that pose
                └─ bodies/shapes.js, lib/geometry.js
```

Rendering decides nothing. Given a pose it draws that pose; every choice is made
above it.

## State that matters

| What | Where | Timescale |
| --- | --- | --- |
| Emotion — valence, arousal, dominance | three `Spring`s on `mote` | seconds |
| Mood — a residue left by events | `mote.mood` | ~75 s decay |
| Temperament — who this creature is | `mote.temper`, from the name | fixed |
| Worn face and crossfade | `worn` in `faces/expressions.js` | 280 ms |
| Episode in flight | `mote.hold`, `pending`, `epoch` | 1–4 s |

Emotion returns to *temperament + mood*, not to a constant. That is the whole
mechanism by which the creature seems to remember the last minute.

## Two clocks, and the rule about them

`clock` advances only while frames are drawn. Anything the creature does is
scheduled on it with `later()`. Wall-clock `setTimeout` is for DOM and UI only.

Mixing them desynchronises an episode whenever the tab is hidden — the reason is
in [ADR 0004](docs/decisions/0004-scripted-episodes.md).

## The expression chooser

`expressionFor(t, v, a, d, forced)` picks one of seventeen faces and draws it
exactly, crossfading 280 ms on change. It is **stateful and time-ordered**: it
enforces a minimum dwell, so callers must pass a monotonically increasing `t`.

While an episode is running, the face is the one the script *named* (`forced`),
not the nearest to the mood — otherwise the creature wears every expression its
mood trajectory happens to pass over.
See [ADR 0003](docs/decisions/0003-discrete-expressions-with-crossfade.md).

## Shapes

A body is a radial profile: 64 radii, one per angle. All bodies share the same
angles, so any two correspond point for point and could be morphed by lerping
radii. Paths are built once per body and cached — the profile is ~9 KB of path
data and only changes when you pick a different body.

## Build

`src/manifest.json` lists the modules in evaluation order; `build.mjs`
concatenates them into a single inline `<script>` between `src/shell.html` and
`src/shell-tail.html`. One shared scope, no imports, no bundler.
See [ADR 0002](docs/decisions/0002-single-file-build.md).

## Tests

`node --test "test/*.test.mjs"`. `test/harness.mjs` loads the same source files
the same way the browser does — concatenated into one `node:vm` context — so the
tested linkage is the shipped linkage.

The suite is mostly a fidelity harness: it re-derives Bloub's shape generators
independently and compares all 64 radii of all 8 shapes, and checks all 16
expression poses field by field. Duplicating those reference values is
deliberate; a test that imported the constants it checks would pass on anything.

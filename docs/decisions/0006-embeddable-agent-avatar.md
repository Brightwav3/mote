# ADR 0006: Mote is embedded through one handle whose API is agent vocabulary, not creature vocabulary

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

The brief became "make this an implementable AI agent avatar" — something a
person can drop into their own agent UI, not a page to look at.

Nothing about the creature was reusable in that form. `say()` wrote into
`document.getElementById("speech")`. The frame loop lived in the demo's
`app/loop.js` and read `makeView.classList` to decide whether to draw. The mood
line wrote to an element the creature had looked up itself. Every one of those
is the demo leaking into the animal.

The second problem is worse and less obvious. Even with the DOM removed, the
natural API is the creature's own: seventeen faces, fourteen animations, a
valence/arousal/dominance triple. That is a real API and it is the wrong one.
An integrator has an agent, not a mood. Handing them `react("shy", 3.2)` and a
list of French expression names asks them to design the avatar — which is
precisely the work they came here to avoid — and guarantees that ten
integrations pick ten different faces for "waiting on a tool call".

## Decision

`Mote.mount(element, opts)` returns a **handle**, and the handle's primary
surface is **the states of an agent's turn**:

`idle`, `listening`, `thinking`, `tool(name)`, `speaking(text, ms)`, `done`,
`shipped`, `needsInput(question)`, `notify`, `error(message)`, `interrupted`,
`asleep`.

The mapping from each of those to choreography is **hardwired, in one table**,
in `src/embed/agent.js`. Each entry is a scripted episode in the sense of
ADR 0004 — a written face order, optionally naming an animation from the
catalogue — and the table is the specification. The creature's own vocabulary
stays available (`animate(id)`, `look`, `say`, `poke`) for anyone who wants it,
but nobody needs it to ship.

The creature is DOM-free. Speech and expression leave through callbacks
(`onSay`, `onFace`); the renderer is the only part that touches an element, and
only the one it was handed.

`build.mjs` emits **two targets from one manifest**: `dist/index.html`, the
demo, and `dist/mote-avatar.js`, the creature alone as an ES module wrapped in
an IIFE. The split is `app/` — everything else is the library.

**The demo goes through the public API.** Its act deck calls `avatar.thinking()`
and `avatar.error(...)`; its maker calls `avatar.setSkin` and `avatar.skin()`;
its pointer handling calls `avatar.pointer`. This is a constraint on the demo,
not a convenience: a demo allowed to reach inside always ends up proving an API
that does not work, because the page looks right and the first real integrator
finds the hole.

`after(seconds, fn)` is exposed because the alternative is worse. An integrator
chaining two calls will otherwise reach for `setTimeout`, which fires against a
frozen creature when the tab is hidden and takes the sequence apart — the bug
ADR 0004 exists because of.

**One instance per page.** The creature's state — mood, attention, the
animation player, the worn expression — is module-level. Mounting twice
replaces the first, and `destroy()` **resets** that state: without it a remount
inherits the previous avatar's mood and whatever it was mid-way through, which
looks like a bug the first time an app remounts on a route change.

**Nothing touches the DOM until asked.** `prefers-reduced-motion` used to be
read at module load, which meant importing the library threw in Node — Next.js,
Remix, Astro — before a line of the integrator's code ran. It is read lazily
now, and `makeStage` builds its SVG node by node instead of from a markup
string, which is also what makes the render layer testable against ~40 lines of
stub DOM rather than a browser.

**`dist/` is committed and the package is installable from git.** Types are
hand-written (`src/embed/types.d.ts`, copied to `dist/` by the build) because
the sources are concatenated plain scripts with no imports, so nothing can
generate them.

## Rejected alternatives

**Expose the faces and animations and let integrators compose.** The API the
creature already has. It moves the design work to the person least equipped to
do it and makes every integration look different. The catalogue is still there
under `animate()`; it is just not the thing you are asked to learn first.

**A `state` string setter — `avatar.state = "thinking"`.** Tempting, and it
loses the arguments: `tool("search")`, `error(message)` and
`needsInput(question)` all carry text the creature says. It also invites a
state machine on the integrator's side to avoid re-triggering, which is work
the episode player already does.

**A web component, `<mote-avatar state="thinking">`.** A nicer front door and a
worse fit: attributes are strings, so every call with text becomes attribute
plumbing, and the imperative handle would have to exist underneath anyway. Worth
adding later ON TOP of this; not instead of it.

**Make it multi-instance now.** Threading an instance through mood, attention,
gaze, the expression chooser and the animation player is a real refactor of
every file, in exchange for a case neither the demo nor an agent UI has: an
assistant has one face. Left undone deliberately, and documented, rather than
half-done behind a flag.

**Ship the demo and tell people to fork it.** What the project was. It makes
every integrator inherit the maker page, the act deck and the beige.

## Consequences

### Positive

- An integration is `mount`, then one call per agent state.
- The demo exercises the whole API, so the API cannot rot silently.
- The library build has no demo in it and leaks no names — everything is inside
  one IIFE, asserted in `test/agent.test.mjs`.
- Face and animation ids in the act table are checked against the real
  catalogues. A misspelt id does not throw — `react` looks it up, gets
  undefined, and the creature simply does nothing when the agent reports an
  error — so nothing but a test would catch it.

### Costs

- One avatar per page, and `mount` silently destroys a previous one rather than
  refusing.
- Two build targets to keep working, and only one of them is what the artifact
  publishes.
- The act table is opinionated: an integrator who dislikes `error` being
  startled-then-sheepish has to edit the table rather than pass an option.
- `speaking()` is exempt from the no-op-on-repeat rule, so a token-by-token
  caller can still thrash it. The stream adapter batches to sentences
  (ADR 0007); a caller not using the adapter must do the same.
- Hand-written types can drift from the handle. `test/agent.test.mjs` pins the
  agent states; nothing checks the rest of `types.d.ts`.

## Enforced in

- `src/embed/agent.js`
- `src/app/loop.js`
- `src/app/acts.js`
- `src/creature/mote.js`
- `build.mjs`
- `test/agent.test.mjs`
- `README.md`
- `package.json`
- `src/lib/math.js`
- `src/render/stage.js`
- `test/mount.test.mjs`

## Explicit non-decisions

This does not decide the content of the act table. Which faces mean "tool call"
is the owner's call, and changing one is editing a list.

It does not authorise the creature reaching for the DOM again for any reason.
If something needs to reach the page, it leaves through a callback.

It says nothing about publishing to a registry, a package name, or versioning.
The build emits a file; how it is distributed is unaddressed.

It does not extend to a web component or a React wrapper. Both would sit on top
of this handle, and neither is decided here.

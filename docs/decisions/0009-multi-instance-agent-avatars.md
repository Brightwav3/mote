# ADR 0009: each Mote mount owns an independent agent life

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

MARK's agent sidebar represents several persistent roles at once. The former
Mote embed kept mood, attention, scripted episodes, animation state and the
animation clock in module-level variables; mounting a second handle therefore
replaced the first creature. Static snapshots cannot provide the living identity
the sidebar needs.

## Decision

The library is BUILT as a factory. `build.mjs` wraps the concatenated sources in
`createMoteRuntime()` instead of an IIFE, and the public `Mote.mount(host, opts)`
calls that factory once per handle. Every live creature therefore gets a private
evaluation of the module scope — its own `mote`, `clock`, `pending`, `epoch` and
`anim` — reached by the same plain names every ported helper already reads. Not
one creature helper learns what an instance is.

Within one copy the creature is still singular, so `destroy()` still resets it:
a remount into the same copy must not inherit the previous mood. `destroy()`
stops and clears only its own loop and host, and can no longer reach another
creature, because another creature is another copy.

The pure lookups — `faces`, `states`, `bodies`, `palette`, `describe` — are
served from one shared copy; they read ported constants and have no state to
isolate. `createMoteRuntime` is also exported for a host that wants to own the
lifetime itself, but no integrator needs it: `Mote.mount` is already
multi-instance.

SVG `id`s are the one thing that cannot be per-copy. They resolve per DOCUMENT,
so the counter behind them moved onto the page (`render/stage.js`), with a local
fallback for a host with no global object. Two creatures whose masks are both
called `s1-notch` silently wear each other's geometry.

`snapshot()` remains available for intentionally decorative copies, but it is no
longer the only way to show several Motes on one page. For dense compact
surfaces, `ambient: false` disables autonomous gaze and mood wander while
preserving the instance clock and runtime-driven agent states.

## Rejected alternatives

### Keep one live Mote and use snapshots for every agent

Rejected because snapshots have no independent mood, attention, tool wait or
animation life. A sidebar row would look alive while being only a copied frame.

### Duplicate the entire creature source for every agent

Rejected, and the factory is not this. Duplication was rejected because it would
multiply the SHIPPED ARTIFACT, drift the ported constants and make every future
behavior fix instance-count dependent. A factory closure multiplies neither: one
artifact, one copy of every constant in the file, one definition of every
helper. What it multiplies is runtime scopes, which is exactly and only the
thing that has to be per-creature.

### Switch module-level state in and out around every public call

Implemented first, on the `context-switch-multi-instance` branch, and replaced.
It works, and the tests on that branch pass. It was rejected because isolation
became an obligation on every future line: each public method, each
requestAnimationFrame callback and each new entry point has to be wrapped, and
the failure mode of forgetting one is two creatures quietly sharing a mood
rather than a crash. The factory has no seam to forget.

Its one genuine advantage — a module-level SVG id counter that stays unique
across the page — is kept here explicitly, see the Decision above.

### Rewrite every helper to accept an instance argument in one pass

Rejected because it would create a broad, high-risk rewrite of the plain
concatenated source for no behavioral gain the factory does not already
provide.

## Consequences

### Positive

- Agent rows can own live Mote handles instead of static identity copies.
- Mood, attention, tool waiting, animation queues and clocks cannot leak between
  agents.
- Existing public state methods and the single-file build remain compatible.
- Teardown is local, so removing a selected or background agent cannot destroy
  another agent's creature.

### Costs

- Each live handle owns an animation loop and a full creature state, so integrators
  should use snapshots for intentionally static compact previews.
- Each live handle also owns a private evaluation of the library scope: every
  closure and every ported constant table exists once per creature. That is
  memory, not bytes shipped, and it scales with the number of visible avatars —
  a roster, not a feed.
- Integrators must destroy every handle they mount.

## Enforced in

- `build.mjs`
- `src/creature/mote.js`
- `src/anim/player.js`
- `src/render/stage.js`
- `src/embed/agent.js`
- `src/embed/types.d.ts`
- `test/mount.test.mjs`
- `test/agent.test.mjs`
- `README.md`

## Explicit non-decisions

This does not define a cross-agent orchestration protocol or a registry of
agent roles; those remain responsibilities of the embedding application.

This does not make snapshot copies interactive or give them an animation loop.

This does not change the ported geometry, faces, bodies, palette or animation
constants.

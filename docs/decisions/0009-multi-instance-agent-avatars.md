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

`Mote.mount(host, options)` creates an independent runtime context for every
handle. The context owns the mutable creature state, animation state, delayed
episode queue, epoch and animation clock. Public methods and requestAnimationFrame
callbacks enter that context before calling the existing plain-script creature
helpers, then persist the context and restore the surrounding instance.

Multiple handles may run concurrently. `destroy()` stops and clears only its own
loop and host. `snapshot()` remains available for intentionally decorative
copies, but it is no longer the only way to show several Motes on one page.
For dense compact surfaces, `ambient: false` disables autonomous gaze and mood
wander while preserving the instance clock and runtime-driven agent states.

## Rejected alternatives

### Keep one live Mote and use snapshots for every agent

Rejected because snapshots have no independent mood, attention, tool wait or
animation life. A sidebar row would look alive while being only a copied frame.

### Duplicate the entire creature source for every agent

Rejected because it would multiply the shipped artifact, drift the ported
constants and make every future behavior fix instance-count dependent.

### Rewrite every helper to accept an instance argument in one pass

Rejected for this release because it would create a broad, high-risk rewrite of
the plain concatenated source. Context switching keeps the established helper
vocabulary while giving handles isolated mutable state; a typed source rewrite
can be evaluated separately.

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
- The implementation has a small context-switching seam around legacy helpers.
- Integrators must destroy every handle they mount.

## Enforced in

- `src/creature/mote.js`
- `src/anim/player.js`
- `src/embed/agent.js`
- `src/embed/types.d.ts`
- `test/mount.test.mjs`
- `README.md`

## Explicit non-decisions

This does not define a cross-agent orchestration protocol or a registry of
agent roles; those remain responsibilities of the embedding application.

This does not make snapshot copies interactive or give them an animation loop.

This does not change the ported geometry, faces, bodies, palette or animation
constants.

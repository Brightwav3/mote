# ADR 0008: Compact presence surfaces use rendered snapshots, not additional live Mote instances

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

Mote intentionally owns one live creature per page. Its mood, animation player,
attention and animation clock are module-level state, and `mount()` replaces a
previous mount. A host agent UI still needs to show Mote identity in compact
places such as conversation rows and a header. Mounting one creature per row
would either require a large state refactor or create several competing loops.

The compact surfaces do not need independent behaviour. They need the last
frame that the one live creature rendered, with the same SVG silhouette, face,
paint and decorative geometry.

## Decision

`Mote.mount()` handles expose `snapshot(host, skin)`. It clears the decorative
host, clones the last rendered SVG frame, marks it `aria-hidden`, and rewrites
SVG definition ids so masks and paint references remain local to the copy. The
optional skin can select a body, paint and name for a distinct compact persona;
the body and eye geometry still come from Mote's renderer. The snapshot does
not start a loop, alter Mote state, or replace the mounted handle.

The mounted handle remains the only live Mote. Hosts that need current compact
presence call `snapshot()` when the host UI renders a semantic state change.
The snapshot API is therefore a rendered-output boundary, not a second creature
runtime and not a CSS imitation of one.

## Rejected alternatives

### Mount one live Mote per compact surface

Rejected because the current one-avatar-per-page contract makes mounting another
instance destructive, and changing that contract would require threading all
creature state through the renderer and animation player.

### Recreate the face with CSS or copied markup in the host UI

Rejected because it drifts from the actual renderer and makes identity a second
implementation. A snapshot must remain the output of Mote's own SVG renderer.

### Add a second requestAnimationFrame loop for every snapshot

Rejected because compact presence is a representation of the one assistant, not
an independent actor. Extra loops waste work and can show contradictory states.

## Consequences

### Positive

- A host can show the actual Mote renderer in any number of compact surfaces.
- The one-live-avatar lifecycle and no-op-on-repeat state semantics remain intact.
- SVG ids are isolated, so multiple snapshots can coexist safely in one document.
- Snapshot consumers do not need Mote internals or a second animation scheduler.

### Costs

- Compact copies are frozen until the host calls `snapshot()` again.
- A snapshot is tied to the current document and SVG DOM implementation.
- The host must treat the copies as decorative and must not try to drive them.

## Enforced in

- `src/embed/agent.js`
- `src/embed/types.d.ts`
- `test/mount.test.mjs`
- `README.md`

## Explicit non-decisions

This does not make Mote multi-instance or change the meaning of `mount()`.

This does not expose internal pose, mood, or renderer objects to integrators.

This does not prescribe how often a host refreshes a compact snapshot; that is a
host rendering decision, subject to the host's own performance and accessibility
needs.

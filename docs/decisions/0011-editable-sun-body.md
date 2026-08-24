# ADR 0011: The editable Sun is a body profile, not a decoration

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

Mote's bodies are 64 radii sampled at shared angles. That correspondence makes
body morphing simple and lets the existing draw-time eye solver contain every
expression without body-specific face art.

Blobatar 2 includes a Sun made from a round core plus repeated circular petals.
Its petal size, count, distance and rotation are meaningful controls. Adding
the petals as separate SVG decoration would preserve their source structure,
but Mote's morphing and containment would then see only the core circle.

## Decision

Adapt the Sun into one Mote radial profile made from repeated raised-cosine
lobes. Each lobe has zero slope where it leaves the core and at its tip, so the
body reads as one circle growing petals rather than a circle with smaller balls
attached. The result is normalized like the existing bodies.

Expose the four controls as `skin.sun`: `size`, `count`, `distance` and
`rotation`. They are clamped to useful visual ranges, and size widens a lobe as
well as deepening it. A Sun setting change creates a new immutable
body object and replaces the current Sun profile directly. It does not enter
the generic body morph: interpolating ray profiles with different petal counts
or angles visibly collapses the petals through the core. Switching between Sun
and another body still uses the ordinary morph. Both the path cache and each
stage's last-rendered-body check key body objects rather than the public `sun`
id so edited profiles cannot reuse stale paths.

## Rejected alternatives

**Draw petals as separate SVG circles or union those circles into the radial
profile.** This stays closest to Blobatar's renderer, but the visible circular
joints read as balls attached to the body rather than growth from it.

**Add one fixed Sun.** Smaller and compatible with the old skin shape, but it
discards the four controls specifically requested for this body.

**Seed Sun geometry from the name.** Blobatar uses seeded traits, but Mote's
body is an explicit maker choice and its name already owns temperament. Hidden
shape changes would make the picker misleading.

## Consequences

- Sun uses all existing Mote eyes, expressions, gaze and animations.
- Skins and personas gain an optional `sun` object, retained while another body
  is selected so changing away and back does not erase authored petals.
- `profilePath` and the renderer's settled-body check now cache by body object
  rather than body id.
- The maker shows four range controls only while Sun is selected.
- Petal edits redraw directly instead of producing a misleading body-change
  transition through a near-circle.
- Blobatar's MIT copyright and license are carried in `NOTICE` and
  `LICENSE-BLOBATAR`.

## Enforced in

- `src/bodies/shapes.js`
- `src/creature/mote.js`
- `src/embed/agent.js`
- `src/embed/types.d.ts`
- `src/app/maker.js`
- `src/render/stage.js`
- `test/shapes.test.mjs`
- `README.md`
- `NOTICE`

## Explicit non-decisions

- **Editable geometry for other bodies.** Their pinned Bloub profiles remain
  unchanged.
- **Blobatar eyes, expressions or animation.** None are imported.
- **Per-petal editing.** The controls apply uniformly to the radial set.
- **A general body-plugin format.** Sun is one built-in body, not an extension
  mechanism.

# ADR 0010: Eyes are contained by the body at draw time, not reauthored per body

- **Status:** Accepted
- **Date:** 2026-08-20
- **Decision owners:** Project owner

## Context

An expression's eye geometry is measured against a unit sphere. `eyeFrames`
places the pair on a ball of radius `R` regardless of the silhouette, and each
eye's width and height are fractions of that same `R`. That is Bloub's
arrangement, and in Bloub the body is always a circle, so it is correct there.

Mote has eight silhouettes. Measured across all eight and all seventeen faces,
the fraction of the silhouette's own radius that the outermost eye corner
reaches is:

| body | reach | | body | reach |
| --- | --- | --- | --- | --- |
| circle | 0.65 | | triangle | 0.81 |
| pebble | 0.72 | | hexagon | 0.70 |
| squircle | 0.59 | | cloud | 0.75 |
| capsule | 0.71 | | **droplet** | **1.10** |

The droplet's waist is 0.68 of its peak radius, and `scared` is the widest pair
of the seventeen. The eyes hang out through the side of the head. Seven bodies
are fine; one is broken.

The tempting fix is to re-express the poses in units relative to each body's own
measured width and height, so that every expression is authored once and adapts
everywhere. That is a real technique and it is what a procedural avatar studio
would do. It is also, here, a rewrite of ADR 0001's ported table under the cover
of a bug fix: it changes what is drawn on all eight bodies, including the seven
that were never wrong, and no test could then say which differences were the fix
and which were drift.

## Decision

The pose table does not move. Containment is applied at draw time as **one
scalar per frame**, solved rather than chosen, which shrinks the eye pair
uniformly toward the centre until its outermost corner sits within
`EYE_LIMIT` (0.9) of the silhouette's radius in that direction.

Three properties make this safe to put in front of a ported table:

- **It is solved, not authored.** Position and size take the same scalar, so
  overflow falls off linearly with it and `EYE_LIMIT / worst` lands exactly on
  the limit in one step. There is no number to taste.
- **It can only shrink.** The scalar is capped at 1, so a wider body never gets
  eyes spread to fill it. That would be restyling.
- **It is inert where nothing is wrong.** A circle's worst face reaches 0.65
  against a limit of 0.9, so the scalar is exactly 1 and the rendering is
  unchanged bit for bit. Any limit above 0.81 leaves all seven well-behaved
  bodies alone; 0.9 was taken from that range to leave the droplet a visible
  margin rather than have its eyes graze the outline.

The radii are read raw, before the silhouette's own rotation, squash and offset,
so a catalogue state that drags or flattens the body does not drag the eyes'
size with it. A floor of 0.55 stops the arithmetic running away when the
catalogue collapses the body to a dot; the eyes carry `eyeAlpha: 0` through
every one of those frames, so the floor costs no fidelity.

## Rejected alternatives

**Relative eye values per body — rescale the poses by each body's measured half
width and half height.** Adapts every expression to every silhouette, which is
the more general fix. Rejected because it changes all eight bodies to repair
one, it makes the ported table a starting point rather than the specification,
and an anisotropic scale stretches an eye's aspect ratio, which is the same
error ADR 0003 rejected in a different costume.

**Author a droplet-specific expression table.** Honest and local, but it is
seventeen more poses to keep in step with Bloub by hand, and it multiplies by
every body added later.

**Shrink the droplet's eyes by a constant, chosen by eye.** Fixes the symptom
in three lines and is exactly the taste adjustment ADR 0001 forbids. Nothing
would then catch a future body with the same defect.

**Widen the droplet's waist.** Changes a shape pinned radius by radius in
`test/shapes.test.mjs`. The shape is not what is wrong.

## Consequences

- The droplet's eyes are up to 18% smaller than the ported pose asks for. It is
  the only body that renders differently, and it is the only one that was wrong.
- Any silhouette added later is contained automatically, including one nobody
  thought to check.
- `drawStage` now solves something rather than being a pure read of the pose.
  The solve is geometric and stateless — the same pose and the same radii always
  give the same scalar — so the property that mattered, that rendering decides
  no *behaviour*, still holds.
- Eight ray casts per frame against a 64-sample profile. Immaterial next to
  rebuilding the silhouette path, which the same frame already does.
- A future body whose waist is narrower than 0.55 of its peak would hit the
  floor and still overflow. `test/fitting.test.mjs` fails if that ever happens.

## Enforced in

- `src/faces/fitting.js`
- `src/render/stage.js`
- `test/fitting.test.mjs`

## Explicit non-decisions

- **Whether expressions should ever become body-relative.** This ADR rejects it
  as a fix for the overflow, not as an idea. If Mote later wants faces that
  genuinely reshape per body, that is a change to what an expression *is* and
  needs its own decision alongside ADR 0001 and ADR 0003.
- **The gaze bias in `gazeOf`.** Untouched here; where the creature looks is a
  separate question from whether its eyes fit.
- **`EYE_LIMIT` as an aesthetic.** It is a containment bound, not a design
  parameter. Nothing should tune it to make a body look better.

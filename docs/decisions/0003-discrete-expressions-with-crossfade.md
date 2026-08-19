# ADR 0003: The face is a discrete choice with a timed crossfade, not a continuous blend

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

Mote's mood is a point in a continuous valence/arousal/dominance space, and each
of the seventeen faces is a coordinate in that space. The obvious rendering is to
weight every face by distance and draw the weighted average: smooth by
construction, never exactly repeating, no state required.

Measured over thirty simulated minutes, **41.5% of the creature's time had no
expression above 80% weight**. What was drawn in that time were frames like
`curious:46 | happy:44` — not an emotion between the two, but a shape nobody
designed. Averaging the hard 30-degree eye squint of `angry` against the soft
-8-degree one of `curious` does not interpolate the feeling, it cancels the
geometry. The expressions were measured as whole poses and only read as
themselves whole.

Sharpening the weighting helped and did not fix it, because the problem is not
the falloff curve. It is that the mood spends much of its life between
coordinates, and there is no shape defined for "between".

## Decision

The mood space chooses **which** face; the renderer draws **that** face exactly —
the source pose, unmodified — with a 280 ms crossfade on change.

Three guards keep it from strobing:

- a rival face must be meaningfully closer than the incumbent, not marginally
  (`SWITCH_MARGIN`);
- a minimum dwell must elapse before any change (`DWELL_MIN`);
- while a scripted reaction is running, the face is the one that reaction
  **named**, not the nearest to the travelling mood (ADR 0004).

A settled face is bit-identical to the source pose. The crossfade drops the
outgoing pose *before* interpolating on its final frame, because `lerp(a, b, 1)`
evaluates as `a + (b - a) * 1` and does not return `b` exactly.

## Rejected alternatives

**Continuous distance-weighted blend of every face.** What this replaces; the
measurement above is the reason.

**Blend, but sharpen the kernel.** Tried across a swept parameter grid.
Sharpening trades mush for switchiness without ever committing, and the
in-between shapes stay undesigned — it moves the problem rather than removing it.

**Compact-support kernel with a cutoff radius.** Tried. It left roughly an eighth
of the mood space outside every face's support, and the boundary between "inside
some radius" and "outside all of them" was a jump of 0.25 in eye height:
technically continuous, visually a snap. Strictly worse than no cutoff.

**Snap with no crossfade.** Correct poses, and the creature twitches between them
like a slideshow. The fade is what makes a change read as a change of mind.

## Consequences

### Positive

- Every drawn face is a real designed pose. Verified: 85% of frames settled, and
  exact when settled.
- Fidelity to ADR 0001 becomes observable at runtime, not just in the table.

### Costs

- The "never exactly repeats" quality of the continuous blend is gone. The face
  is one of seventeen, and variety must now come from behaviour — which faces, in
  what order, for how long — rather than from geometry.
- `expressionFor` is stateful and time-ordered. Callers must pass a monotonically
  increasing clock; a test that resets time between cases will see the dwell
  guard suppress changes and report a false failure.

## Enforced in

- `src/faces/expressions.js`
- `test/expressions.test.mjs`

## Explicit non-decisions

This does not make the mood space discrete. Valence, arousal and dominance stay
continuous and still decide which face and how the creature travels there.

It does not fix the crossfade duration, the dwell or the margin as values — those
are tuning. It fixes that a settled face is drawn exactly.

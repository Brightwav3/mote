# ADR 0016: Deliberate attention snapshots a target instead of tracking it

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

The host continuously reports pointer position so Mote can occasionally look at
the viewer. Re-reading that position on every frame after attention begins makes
the eyes follow the cursor. Even if tracking starts rarely, the resulting gaze
feels like a targeting reticle rather than a creature choosing to glance at a
place.

## Decision

When Mote deliberately looks at the viewer, it snapshots the current pointer
position once and holds that fixation for the requested duration. Later pointer
movement updates the candidate target for a future glance but does not drag the
current gaze.

## Rejected alternatives

**Track the live pointer for the whole glance.** The eyes glue to input movement
and the creature stops appearing to own its attention.

**Ignore pointer position entirely.** A glance toward the viewer would be generic
and could not acknowledge where interaction occurred.

**Continuously low-pass-filter the pointer.** Smoothing reduces jitter but remains
tracking; the gaze still follows a target it never chose again.

## Consequences

### Positive

- A glance reads as a deliberate fixation.
- Pointer motion cannot hijack an attention episode already in progress.
- The host API remains a simple stream of normalized positions.

### Costs

- Mote can look at a position the pointer has just left.
- A host that wants explicit tracking needs a distinct future mode.

## Enforced in

- `src/creature/mote.js`
- `src/embed/agent.js`

## Explicit non-decisions

This ADR does not define autonomous gaze wandering or its spatial distribution.

It does not prohibit an explicitly named tracking mode in the future.

It does not require mouse input; touch, gaze, or another host signal may supply
the normalized target.

# ADR 0015: Large-field animation is omitted when reduced motion is requested

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

Some catalogue states move across most of the avatar field, rapidly spin, burst,
or surround the creature with orbiting decor. Merely slowing those states extends
exposure to the same large movement and can make an agent appear unresponsive.
Removing all animation, however, would also suppress small blinks and face changes
that communicate state without large motion.

## Decision

Animation definitions explicitly mark large-field motion with `big:true`.
`playAnim` does not start those states when `prefers-reduced-motion` is active.
Small local motion and expression changes remain available.

The state is omitted rather than slowed, simplified ad hoc, or partially played.

## Rejected alternatives

**Slow every animation.** Duration is not amplitude; a slow orbit still crosses
the same visual field and keeps the user exposed for longer.

**Disable the entire animation system.** Blinks, gaze changes, and small local
actions are useful status signals and do not carry the same motion cost.

**Maintain a second reduced choreography per state.** It doubles an already
measured catalogue and invites semantic drift between two versions of each act.

## Consequences

### Positive

- Host accessibility preference is respected at the motion boundary.
- Small, useful state communication remains intact.
- Animation authors have one explicit classification to review.

### Costs

- A skipped large state may have no visual equivalent beyond the current face.
- New large-field animations must be correctly marked.

## Enforced in

- `src/anim/player.js`
- `src/anim/states.js`

## Explicit non-decisions

This ADR does not classify colour changes, blinking, or speech as large motion.

It does not prescribe a host-level reduced-motion UI or override the browser
media query.

It does not prevent a future deliberately designed low-motion alternative from
being added as a separate state.

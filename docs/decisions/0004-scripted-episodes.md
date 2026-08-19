# ADR 0004: Deliberate reactions are scripted episodes played on the animation clock

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

Pressing a button was meant to produce a written sequence of faces. It did not.
Reported and reproduced: "say hello" produced `surpris → attentif` when the
script said `heureux`; "ask it something" produced
`confus → curieux → méfiant → curieux` from a two-step script; "scold it" ended
on `timide`.

Three independent causes, all structural:

1. Second beats were queued with `setTimeout` and nothing cancelled them. A beat
   queued by an idle thought landed in the middle of a deliberate reaction and
   replaced it.
2. Between two beats no hold was in force, so the face fell back to "nearest
   expression to the currently travelling mood" — an arbitrary point mid-flight.
   That is where the stray `méfiant` came from.
3. Hold durations were scaled by the creature's temperament, so the beats drifted
   out of step with the timings they were written against.

`setTimeout` was independently wrong. The animation clock advances only while
frames are drawn, so with the tab hidden a wall-clock timer fires against a
frozen creature and the episode comes apart. It also made the behaviour
untestable: driving frames in a loop never runs the event loop, so scheduled
beats never happened, and six expressions appeared unreachable when they were
merely unobservable.

## Decision

A reaction is a **script** — an ordered list of `{ face, hold, ... }` steps played
by `play()`.

- Starting an episode increments an epoch, discarding every beat queued by a
  previous one. A deliberate act always wins over an idle thought.
- Each step's hold covers exactly until the next step begins, so there is no gap
  to fall through.
- Scripted holds are exact, not temperament-scaled.
- Delayed beats are scheduled on the animation clock via `later()` and drained by
  `runPending()` each frame, so an episode pauses and resumes as a unit and a
  test can drive it by advancing frames.
- Only a step marked `trace: true` leaves a mood residue: one event, one trace.
  The creature's own idle scripts leave none.

## Rejected alternatives

**Derive the sequence from the mood model.** The original design — an event
pushes the mood, and whatever faces result, result. It produced sequences nobody
wrote and could only be corrected by tuning constants until the output looked
right, which is not a specification.

**Keep `setTimeout` and add cancellation.** Fixes cause 1 only, leaving the
hidden-tab desync and the untestability — both worse than the bug it would fix.

**One long hold per reaction, no steps.** Cannot express `excité → attentif`,
which is the entire requirement.

## Consequences

### Positive

- The written sequence is the specification. All seven scripted acts were
  verified replaying exactly.
- Episodes are deterministic under a driven clock, so behaviour is testable.
- Tab visibility no longer desynchronises a reaction.

### Costs

- Two scheduling mechanisms now exist: `later()` for anything the creature does,
  `setTimeout` for DOM and UI concerns. Using the wrong one reintroduces the
  desync, and nothing enforces the split.
- The epoch counter means a stale closure firing after an episode change is
  silently dropped rather than raising — correct, but it hides mistakes.

## Enforced in

- `src/creature/mote.js`
- `src/app/acts.js`

## Explicit non-decisions

This does not decide the content of any script. The face sequences belong to the
owner, and changing one is editing a list.

It does not extend to how autonomous idle behaviour *chooses* what to do — that
stays weighted-random. It governs only how a chosen sequence plays.

It does not authorise moving UI timers onto the animation clock. `later()` is for
creature behaviour.

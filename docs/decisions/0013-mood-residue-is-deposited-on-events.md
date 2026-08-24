# ADR 0013: Mood residue is deposited when an external feeling fires

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

Mote has fast emotion springs and a slower mood residue. The first implementation
integrated `emotion - home` on every frame. Because every spring returns to home,
the positive and negative portions nearly cancelled: four praise events moved the
mood by only 0.01 and the creature had no perceptible memory.

We need a residue that reflects what happened, while keeping emotion free to
settle and without making animation frame rate part of personality.

## Decision

An externally caused episode deposits mood residue once, when its opening feeling
fires. The deposit is proportional to the distance between the reaction target
and the creature's baseline, scaled by temperament and novelty. Later beats of
the same episode and autonomous thoughts do not deposit another trace.

Mood then decays continuously toward zero on its own timescale. It is not the
integral of the visible spring trajectory.

## Rejected alternatives

**Integrate emotion displacement every frame.** The spring's return journey
cancels its outward journey, so meaningful events leave almost no memory. The
result also depends on frame scheduling.

**Deposit on every beat.** Follow-up faces can oppose the opening feeling. A
`happy → shy` praise episode would partially cancel its own positive trace and
count one event twice.

**Let autonomous thoughts alter mood.** A creature left alone would drift to a
random emotional extreme merely because its idle scripts happened to run.

## Consequences

### Positive

- Repeated external events produce a perceptible short-term emotional history.
- One user event leaves one trace, independent of script length and frame rate.
- Autonomous life stays expressive without rewriting the creature's baseline.

### Costs

- Every externally meaningful entry point must mark exactly one beat `trace:true`.
- Tuning deposit gain and decay changes personality and requires behavioural tests.

## Enforced in

- `src/creature/temperament.js`
- `src/creature/mote.js`

## Explicit non-decisions

This ADR does not fix the numerical gain, per-axis clamps, or 75-second decay as
permanent values. Those remain tuning parameters.

It does not define which host events deserve an emotional reaction. The agent
adapter owns that mapping.

It does not make mood persistent across page reloads or persona serialization.

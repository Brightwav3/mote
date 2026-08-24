# ADR 0014: Autonomous thoughts cover the face repertoire without leaving mood residue

- **Status:** Accepted
- **Date:** 2026-08-24
- **Decision owners:** Project owner

## Context

An early idle table named only six faces. A half-hour observation showed that
eight of seventeen expressions never appeared, leaving the creature to cycle
mostly through attentive, curious, and neutral. Uniform random selection fixed
coverage but made vivid reactions commonplace and the creature feel shuffled.

Idle behaviour also shares the episode engine with external reactions, so it
could accidentally leave the same long-lived mood traces as user events.

## Decision

Every face is reachable through Mote's autonomous scripts. Common quiet states
have higher weights; vivid states are rare and may arrive through short causal
chains rather than as isolated cuts. Autonomous scripts always use `trace:false`.

The table remains weighted-random, but its coverage and trace isolation are
behavioural invariants rather than incidental list contents.

## Rejected alternatives

**Uniformly sample all faces.** It guarantees coverage but makes fear, anger,
pride, and laughter as common as ordinary attention.

**Keep a small calm subset.** It produces a predictable screensaver and makes a
large part of the authored expression vocabulary unreachable without a host.

**Let idle episodes leave mood traces.** An untouched Mote would gradually acquire
a random mood from events that never happened to it.

## Consequences

### Positive

- The full expression investment is observable in ordinary use.
- Rare expressions remain worth noticing.
- Being left alone does not rewrite emotional memory.

### Costs

- Adding a face requires checking autonomous reachability or explicitly deciding
  that it is host-only.
- Weight changes require observation over time, not only snapshot tests.

## Enforced in

- `src/creature/mote.js`

## Explicit non-decisions

This ADR does not freeze the exact weights, delays, prose, or ordering of idle
scripts. Those are authored content.

It does not require every animation to play autonomously; face reachability and
animation scheduling are separate catalogues.

It does not authorize autonomous scripts to interrupt an active deliberate act.

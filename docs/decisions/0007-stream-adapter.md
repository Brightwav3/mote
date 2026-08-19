# ADR 0007: A model stream drives the avatar through an adapter, and the stream's shape dictates three properties of the API

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision owners:** Project owner

## Context

ADR 0006 gave the avatar an API in the vocabulary of an agent's turn. That
vocabulary was a **guess**: it was written by reading the creature and asking
what an agent might report, with no agent on the other end of it.

Wiring one real stream — the Anthropic Messages streaming events:
`message_start`, `content_block_start`, `content_block_delta`,
`content_block_stop`, `message_delta`, `message_stop`, `error` — was the step
that tested the guess, and the guess was wrong in three specific ways. All three
are properties of how a stream behaves, not of this particular provider:

1. **A stream calls the same state constantly.** `thinking` arrives on every
   thinking delta, hundreds of times a turn. Every call restarted the episode,
   so the creature replayed its first beat forever and never reached the second.
2. **Text arrives a few characters at a time.** One `speaking()` per delta is a
   face change per token.
3. **A tool call has no end in the event stream.** `content_block_start` says a
   tool call began; nothing says it finished, because the result comes back in
   the *next* request. The scripted `tool()` therefore looked up after a fixed
   2.4 s whether or not the tool had returned — which is precisely the tell that
   something is an animation rather than a status.

## Decision

`src/embed/stream.js` translates stream events into API calls, and the handle
exposes `event(e)` for one event and `runStream(stream)` for an async iterable.
Unknown event types are ignored rather than thrown on: a provider adding an
event type must not take the avatar down.

The three findings are fixed **in the layer each belongs to**, not in the
adapter:

- **Repeating a state while its episode is still playing is a no-op** — in the
  handle, so it protects every caller, not only streams. Arguments are part of
  the comparison, so `tool("read")` after `tool("search")` is a new call.
  `speaking` is exempt: its text differs each time and saying the next sentence
  is the point.
- **Speech is batched to sentence boundaries** — in the adapter, because that is
  where the token stream is. Segmentation is deliberately dumb: the goal is a
  natural pause, and a wrong split costs nothing.
- **`tool()` waits** — in the act table. It re-arms until `toolResult(ok)` is
  called, and `toolResult(false)` is a different, put-out reaction rather than
  the alarmed one `error()` gives.

The handle also gains `state()`, so a caller can read what it last set without
tracking it themselves.

Stop reasons map: `end_turn`/`stop_sequence` → `done`, `tool_use` → keep
waiting, `max_tokens` → `interrupted`, `refusal` → `needsInput` (it declined —
sheepish, not alarmed), `pause_turn` → `thinking`.

## Rejected alternatives

**Put the debounce in the adapter.** It is a property of the API, not of
streams: any caller in a render loop hits it. Fixing it in the adapter leaves
the trap set for everyone using the handle directly.

**Debounce by wall-clock time.** Simple and wrong here: everything the creature
does runs on the animation clock, so a hidden tab would keep dropping calls it
should have queued. The episode's own end time is already the right boundary.

**Let `tool()` take a promise and resolve on it.** Reads nicer
(`avatar.tool("search", p)`) and forces the integrator to have a promise, which
a stream-driven caller often does not — the result arrives as a separate request
later. `toolResult()` works either way.

**Segment sentences properly, or stream text word by word into a bubble.** The
avatar is not a transcript view. Its job is a face that matches what is
happening; the words belong to the host UI, which gets them through `onSay`.

**Map `refusal` to `error`.** A refusal is not a malfunction. Treating it as one
teaches the user to distrust the agent's failures.

## Consequences

### Positive

- An integration is `for await (const e of stream) avatar.event(e)`.
- The no-op-on-repeat rule makes the whole API safe to call from a render loop.
- `test/mount.test.mjs` drives a full two-request turn — thinking, a tool call,
  a waited result, streamed text, `end_turn` — and asserts speech came out as
  two sentences rather than four chunks.

### Costs

- The adapter is coupled to one event vocabulary. Another provider's shape needs
  a second adapter, though the mapping is about thirty lines.
- `state()` reports the last state *set*, which is not the same as the face
  being worn — the creature may be mid-crossfade or playing something of its
  own.
- A tool call that never gets a `toolResult` waits forever, replaying its script.
  Deliberate — a spinner that stops is worse than one that does not — but it
  means a dropped result is visible as a creature stuck on a tool.
- Sentence batching adds up to one sentence of lag between the token arriving
  and the avatar reacting.

## Enforced in

- `src/embed/stream.js`
- `src/embed/agent.js`
- `test/mount.test.mjs`
- `README.md`

## Explicit non-decisions

This does not decide the stop-reason mapping as policy — it is a table, and
editing it is editing a list.

It does not extend to non-Anthropic stream shapes. Adding one means adding an
adapter beside this one, not generalising this one until it fits both.

It says nothing about how the host UI renders the agent's text. `onSay` exists
for the creature's own short lines, not as a transcript.

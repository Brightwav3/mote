/* ── DRIVING IT FROM A REAL STREAM ────────────────────────────────────────
   The agent surface is a set of states; a model stream is a sequence of
   events. This translates one into the other, so an integration is
   `for await (const e of stream) avatar.event(e)` and nothing else.

   It is written against the Anthropic Messages streaming shape —
   `message_start`, `content_block_start`, `content_block_delta`,
   `content_block_stop`, `message_delta`, `message_stop`, `error` — because
   that is the stream this was built for. Anything with the same skeleton maps
   the same way; the whole translation is the table below and it is thirty
   lines.

   Writing this is what exposed three things the hand-driven demo never could,
   all of which are fixed in the layer below rather than here:

     · a stream calls the same state hundreds of times. `thinking` arrives on
       every thinking delta. So repeating a state while its episode is still
       running is now a no-op — otherwise the creature restarts its script on
       every token and never gets past the first beat.
     · text arrives a few characters at a time, and a face per token is a
       seizure. Speech is therefore batched to SENTENCE boundaries here, in
       the adapter, where the token stream actually is.
     · a tool call has no duration in the event stream — `content_block_start`
       says it began and nothing says it ended, because the result comes back
       in the NEXT request. So `tool()` waits, and `toolResult()` ends it.
       Without that the creature looks up from a tool call after a fixed 2.4s
       whether or not the tool has returned, which is the tell that it is
       animation rather than status. */
/* ADR 0007: docs/decisions/0007-stream-adapter.md */

/* Sentence enough to speak. Kept deliberately dumb — the point is a natural
   pause, not correct segmentation, and a wrong split costs nothing. */
const SENTENCE_END = /[.!?…]["')\]]?\s$|\n\s*$/;
const MIN_SPEAK = 12;   // don't stop for "Hi." on its own

function makeStreamDriver(api) {
  let buffer = "";
  let blockKind = null;   // what the open content block is
  let toolName = null;
  let sawStop = false;

  const flush = (force) => {
    const text = buffer.trim();
    if (!text) return;
    if (!force && text.length < MIN_SPEAK) return;
    buffer = "";
    /* ~55ms a character, floored — long enough to read, and it is also how
       long the creature holds the face. */
    api.speaking(text, Math.min(9000, Math.max(1600, text.length * 55)));
  };

  return {
    /* One event in, whatever it implies out. Unknown event types are ignored
       rather than thrown on: a stream that grows a new event type should not
       take the avatar down with it. */
    event(e) {
      if (!e || typeof e.type !== "string") return api;
      switch (e.type) {
        case "message_start":
          buffer = ""; sawStop = false;
          api.thinking();
          break;

        case "content_block_start": {
          const block = e.content_block || {};
          blockKind = block.type;
          if (block.type === "thinking") api.thinking();
          else if (block.type === "tool_use") {
            toolName = block.name || null;
            api.tool(toolName);
          }
          break;
        }

        case "content_block_delta": {
          const d = e.delta || {};
          if (d.type === "text_delta") {
            buffer += d.text || "";
            if (SENTENCE_END.test(buffer)) flush(false);
          }
          /* `thinking_delta` and `input_json_delta` deliberately do nothing.
             The creature is already thinking or already on the tool, and
             re-asserting it every delta is the thrash this adapter exists to
             prevent. */
          break;
        }

        case "content_block_stop":
          if (blockKind === "text") flush(true);
          blockKind = null;
          break;

        case "message_delta": {
          const reason = (e.delta || {}).stop_reason;
          if (!reason) break;
          sawStop = true;
          /* Say the last sentence BEFORE reacting to the turn ending. The
             final chunk usually has no trailing whitespace, so it does not
             flush on its own — without this the leftover text spoke after
             `done()` and overwrote the beat that says the turn landed. */
          flush(true);
          if (reason === "tool_use") break;               // still waiting on you
          else if (reason === "end_turn" || reason === "stop_sequence") api.done();
          else if (reason === "max_tokens") api.interrupted();
          else if (reason === "refusal") {
            /* Not a failure of the agent — it declined. Sheepish, not
               alarmed, so `needsInput` rather than `error`. */
            api.needsInput();
          } else if (reason === "pause_turn") api.thinking();
          break;
        }

        case "message_stop":
          flush(true);
          if (!sawStop) api.done();
          break;

        case "error":
          flush(true);
          api.error((e.error && e.error.message) || null);
          break;
      }
      return api;
    },

    /* The result of a tool call came back. Ends the wait started by the
       `tool_use` block — nothing in the stream itself can. */
    toolResult(ok = true) {
      toolName = null;
      api.toolResult(ok);
      return api;
    },

    /* The whole stream, for the common case. Works with anything async
       iterable: the SDK's `client.messages.stream(...)`, a `ReadableStream`
       of parsed events, an array in a test. */
    async run(stream) {
      for await (const e of stream) this.event(e);
      return api;
    },
  };
}

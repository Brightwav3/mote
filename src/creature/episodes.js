/* ── EPISODES AS DATA ─────────────────────────────────────────────────────
   `play()` already takes a written script — a list of `{ face, hold, ... }`
   beats — and ADR 0004 makes that list the specification of a reaction. What
   it did not have was a way in from outside. Every script in the project is a
   JS literal inside `embed/agent.js`, which is fine for the ten states an
   agent's turn goes through and useless to anybody who wants an eleventh.

   Two things are needed to hand that list to an integrator, and neither is
   the list itself.

   The first is VALIDATION. `play()` trusts what it is given because
   everything it is given was written three lines away by someone who could
   see `FACES`. A script arriving as JSON from a config file, an API or a
   person is a different proposition: `{ expression: "happy" }` instead of
   `{ face: "happy" }` would silently play a beat with no face and an
   undefined hold, and the creature would sit there wrong with nothing in the
   console. So a script is checked completely, up front, before a single beat
   runs, and a bad one throws at the call rather than misbehaving later. That
   includes rejecting keys nobody defined — a typo is the failure being
   guarded against, and ignoring unknown keys is how a typo stays silent.

   The second is REPETITION. A written script runs once, which is right for a
   reaction to an event. An episode carried in a persona is often not a
   reaction — an idle loop, a two-beat breathing pattern, a waiting animation
   — and those want to keep going until something interrupts.

   The interruption is free, and it is worth saying why, because it is the
   whole reason a loop is safe here. `play()` bumps the epoch, and `later()`
   stamps every job with the epoch current when it was scheduled; `runPending`
   discards a job whose stamp has gone stale. So a loop re-arms itself AFTER
   its own `play()` — capturing the fresh epoch — and any deliberate act
   afterwards bumps the epoch again and the loop simply stops existing. No
   cancellation token, no handle to leak, and no way for a forgotten loop to
   fight with a reaction. ADR 0004:
   docs/decisions/0004-scripted-episodes.md */

/* `pingpong` is the mode a written sequence usually wants when it loops. A
   plain loop of `a b c` cuts from c straight back to a; ping-pong walks back
   out the way it came, `a b c b`, so the join is a beat that was already
   there. The endpoints are not repeated — `a b c b a b c b` — because holding
   c or a for two beats running is the stutter the mode exists to avoid. */
function pingpongOrder(steps) {
  if (steps.length < 3) return steps.slice();
  return steps.concat(steps.slice(1, -1).reverse());
}

const EPISODE_MODES = ["once", "loop", "pingpong"];
const EPISODE_MAX_STEPS = 64;
const EPISODE_MAX_HOLD = 30;

/* Every key a beat may carry, with a check for each. `play()` reads exactly
   these; anything else in the object is a mistake, not an extension. */
const EPISODE_STEP_KEYS = {
  face: (v) => (FACE_AT[v] ? null : `unknown face ${JSON.stringify(v)}`),
  hold: (v) => (typeof v === "number" && v > 0 && v <= EPISODE_MAX_HOLD
    ? null : `hold must be a number in (0, ${EPISODE_MAX_HOLD}]`),
  anim: (v) => (STATE_BY_ID[v] ? null : `unknown animation ${JSON.stringify(v)}`),
  look: (v) => (Array.isArray(v) && LOOK_MODES.includes(v[0]) && typeof v[1] === "number"
    ? null : `look must be [${LOOK_MODES.join("|")}, seconds]`),
  say: (v) => (Array.isArray(v) && typeof v[0] === "string" && typeof v[1] === "number"
    ? null : "say must be [text, milliseconds]"),
  think: (v) => (typeof v === "number" && v > 0 ? null : "think must be a positive number"),
  blink: (v) => (typeof v === "boolean" ? null : "blink must be a boolean"),
  trace: (v) => (typeof v === "boolean" ? null : "trace must be a boolean"),
  kind: (v) => (typeof v === "string" ? null : "kind must be a string"),
};

/* The four attention modes `look()` understands. Naming a fifth does not
   error inside `look` — it just parks the creature in a mode nothing steers,
   which is the sort of quiet wrongness this file exists to prevent. */
const LOOK_MODES = ["about", "viewer", "away", "inward"];

const episodeFail = (msg) => { throw new Error(`mote: ${msg}`); };

/* Checked whole, before anything plays. A script that is half valid must not
   run its valid half — an integrator seeing three of five beats would go
   looking for the bug in the wrong place entirely. */
function checkEpisode(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    episodeFail("an episode is a non-empty array of beats");
  }
  if (steps.length > EPISODE_MAX_STEPS) {
    episodeFail(`an episode may have at most ${EPISODE_MAX_STEPS} beats`);
  }
  steps.forEach((step, i) => {
    const at = `beat ${i}`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      episodeFail(`${at}: a beat is an object`);
    }
    /* Unknown keys first. `{ expression: "happy", hold: 1 }` is missing a
       face AND carries a key nobody defined, and of those two facts only the
       second tells the reader what they actually typed wrong. */
    for (const key of Object.keys(step)) {
      const check = EPISODE_STEP_KEYS[key];
      if (!check) {
        episodeFail(`${at}: unknown key ${JSON.stringify(key)} — expected one of `
          + Object.keys(EPISODE_STEP_KEYS).join(", "));
      }
      if (step[key] === undefined) continue;   // an omitted optional
      const why = check(step[key]);
      if (why) episodeFail(`${at}.${key}: ${why}`);
    }
    if (!("face" in step)) episodeFail(`${at}: a beat needs a face`);
    if (!("hold" in step)) episodeFail(`${at}: a beat needs a hold`);
  });
  return steps;
}

const episodeLength = (steps) => steps.reduce((sum, st) => sum + st.hold, 0);

/* Play a checked script, optionally over and over.

   `repeat` counts ROUNDS, so 1 is indistinguishable from "once" and Infinity
   is the default for a mode that repeats at all. A round is one pass of the
   whole cycle — for ping-pong that is out and back, not out. */
function playEpisode(steps, opts = {}) {
  checkEpisode(steps);
  const mode = opts.mode === undefined ? "once" : opts.mode;
  if (!EPISODE_MODES.includes(mode)) {
    episodeFail(`unknown mode ${JSON.stringify(mode)} — expected one of ${EPISODE_MODES.join(", ")}`);
  }
  const repeat = opts.repeat === undefined ? Infinity : opts.repeat;
  if (!(repeat >= 1)) episodeFail("repeat must be at least 1");

  const cycle = mode === "pingpong" ? pingpongOrder(steps) : steps;
  const span = episodeLength(cycle);
  let rounds = mode === "once" ? 1 : repeat;

  const round = () => {
    play(cycle);
    /* Scheduled AFTER `play()`, so it carries the epoch `play()` just bumped
       to and survives its own restart. Anything else calling `play()` — a
       reaction, another episode, `idle()` — bumps past it and the loop ends
       without being told to. */
    if (--rounds > 0) later(span, round);
  };
  round();
  return span;
}

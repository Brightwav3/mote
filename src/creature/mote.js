/* ADR 0009: mutable creature values are captured per public mount context. */
let clock = 0;
let pending = [];
let epoch = 0;

function makeMoteState() {
  return {
  valence: new Spring(0.15, 11, 5.2),
  arousal: new Spring(0.53, 10, 5.0),
  dominance: new Spring(0.05, 10, 5.0),
  mood: new Mood(),
  restV: 0.15, restA: 0.53, restD: 0.05,
    temper: temperamentFor("Mote"),
    gaze: new Gaze(),
    ambient: true,

  body: BODIES[0], paint: PAINTS[0][1], name: "Mote",
  bodyFrom: null, bodyAt: -9,   // a change of body morphs; see morphBody

  mode: "about", modeUntil: 0,
  place: 0, placeYaw: 0, placePitch: 0,
  glanceYaw: 0, glancePitch: 0, lastGlance: -9,
  nextIdea: clock + 7,

  blinkAt: -9, blinkDur: 0.16, nextBlink: clock + 2,
  speakUntil: -9, thinkUntil: -9,
  hold: null,
  episodeUntil: -9,
  /* Named scripts carried by the persona, and the play settings each was
     declared with. See src/creature/episodes.js. */
  episodes: {},
  episodeOpts: {},
  lastInput: clock,
  cursor: { x: 0, y: 0, has: false },
  lastStim: "", lastStimAt: -99,

  awaitingTool: false,

  /* Set by whoever mounts the creature; both default to nothing happening. */
  onSay: null,        // (text, ms) — it said something
  onFace: null,       // (faceId, settled) — the expression it settled into
  };
}

let mote = makeMoteState();

/* Put the creature back to its birth state. Every field the running animal
   accumulates is listed here on purpose: this is module-level state, so a
   second `mount` in the same page inherits whatever the first one was feeling
   unless it is cleared. ADR 0006:
   docs/decisions/0006-embeddable-agent-avatar.md */
function resetMote() {
  mote = makeMoteState();
  pending.length = 0;
  epoch++;
}

const blink = (t, dur = 0.16) => { mote.blinkAt = t; mote.blinkDur = dur; };

/* Delayed beats run on HIS clock, not the wall clock.

   These used to be wall-clock timers, which is wrong in a way that only shows
   up in real use: `clock` advances only while frames are drawn, so with the
   tab hidden the timer still fires and the second half of a reaction lands on
   a frozen creature — the two beats come apart. On the animation clock the
   whole episode pauses and resumes together. */
/* ADR 0004: creature behaviour is scheduled on the animation clock, never with
   setTimeout — a wall-clock timer fires against a frozen creature when the tab
   is hidden. docs/decisions/0004-scripted-episodes.md */
const later = (delaySec, fn) => pending.push({ at: clock + delaySec, fn, epoch });
function runPending() {
  for (let i = pending.length - 1; i >= 0; i--) {
    const job = pending[i];
    if (job.epoch !== epoch) { pending.splice(i, 1); continue; }   // superseded
    if (clock >= job.at) { pending.splice(i, 1); job.fn(); }
  }
}

/* ── EPISODES ─────────────────────────────────────────────────────────────
   A reaction is a SCRIPT: a list of faces with a duration each, played in
   order. This replaced ad-hoc timers, which produced sequences nobody wrote.
   Three things went wrong with those and all three are structural:

     · a queued second beat from an earlier idle thought would land in the
       middle of a deliberate reaction and hijack it — you said hello and got
       whatever the creature had been about to do anyway;
     · between two beats there was no hold at all, so the face fell back to
       "nearest expression to the currently travelling mood", which is an
       arbitrary point mid-flight — that is where the stray `méfiant` and
       `curieux` came from;
     · hold durations were scaled by temperament, so the beats drifted out of
       step with the timings they were written against.

   So: starting an episode bumps the epoch, which invalidates every queued
   beat from the last one; each step's hold covers exactly until the next step
   begins, leaving no gap to fall through; and scripted holds are exact, not
   temperament-scaled. What is written below is what plays.                 */
/* ADR 0004: a reaction is a written script; the sequence is the specification.
   docs/decisions/0004-scripted-episodes.md */
function play(steps) {
  epoch++;
  let at = 0;
  for (const st of steps) {
    const run = () => {
      react(st.face, st.hold, {
        exact: true, blink: st.blink, kind: st.kind,
        trace: st.trace === true,
      });
      /* A beat may name an animation from the catalogue, which then plays for
         exactly that beat and then puts itself away. A beat that names none
         leaves a running animation alone — it does NOT cut it. Cutting was
         the first version and it was wrong in the most visible way possible:
         every script the creature plays to itself passes through beats with
         no animation, so any orbit or burst was killed mid-turn by whatever
         it happened to think of next.
         ADR 0005: docs/decisions/0005-animation-catalogue.md */
      if (st.anim) playAnim(st.anim, st.hold);
      if (st.say) say(st.say[0], st.say[1]);
      if (st.look) look(st.look[0], st.look[1]);
      if (st.think) { mote.thinkUntil = clock + st.think; look("inward", st.think); }
    };
    if (at === 0) run(); else later(at, run);
    at += st.hold;
  }
  mote.episodeUntil = clock + at;
}

/* Habituation. The same prod twice running lands at a fraction of the
   strength — the cheapest way to suggest he remembers the last minute. */
function novelty(kind) {
  const gap = clock - mote.lastStimAt;
  const n = kind === mote.lastStim ? clamp(gap / 9, 0.22, 1) : 1;
  mote.lastStim = kind; mote.lastStimAt = clock;
  return n;
}

const FACE_AT = Object.fromEntries(FACES.map((f) => [f.id, f]));

/* Reactions name a FACE and PARK the mood there for a while before letting go.
   Pushing an impulse and letting the spring fly home was the first attempt and
   it never arrived: the mood spiked for 200ms and was back at rest before the
   face finished travelling. The hold is the difference between a twitch and a
   feeling. The body kick lands in two beats — a small counter-move, then the
   reaction proper 130ms later — because without anticipation every reaction
   reads as a jump-cut however smoothly it is interpolated. */
function react(faceId, hold, opts = {}) {
  const f = FACE_AT[faceId];
  const n = (opts.kind ? novelty(opts.kind) : 1) * clamp(mote.temper.volatility, 0.4, 1.6);
  /* `power` went dead when the body kick was removed — it was only ever wired
     to that — so for a while every reaction, subtle or violent, reached its
     face at identical strength. It scales how far the mood actually travels,
     which is what it always meant. */
  const power = opts.power === undefined ? 1 : opts.power;
  const reach = clamp(n * power, 0, 1.15);
  const base = { v: mote.restV, a: mote.restA, d: mote.restD };
  mote.hold = {
    face: f,
    v: lerp(mote.valence.home, f.v, reach),
    a: lerp(mote.arousal.home, f.a, reach),
    d: lerp(mote.dominance.home, f.d, reach),
    until: clock + (opts.exact
      ? hold
      : hold * lerp(0.45, 1, clamp(n)) / clamp(mote.temper.recovery, 0.5, 1.6)),
  };
  /* Only the OPENING beat of an episode leaves a trace. A two-beat reaction —
     pleased, then bashful about being pleased — is one event, and letting the
     second beat deposit as well was quietly cancelling the first: `shy` sits
     below a sunny Mote's resting valence, so being praised made it very
     slightly sadder. Follow-ups pass trace:false. */
  /* Only a step explicitly marked trace:true leaves a mood residue — the
     opening beat of something YOU did. Later beats of the same episode do not
     (one event, one trace), and his own idle scripts never do. */
  if (opts.trace === true) mote.mood.absorb(mote.hold, base, mote.temper);
  if (opts.blink) blink(clock + 0.08, 0.13);
  return n;
}

/* Speech leaves through a callback rather than into an element. The creature
   does not know it is on a page: whoever mounted it decides whether a line
   becomes a bubble, a caption or nothing at all. That is the whole difference
   between a demo and something you can embed. ADR 0006:
   docs/decisions/0006-embeddable-agent-avatar.md */
function say(text, ms) {
  mote.speakUntil = clock + ms / 1000;
  if (mote.onSay) mote.onSay(text, ms);
}

/* Looking at you means looking at WHERE YOU WERE when he decided to look.
   Re-reading the cursor every frame is tracking, however rarely it starts, and
   the eyes glue to the pointer. Snapshot once; hold the fixation. */
function look(mode, seconds) {
  if (mode === "viewer") {
    mote.glanceYaw = clamp(mote.cursor.x, -1, 1) * 30;
    mote.glancePitch = clamp(-mote.cursor.y, -1, 1) * 21;
    mote.lastGlance = clock;
  }
  mote.mode = mode;
  mote.modeUntil = clock + seconds;
}

/* ── his world ────────────────────────────────────────────────────────────
   Eight loci he attends to, in his own order. Real attention is not uniform
   across space: it returns to the same few places and resamples in small
   steps around wherever it already is. Both are here, and together they are
   most of what makes idle behaviour look considered rather than shuffled. */
const PLACES = [
  { y: -32, p: 8 }, { y: 26, p: -5 }, { y: -9, p: 17 }, { y: 43, p: 11 },
  { y: -46, p: -7 }, { y: 7, p: -19 }, { y: 20, p: 22 }, { y: -21, p: -15 },
];

/* Mood weather. His baseline drifts on its own, slowly, which is why he is
   sometimes just in a good mood for no reason you can point at. */
/* Weather is deliberately small. It used to swing wide enough to park his
   resting mood in the gap between attentive, neutral and curious, where the
   blend is a three-way mush and he never looks like anything in particular.
   Resting should land ON a face. */
const weather = (t) => ({ v: noise(t, 47, 0.7) * 0.10, a: noise(t, 31, 2.2) * 0.06 });

function pickPlace(near) {
  if (near || Math.random() < 0.42) {
    mote.placeYaw += rnd(-11, 11);
    mote.placePitch += rnd(-7, 7);
  } else {
    mote.place = Math.floor(Math.random() * PLACES.length);
    mote.placeYaw = PLACES[mote.place].y + rnd(-5, 5);
    mote.placePitch = PLACES[mote.place].p + rnd(-4, 4);
  }
  mote.placeYaw = clamp(mote.placeYaw, -48, 48);
  mote.placePitch = clamp(mote.placePitch, -24, 26);
}

/* Things that occur to him, unprompted.

   The first version of this list named six faces, and a measurement over half
   an hour of him alone found the obvious consequence: eight of the seventeen
   NEVER appeared. He cannot be delighted, cross, bashful or frightened by
   himself if nothing in here ever makes him so, and a creature that only ever
   cycles attentive → curious → neutral is a screensaver.

   So: every face is reachable from his own head, and several arrive as short
   chains, because that is how they actually happen. Nobody goes straight to
   laughing — you notice something first. Nobody is proud without being
   pleased first. Fright arrives before you know what frightened you and
   resolves into puzzlement a second later.

   Weights are deliberately lopsided. He is mostly pottering about; the vivid
   ones are rare enough to be worth catching. And every one of these passes
   trace:false — his own musings must not stain his mood, or he would drift
   somewhere random over an afternoon of being left alone. Only things YOU do
   are worth remembering.                                                    */
/* His own thoughts, as scripts. Weights are lopsided on purpose: he is mostly
   pottering about, and the vivid ones stay rare enough to be worth catching.
   None of them carry a mood trace — his own musings must not stain how he
   feels, or an afternoon alone would leave him somewhere random. Only things
   YOU do are worth remembering. */
const IDEAS = [
  [16, [{ face: "neutral", hold: 2.4 }]],
  [14, [{ face: "attentive", hold: 2.6 }]],
  [14, [{ face: "curious", hold: 2.8 }]],
  [9, [{ face: "round", hold: 2.6 }]],
  [9, [{ face: "happy", hold: 2.6 }]],
  [8, [{ face: "unimpressed", hold: 3.0 }]],
  [5, [{ face: "surprised", hold: 1.4, blink: true }, { face: "attentive", hold: 2.0 }]],
  [5, [{ face: "sleepy", hold: 3.4 }]],
  [4, [{ face: "confused", hold: 2.6 }]],
  [4, [{ face: "happy", hold: 1.2 }, { face: "proud", hold: 2.8 }]],
  [3, [{ face: "curious", hold: 1.0 }, { face: "laughing", hold: 2.4 }]],
  [3, [{ face: "happy", hold: 1.0 }, { face: "shy", hold: 2.6 }]],
  [3, [{ face: "round", hold: 1.0 }, { face: "excited", hold: 2.4 }]],
  [3, [{ face: "suspicious", hold: 2.6 }]],
  [2, [{ face: "unimpressed", hold: 1.0 }, { face: "sad", hold: 2.8 }]],
  [2, [{ face: "suspicious", hold: 0.9 }, { face: "angry", hold: 2.4 }]],
  [1, [{ face: "surprised", hold: 0.7, blink: true }, { face: "scared", hold: 2.0 }]],
  [4, [{ face: "neutral", hold: 2.6, think: 2.4 }]],
  [2, [{ face: "curious", hold: 2.0, look: ["viewer", 1.1] }]],
];

function idea() {
  let r = Math.random() * IDEAS.reduce((n, [w]) => n + w, 0);
  for (const [w, steps] of IDEAS) {
    if ((r -= w) <= 0) {
      play(steps);
      pickPlace(Math.random() < 0.6);
      return;
    }
  }
}

function direct(t) {
  if (!mote.ambient) return;
  const idle = t - mote.lastInput;
  const w = weather(t);

  /* Where the emotion returns to = who he is + what sort of minute he has
     been having + slow weather. Only the first is fixed. */
  const T = mote.temper;
  const settle = (v, a, d) => {
    /* Remembered separately from `.home`, because `.home` is commandeered by
       whatever reaction is running; the residue has to be measured against
       where he would be if nothing were happening. */
    mote.restV = clamp(v + mote.mood.v, -1, 1);
    mote.restA = clamp(a + mote.mood.a, 0, 1);
    mote.restD = clamp(d + mote.mood.d, -1, 1);
    mote.valence.home = mote.restV;
    mote.arousal.home = mote.restA;
    mote.dominance.home = mote.restD;
  };

  if (mote.mode !== "asleep" && idle > 52) {
    mote.mode = "asleep"; mote.modeUntil = t + 999;
    settle(0.05, 0.02, -0.1);
  } else if (mote.mode === "asleep") {
    settle(0.05, 0.02, -0.1);
  } else if (idle > 30) {
    settle(T.baseV - 0.29 + w.v * 0.5, T.baseA - 0.37 + w.a * 0.4, T.baseD + 0.15);
  } else {
    settle(T.baseV + w.v, T.baseA + w.a, T.baseD);
  }

  if (t > mote.nextIdea && mote.mode !== "asleep" && t > mote.episodeUntil) {
    mote.nextIdea = t + rnd(1.8, 4.6) / clamp(mote.temper.curiosity, 0.5, 1.8);
    /* Not while something is playing: an idea that lands mid-animation used to
       interrupt it, and the creature has nothing to say that is worth cutting
       an orbit in half for. */
    if (!animBusy() && (!mote.hold || t > mote.hold.until)) idea();
  }

  if (t > mote.modeUntil && mote.mode !== "asleep") {
    if (Math.random() < 0.04 * clamp(mote.temper.sociability, 0.2, 2.2) && mote.cursor.has && t - mote.lastGlance > 9) look("viewer", rnd(0.6, 1.3));
    else { pickPlace(false); look("about", rnd(0.9, 3.4)); }
  }

  if (mote.mode === "viewer") { mote.gaze.aim(mote.glanceYaw, mote.glancePitch); return; }
  if (mote.mode === "inward") {
    mote.gaze.aim(noise(t, 2.1, 1.4) * 22 - 6, -12 + noise(t, 1.6, 3.3) * 7);
    return;
  }
  if (mote.mode === "away") { mote.gaze.aim(-30, 13); return; }
  if (mote.mode === "asleep") { mote.gaze.aim(4, -15); return; }
  mote.gaze.aim(mote.placeYaw, mote.placePitch);
}

/* ── how he is, in words ──────────────────────────────────────────────────
   The only status worth showing. Not numbers — a sentence, in his own terms,
   and only when it has changed. */
const MOODLINE = {
  round: "wide-eyed about something", neutral: "somewhere else entirely",
  attentive: "taking it all in", curious: "curious about something",
  surprised: "caught off guard", excited: "thoroughly excited",
  happy: "quietly pleased", laughing: "delighted with itself",
  proud: "rather pleased with itself", shy: "a little bashful",
  confused: "not following", suspicious: "not sure it believes you",
  sad: "a bit downcast", angry: "distinctly unimpressed with you",
  scared: "alarmed", unimpressed: "bored", sleepy: "nearly asleep",
};

/* ── the frame ────────────────────────────────────────────────────────────
   Every body channel is a spring or a follower, so none of them can step.
   Assigning a visual property is what makes motion pop; chasing one is what
   makes it read as mass. */

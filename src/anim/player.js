/* ADR 0009: the animation player state is captured per public Mote handle. */
/* ── PLAYING AN ANIMATION ─────────────────────────────────────────────────
   The catalogue in `states.js` is pure: a state is a function of local time.
   This is the part that owns a clock — which state is running, which one it is
   coming FROM, and how the two are mixed.

   The mix is one scalar and one rule: **everything on screen is a crossfade
   between an outgoing pose and an incoming one.** Ordinary life — the body you
   picked, wearing the expression the mood chose — is just another pose, so
   starting an animation, switching between two, and stopping are all the same
   operation with different ends.

   That is the second design here. The first blended each state against
   ordinary life and nothing else, which meant every switch went *through* the
   resting ball: `thinking` collapses the body to a dot on the right-hand side
   and `notify` wants the full ball, so going from one to the other popped the
   ball back to full size and then reformed it. Worse, starting a state while
   another was showing reset the ramp, so the drawn pose snapped to rest in a
   single frame before morphing in. There was no path between two states,
   because nothing held on to the one being left.

   Now `prev` does. Its pose is evaluated live — with its own clock still
   running, so a comet's ribbons keep turning while they fade — and the drawn
   pose is `lerp(prev, next, k)` across silhouette, gaze, eyes and decor alike.

   Two things fall out of that. States chain with no gap: when one ends with
   another queued behind it, the next begins immediately and the crossfade is
   between the two rather than through the ball. And decor stops popping —
   outgoing dots and rings fade at `1 - k` while the incoming ones arrive at
   `k`.

   It runs on `clock`, the animation clock, like everything else the creature
   does — never `setTimeout`. See ADR 0004. */
/* ADR 0005: docs/decisions/0005-animation-catalogue.md */

const EXIT_MORPH = 0.38;

/* `prev.def === null` means "ordinary life". Keeping rest as a real prev
   rather than as the absence of one is what makes starting an animation a
   crossfade like any other: the first version left `prev` null when nothing
   had been playing, so every state begun from rest arrived in a single frame.
   Measured against the drawn silhouette, entering `thinking` from rest jumped
   154 px between two frames; the same entry now moves at most 4 px. */
const makeAnimState = () => ({
  cur: null,      // { def, t0, until } — what is playing
  prev: null,     // { def, t0 } — what it is crossfading from; def null = rest
  morphT0: 0,     // when the current crossfade began
  morphDur: 0.4,
  queue: [],
  rot: null,      // last blended rotation, for continuity — see mixPoses
});
let anim = makeAnimState();

/* Stopping is a crossfade back to ordinary life, not a cut. It used to be a
   cut, and since every scripted beat that named no animation called it, an
   orbit begun a second earlier was killed mid-turn — silhouette and rings gone
   on one frame — by whatever the creature thought of next. */
function stopAnim() {
  anim.queue.length = 0;
  if (anim.cur) leaveAnim();
}

/* The hard version: nothing plays out, nothing is queued. Only for "leave it
   be", which is the one act that means stop, now. */
function cancelAnim() {
  anim.queue.length = 0;
  anim.cur = null;
  anim.prev = null;
  anim.rot = null;
}

function leaveAnim() {
  anim.prev = anim.cur || { def: null, t0: clock };
  anim.cur = null;
  anim.morphT0 = clock;
  anim.morphDur = EXIT_MORPH;
}

function playAnim(id, hold) {
  const def = STATE_BY_ID[id];
  if (!def) return;
  /* Large-field motion — the burst, the orbit, the comet, the travelling "!"
     — is exactly what `prefers-reduced-motion` is about, so it is skipped
     entirely rather than slowed down. The face still changes, so the state is
     still legible; it just does not fly across the element. */
  if (def.big && reducedMotion()) return;
  /* Whatever is showing becomes the thing we fade FROM — including a state
     that was itself only half-arrived. Its own clock keeps running. */
  anim.prev = anim.cur || { def: null, t0: clock };
  anim.cur = { def, t0: clock, until: clock + Math.max(def.minDuration ?? 0, hold ?? def.duration) };
  anim.morphT0 = clock;
  anim.morphDur = def.morph;
  if (def.blinkIn) blink(clock, 0.26);
}

/* The whole catalogue, back to back, in the order it was cut. */
function playAnimSequence(ids = SEQUENCE) {
  anim.queue = ids.slice();
  advanceAnim();
}

function advanceAnim() {
  const next = anim.queue.shift();
  if (next) playAnim(next);
  else leaveAnim();
}

/* Is anything animating — playing, or still fading out? */
function animBusy() {
  return anim.cur !== null || anim.prev !== null;
}

/* One state's contribution, resolved against ordinary life. `baseBody` and
   `baseFace` mean "that channel is not mine", so the body you picked and the
   expression the mood chose come through untouched. */
function poseOfState(def, local, rest) {
  const p = def.pose(local);
  return {
    sil: def.baseBody ? rest.sil : p.sil,
    gaze: def.baseFace ? rest.gaze : p.gaze,
    split: def.baseFace ? rest.split : p.split,
    eyes: def.baseFace ? rest.eyes : p.eyes,
    eyeAlpha: p.eyeAlpha,
    dots: p.dots, arcs: p.arcs, notif: p.notif, dotsBehind: p.dotsBehind,
  };
}

const restPose = (rest) => ({
  sil: rest.sil, gaze: rest.gaze, split: rest.split, eyes: rest.eyes,
  eyeAlpha: 1, dots: [], arcs: [], notif: null, dotsBehind: false,
});

/* The drawn pose, or null when nothing is animating and the loop can take its
   cheap path. This advances the state machine, so call it exactly once a
   frame. */
function animPose(rest) {
  if (anim.cur && clock >= anim.cur.until) {
    if (anim.queue.length) advanceAnim();
    else leaveAnim();
  }
  if (!anim.cur && !anim.prev) { anim.rot = null; return null; }

  const k = anim.morphDur > 0 ? clamp((clock - anim.morphT0) / anim.morphDur) : 1;
  /* Drop the outgoing state BEFORE interpolating on the final frame, so a
     settled pose is exactly the incoming pose rather than a lerp that happens
     to land on it. The expression crossfade had this same bug, and there it
     showed up as 0.17000000000000004 where 0.17 was meant. */
  if (k >= 1) anim.prev = null;
  if (!anim.cur && !anim.prev) { anim.rot = null; return null; }

  const next = anim.cur ? poseOfState(anim.cur.def, clock - anim.cur.t0, rest) : restPose(rest);
  if (!anim.prev) { anim.rot = next.sil.rot; return next; }
  const from = anim.prev.def
    ? poseOfState(anim.prev.def, clock - anim.prev.t0, rest)
    : restPose(rest);
  return mixPoses(from, next, EASE.inOutCubic(k));
}

/* Nearest way round from a reference angle. */
function unwrapTo(ref, x) {
  let d = x - ref;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return ref + d;
}

function mixPoses(a, b, k) {
  /* Rotation is unwrapped toward what was drawn LAST FRAME, not toward the
     other silhouette. `orbit` spins continuously, so once its angle passed
     -180deg the shortest path from a still shape flipped sign and the blend
     reversed direction mid-crossfade — a 26 px jump, measured. Anchoring both
     ends to the previous output keeps the drawn rotation continuous whatever
     the two ends are doing. */
  const ref = anim.rot === null ? b.sil.rot : anim.rot;
  const sil = blendSil(a.sil, b.sil, k);
  sil.rot = lerp(unwrapTo(ref, a.sil.rot), unwrapTo(ref, b.sil.rot), k);
  anim.rot = sil.rot;
  return {
    sil,
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, k),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, k),
      roll: lerp(a.gaze.roll, b.gaze.roll, k),
    },
    split: lerp(a.split, b.split, k),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], k), lerpEye(a.eyes[1], b.eyes[1], k)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, k),
    /* Decor is not interpolated — an outgoing ring and an incoming dot are not
       two values of one thing — so both are drawn and their opacities are
       crossfaded instead. */
    dots: fadeDecor(a.dots, 1 - k).concat(fadeDecor(b.dots, k)),
    arcs: fadeDecor(a.arcs, 1 - k).concat(fadeDecor(b.arcs, k)),
    notif: pickNotif(a.notif, 1 - k, b.notif, k),
    dotsBehind: k < 0.5 ? a.dotsBehind : b.dotsBehind,
  };
}

const fadeDecor = (list, k) =>
  (k <= 0.001 ? [] : list.map((d) => ({ ...d, opacity: d.opacity * k })));

/* Only one pip can be notched out of the body at a time — the mask is a single
   circle — so the fading one keeps the notch until the arriving one is
   larger. */
function pickNotif(a, ka, b, kb) {
  const A = a ? { ...a, r: a.r * ka, notch: a.notch * ka } : null;
  const B = b ? { ...b, r: b.r * kb, notch: b.notch * kb } : null;
  if (!A) return B;
  if (!B) return A;
  return B.r >= A.r ? B : A;
}

/* ── UNPROMPTED ───────────────────────────────────────────────────────────
   He plays these to himself, rarely. The weights are lopsided: a wink or a
   thought is a small thing that can happen every half-minute without wearing
   out, while collapsing into a comet is not. None of them leaves a mood trace
   — an animation is something he DOES, not something that happens to him. */
const IDLE_ANIMS = [
  [11, "wink"], [9, "thinking"], [8, "wide"], [6, "notify"], [5, "exclaim"],
  [4, "alert"], [4, "egg"], [4, "hexagon"], [4, "play"], [3, "sleep"],
  [3, "comet"], [3, "burst"], [2, "orbit"],
];
let nextAnimAt = 24;

function maybeIdleAnim(t) {
  if (t < nextAnimAt) return;
  nextAnimAt = t + rnd(26, 62);
  if (animBusy() || mote.mode === "asleep" || t < mote.episodeUntil) return;
  if (mote.hold && t < mote.hold.until) return;
  let r = Math.random() * IDLE_ANIMS.reduce((n, [w]) => n + w, 0);
  for (const [w, id] of IDLE_ANIMS) if ((r -= w) <= 0) return playAnim(id);
}

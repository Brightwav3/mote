const field = document.getElementById("field");
const stage = makeStage(field);
let last = performance.now() / 1000;

function frame(now) {
  const nowS = now / 1000;
  const dt = clamp(nowS - last, 0, 0.05);
  last = nowS; clock += dt;
  const t = clock;

  /* While you are still choosing, only the preview runs. He has no inner life
     to speak of yet — that starts when you bring him to life. */
  if (makeView.classList.contains("on")) {
    drawPreview(t);
    requestAnimationFrame(frame);
    return;
  }

  runPending();
  direct(t);
  mote.mood.decay(dt);
  if (mote.hold) {
    if (t < mote.hold.until) {
      mote.valence.home = mote.hold.v;
      mote.arousal.home = mote.hold.a;
      mote.dominance.home = mote.hold.d;
    } else mote.hold = null;
  }
  mote.valence.step(dt);
  mote.arousal.step(dt);
  mote.dominance.step(dt);
  const v = clamp(mote.valence.x, -1, 1);
  const a = clamp(mote.arousal.x, 0, 1);
  const d = clamp(mote.dominance.x, -1, 1);

  mote.gaze.step(t, dt, a, (amp) => blink(t, 0.1 + amp * 0.0022));

  /* Spontaneous blinks: an alert creature blinks less, a drowsy one blinks
     slowly and often. */
  if (t > mote.nextBlink) {
    blink(t, lerp(0.30, 0.11, a));
    mote.nextBlink = t + lerp(1.6, 5.2, a) * rnd(0.6, 1.5);
  }
  const bk = (t - mote.blinkAt) / mote.blinkDur;
  let lidClose = 1;
  if (bk >= 0 && bk <= 1) lidClose = bk < 0.42 ? 1 - bk / 0.42 : (bk - 0.42) / 0.58;

  /* While a feeling is running, he wears the face that feeling NAMED. Picking
     the nearest face to the live mood instead meant he wore every expression
     the trajectory happened to pass over on the way — a flicker of `neutral`
     and `suspicious` en route to `angry`, 1,199 changes in half an hour. The
     intensity of a reaction decides how deep and how long it goes; it does not
     get a vote on which expression it is. */
  const held = mote.hold && t < mote.hold.until ? mote.hold.face : null;
  const { mix, id: faceId, settled } = expressionFor(t, v, a, d, held);

  /* The body never changes size. No breath, no speech swell, no reaction
     kick, no squash — every one of those was a pulse, and pulses on a shape
     this simple read as a glitch rather than as life. What is left is a small
     lean in the direction he is looking, which is not a rhythm: it only moves
     when his attention does. Everything expressive happens in the eyes. */
  const gx = Math.sin(rad(mote.gaze.yaw)), gy = -Math.sin(rad(mote.gaze.pitch));

  drawStage(stage, {
    body: mote.body, paint: mote.paint,
    x: gx * 7,
    y: gy * 5,
    sx: 1,
    sy: 1,
    lookYaw: mote.gaze.yaw * 0.45, lookPitch: mote.gaze.pitch * 0.45,
    mix, blinkLid: lidClose,
  });

  if (t > mote.speakUntil && speechEl.classList.contains("on")) speechEl.classList.remove("on");

  const line = MOODLINE[faceId];
  if (line !== shownMood && settled) { shownMood = line; moodEl.textContent = line; }

  requestAnimationFrame(frame);
}

/* ── you, from his side ───────────────────────────────────────────────────
   He knows where you are and does not follow you. The pointer records a
   position for the rare moments he chooses to look over, and nothing else
   about it reaches him. */
window.addEventListener("pointermove", (e) => {
  const r = field.getBoundingClientRect();
  mote.cursor = {
    x: clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1.6, 1.6),
    y: clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1.6, 1.6),
    has: true,
  };
  mote.lastInput = clock;
  if (mote.mode === "asleep") {
    look("viewer", 1.3);
    mote.valence.push(0.25); mote.arousal.push(0.85); mote.dominance.push(0.2);
    blink(clock, 0.24);
  }
});

field.addEventListener("pointerdown", () => {
  mote.lastInput = clock;
  react("surprised", 1.0, { kind: "poke", blink: true, power: 0.8 });
  look("viewer", 1.2);
});

/* ── things you can do to him ─────────────────────────────────────────────  */
/* The deck. These sequences are written, not derived — the face order is the
   specification, and the mood system's job here is only to carry the residue
   afterwards. */
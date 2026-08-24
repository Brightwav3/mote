const eye = (w, h, tilt = 0, open = 1) => ({ w, h, tilt, open });
const pair = (w, h, tilt = 0, open = 1) => [eye(w, h, tilt, open), eye(w, h, -tilt, open)];

/* ADR 0001: these are Bloub's measured poses, ported verbatim and pinned by
   test/expressions.test.mjs. Do not adjust a value to taste — check it against
   bloub/src/bot/expressions.ts. docs/decisions/0001-port-bloub-verbatim.md */
const FACES = [
  { id: "neutral",     v: 0.00, a: 0.18, d: 0.00, yaw: 28.49, pitch: 28.62, roll: -13, split: 15.46,
    eyes: [eye(0.186, 0.412, 0, 1), eye(0.186, 0.412, 0, 1)] },
  { id: "attentive",   v: 0.15, a: 0.55, d: 0.10, yaw:   4, pitch:   5, roll:  -4, split: 16.00,
    eyes: [eye(0.21, 0.44, 0, 1), eye(0.21, 0.44, -0, 1)] },
  { id: "curious",     v: 0.35, a: 0.60, d: 0.15, yaw:  16, pitch:  -9, roll: -15, split: 16.50,
    eyes: [eye(0.24, 0.46, -8, 1), eye(0.2, 0.38, -8, 1)] },
  { id: "round",       v: 0.34, a: 0.72, d: -0.10, yaw:   5, pitch:  -2, roll:   0, split: 16.60,
    eyes: [eye(0.30, 0.30, 0, 1), eye(0.30, 0.30, 0, 1)] },   // mine, not Bloub's
  { id: "surprised",   v: 0.05, a: 0.88, d: -0.20, yaw:   3, pitch:  -3, roll:   0, split: 19.00,
    eyes: [eye(0.46, 0.46, 0, 1), eye(0.46, 0.46, 0, 1)] },
  { id: "excited",     v: 0.75, a: 0.95, d: 0.50, yaw:   6, pitch: -14, roll:   0, split: 19.50,
    eyes: [eye(0.4, 0.56, -10, 1), eye(0.4, 0.56, 10, 1)] },
  { id: "happy",       v: 0.70, a: 0.50, d: 0.30, yaw:   5, pitch:   9, roll:   0, split: 17.00,
    eyes: [eye(0.28, 0.28, 0, 1), eye(0.28, 0.28, 0, 1)] },
  { id: "laughing",    v: 0.88, a: 0.76, d: 0.50, yaw:   4, pitch:  14, roll:   0, split: 18.00,
    eyes: [eye(0.4, 0.56, -10, 1), eye(0.4, 0.56, 10, 1)] },
  { id: "proud",       v: 0.60, a: 0.40, d: 0.90, yaw:   5, pitch:  17, roll:   0, split: 17.00,
    eyes: [eye(0.3, 0.15, 18, 1), eye(0.3, 0.15, -18, 1)] },
  { id: "shy",         v: 0.28, a: 0.34, d: -0.60, yaw: -19, pitch: -14, roll:  -7, split: 14.00,
    eyes: [eye(0.16, 0.34, 28, 1), eye(0.16, 0.34, -28, 1)] },
  { id: "confused",    v: -0.28, a: 0.55, d: -0.40, yaw: -14, pitch:   3, roll:   8, split: 16.50,
    eyes: [eye(0.2, 0.44, -18, 1), eye(0.28, 0.17, 14, 1)] },
  { id: "suspicious",  v: -0.38, a: 0.45, d: 0.20, yaw:  12, pitch:   6, roll:  -6, split: 16.00,
    eyes: [eye(0.21, 0.4, 0, 1), eye(0.22, 0.15, 0, 1)] },
  { id: "sad",         v: -0.72, a: 0.24, d: -0.50, yaw:   3, pitch: -13, roll:   0, split: 16.00,
    eyes: [eye(0.22, 0.4, 28, 1), eye(0.22, 0.4, -28, 1)] },
  { id: "angry",       v: -0.82, a: 0.78, d: 0.70, yaw:   3, pitch:   7, roll:   0, split: 17.00,
    eyes: [eye(0.4, 0.1, 38, 1), eye(0.4, 0.1, -38, 1)] },
  { id: "scared",      v: -0.62, a: 0.96, d: -0.90, yaw:   2, pitch: -20, roll:   0, split: 20.50,
    eyes: [eye(0.4, 0.6, 0, 1), eye(0.4, 0.6, -0, 1)] },
  { id: "unimpressed", v: -0.20, a: 0.12, d: 0.30, yaw: -22, pitch:   2, roll:   0, split: 16.00,
    eyes: [eye(0.3, 0.12, 0, 1), eye(0.3, 0.12, -0, 1)] },
  { id: "sleepy",      v: 0.05, a: 0.02, d: -0.10, yaw:   6, pitch:  -9, roll:  -3, split: 16.00,
    eyes: [eye(0.34, 0.2, 0, 0.24), eye(0.34, 0.2, -0, 0.24)] },
];

/* Shepard weights over all seventeen. Arousal counts heavier than valence
   because a 0.3 jump in arousal is a much bigger visible change; dominance
   counts a little lighter, since it separates faces rather than driving them.
   eps and the exponent were swept, not guessed: at these values every face
   renders at 97%+ of itself at its own coordinate, and the largest change
   anywhere on the space is small enough to be invisible between frames. An
   earlier version used a cutoff radius and was worse — it left a wide region
   outside every face's support, and crossing that boundary was a visible
   snap. A kernel with no boundary has none of that.                        */
const BLEND_EPS = 0.005;
const BLEND_SHARP = 2.0;

const lerpEye = (x, y, t) => ({
  w: lerp(x.w, y.w, t), h: lerp(x.h, y.h, t),
  tilt: lerp(x.tilt, y.tilt, t), open: lerp(x.open, y.open, t),
});

const poseOf = (f) => ({
  split: f.split, yaw: f.yaw, pitch: f.pitch, roll: f.roll,
  eyes: [{ ...f.eyes[0] }, { ...f.eyes[1] }],
});
const lerpPose = (x, y, t) => ({
  split: lerp(x.split, y.split, t),
  yaw: lerp(x.yaw, y.yaw, t),
  pitch: lerp(x.pitch, y.pitch, t),
  roll: lerp(x.roll, y.roll, t),
  eyes: [lerpEye(x.eyes[0], y.eyes[0], t), lerpEye(x.eyes[1], y.eyes[1], t)],
});

/* ── WHICH FACE, AND GETTING THERE ────────────────────────────────────────
   The face is a DISCRETE choice with a timed crossfade, not a continuous
   weighted blend of the whole set. That is a reversal, and it is worth saying
   why, because the continuous version was defensible and still wrong.

   Weighting every expression by distance meant that whenever the mood sat
   between two faces — which is most of a transition, and a good deal of rest
   — what got drawn was an average of two or three of them. Measured over half
   an hour, 41.5% of his time had no expression above 80%: not `curious`, not
   `happy`, but a 46/44 smear of both, which is a shape nobody drew and which
   reads as approximately nothing. Averaging `angry`'s hard 30-degree squint
   with `curious`'s soft one does not produce an emotion between them; it
   produces mush.

   So the mood plane now decides WHICH of the seventeen he is, and he is that
   one exactly — Bloub's measured pose, unmodified — with a 280ms crossfade
   when he changes his mind. Two guards keep that from flickering: a new face
   has to be meaningfully closer than the one he is already wearing, not just
   marginally, and it has to wait out a minimum dwell. Without both, a mood
   drifting along the boundary between two faces would strobe between them.  */
const CROSSFADE = 0.28;
const DWELL_MIN = 0.34;
const SWITCH_MARGIN = 0.72;   // a rival must be this much closer to win

const worn = {
  face: null, from: null, t0: -9, pose: null,
};

function faceDistance(f, v, a, d) {
  const dv = f.v - v, da = (f.a - a) * 1.55, dd = (f.d - d) * 0.85;
  return dv * dv + da * da + dd * dd;
}

/* ADR 0003: discrete face, timed crossfade — never a weighted blend of poses.
   Stateful and time-ordered; `t` must increase monotonically.
   docs/decisions/0003-discrete-expressions-with-crossfade.md */
function expressionFor(t, v, a, d, forced) {
  let want = FACES[0], best = Infinity;
  if (forced) {
    want = forced; best = -1;
  } else {
    for (const f of FACES) {
      const s = faceDistance(f, v, a, d);
      if (s < best) { best = s; want = f; }
    }
  }

  if (!worn.face) {
    worn.face = want; worn.from = null; worn.t0 = t; worn.pose = poseOf(want);
  } else if (want !== worn.face
             && (forced || best < faceDistance(worn.face, v, a, d) * SWITCH_MARGIN)
             && t - worn.t0 > DWELL_MIN) {
    worn.from = worn.pose;      // crossfade out of exactly what is on screen
    worn.face = want;
    worn.t0 = t;
  }

  const k = clamp((t - worn.t0) / CROSSFADE);
  /* Drop the outgoing pose BEFORE interpolating, not after. Interpolating with
     e === 1 does not return the target exactly — lerp(a, b, 1) is
     a + (b - a) * 1, which for 0.44 -> 0.17 lands on 0.17000000000000004. The
     whole point of the discrete chooser is that a settled face is Bloub's pose
     bit for bit, so the last frame of a crossfade must not be a lerp. */
  if (k >= 1) worn.from = null;
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  worn.pose = worn.from ? lerpPose(worn.from, poseOf(worn.face), e) : poseOf(worn.face);
  return { mix: worn.pose, id: worn.face.id, settled: k >= 1 };
}

function blendFace(v, a, d) {
  const scored = [];
  let total = 0;
  for (const f of FACES) {
    const dv = f.v - v, da = (f.a - a) * 1.55, dd = (f.d - d) * 0.85;
    const w = Math.pow(1 / (dv * dv + da * da + dd * dd + BLEND_EPS), BLEND_SHARP);
    scored.push({ f, w });
    total += w;
  }

  const mix = {
    split: 0, roll: 0, pitch: 0,
    eyes: [eye(0, 0, 0, 0), eye(0, 0, 0, 0)],
  };
  for (const sc of scored) {
    const k = sc.w / total;
    mix.split += sc.f.split * k;
    mix.roll += sc.f.roll * k;
    mix.pitch += sc.f.pitch * k;
    for (let i = 0; i < 2; i++) {
      mix.eyes[i].w += sc.f.eyes[i].w * k;
      mix.eyes[i].h += sc.f.eyes[i].h * k;
      mix.eyes[i].tilt += sc.f.eyes[i].tilt * k;
      mix.eyes[i].open += sc.f.eyes[i].open * k;
    }
  }
  const parts = scored.map((sc) => ({ id: sc.f.id, k: sc.w / total }))
    .sort((x, y) => y.k - x.k).slice(0, 3);
  return { mix, parts };
}

/* Damped spring. Values carry momentum, so mood cannot be assigned — only

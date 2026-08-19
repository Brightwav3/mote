/* ── THE ANIMATION CATALOGUE ──────────────────────────────────────────────
   Fourteen animations, ported from bloub/src/bot/states.ts with their measured
   constants intact. Each is a pure function of local time: hand it `t` seconds
   since the state began and it returns a complete pose — silhouette, gaze,
   eyes, and whatever decor that state draws. No clock, no state of its own.

   Two flags decide how much of the creature survives an animation:

     · `baseBody` true means the silhouette is the resting body, so the shape
       you picked is the one that plays. False means the shape IS the
       animation — the "!", the dots, the egg, the triangle — and substituting
       a droplet for it would leave nothing to watch.
     · `baseFace` true means the resting expression shows through. Only `idle`
       has it: every other face here was measured off the reference video, and
       reproducing it is the whole point.

   `blinkIn` states hide their entry morph behind a blink, which is how the
   original gets away with changing shape in a single frame.                  */
/* ADR 0005: measured constants, ported not re-derived.
   docs/decisions/0005-animation-catalogue.md */

const REST_GAZE = { yaw: 28.49, pitch: 28.62, roll: -13 };
const EYE_W = 0.186, EYE_H = 0.412, EYE_SPLIT = 15.46;

function baseState(over = {}) {
  return {
    sil: circleSil(1),
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(EYE_W, EYE_H),
    eyeAlpha: 1,
    dots: [],
    arcs: [],
    notif: null,
    dotsBehind: false,
    ...over,
  };
}

/* The upright "!" bar is not a rectangle: it is the convex hull of a large
   disc at the top and a small one at the bottom, so it tapers (1.76 to 1). */
const BAR_UPRIGHT_CY = -0.1875;
const BAR_UPRIGHT = profileFromPolygon(
  hullOfCircles(0, -0.505, 0.132, 0, 0.13, 0.075), 0, BAR_UPRIGHT_CY);
/* The leaning one is a pure capsule: constant width 0.269, length 0.776. */
const BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -0.2535, 0.1345, 0, 0.2535, 0.1345), 0, 0);

const barUpright = (pose = {}) => poseSil([...BAR_UPRIGHT], { cy: BAR_UPRIGHT_CY, ...pose });
const barItalic = (pose = {}) => poseSil([...BAR_ITALIC], pose);

/* The dot of the leaning "!" is a teardrop, round at the bar end and drawn to
   a point away from it — not a disc. */
const TEAR = polyPath(hullOfCircles(0, 0, 0.118, 0, 0.172, 0.012));

/* The triangle does not spin in place: its centre travels a circle of radius
   0.213 about the origin. That offset is what makes it read as tumbling. */
const TRI_ORBIT = 0.213;
const TRIANGLE = BODY_BY_ID.triangle.profile;
const HEXAGON = BODY_BY_ID.hexagone.profile;

function spinningTriangle(rot) {
  return poseSil(TRIANGLE, {
    rot, cx: -TRI_ORBIT * Math.sin(rot), cy: TRI_ORBIT * Math.cos(rot),
  });
}

/* A pulse travelling left to right across the three dots. */
function dotPulse(t, index) {
  const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1;
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0;
  return clamp(k * 2);
}

const STATES = [
  {
    id: "idle", label: "Idle", duration: 2.4, morph: 0.45,
    blinkIn: false, baseFace: true, baseBody: true,
    pose: () => baseState(),
  },

  {
    id: "thinking", label: "Thinking", duration: 2.6, morph: 0.4,
    blinkIn: true, baseFace: false, baseBody: false,
    pose: (t) => {
      const mid = dotPulse(t, 1);
      /* The side dots come out of the ball's flanks: in the reference they
         stay fused with it for a frame or two before separating. */
      const emerge = 0.3 + 0.7 * EASE.outCubic(clamp(t / 0.3));
      return baseState({
        // the ball BECOMES the middle dot, so the morph stays continuous
        sil: circleSil(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1] }),
        eyeAlpha: 0,
        dots: [0, 2].map((i) => {
          const k = dotPulse(t, i);
          return {
            x: DOT_X[i] * emerge, y: 0,
            r: DOT_R * (1 + (DOT_PEAK - 1) * k),
            opacity: 0.55 + 0.45 * k,
          };
        }),
      });
    },
  },

  {
    id: "wink", label: "Wink", duration: 1.6, morph: 0.3,
    blinkIn: true, baseFace: false, baseBody: true,
    pose: () => baseState({
      gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 },
      split: 16.25,
      /* The shut eye is not the open one squashed: it is a horizontal dash
         WIDER than the open eye — 0.447 against 0.236. */
      eyes: [eye(0.236, 0.464), eye(0.447, 0.089)],
    }),
  },

  {
    id: "wide", label: "Wide eyes", duration: 1.8, morph: 0.55,
    blinkIn: true, baseFace: false, baseBody: true,
    pose: () => baseState({
      gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
      split: 18.43, eyes: pair(0.356, 0.875),
    }),
  },

  {
    big: true, id: "alert", label: "Alert", duration: 2.4, minDuration: 2, morph: 0.45,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: (t) => {
      // Measured travel: -0.087 to +0.732 in 1.5s, ease-in-out, micro-overshoot.
      const travel = EASE.inOutCubic(clamp(t / 1.5)) * 0.82 - 0.087;
      const back = t > 1.6 ? clamp((t - 1.6) / 0.4) : 0;
      const x = travel * (1 - back) + 0.1 * back;
      // 2.5Hz secondary buzz, bar and dot in antiphase.
      const buzz = Math.sin(t * 2.5 * TAU) * 0.005;
      const tilt = (17.7 * Math.PI) / 180;
      return baseState({
        sil: barItalic({ rot: tilt, cx: x, cy: -0.325 - buzz }),
        eyeAlpha: 0,
        dots: [{
          x: x - Math.sin(tilt) * 0.58,
          y: -0.325 + Math.cos(tilt) * 0.58 + buzz * 2.8,
          r: 0.118, d: TEAR, rot: (tilt * 180) / Math.PI, opacity: 1,
        }],
      });
    },
  },

  {
    id: "notify", label: "Notification", duration: 2.2, morph: 0.5,
    blinkIn: true, baseFace: false, baseBody: true,
    pose: (t) => {
      // Pop: peaks 14% over at ~0.3s, then settles.
      const p = clamp(t / 0.45);
      const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35);
      const r = NOTIF_R * (p < 1 ? pop : 1);
      const a = (NOTIF_ANGLE * Math.PI) / 180;
      return baseState({
        // it looks away from the pip, not at it
        gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
        split: 18.89, eyes: pair(0.505, 0.498),
        notif: { x: Math.cos(a) * NOTIF_DIST, y: Math.sin(a) * NOTIF_DIST, r, notch: r + NOTIF_MARGIN },
      });
    },
  },

  {
    id: "exclaim", label: "Exclamation", duration: 2, morph: 0.45,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: () => baseState({
      sil: barUpright(), eyeAlpha: 0,
      dots: [{ x: -0.012, y: 0.526, r: 0.113, opacity: 1 }],
    }),
  },

  {
    id: "sleep", label: "Sleep", duration: 2.4, morph: 0.5,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: (t) => baseState({
      // Measured bounce: +-0.19 about +0.11, period 0.6s.
      sil: circleSil(0.1585, { cy: 0.11 + Math.sin(t * (TAU / 0.6)) * 0.19 }),
      eyeAlpha: 0,
    }),
  },

  {
    id: "egg", label: "Egg", duration: 1.8, morph: 0.4,
    blinkIn: true, baseFace: false, baseBody: false,
    pose: () => baseState({
      sil: poseSil(EGG_PROFILE),
      gaze: { yaw: 19.97, pitch: 26.01, roll: -17.1 },
      split: 11.07, eyes: pair(0.164, 0.385),   // the eyes narrow with the body
    }),
  },

  {
    id: "hexagon", label: "Hexagon", duration: 1.6, morph: 0.4,
    blinkIn: true, baseFace: false, baseBody: false,
    pose: () => baseState({
      sil: poseSil(HEXAGON),
      gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 },
      split: 13.37, eyes: pair(0.177, 0.411),
    }),
  },

  {
    big: true, id: "play", label: "Play", duration: 2, morph: 0.5,
    blinkIn: true, baseFace: false, baseBody: false,
    pose: (t) => {
      // The triangle holds nearly still while the bouquet crosses it.
      const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5);
      return baseState({
        sil: spinningTriangle(0),
        gaze: { yaw: 12, pitch: -8, roll: -6 },
        split: 15, eyes: pair(0.18, 0.34),
        arcs: SWOOSH.map((s, i) => ({
          id: `sw${i}`, seed: { ...s, cx: 0.45 - t * 0.42 }, t, opacity: fade,
        })),
      });
    },
  },

  {
    big: true, id: "orbit", label: "Orbit", duration: 3.4, minDuration: 2.5, morph: 0.6,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: (t) => {
      // Measured rotation: 0.35s ramp, then 1.25 turns a second, anticlockwise.
      const ramp = EASE.inOutCubic(clamp(t / 0.35));
      const rot = -TAU * 1.25 * t * ramp;
      // The body relaxes out of the triangle and back to the ball mid-orbit.
      const back = EASE.inOutCubic(clamp((t - 1.6) / 0.9));
      const tri = spinningTriangle(rot);
      const ball = circleSil(1, { rot });
      const sil = {
        radii: tri.radii.map((r, i) => r + (ball.radii[i] - r) * back),
        rot, cx: tri.cx * (1 - back), cy: tri.cy * (1 - back), sx: 1, sy: 1,
      };
      const fade = clamp(t / 0.8) * clamp((3.6 - t) / 0.9);
      return baseState({
        sil,
        // the eyes race round the sphere about 3x faster than the silhouette
        gaze: {
          yaw: REST_GAZE.yaw + Math.sin(t * 6.5) * 65 * (1 - back),
          pitch: -4 + back * 32, roll: -13,
        },
        eyes: pair(0.18, 0.34 + back * 0.07),
        arcs: RINGS.map((s, i) => ({
          id: `rg${i}`, seed: s, t, opacity: fade * clamp((t - i * 0.13) / 0.3),
        })),
      });
    },
  },

  {
    big: true, id: "burst", label: "Burst", duration: 2.6, minDuration: 2.4, morph: 0.4,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: (t) => {
      // Measured collapse: 1.0 to 0.166 in 0.7s, ease-out, no bounce.
      const collapse = 1 - 0.834 * EASE.outQuint(clamp(t / 0.7));
      const regrow = EASE.outQuint(clamp((t - 1.7) / 0.7));
      return baseState({
        sil: circleSil(collapse + (1 - collapse) * regrow),
        eyeAlpha: clamp((t - 1.85) / 0.4),
        dots: particles(t, 1), dotsBehind: true,
      });
    },
  },

  {
    big: true, id: "comet", label: "Comet", duration: 2.4, minDuration: 2.4, morph: 0.45,
    blinkIn: false, baseFace: false, baseBody: false,
    pose: (t) => {
      const collapse = 1 - (1 - COMET_DOT) * EASE.outQuint(clamp(t / 0.55));
      const regrow = EASE.outQuint(clamp((t - 1.85) / 0.6));
      const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3);
      return baseState({
        // the dot drifts 0.035 down and back up again (measured wobble)
        sil: circleSil(collapse + (1 - collapse) * regrow, {
          cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035,
        }),
        eyeAlpha: clamp((t - 2) / 0.35),
        arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade })),
      });
    },
  },
];

const STATE_BY_ID = Object.fromEntries(STATES.map((s) => [s.id, s]));
/* Reading order of the full sequence, as cut in the reference video. */
const SEQUENCE = STATES.map((s) => s.id);
